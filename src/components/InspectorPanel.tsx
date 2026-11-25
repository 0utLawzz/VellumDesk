import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  GitBranch,
  History,
  Loader2,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  CollaboratorPresence,
  DocumentAuditResult,
  DocumentComment,
  DocumentSection,
  DocumentStatus,
  DocumentVersion,
  DocumentVisibility,
  ManagedDocument,
  StorageTier,
} from '../types/document';
import { computeSectionDiff } from '../lib/diffUtils';

export type InspectorTab = 'collaborate' | 'versions' | 'audit' | 'security';

interface InspectorPanelProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  document: ManagedDocument;
  currentSections: DocumentSection[];
  activeSectionId: string | null;
  isOwner: boolean;
  isAuthenticated: boolean;
  socketConnected: boolean;
  collaborators: CollaboratorPresence[];
  comments: DocumentComment[];
  versions: DocumentVersion[];
  auditResult: DocumentAuditResult | null;
  auditing: boolean;
  onAddComment: (sectionId: string, body: string) => Promise<void>;
  onToggleCommentResolved: (commentId: string, resolved: boolean) => Promise<void>;
  onSaveSnapshot: (label: string) => Promise<void>;
  onRestoreVersion: (version: DocumentVersion) => Promise<void>;
  onRunAudit: () => Promise<void>;
  onApplyAuditFix: (sectionHeading: string, recommendation: string) => Promise<void>;
  onUpdateSecurity: (params: {
    visibility: DocumentVisibility;
    storageTier: StorageTier;
    sharedEmails: string[];
    status: DocumentStatus;
  }) => Promise<void>;
  onRequireSignIn: () => void;
}

