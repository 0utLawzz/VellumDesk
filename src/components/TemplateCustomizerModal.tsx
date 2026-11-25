import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  DocumentCategory,
  DocumentTemplate,
  TemplateSectionSpec,
  TemplateTone,
} from '../types/document';
import { makeSafeId } from '../lib/documentService';

interface TemplateCustomizerModalProps {
  initialTemplate?: DocumentTemplate | null;
  ownerId: string;
  isAuthenticated: boolean;
  onSave: (template: DocumentTemplate) => Promise<void>;
  onClose: () => void;
}

export const TemplateCustomizerModal: React.FC<TemplateCustomizerModalProps> = ({
  initialTemplate,
  ownerId,
  isAuthenticated,
  onSave,
  onClose,
}) => {
  const isEditingCustom = Boolean(initialTemplate && !initialTemplate.isBuiltIn);
  const [name, setName] = useState(
    initialTemplate
      ? isEditingCustom
        ? initialTemplate.name
        : `${initialTemplate.name} (Custom)`
      : 'Custom Commercial Blueprint'
  );
  const [category, setCategory] = useState<DocumentCategory>(
    initialTemplate?.category || 'contract'
  );
  const [tone, setTone] = useState<TemplateTone>(initialTemplate?.tone || 'formal_legal');
  const [jurisdiction, setJurisdiction] = useState(
    initialTemplate?.jurisdiction || 'State of Delaware, United States'
  );
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [variablesText, setVariablesText] = useState(
    (initialTemplate?.variables || ['Client_Name', 'Effective_Date']).join(', ')
  );
  const [sections, setSections] = useState<TemplateSectionSpec[]>(
    initialTemplate?.sections?.length
      ? initialTemplate.sections.map((s) => ({ ...s }))
      : [
          {
            id: makeSafeId('tsec'),
            title: '1. Executive Scope & Definitions',
            guidance: 'Outline core scope, parties, and key defined terms.',
          },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSection = () => {
    if (sections.length >= 20) return;
    setSections((prev) => [
      ...prev,
      {
        id: makeSafeId('tsec'),
        title: `${prev.length + 1}. New Section`,
        guidance: '',
      },
    ]);
  };

  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSectionChange = (id: string, field: 'title' | 'guidance', value: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const variables = variablesText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 20);

      await onSave({
        id: isEditingCustom && initialTemplate ? initialTemplate.id : makeSafeId('tpl'),
        ownerId,
        isBuiltIn: false,
        name: name.trim(),
        category,
        description: description.trim(),
        tone,
        jurisdiction: jurisdiction.trim(),
        sections: sections.map((s, idx) => ({
          id: s.id || makeSafeId(`tsec_${idx + 1}`),
          title: s.title.trim() || `Section ${idx + 1}`,
          guidance: s.guidance.trim(),
        })),
        variables,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save custom template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1a2e2a]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#fdfaf3] border-[1.5px] border-[#1a2e2a] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[8px_8px_0_#1a2e2a]">
        <div className="flex items-center justify-between px-6 py-4 border-b-[1.5px] border-[#1a2e2a] bg-white/70 rounded-t-xl">
          <div>
            <p className="mono-label">Blueprint Editor</p>
            <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-[#1a2e2a]">
              {isEditingCustom ? 'Edit Custom Template' : 'Customize Document Template'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template customizer"
            className="p-2 text-[#1a2e2a] hover:bg-[#1a2e2a] hover:text-[#fdfaf3] rounded-md border border-[#1a2e2a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isAuthenticated && (
            <div className="border-[1.5px] border-[#1a2e2a] bg-white rounded-md p-3 text-xs text-[#1a2e2a]">
              <span className="font-mono uppercase font-bold text-[#d44c3c] mr-2">Local Mode:</span>
              Sign in with Google to persist custom templates to your cloud workspace.
            </div>
          )}

          {error && (
            <div className="border-[1.5px] border-[#d44c3c] bg-white rounded-md p-3 text-xs text-[#d44c3c] font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mono-label mb-1.5">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={140}
                required
                className="w-full px-3 py-2 text-sm bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none focus:ring-2 focus:ring-[#d44c3c]/30"
              />
            </div>

            <div>
              <label className="block mono-label mb-1.5">Document Category</label>
              <div className="flex items-center gap-1 p-1 bg-white border-[1.5px] border-[#1a2e2a] rounded">
                <button
                  type="button"
                  onClick={() => setCategory('contract')}
                  className={`flex-1 py-1.5 text-xs font-mono uppercase font-bold rounded-sm transition-colors whitespace-nowrap ${
                    category === 'contract'
                      ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                      : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                  }`}
                >
                  Legal Contract
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('report')}
                  className={`flex-1 py-1.5 text-xs font-mono uppercase font-bold rounded-sm transition-colors whitespace-nowrap ${
                    category === 'report'
                      ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                      : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                  }`}
                >
                  Business Report
                </button>
              </div>
            </div>

            <div>
              <label className="block mono-label mb-1.5">Default Drafting Tone</label>
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

            <div>
              <label className="block mono-label mb-1.5">
                {category === 'contract' ? 'Governing Jurisdiction' : 'Target Audience'}
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                maxLength={120}
                className="w-full px-3 py-2 text-sm bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block mono-label mb-1.5">Template Purpose & Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              placeholder="Summarize when teams should use this template..."
              className="w-full px-3 py-2 text-sm bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
            />
          </div>

          <div>
            <label className="block mono-label mb-1.5">Custom Variables (comma-separated)</label>
            <input
              type="text"
              value={variablesText}
              onChange={(e) => setVariablesText(e.target.value)}
              placeholder="Client_Entity, Effective_Date, Contract_Value"
              className="w-full px-3 py-2 text-xs font-mono bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="mono-label">
                Section Blueprint ({sections.length}/20)
              </label>
              <button
                type="button"
                onClick={handleAddSection}
                disabled={sections.length >= 20}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Section
              </button>
            </div>

            <div className="space-y-3">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="border-[1.5px] border-[#1a2e2a] rounded-md p-3.5 bg-white space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#d44c3c] tabular-nums w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => handleSectionChange(sec.id, 'title', e.target.value)}
                      maxLength={140}
                      placeholder="Section heading"
                      className="flex-1 px-2.5 py-1.5 text-sm font-semibold bg-[#fdfaf3] border border-[#1a2e2a]/40 rounded focus:outline-none focus:border-[#1a2e2a]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(sec.id)}
                      disabled={sections.length <= 1}
                      aria-label="Remove section"
                      className="p-1.5 text-[#1a2e2a]/60 hover:text-[#d44c3c] disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sec.guidance}
                    onChange={(e) => handleSectionChange(sec.id, 'guidance', e.target.value)}
                    maxLength={400}
                    placeholder="AI drafting guidance for this clause or section..."
                    className="w-full px-2.5 py-1.5 text-xs bg-[#fdfaf3] border border-[#1a2e2a]/30 rounded text-[#1a2e2a] focus:outline-none focus:border-[#1a2e2a]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-[1.5px] border-[#1a2e2a]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-cta px-5 py-2 text-xs rounded disabled:opacity-60"
            >
              {saving ? 'Saving Template...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
