import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  CollaboratorPresence,
  DocumentAuditResult,
  DocumentSection,
  DocumentStatus,
  ManagedDocument,
} from '../types/document';
import { countWords, makeSafeId } from '../lib/documentService';
import {
  exportDocumentToDocx,
  exportDocumentToMarkdown,
  exportDocumentToPdf,
} from '../lib/exportUtils';

interface DocumentEditorProps {
  document: ManagedDocument;
  currentUserId: string;
  isAuthenticated: boolean;
  syncStatus: { fromCache: boolean; hasPendingWrites: boolean };
  collaborators: CollaboratorPresence[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string | null, isTyping?: boolean) => void;
  onRemotePatchBind: (
    handler: (patch: {
      sectionId?: string;
      heading?: string;
      body?: string;
      title?: string;
    }) => void
  ) => void;
  emitSectionPatch: (patch: {
    sectionId?: string;
    heading?: string;
    body?: string;
    title?: string;
  }) => void;
  onSectionsSnapshotChange: (sections: DocumentSection[], title: string, status: DocumentStatus) => void;
  onBack: () => void;
  onSaveDocument: (params: {
    nextTitle: string;
    nextSections: DocumentSection[];
    nextStatus?: DocumentStatus;
    createSnapshot?: boolean;
    snapshotLabel?: string;
    changeSummary?: string;
  }) => Promise<void>;
  onAuditResult: (result: DocumentAuditResult) => void;
  onSwitchToAuditTab: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document: initialDoc,
  currentUserId,
  isAuthenticated,
  syncStatus,
  collaborators,
  activeSectionId,
  onSelectSection,
  onRemotePatchBind,
  emitSectionPatch,
  onSectionsSnapshotChange,
  onBack,
  onSaveDocument,
  onAuditResult,
  onSwitchToAuditTab,
}) => {
  const [title, setTitle] = useState(initialDoc.title);
  const [sections, setSections] = useState<DocumentSection[]>(initialDoc.sections);
  const [status, setStatus] = useState<DocumentStatus>(initialDoc.status);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  const [refiningSectionId, setRefiningSectionId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);

  const isOwner = !isAuthenticated || initialDoc.ownerId === currentUserId;
  const isLocked = !isOwner && (status === 'approved' || status === 'archived');

  useEffect(() => {
    onSectionsSnapshotChange(sections, title, status);
  }, [sections, title, status, onSectionsSnapshotChange]);

  useEffect(() => {
    onRemotePatchBind((patch) => {
      if (patch.title !== undefined) {
        setTitle(patch.title);
      }
      if (patch.sectionId) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === patch.sectionId
              ? {
                  ...s,
                  heading: patch.heading !== undefined ? patch.heading : s.heading,
                  body: patch.body !== undefined ? patch.body : s.body,
                }
              : s
          )
        );
      }
    });
  }, [onRemotePatchBind]);

  const lastDocUpdatedRef = useRef<unknown>(initialDoc.updatedAt);
  useEffect(() => {
    if (initialDoc.updatedAt !== lastDocUpdatedRef.current && !dirty) {
      lastDocUpdatedRef.current = initialDoc.updatedAt;
      setTitle(initialDoc.title);
      setSections(initialDoc.sections);
      setStatus(initialDoc.status);
    }
  }, [initialDoc, dirty]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setDirty(true);
    emitSectionPatch({ title: val });
  };

  const handleSectionChange = (
    sectionId: string,
    field: 'heading' | 'body',
    value: string
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, [field]: value } : s))
    );
    setDirty(true);
    onSelectSection(sectionId, true);
    emitSectionPatch({
      sectionId,
      [field]: value,
    });
  };

  const handleAddSection = () => {
    if (sections.length >= 30) return;
    const newSec: DocumentSection = {
      id: makeSafeId(`sec_${sections.length + 1}`),
      heading: `${sections.length + 1}. Additional Clause`,
      body: '',
      order: sections.length + 1,
    };
    setSections((prev) => [...prev, newSec]);
    onSelectSection(newSec.id, false);
    setDirty(true);
  };

  const handleRemoveSection = (sectionId: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setDirty(true);
  };

  const handleSave = async (createSnapshot = false, snapshotLabel?: string) => {
    setSaving(true);
    try {
      await onSaveDocument({
        nextTitle: title,
        nextSections: sections,
        nextStatus: status,
        createSnapshot,
        snapshotLabel,
        changeSummary: createSnapshot
          ? `Saved revision snapshot (${countWords(sections)} words).`
          : 'Saved working draft.',
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRefineSection = async (section: DocumentSection, customInstruction?: string) => {
    const instr = (customInstruction ?? refineInstruction).trim();
    if (!instr) return;
    setRefineLoading(true);
    setRefineError(null);
    try {
      const res = await fetch('/api/documents/refine-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: title,
          category: initialDoc.category,
          tone: initialDoc.metadata?.tone || 'formal_legal',
          sectionHeading: section.heading,
          sectionBody: section.body,
          instruction: instr,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to refine section.');
      }
      const nextSections = sections.map((s) =>
        s.id === section.id
          ? { ...s, heading: data.heading || s.heading, body: data.body || s.body }
          : s
      );
      setSections(nextSections);
      emitSectionPatch({
        sectionId: section.id,
        heading: data.heading || section.heading,
        body: data.body || section.body,
      });
      setRefiningSectionId(null);
      setRefineInstruction('');
      await onSaveDocument({
        nextTitle: title,
        nextSections,
        nextStatus: status,
        createSnapshot: true,
        snapshotLabel: `AI Refinement: ${section.heading.slice(0, 60)}`,
        changeSummary: data.changeSummary || `Refined "${section.heading}" via AI editor.`,
      });
      setDirty(false);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'Failed to refine section.');
    } finally {
      setRefineLoading(false);
    }
  };

  const handleRunAudit = async () => {
    setAuditing(true);
    onSwitchToAuditTab();
    try {
      const res = await fetch('/api/documents/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: title,
          category: initialDoc.category,
          jurisdiction: initialDoc.metadata?.jurisdiction || 'General',
          sections: sections.map((s) => ({ heading: s.heading, body: s.body })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Audit request failed.');
      }
      onAuditResult(data as DocumentAuditResult);
    } finally {
      setAuditing(false);
    }
  };

  const liveDocumentSnapshot: ManagedDocument = {
    ...initialDoc,
    title,
    sections,
    status,
    wordCount: countWords(sections),
  };

  const handleDocxExport = async () => {
    setExportingDocx(true);
    try {
      await exportDocumentToDocx(liveDocumentSnapshot);
    } finally {
      setExportingDocx(false);
      setExportMenuOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div className="no-print bg-white/80 border-b-[1.5px] border-[#1a2e2a] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-sm whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Archive
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#1a2e2a] truncate max-w-[200px] sm:max-w-sm">
              {title}
            </p>
            <p className="text-[10px] font-mono text-[#1a2e2a]/60 tabular-nums">
              v{initialDoc.currentVersion}.0 · {countWords(sections).toLocaleString()} words ·{' '}
              {!isAuthenticated
                ? 'Local Draft'
                : syncStatus.hasPendingWrites
                  ? 'Syncing...'
                  : dirty
                    ? 'Unsaved edits'
                    : 'Cloud Synced'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            disabled={isLocked}
            onChange={(e) => {
              const next = e.target.value as DocumentStatus;
              setStatus(next);
              setDirty(true);
            }}
            aria-label="Document status"
            className="px-2.5 py-1.5 text-[11px] font-mono uppercase font-bold border-[1.5px] border-[#1a2e2a] rounded-sm bg-white text-[#1a2e2a] focus:outline-none"
          >
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            {isOwner && <option value="approved">Approved</option>}
            {isOwner && <option value="archived">Archived</option>}
          </select>

          <button
            type="button"
            onClick={handleRunAudit}
            disabled={auditing}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-sm whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#d44c3c]" />
            {auditing ? 'Auditing...' : 'AI Audit'}
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || isLocked}
            className="btn-cta inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] rounded-sm whitespace-nowrap disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-sm whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white border-[1.5px] border-[#1a2e2a] rounded-md shadow-[4px_4px_0_#1a2e2a] py-1.5 z-30">
                <button
                  type="button"
                  onClick={() => {
                    exportDocumentToPdf(liveDocumentSnapshot);
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#1a2e2a] hover:bg-[#fdfaf3] flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] font-bold">PDF (.pdf)</span>
                  <FileText className="w-3.5 h-3.5 text-[#d44c3c]" />
                </button>
                <button
                  type="button"
                  disabled={exportingDocx}
                  onClick={handleDocxExport}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#1a2e2a] hover:bg-[#fdfaf3] flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] font-bold">
                    {exportingDocx ? 'Building...' : 'Word (.docx)'}
                  </span>
                  <FileText className="w-3.5 h-3.5 text-[#1a2e2a]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportDocumentToMarkdown(liveDocumentSnapshot);
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#1a2e2a] hover:bg-[#fdfaf3] flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] font-bold">Markdown (.md)</span>
                  <FileText className="w-3.5 h-3.5 text-[#1a2e2a]/60" />
                </button>
                <div className="my-1 border-t border-[#1a2e2a]/15" />
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    window.print();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#1a2e2a] hover:bg-[#fdfaf3] flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] font-bold">Print Layout</span>
                  <Printer className="w-3.5 h-3.5 text-[#1a2e2a]/60" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Document Sheet */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="print-sheet max-w-[780px] mx-auto bg-white border-[1.5px] border-[#1a2e2a] rounded-lg p-7 sm:p-11 space-y-8 shadow-[6px_6px_0_rgba(26,46,42,0.08)]">
          {/* Masthead */}
          <div className="pb-6 border-b-[1.5px] border-[#1a2e2a] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-[#1a2e2a]/60">
              <span>
                {initialDoc.category === 'contract'
                  ? 'Commercial Agreement'
                  : 'Executive Business Report'}
                {' · '}
                {initialDoc.templateName}
                {' · '}
                v{initialDoc.currentVersion}.0
              </span>
              {initialDoc.metadata?.jurisdiction && (
                <span>{initialDoc.metadata.jurisdiction}</span>
              )}
            </div>

            <input
              type="text"
              value={title}
              disabled={isLocked}
              onChange={(e) => handleTitleChange(e.target.value)}
              maxLength={200}
              className="w-full font-display font-extrabold text-2xl sm:text-3xl text-[#1a2e2a] tracking-tight bg-transparent focus:outline-none focus:bg-[#fdfaf3] rounded px-1 -mx-1 py-1"
            />

            {Object.entries(initialDoc.metadata || {}).some(
              ([k, v]) => k !== 'tone' && typeof v === 'string' && v.trim().length > 0
            ) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2 text-xs">
                {initialDoc.metadata?.partyA && (
                  <div className="flex items-baseline justify-between border-b border-[#1a2e2a]/15 py-1">
                    <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                      {initialDoc.category === 'contract' ? 'First Party' : 'Organization'}
                    </span>
                    <span className="font-semibold text-[#1a2e2a]">
                      {initialDoc.metadata.partyA}
                    </span>
                  </div>
                )}
                {initialDoc.metadata?.partyB && (
                  <div className="flex items-baseline justify-between border-b border-[#1a2e2a]/15 py-1">
                    <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                      {initialDoc.category === 'contract' ? 'Counterparty' : 'Audience'}
                    </span>
                    <span className="font-semibold text-[#1a2e2a]">
                      {initialDoc.metadata.partyB}
                    </span>
                  </div>
                )}
                {initialDoc.metadata?.effectiveDate && (
                  <div className="flex items-baseline justify-between border-b border-[#1a2e2a]/15 py-1">
                    <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                      Effective Date
                    </span>
                    <span className="font-mono text-[#1a2e2a] tabular-nums">
                      {initialDoc.metadata.effectiveDate}
                    </span>
                  </div>
                )}
                {initialDoc.metadata?.contractValue && (
                  <div className="flex items-baseline justify-between border-b border-[#1a2e2a]/15 py-1">
                    <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                      {initialDoc.category === 'contract' ? 'Value' : 'Metrics'}
                    </span>
                    <span className="font-semibold text-[#1a2e2a]">
                      {initialDoc.metadata.contractValue}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {isLocked && (
            <div className="no-print border-[1.5px] border-[#d44c3c] bg-[#fdfaf3] rounded p-3 text-xs text-[#1a2e2a]">
              This document is marked {status}. Only the document owner may modify approved or archived documents.
            </div>
          )}

          {/* Sections */}
          <div className="space-y-7">
            {sections.map((section) => {
              const activeEditors = collaborators.filter(
                (c) => c.uid !== currentUserId && c.activeSectionId === section.id
              );
              const isRefining = refiningSectionId === section.id;

              return (
                <div
                  key={section.id}
                  onClick={() => onSelectSection(section.id, false)}
                  className={`group rounded-md transition-colors p-3 -mx-3 ${
                    activeSectionId === section.id
                      ? 'bg-[#fdfaf3] ring-1 ring-[#1a2e2a]'
                      : 'hover:bg-[#fdfaf3]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <input
                      type="text"
                      value={section.heading}
                      disabled={isLocked}
                      onFocus={() => onSelectSection(section.id, false)}
                      onChange={(e) =>
                        handleSectionChange(section.id, 'heading', e.target.value)
                      }
                      maxLength={200}
                      className="flex-1 font-display font-bold text-base sm:text-lg text-[#1a2e2a] bg-transparent focus:outline-none"
                    />

                    <div className="no-print flex items-center gap-1.5 opacity-85 group-hover:opacity-100">
                      {activeEditors.map((ed) => (
                        <span
                          key={ed.clientId}
                          className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm text-white border border-[#1a2e2a]"
                          style={{ backgroundColor: ed.color }}
                        >
                          {ed.name} {ed.isTyping ? 'editing' : 'viewing'}
                        </span>
                      ))}

                      {!isLocked && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefiningSectionId(isRefining ? null : section.id);
                              setRefineError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase font-bold text-[#d44c3c] border border-[#1a2e2a]/25 hover:border-[#1a2e2a] bg-white rounded-sm transition-colors whitespace-nowrap"
                          >
                            <Wand2 className="w-3 h-3" />
                            Refine
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSection(section.id);
                            }}
                            disabled={sections.length <= 1}
                            aria-label="Delete section"
                            className="p-1 text-[#1a2e2a]/45 hover:text-[#d44c3c] rounded-sm disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isRefining && (
                    <div
                      className="no-print mb-3 p-3 bg-white border-[1.5px] border-[#1a2e2a] rounded space-y-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mono-label mr-1">Quick edits:</span>
                        {[
                          'Make language legally stricter',
                          'Simplify for executive clarity',
                          'Add concrete SLA remedies & timelines',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleRefineSection(section, preset)}
                            disabled={refineLoading}
                            className="px-2 py-1 text-[11px] font-medium text-[#1a2e2a] bg-[#fdfaf3] border border-[#1a2e2a]/30 hover:border-[#1a2e2a] rounded-sm transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      {refineError && <p className="text-xs text-[#d44c3c]">{refineError}</p>}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={refineInstruction}
                          onChange={(e) => setRefineInstruction(e.target.value)}
                          placeholder="Instruct AI how to rewrite this section..."
                          className="flex-1 px-3 py-1.5 text-xs bg-[#fdfaf3]/60 border-[1.5px] border-[#1a2e2a] rounded-sm focus:outline-none focus:bg-white"
                        />
                        <button
                          type="button"
                          disabled={refineLoading || !refineInstruction.trim()}
                          onClick={() => handleRefineSection(section)}
                          className="btn-cta px-3 py-1.5 text-[10px] rounded-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          {refineLoading ? 'Refining...' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={section.body}
                    disabled={isLocked}
                    onFocus={() => onSelectSection(section.id, false)}
                    onBlur={() => onSelectSection(section.id, false)}
                    onChange={(e) =>
                      handleSectionChange(section.id, 'body', e.target.value)
                    }
                    rows={Math.max(5, Math.ceil(section.body.length / 86) + 1)}
                    className="w-full text-[15px] leading-[1.7] text-[#1a2e2a]/90 bg-transparent resize-y focus:outline-none"
                  />
                </div>
              );
            })}
          </div>

          {!isLocked && (
            <div className="no-print pt-5 border-t border-[#1a2e2a]/20 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAddSection}
                disabled={sections.length >= 30}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Section
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSave(true, `Checkpoint v${initialDoc.currentVersion + 1}`)
                }
                disabled={saving}
                className="font-mono text-[11px] uppercase font-bold text-[#d44c3c] hover:underline"
              >
                Save & Commit Version
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