function formatDate(ts: unknown): string {
  if (!ts) return 'Just now';
  try {
    if (
      typeof ts === 'object' &&
      ts !== null &&
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (ts instanceof Date || typeof ts === 'number' || typeof ts === 'string') {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    return 'Recently';
  }
  return 'Recently';
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeTab,
  onTabChange,
  document,
  currentSections,
  activeSectionId,
  isOwner,
  isAuthenticated,
  socketConnected,
  collaborators,
  comments,
  versions,
  auditResult,
  auditing,
  onAddComment,
  onToggleCommentResolved,
  onSaveSnapshot,
  onRestoreVersion,
  onRunAudit,
  onApplyAuditFix,
  onUpdateSecurity,
  onRequireSignIn,
}) => {
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [applyingFixHeading, setApplyingFixHeading] = useState<string | null>(null);

  const targetSection = useMemo(
    () =>
      currentSections.find((s) => s.id === activeSectionId) ||
      currentSections[0] || { id: 'sec_1', heading: 'Document', body: '', order: 1 },
    [currentSections, activeSectionId]
  );

  const comparedVersion = useMemo(
    () => versions.find((v) => v.id === compareVersionId) || null,
    [versions, compareVersionId]
  );

  const diffItems = useMemo(() => {
    if (!comparedVersion) return [];
    return computeSectionDiff(comparedVersion.sections, currentSections);
  }, [comparedVersion, currentSections]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await onAddComment(targetSection.id, commentText.trim());
      setCommentText('');
    } finally {
      setPostingComment(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSnapshot(true);
    try {
      await onSaveSnapshot(
        snapshotLabel.trim() || `Manual Checkpoint v${document.currentVersion + 1}`
      );
      setSnapshotLabel('');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inviteEmail.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) return;
    if (document.sharedEmails.includes(cleaned)) {
      setInviteEmail('');
      return;
    }
    setSecuritySaving(true);
    try {
      await onUpdateSecurity({
        visibility: 'shared',
        storageTier: document.storageTier,
        sharedEmails: [...document.sharedEmails, cleaned].slice(0, 15),
        status: document.status,
      });
      setInviteEmail('');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    setSecuritySaving(true);
    try {
      const next = document.sharedEmails.filter((e) => e !== email);
      await onUpdateSecurity({
        visibility: next.length > 0 ? document.visibility : 'private',
        storageTier: document.storageTier,
        sharedEmails: next,
        status: document.status,
      });
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/?doc=${encodeURIComponent(document.id)}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Segmented Inspector Tabs */}
      <div className="p-3 border-b-[1.5px] border-[#1a2e2a] bg-white/60">
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#fdfaf3] border border-[#1a2e2a] rounded-md">
          {(
            [
              { id: 'collaborate', label: 'Review' },
              { id: 'versions', label: 'History' },
              { id: 'audit', label: 'Audit' },
              { id: 'security', label: 'Vault' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`py-1.5 text-[10px] font-mono uppercase font-bold rounded-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                  : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'collaborate' && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="mono-label flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Live Room Presence
                </h3>
                <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                  {socketConnected ? 'Synced' : 'Connecting'}
                </span>
              </div>

              <div className="border-[1.5px] border-[#1a2e2a] rounded bg-white divide-y divide-[#1a2e2a]/15">
                {collaborators.length === 0 ? (
                  <p className="p-3 text-xs text-[#1a2e2a]/65">
                    Only you are currently viewing this document.
                  </p>
                ) : (
                  collaborators.map((member) => {
                    const sec = currentSections.find((s) => s.id === member.activeSectionId);
                    return (
                      <div key={member.clientId} className="p-2.5 flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded-sm text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#1a2e2a]"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1a2e2a] truncate">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-[#1a2e2a]/60 truncate">
                            {sec
                              ? `${member.isTyping ? 'Editing' : 'Viewing'} ${sec.heading}`
                              : 'Reading document'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#1a2e2a]/20">
              <div className="flex items-center justify-between gap-2">
                <h3 className="mono-label flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments ({comments.length})
                </h3>
                <span className="text-[11px] text-[#1a2e2a]/60 truncate max-w-[140px]">
                  {targetSection.heading}
                </span>
              </div>

              {isAuthenticated ? (
                <form onSubmit={handlePostComment} className="space-y-2">
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={`Add review note on "${targetSection.heading}"...`}
                    maxLength={2000}
                    className="w-full px-3 py-2 text-xs bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={postingComment || !commentText.trim()}
                      className="btn-secondary px-3 py-1.5 text-[10px] rounded-sm disabled:opacity-50"
                    >
                      {postingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="border border-[#1a2e2a] bg-white rounded p-3 space-y-2">
                  <p className="text-xs text-[#1a2e2a]/75">
                    Sign in to post persistent review comments synced across collaborators.
                  </p>
                  <button
                    type="button"
                    onClick={onRequireSignIn}
                    className="font-mono text-[11px] uppercase font-bold text-[#d44c3c] hover:underline"
                  >
                    Sign in with Google
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-[#1a2e2a]/60 py-1">
                    No comments posted yet. Select any section to anchor feedback.
                  </p>
                ) : (
                  comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className={`p-3 rounded border border-[#1a2e2a] text-xs space-y-1.5 ${
                        cmt.resolved ? 'bg-[#fdfaf3] opacity-70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1a2e2a] truncate">
                          {cmt.authorName}
                        </span>
                        <span className="text-[10px] font-mono text-[#1a2e2a]/50 tabular-nums shrink-0">
                          {formatDate(cmt.createdAt)}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-[#1a2e2a]/60 truncate">
                        Section: {cmt.sectionHeading}
                      </p>
                      <p className="text-[#1a2e2a]/85 leading-relaxed whitespace-pre-wrap">
                        {cmt.body}
                      </p>
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onToggleCommentResolved(cmt.id, !cmt.resolved)}
                          className="font-mono text-[10px] uppercase font-bold text-[#d44c3c] hover:underline"
                        >
                          {cmt.resolved ? 'Reopen' : 'Mark Resolved'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-5">
            <div>
              <h3 className="mono-label flex items-center gap-1.5 mb-2">
                <GitBranch className="w-3.5 h-3.5" />
                Save Version Snapshot
              </h3>
              <form onSubmit={handleCreateSnapshot} className="flex gap-2">
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  maxLength={160}
                  placeholder="Revision label..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingSnapshot}
                  className="btn-cta px-3 py-1.5 text-[10px] rounded-sm whitespace-nowrap disabled:opacity-50"
                >
                  {savingSnapshot ? 'Saving...' : 'Commit'}
                </button>
              </form>
            </div>

            {comparedVersion && (
              <div className="border-[1.5px] border-[#1a2e2a] rounded bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-bold text-[#1a2e2a]">
                      DIFF: v{comparedVersion.versionNumber}.0 vs Current
                    </p>
                    <p className="text-[11px] text-[#1a2e2a]/60">{comparedVersion.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompareVersionId(null)}
                    className="font-mono text-[10px] uppercase font-bold text-[#d44c3c] hover:underline"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {diffItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#fdfaf3] border border-[#1a2e2a]/30 rounded p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1a2e2a] truncate">
                          {item.heading}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase font-bold shrink-0 ${
                            item.status === 'added'
                              ? 'text-[#1a2e2a]'
                              : item.status === 'removed' || item.status === 'modified'
                                ? 'text-[#d44c3c]'
                                : 'text-[#1a2e2a]/40'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      {item.status === 'modified' && (
                        <div className="space-y-1 pt-1 border-t border-[#1a2e2a]/15">
                          <p className="text-[11px] text-[#d44c3c] bg-white p-1.5 rounded line-clamp-3">
                            - {item.oldBody}
                          </p>
                          <p className="text-[11px] text-[#1a2e2a] bg-white p-1.5 rounded line-clamp-3">
                            + {item.newBody}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2.5 pt-2 border-t border-[#1a2e2a]/20">
              <div className="flex items-center justify-between">
                <h3 className="mono-label flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Version Log
                </h3>
                <span className="font-mono text-[11px] text-[#1a2e2a]/60 tabular-nums">
                  {versions.length}
                </span>
              </div>

              {versions.length === 0 ? (
                <p className="text-xs text-[#1a2e2a]/60">
                  Save a checkpoint to start tracking revision history.
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((ver) => (
                    <div
                      key={ver.id}
                      className="border border-[#1a2e2a] rounded p-3 space-y-1.5 bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#1a2e2a]">
                          <span className="font-mono font-bold text-[#d44c3c] tabular-nums mr-1.5">
                            v{ver.versionNumber}.0
                          </span>
                          {ver.label}
                        </span>
                        <span className="text-[10px] font-mono text-[#1a2e2a]/50 tabular-nums shrink-0">
                          {formatDate(ver.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#1a2e2a]/70">{ver.changeSummary}</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#1a2e2a]/60">
                        <span>{ver.authorName}</span>
                        <div className="flex items-center gap-3 font-mono text-[10px] uppercase font-bold">
                          <button
                            type="button"
                            onClick={() =>
                              setCompareVersionId(compareVersionId === ver.id ? null : ver.id)
                            }
                            className="text-[#1a2e2a] hover:text-[#d44c3c]"
                          >
                            {compareVersionId === ver.id ? 'Hide Diff' : 'Diff'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRestoreVersion(ver)}
                            className="inline-flex items-center gap-1 text-[#d44c3c] hover:underline"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="mono-label">AI Clause Audit</h3>
                <p className="text-[11px] text-[#1a2e2a]/65 mt-0.5">
                  Identify missing terms or ambiguities
                </p>
              </div>
              <button
                type="button"
                onClick={onRunAudit}
                disabled={auditing}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-sm disabled:opacity-50 whitespace-nowrap"
              >
                {auditing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Auditing
                  </>
                ) : (
                  'Run Review'
                )}
              </button>
            </div>

            {auditResult ? (
              <div className="space-y-3">
                <div className="p-3 border border-[#1a2e2a] rounded bg-white text-xs text-[#1a2e2a] leading-relaxed">
                  {auditResult.summary}
                </div>
                {auditResult.findings.map((f, idx) => (
                  <div
                    key={`${f.sectionHeading}-${idx}`}
                    className="p-3 border border-[#1a2e2a] rounded bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1a2e2a] truncate">
                        {f.sectionHeading}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${
                          f.severity === 'high' ? 'text-[#d44c3c]' : 'text-[#1a2e2a]/70'
                        }`}
                      >
                        {f.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[#1a2e2a]/85">{f.issue}</p>
                    <p className="text-[#1a2e2a]/65 leading-relaxed">
                      Recommendation: {f.recommendation}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={applyingFixHeading === f.sectionHeading}
                        onClick={async () => {
                          setApplyingFixHeading(f.sectionHeading);
                          try {
                            await onApplyAuditFix(f.sectionHeading, f.recommendation);
                          } finally {
                            setApplyingFixHeading(null);
                          }
                        }}
                        className="font-mono text-[10px] uppercase font-bold text-[#d44c3c] hover:underline disabled:opacity-50"
                      >
                        {applyingFixHeading === f.sectionHeading
                          ? 'Applying Fix...'
                          : 'Apply AI Fix'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-[#1a2e2a] rounded p-5 text-center text-xs text-[#1a2e2a]/65">
                Run an automated review to inspect legal protections, obligations, and missing figures.
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <h3 className="mono-label flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cloud Storage & Access
              </h3>

              {!isAuthenticated ? (
                <div className="border-[1.5px] border-[#1a2e2a] bg-white rounded p-3.5 space-y-3">
                  <p className="text-xs text-[#1a2e2a]/80">
                    Stored locally in this session. Sign in with Google to enable Firestore cloud vault storage and collaborator invites.
                  </p>
                  <button
                    type="button"
                    onClick={onRequireSignIn}
                    className="btn-cta w-full py-2 text-[10px] rounded-sm"
                  >
                    Sign in & Sync to Cloud
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block mono-label mb-1">Storage Tier</label>
                    <select
                      disabled={!isOwner || securitySaving}
                      value={document.storageTier}
                      onChange={(e) =>
                        onUpdateSecurity({
                          visibility: document.visibility,
                          storageTier: e.target.value as StorageTier,
                          sharedEmails: document.sharedEmails,
                          status: document.status,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border-[1.5px] border-[#1a2e2a] rounded bg-white disabled:opacity-60"
                    >
                      <option value="standard_cloud">Standard Cloud Sync</option>
                      <option value="vault_restricted">Restricted Private Vault</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mono-label mb-1">Collaboration Access</label>
                    <select
                      disabled={!isOwner || securitySaving}
                      value={document.visibility}
                      onChange={(e) =>
                        onUpdateSecurity({
                          visibility: e.target.value as DocumentVisibility,
                          storageTier: document.storageTier,
                          sharedEmails: document.sharedEmails,
                          status: document.status,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border-[1.5px] border-[#1a2e2a] rounded bg-white disabled:opacity-60"
                    >
                      <option value="private">Private (Owner Only)</option>
                      <option value="shared">Shared Team (Invited Emails)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {isAuthenticated && (
              <div className="pt-4 border-t border-[#1a2e2a]/20 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="mono-label flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    Access ({document.sharedEmails.length}/15)
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-[#d44c3c] hover:underline"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Share URL
                      </>
                    )}
                  </button>
                </div>

                {isOwner && (
                  <form onSubmit={handleAddCollaborator} className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      required
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white border-[1.5px] border-[#1a2e2a] rounded focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={securitySaving || document.sharedEmails.length >= 15}
                      className="btn-secondary px-3 py-1.5 text-[10px] rounded-sm disabled:opacity-50"
                    >
                      Invite
                    </button>
                  </form>
                )}

                <div className="border-[1.5px] border-[#1a2e2a] rounded bg-white divide-y divide-[#1a2e2a]/15">
                  <div className="p-2.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1a2e2a]">{document.ownerName}</span>
                    <span className="font-mono text-[10px] uppercase text-[#1a2e2a]/60">
                      Owner
                    </span>
                  </div>
                  {document.sharedEmails.length === 0 ? (
                    <div className="p-2.5 text-[11px] text-[#1a2e2a]/60 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      No external collaborators invited.
                    </div>
                  ) : (
                    document.sharedEmails.map((email) => (
                      <div
                        key={email}
                        className="p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[#1a2e2a] truncate">{email}</span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(email)}
                            aria-label={`Remove ${email}`}
                            className="p-1 text-[#1a2e2a]/50 hover:text-[#d44c3c]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
