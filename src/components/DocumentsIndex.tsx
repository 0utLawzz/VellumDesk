import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Lock,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ManagedDocument } from '../types/document';
import { fuzzyFilterDocuments } from '../lib/fuzzySearch';

interface DocumentsIndexProps {
  documents: ManagedDocument[];
  sharedDocuments: ManagedDocument[];
  loading: boolean;
  isAuthenticated: boolean;
  searchOpen: boolean;
  searchFocusTick: number;
  onToggleSearch: (nextOpen?: boolean) => void;
  onOpenDocument: (doc: ManagedDocument) => void;
  onCreateNew: () => void;
  onDeleteDocument: (docId: string) => void;
}

type FilterTab = 'all' | 'contract' | 'report' | 'shared';

function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  try {
    if (
      typeof ts === 'object' &&
      ts !== null &&
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (ts instanceof Date || typeof ts === 'number' || typeof ts === 'string') {
      return new Date(ts).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  } catch {
    return 'Updated recently';
  }
  return 'Updated recently';
}

function formatStatusLabel(status: ManagedDocument['status']): string {
  switch (status) {
    case 'in_review':
      return 'In Review';
    case 'approved':
      return 'Approved';
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
}

export const DocumentsIndex: React.FC<DocumentsIndexProps> = ({
  documents,
  sharedDocuments,
  loading,
  isAuthenticated,
  searchOpen,
  searchFocusTick,
  onToggleSearch,
  onOpenDocument,
  onCreateNew,
  onDeleteDocument,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen) {
      const id = window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [searchOpen, searchFocusTick]);

  const combinedDocs = useMemo(() => {
    const map = new Map<string, ManagedDocument>();
    for (const d of documents) map.set(d.id, d);
    for (const d of sharedDocuments) {
      if (!map.has(d.id)) map.set(d.id, d);
    }
    return Array.from(map.values());
  }, [documents, sharedDocuments]);

  const filteredDocs = useMemo(() => {
    const tabFiltered = combinedDocs.filter((doc) => {
      if (filter === 'contract' && doc.category !== 'contract') return false;
      if (filter === 'report' && doc.category !== 'report') return false;
      if (filter === 'shared' && doc.visibility !== 'shared') return false;
      return true;
    });

    if (!searchQuery.trim()) {
      return tabFiltered;
    }

    return fuzzyFilterDocuments(tabFiltered, searchQuery).map((match) => match.item);
  }, [combinedDocs, filter, searchQuery]);

  return (
    <div className="flex flex-col h-full p-6 sm:p-9 overflow-y-auto">
      {/* Hero Header */}
      <div className="max-w-xl">
        <span className="mono-label block">
          {isAuthenticated ? 'Cloud Repository · Synced' : 'Online Repository · Local Session'}
        </span>
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl leading-[0.9] tracking-[-0.04em] uppercase text-[#1a2e2a] mt-3 mb-5">
          <span className="font-script text-[#d44c3c] text-4xl sm:text-5xl normal-case font-normal block -mb-3 ml-1">
            Studio
          </span>
          Document
          <br />
          Archive
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-[#1a2e2a]/80">
          Draft, review, and export legal agreements and executive business reports with version history and team collaboration.
        </p>
      </div>

      {/* Monospace Fuzzy Search & Segmented Filter Controls */}
      <div className="mt-7 mb-6 space-y-3">
        {searchOpen && (
          <div className="relative">
            <Search className="w-4 h-4 text-[#1a2e2a] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (searchQuery) {
                    setSearchQuery('');
                  } else {
                    onToggleSearch(false);
                  }
                }
              }}
              aria-label="Fuzzy search documents by title or category"
              placeholder="FUZZY_SEARCH_BY_TITLE_OR_CATEGORY (e.g. 'msa', 'contract', 'q4 report')..."
              className="w-full pl-12 pr-20 py-3.5 bg-white/60 border-[1.5px] border-[#1a2e2a] rounded font-mono text-xs sm:text-sm text-[#1a2e2a] placeholder:text-[#1a2e2a]/45 focus:outline-none focus:bg-white"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="p-1 text-[#1a2e2a]/60 hover:text-[#d44c3c] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggleSearch(false)}
                title="Hide search bar (Ctrl+F)"
                className="px-1.5 py-0.5 font-mono text-[10px] uppercase border border-[#1a2e2a]/35 text-[#1a2e2a]/70 hover:border-[#1a2e2a] hover:text-[#1a2e2a] rounded-sm"
              >
                Esc
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-white/70 border border-[#1a2e2a] rounded-md">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'contract', label: 'Contracts' },
                  { id: 'report', label: 'Reports' },
                  { id: 'shared', label: 'Shared' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1 text-[11px] font-mono uppercase font-bold rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                      : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onToggleSearch(!searchOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase font-bold border border-[#1a2e2a] rounded-md transition-colors whitespace-nowrap ${
                searchOpen
                  ? 'bg-[#fdfaf3] text-[#1a2e2a]'
                  : 'bg-white/70 text-[#1a2e2a] hover:bg-[#1a2e2a] hover:text-[#fdfaf3]'
              }`}
            >
              <Search className="w-3 h-3" />
              <span>{searchOpen ? 'Hide Search' : 'Search'}</span>
              <span className="opacity-60 text-[10px]">[Ctrl+F]</span>
            </button>
          </div>

          <span className="font-mono text-[11px] uppercase tracking-wider text-[#1a2e2a]/60 tabular-nums">
            Showing {filteredDocs.length} of {combinedDocs.length}
          </span>
        </div>
      </div>

      {/* Document Table / Empty / Loading */}
      {loading ? (
        <div className="flex-1 bg-white border-[1.5px] border-[#1a2e2a] rounded-lg divide-y divide-[#1a2e2a]/15">
          {[1, 2, 3].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between animate-pulse">
              <div className="space-y-2">
                <div className="h-4 w-56 bg-[#1a2e2a]/15 rounded" />
                <div className="h-3 w-40 bg-[#1a2e2a]/10 rounded" />
              </div>
              <div className="h-8 w-20 bg-[#1a2e2a]/10 rounded" />
            </div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex-1 min-h-[240px] border border-dashed border-[#1a2e2a] rounded-lg flex flex-col items-center justify-center text-center p-8 bg-[#1a2e2a]/[0.02]">
          <h2 className="font-display font-extrabold text-2xl text-[#1a2e2a] uppercase mb-2">
            {searchQuery || filter !== 'all' ? 'No Matching Files' : 'Workspace Clear'}
          </h2>
          <p className="text-sm text-[#1a2e2a]/65 max-w-md mb-6 leading-relaxed">
            {searchQuery || filter !== 'all'
              ? 'Adjust your search filter or category tab to inspect other documents.'
              : 'Generate an AI-drafted contract or executive report from a customizable template, collaborate in real time, and export to PDF or DOCX.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="btn-cta px-6 py-3.5 text-xs rounded-sm whitespace-nowrap"
          >
            Draft First Document
          </button>
        </div>
      ) : (
        <div className="bg-white border-[1.5px] border-[#1a2e2a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[1.5px] border-[#1a2e2a] bg-[#fdfaf3] font-mono text-[10px] uppercase tracking-wider text-[#1a2e2a]/70">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Access</th>
                  <th className="py-3 px-3 text-right">Ver</th>
                  <th className="py-3 px-3 text-right">Words</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2e2a]/15 text-sm">
                {filteredDocs.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#fdfaf3] transition-colors group cursor-pointer"
                    onClick={() => onOpenDocument(item)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#1a2e2a] group-hover:text-[#d44c3c] transition-colors">
                        {item.title}
                      </div>
                      <div className="text-xs text-[#1a2e2a]/60 mt-0.5 flex items-center gap-1.5">
                        <span>{item.category === 'contract' ? 'Contract' : 'Report'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.templateName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTimestamp(item.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-[#1a2e2a] whitespace-nowrap">
                      {formatStatusLabel(item.status)}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[#1a2e2a]/75 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {item.visibility === 'shared' ? (
                          <>
                            <Users className="w-3.5 h-3.5 text-[#d44c3c]" />
                            <span>Shared ({item.sharedEmails.length + 1})</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-[#1a2e2a]/60" />
                            <span>
                              {item.storageTier === 'vault_restricted' ? 'Vault' : 'Private'}
                            </span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-xs text-[#1a2e2a] tabular-nums whitespace-nowrap">
                      v{item.currentVersion}.0
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-xs text-[#1a2e2a] tabular-nums whitespace-nowrap">
                      {item.wordCount.toLocaleString()}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenDocument(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono uppercase font-bold text-[#1a2e2a] border border-[#1a2e2a] hover:bg-[#1a2e2a] hover:text-[#fdfaf3] rounded-sm transition-colors"
                        >
                          Open
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(item.id)}
                          aria-label={`Delete ${item.title}`}
                          className="p-1.5 text-[#1a2e2a]/50 hover:text-[#d44c3c] rounded-sm transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
