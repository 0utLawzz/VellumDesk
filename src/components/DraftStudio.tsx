import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCheck2,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type {
  DocumentCategory,
  DocumentMetadata,
  DocumentSection,
  DocumentTemplate,
  DocumentVisibility,
  StorageTier,
  TemplateTone,
} from '../types/document';
import { makeSafeId } from '../lib/documentService';

interface DraftStudioProps {
  templates: DocumentTemplate[];
  defaultStorageTier: StorageTier;
  isAuthenticated: boolean;
  onCustomizeTemplate: (template: DocumentTemplate | null) => void;
  onDeleteCustomTemplate: (templateId: string) => void;
  onDraftGenerated: (payload: {
    title: string;
    category: DocumentCategory;
    template: DocumentTemplate;
    visibility: DocumentVisibility;
    storageTier: StorageTier;
    metadata: DocumentMetadata;
    sections: DocumentSection[];
    changeSummary: string;
  }) => Promise<void>;
}

export const DraftStudio: React.FC<DraftStudioProps> = ({
  templates,
  defaultStorageTier,
  isAuthenticated,
  onCustomizeTemplate,
  onDeleteCustomTemplate,
  onDraftGenerated,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || 'tpl_msa_enterprise'
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  const [title, setTitle] = useState('');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-12-01');
  const [jurisdiction, setJurisdiction] = useState(
    selectedTemplate?.jurisdiction || 'State of Delaware, United States'
  );
  const [contractValue, setContractValue] = useState('');
  const [tone, setTone] = useState<TemplateTone>(selectedTemplate?.tone || 'formal_legal');
  const [visibility, setVisibility] = useState<DocumentVisibility>('private');
  const [storageTier, setStorageTier] = useState<StorageTier>(defaultStorageTier);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!generating) {
      return;
    }
    const timer = window.setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 86) return prev;
        const step = prev < 35 ? 6 : prev < 65 ? 4 : 2;
        const next = Math.min(86, prev + step);
        if (next < 32) {
          setGenerationStage('Preparing template blueprint & metadata...');
        } else if (next < 68) {
          setGenerationStage('AI drafting structured sections & clauses...');
        } else {
          setGenerationStage('Validating section formatting & summary...');
        }
        return next;
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [generating]);

  const handleSelectTemplate = (tpl: DocumentTemplate) => {
    setSelectedTemplateId(tpl.id);
    setJurisdiction(tpl.jurisdiction);
    setTone(tpl.tone);
  };

  const loadSampleContract = () => {
    const msa = templates.find((t) => t.id === 'tpl_msa_enterprise') || templates[0];
    if (msa) handleSelectTemplate(msa);
    setCategoryFilter('contract');
    setTitle('Master Services Agreement — Northstar Analytics & Meridian Systems');
    setPartyA('Northstar Analytics, Inc.');
    setPartyB('Meridian Cloud Systems LLC');
    setEffectiveDate('2026-12-01');
    setJurisdiction('State of Delaware, United States');
    setContractValue('$180,000 Annual Retainer (Net-30)');
    setBrief(
      'Engage Meridian Cloud Systems to architect and migrate Northstar Analytics enterprise data warehouse and compliance reporting pipelines over a 12-month term. Include 99.95% uptime SLA, full client IP assignment upon payment, SOC 2 Type II security controls, mutual confidentiality surviving 5 years, and a 12-month fees liability cap.'
    );
  };

  const loadSampleReport = () => {
    const qbr = templates.find((t) => t.id === 'tpl_qbr_board') || templates[0];
    if (qbr) handleSelectTemplate(qbr);
    setCategoryFilter('report');
    setTitle('Q4 2026 Board Performance & Strategic Outlook Report');
    setPartyA('Vanguard Industrial Software');
    setPartyB('Board of Directors & Audit Committee');
    setEffectiveDate('2026-11-25');
    setJurisdiction('Board of Directors');
    setContractValue('$24.8M ARR (+34% YoY) · 118% Net Dollar Retention');
    setBrief(
      'Summarize Q4 performance showing $24.8M ARR (+34% YoY), 78% gross margin, 118% NRR, and 26 months cash runway. Highlight European DACH enterprise launch ahead of schedule, slight sales cycle elongation in mid-market (+11 days), and request Board approval for Q1 R&D headcount expansion of 8 engineers.'
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setGenerating(true);
    setGenerationProgress(12);
    setGenerationStage('Preparing template blueprint & metadata...');
    setError(null);

    try {
      const metadata: DocumentMetadata = {
        partyA: partyA.trim() || undefined,
        partyB: partyB.trim() || undefined,
        effectiveDate: effectiveDate.trim() || undefined,
        jurisdiction: jurisdiction.trim() || undefined,
        contractValue: contractValue.trim() || undefined,
        tone,
      };

      const res = await fetch('/api/documents/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: selectedTemplate.category,
          templateName: selectedTemplate.name,
          tone,
          jurisdiction,
          brief: brief.trim(),
          metadata,
          sections: selectedTemplate.sections,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate document draft.');
      }

      setGenerationProgress(90);
      setGenerationStage('Saving v1.0 draft & opening editor...');

      const generatedSections: DocumentSection[] = (data.sections || []).map(
        (s: { heading: string; body: string }, idx: number) => ({
          id: makeSafeId(`sec_${idx + 1}`),
          heading: s.heading || `Section ${idx + 1}`,
          body: s.body || '',
          order: idx + 1,
        })
      );

      setGenerationProgress(100);
      await onDraftGenerated({
        title: data.title || title.trim() || selectedTemplate.name,
        category: selectedTemplate.category,
        template: selectedTemplate,
        visibility,
        storageTier,
        metadata,
        sections: generatedSections,
        changeSummary:
          data.changeSummary || `Initial AI draft generated from ${selectedTemplate.name}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate document.');
      setGenerationProgress(0);
      setGenerationStage('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 sm:p-8 overflow-y-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b-[1.5px] border-[#1a2e2a]">
        <div>
          <span className="mono-label block">Automated Document Generator</span>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl uppercase tracking-tight text-[#1a2e2a] mt-2">
            <span className="font-script text-[#d44c3c] text-3xl normal-case font-normal block -mb-2">
              Drafting
            </span>
            Template & AI Studio
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadSampleContract}
            className="btn-secondary px-3 py-1.5 text-[11px] rounded-sm whitespace-nowrap"
          >
            Sample MSA
          </button>
          <button
            type="button"
            onClick={loadSampleReport}
            className="btn-secondary px-3 py-1.5 text-[11px] rounded-sm whitespace-nowrap"
          >
            Sample Report
          </button>
          <button
            type="button"
            onClick={() => onCustomizeTemplate(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase font-bold text-[#fdfaf3] bg-[#1a2e2a] border-[1.5px] border-[#1a2e2a] rounded-sm hover:bg-[#d44c3c] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Template Picker */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#1a2e2a] rounded-md">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'contract', label: 'Contracts' },
                  { id: 'report', label: 'Reports' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCategoryFilter(t.id)}
                  className={`px-2.5 py-1 text-[11px] font-mono uppercase font-bold rounded-sm transition-colors whitespace-nowrap ${
                    categoryFilter === t.id
                      ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                      : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] text-[#1a2e2a]/60 tabular-nums">
              {filteredTemplates.length} blueprints
            </span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredTemplates.map((tpl) => {
              const active = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-3.5 rounded-lg border-[1.5px] transition-all cursor-pointer ${
                    active
                      ? 'bg-white border-[#1a2e2a] shadow-[3px_3px_0_#d44c3c]'
                      : 'bg-white/75 border-[#1a2e2a]/40 hover:border-[#1a2e2a]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#1a2e2a]/60 mb-1">
                        {tpl.category === 'contract' ? 'Contract' : 'Report'}
                        {' · '}
                        {tpl.isBuiltIn ? 'Standard' : 'Custom'}
                        {' · '}
                        {tpl.sections.length} sections
                      </p>
                      <h3 className="font-semibold text-sm text-[#1a2e2a]">{tpl.name}</h3>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onCustomizeTemplate(tpl)}
                        title="Customize template"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase font-bold text-[#1a2e2a] border border-[#1a2e2a]/30 hover:border-[#1a2e2a] hover:bg-[#fdfaf3] rounded-sm transition-colors"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Edit
                      </button>
                      {!tpl.isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomTemplate(tpl.id)}
                          aria-label={`Delete ${tpl.name}`}
                          className="p-1 text-[#1a2e2a]/50 hover:text-[#d44c3c] rounded-sm transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#1a2e2a]/70 mt-1.5 leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Parameters & AI Brief */}
        <form
          onSubmit={handleGenerate}
          className="xl:col-span-7 bg-white border-[1.5px] border-[#1a2e2a] rounded-lg p-5 sm:p-6 space-y-5"
        >
          <div className="pb-4 border-b border-[#1a2e2a]/20 flex items-start justify-between gap-4">
            <div>
              <span className="mono-label block">Selected Blueprint</span>
              <h2 className="font-display font-bold text-lg text-[#1a2e2a] mt-0.5">
                {selectedTemplate?.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => selectedTemplate && onCustomizeTemplate(selectedTemplate)}
              className="font-mono text-[11px] uppercase font-bold text-[#d44c3c] hover:underline whitespace-nowrap"
            >
              Edit Sections
            </button>
          </div>

          {error && (
            <div className="border-[1.5px] border-[#d44c3c] bg-[#fdfaf3] rounded p-3 text-xs text-[#d44c3c] font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block mono-label mb-1.5">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={`Leave blank to auto-title from ${selectedTemplate?.name || 'template'}`}
                className="w-full px-3 py-2 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">
                {selectedTemplate?.category === 'contract'
                  ? 'First Party / Client'
                  : 'Organization / Unit'}
              </label>
              <input
                type="text"
                value={partyA}
                onChange={(e) => setPartyA(e.target.value)}
                placeholder="e.g. Acme Holdings Inc."
                className="w-full px-3 py-2 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">
                {selectedTemplate?.category === 'contract'
                  ? 'Counterparty / Vendor'
                  : 'Sponsor / Audience'}
              </label>
              <input
                type="text"
                value={partyB}
                onChange={(e) => setPartyB(e.target.value)}
                placeholder={
                  selectedTemplate?.category === 'contract'
                    ? 'e.g. Northstar Solutions LLC'
                    : 'e.g. Board Audit Committee'
                }
                className="w-full px-3 py-2 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">
                {selectedTemplate?.category === 'contract' ? 'Effective Date' : 'Report Date'}
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">
                {selectedTemplate?.category === 'contract'
                  ? 'Contract Value'
                  : 'Headline Metrics'}
              </label>
              <input
                type="text"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder={
                  selectedTemplate?.category === 'contract'
                    ? 'e.g. $120,000 / year, Net-30'
                    : 'e.g. $18.4M ARR, 76% Margin'
                }
                className="w-full px-3 py-2 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">
                {selectedTemplate?.category === 'contract' ? 'Governing Law' : 'Report Scope'}
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">Drafting Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as TemplateTone)}
                className="w-full px-3 py-2 text-sm border-[1.5px] border-[#1a2e2a] rounded bg-white focus:outline-none"
              >
                <option value="formal_legal">Formal Legal</option>
                <option value="commercial_balanced">Commercial Balanced</option>
                <option value="executive_concise">Executive Concise</option>
                <option value="boardroom_analytical">Boardroom Analytical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block mono-label mb-1.5">
              Drafting Brief & Key Clauses / Findings
            </label>
            <textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe specific terms, deliverables, liability caps, financial figures, or strategic recommendations to incorporate..."
              className="w-full px-3 py-2.5 text-sm bg-[#fdfaf3]/50 border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:bg-white"
            />
          </div>

          <div className="pt-3 border-t border-[#1a2e2a]/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mono-label mb-1.5">Cloud Storage Option</label>
              <select
                value={storageTier}
                onChange={(e) => setStorageTier(e.target.value as StorageTier)}
                className="w-full px-3 py-2 text-xs font-mono border-[1.5px] border-[#1a2e2a] rounded bg-white focus:outline-none"
              >
                <option value="standard_cloud">Standard Cloud Sync</option>
                <option value="vault_restricted">Restricted Private Vault</option>
              </select>
            </div>

            <div>
              <label className="block mono-label mb-1.5">Initial Access</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
                className="w-full px-3 py-2 text-xs font-mono border-[1.5px] border-[#1a2e2a] rounded bg-white focus:outline-none"
              >
                <option value="private">Private (Owner Only)</option>
                <option value="shared">Team Shared Workspace</option>
              </select>
            </div>
          </div>

          {generating && (
            <div
              className="p-4 bg-[#fdfaf3] border-[1.5px] border-[#1a2e2a] rounded-md space-y-2.5"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase font-bold text-[#1a2e2a] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d44c3c]" />
                  {generationStage || 'Generating draft...'}
                </span>
                <span className="font-mono text-xs font-bold text-[#d44c3c] tabular-nums">
                  {generationProgress}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="AI document generation progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={generationProgress}
                className="w-full h-3 bg-white border border-[#1a2e2a] rounded-sm overflow-hidden"
              >
                <div
                  className="h-full bg-[#d44c3c] transition-all duration-300 ease-out"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                <span>{selectedTemplate?.sections.length || 0} sections</span>
                <span>{tone.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-[#1a2e2a]/65">
              {isAuthenticated
                ? 'Saves to Cloud Firestore with v1.0 snapshot.'
                : 'Creates an interactive local draft. Sign in to sync to cloud.'}
            </p>
            <button
              type="submit"
              disabled={generating}
              className="btn-cta inline-flex items-center justify-center gap-2 px-5 py-3 text-xs rounded-sm disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Drafting ({generationProgress}%)
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  Generate Draft
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
