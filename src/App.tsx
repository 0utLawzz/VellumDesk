import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { LogOut, Plus, ShieldCheck } from 'lucide-react';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import {
  addDocumentComment,
  countWords,
  createCloudDocument,
  deleteCloudDocument,
  deleteUserTemplate,
  ensureUserProfile,
  makeSafeId,
  saveDocumentAndSnapshot,
  saveUserTemplate,
  subscribeComments,
  subscribeDocument,
  subscribeOwnedDocuments,
  subscribeSharedDocuments,
  subscribeUserTemplates,
  subscribeVersions,
  toggleCommentResolved,
  updateDocumentSecuritySettings,
  updateUserStoragePreference,
} from './lib/documentService';
import { BUILT_IN_TEMPLATES } from './data/defaultTemplates';
import type {
  DocumentAuditResult,
  DocumentCategory,
  DocumentComment,
  DocumentMetadata,
  DocumentSection,
  DocumentStatus,
  DocumentTemplate,
  DocumentVersion,
  DocumentVisibility,
  ManagedDocument,
  StorageTier,
  UserProfile,
} from './types/document';
import { useCollaborationSocket } from './hooks/useCollaborationSocket';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DocumentsIndex } from './components/DocumentsIndex';
import { DraftStudio } from './components/DraftStudio';
import { DocumentEditor } from './components/DocumentEditor';
import { InspectorPanel, type InspectorTab } from './components/InspectorPanel';
import { TemplateCustomizerModal } from './components/TemplateCustomizerModal';

type AppView = 'documents' | 'studio' | 'editor' | 'storage';

function WorkspaceApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [view, setView] = useState<AppView>('documents');

  // Cloud state
  const [cloudDocs, setCloudDocs] = useState<ManagedDocument[]>([]);
  const [sharedDocs, setSharedDocs] = useState<ManagedDocument[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [userTemplates, setUserTemplates] = useState<DocumentTemplate[]>([]);

  // Local fallback state when unauthenticated
  const [localDocs, setLocalDocs] = useState<ManagedDocument[]>([]);
  const [localTemplates, setLocalTemplates] = useState<DocumentTemplate[]>([]);
  const [localVersions, setLocalVersions] = useState<Record<string, DocumentVersion[]>>({});
  const [localComments, setLocalComments] = useState<Record<string, DocumentComment[]>>({});

  // Active Document state
  const [activeDocId, setActiveDocId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('doc');
  });
  const [activeCloudDoc, setActiveCloudDoc] = useState<ManagedDocument | null>(null);
  const [activeDocSync, setActiveDocSync] = useState({
    fromCache: false,
    hasPendingWrites: false,
  });
  const [cloudVersions, setCloudVersions] = useState<DocumentVersion[]>([]);
  const [cloudComments, setCloudComments] = useState<DocumentComment[]>([]);

  // Editor <-> Inspector bridge state
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('collaborate');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [liveSections, setLiveSections] = useState<DocumentSection[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveStatus, setLiveStatus] = useState<DocumentStatus>('draft');
  const [auditResult, setAuditResult] = useState<DocumentAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  const remotePatchHandlerRef = useRef<
    (patch: { sectionId?: string; heading?: string; body?: string; title?: string }) => void
  >(() => {});

  // Template customizer modal
  const [customizerTarget, setCustomizerTarget] = useState<DocumentTemplate | null | undefined>(
    undefined
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const profile = await ensureUserProfile(nextUser);
          setUserProfile(profile);
        } catch (err) {
          console.error(err);
        }
      } else {
        setUserProfile(null);
        setCloudDocs([]);
        setSharedDocs([]);
        setUserTemplates([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    setCloudLoading(true);

    const unsubOwned = subscribeOwnedDocuments(user.uid, (docs) => {
      setCloudDocs(docs);
      setCloudLoading(false);
    });

    const unsubShared = user.email
      ? subscribeSharedDocuments(user.email, (docs) => {
          setSharedDocs(docs);
        })
      : () => {};

    const unsubTemplates = subscribeUserTemplates(user.uid, (tpls) => {
      setUserTemplates(tpls);
    });

    return () => {
      unsubOwned();
      unsubShared();
      unsubTemplates();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!activeDocId || !user) {
      setActiveCloudDoc(null);
      setCloudVersions([]);
      setCloudComments([]);
      return;
    }

    setView('editor');
    const unsubDoc = subscribeDocument(activeDocId, (docData, meta) => {
      setActiveCloudDoc(docData);
      setActiveDocSync(meta);
    });
    const unsubVer = subscribeVersions(activeDocId, setCloudVersions);
    const unsubCmt = subscribeComments(activeDocId, setCloudComments);

    return () => {
      unsubDoc();
      unsubVer();
      unsubCmt();
    };
  }, [activeDocId, user]);

  const allTemplates = useMemo(() => {
    const custom = user ? userTemplates : localTemplates;
    return [...custom, ...BUILT_IN_TEMPLATES];
  }, [user, userTemplates, localTemplates]);

  const ownedDocs = user ? cloudDocs : localDocs;
  const visibleSharedDocs = user ? sharedDocs : [];

  const totalCombinedDocs = useMemo(() => {
    const map = new Map<string, ManagedDocument>();
    for (const d of ownedDocs) map.set(d.id, d);
    for (const d of visibleSharedDocs) {
      if (!map.has(d.id)) map.set(d.id, d);
    }
    return Array.from(map.values());
  }, [ownedDocs, visibleSharedDocs]);

  const activeDocument = useMemo(() => {
    if (!activeDocId) return null;
    if (user) {
      return (
        activeCloudDoc ||
        cloudDocs.find((d) => d.id === activeDocId) ||
        sharedDocs.find((d) => d.id === activeDocId) ||
        null
      );
    }
    return localDocs.find((d) => d.id === activeDocId) || null;
  }, [activeDocId, user, activeCloudDoc, cloudDocs, sharedDocs, localDocs]);

  useEffect(() => {
    if (activeDocument) {
      setLiveSections(activeDocument.sections);
      setLiveTitle(activeDocument.title);
      setLiveStatus(activeDocument.status);
      setActiveSectionId((prev) => prev || activeDocument.sections[0]?.id || null);
      setAuditResult(null);
    }
  }, [activeDocument?.id]);

  const activeVersions = useMemo(() => {
    if (!activeDocId) return [];
    return user ? cloudVersions : localVersions[activeDocId] || [];
  }, [activeDocId, user, cloudVersions, localVersions]);

  const activeComments = useMemo(() => {
    if (!activeDocId) return [];
    return user ? cloudComments : localComments[activeDocId] || [];
  }, [activeDocId, user, cloudComments, localComments]);

  const { connected, collaborators, emitFocus, emitSectionPatch } = useCollaborationSocket({
    docId: view === 'editor' && activeDocument ? activeDocument.id : null,
    uid: user?.uid || 'local_user',
    displayName: user?.displayName || user?.email || 'Local Author',
    onRemotePatch: (patch) => {
      remotePatchHandlerRef.current(patch);
    },
  });

  const handleBindRemotePatch = useCallback(
    (
      handler: (patch: {
        sectionId?: string;
        heading?: string;
        body?: string;
        title?: string;
      }) => void
    ) => {
      remotePatchHandlerRef.current = handler;
    },
    []
  );

  const handleSectionsSnapshotChange = useCallback(
    (sections: DocumentSection[], title: string, status: DocumentStatus) => {
      setLiveSections(sections);
      setLiveTitle(title);
      setLiveStatus(status);
    },
    []
  );

  const handleSelectSection = useCallback(
    (sectionId: string | null, isTyping = false) => {
      setActiveSectionId(sectionId);
      emitFocus(sectionId, isTyping);
    },
    [emitFocus]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setActiveDocId(null);
    setView('documents');
  };

  const handleOpenDocument = (doc: ManagedDocument) => {
    setActiveDocId(doc.id);
    const url = new URL(window.location.href);
    url.searchParams.set('doc', doc.id);
    window.history.replaceState({}, '', url.toString());
    setView('editor');
  };

  const handleBackToDocuments = () => {
    setActiveDocId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('doc');
    window.history.replaceState({}, '', url.toString());
    setView('documents');
  };

  const handleSaveCustomTemplate = async (template: DocumentTemplate) => {
    if (user) {
      await saveUserTemplate(template);
    } else {
      setLocalTemplates((prev) => {
        const exists = prev.some((t) => t.id === template.id);
        return exists ? prev.map((t) => (t.id === template.id ? template : t)) : [template, ...prev];
      });
    }
  };

  const handleDeleteCustomTemplate = async (templateId: string) => {
    if (user) {
      await deleteUserTemplate(templateId);
    } else {
      setLocalTemplates((prev) => prev.filter((t) => t.id !== templateId));
    }
  };

  const handleDraftGenerated = async (payload: {
    title: string;
    category: DocumentCategory;
    template: DocumentTemplate;
    visibility: DocumentVisibility;
    storageTier: StorageTier;
    metadata: DocumentMetadata;
    sections: DocumentSection[];
    changeSummary: string;
  }) => {
    const newDocId = makeSafeId('doc');
    const ownerName = user?.displayName || user?.email || 'Local Author';
    const ownerId = user?.uid || 'local_user';

    if (user) {
      await createCloudDocument(
        {
          id: newDocId,
          ownerId,
          ownerName,
          title: payload.title,
          category: payload.category,
          templateId: payload.template.id,
          templateName: payload.template.name,
          status: 'draft',
          visibility: payload.visibility,
          storageTier: payload.storageTier,
          sharedEmails: [],
          metadata: payload.metadata,
          sections: payload.sections,
        },
        'Initial AI Draft',
        payload.changeSummary
      );
      setActiveDocId(newDocId);
      setView('editor');
    } else {
      const createdAt = new Date().toISOString();
      const newDoc: ManagedDocument = {
        id: newDocId,
        ownerId,
        ownerName,
        title: payload.title,
        category: payload.category,
        templateId: payload.template.id,
        templateName: payload.template.name,
        status: 'draft',
        visibility: payload.visibility,
        storageTier: payload.storageTier,
        sharedEmails: [],
        metadata: payload.metadata,
        sections: payload.sections,
        currentVersion: 1,
        wordCount: countWords(payload.sections),
        createdAt,
        updatedAt: createdAt,
      };
      const initialVer: DocumentVersion = {
        id: makeSafeId('ver'),
        documentId: newDocId,
        docOwnerId: ownerId,
        docVisibility: payload.visibility,
        docSharedEmails: [],
        versionNumber: 1,
        label: 'Initial AI Draft',
        changeSummary: payload.changeSummary,
        authorId: ownerId,
        authorName: ownerName,
        title: payload.title,
        sections: payload.sections,
        createdAt,
      };
      setLocalDocs((prev) => [newDoc, ...prev]);
      setLocalVersions((prev) => ({ ...prev, [newDocId]: [initialVer] }));
      setActiveDocId(newDocId);
      setView('editor');
    }
  };

  const handleSaveDocument = async (params: {
    nextTitle: string;
    nextSections: DocumentSection[];
    nextStatus?: DocumentStatus;
    createSnapshot?: boolean;
    snapshotLabel?: string;
    changeSummary?: string;
  }) => {
    if (!activeDocument) return;

    if (user) {
      await saveDocumentAndSnapshot({
        document: activeDocument,
        ...params,
      });
    } else {
      const nextVersion = params.createSnapshot
        ? activeDocument.currentVersion + 1
        : activeDocument.currentVersion;
      const now = new Date().toISOString();
      const updatedDoc: ManagedDocument = {
        ...activeDocument,
        title: params.nextTitle,
        sections: params.nextSections,
        status: params.nextStatus || activeDocument.status,
        currentVersion: nextVersion,
        wordCount: countWords(params.nextSections),
        updatedAt: now,
      };
      setLocalDocs((prev) => prev.map((d) => (d.id === activeDocument.id ? updatedDoc : d)));
      if (params.createSnapshot) {
        const ver: DocumentVersion = {
          id: makeSafeId('ver'),
          documentId: activeDocument.id,
          docOwnerId: activeDocument.ownerId,
          docVisibility: activeDocument.visibility,
          docSharedEmails: activeDocument.sharedEmails,
          versionNumber: nextVersion,
          label: params.snapshotLabel || `Revision v${nextVersion}`,
          changeSummary: params.changeSummary || 'Saved revision snapshot.',
          authorId: activeDocument.ownerId,
          authorName: activeDocument.ownerName,
          title: params.nextTitle,
          sections: params.nextSections,
          createdAt: now,
        };
        setLocalVersions((prev) => ({
          ...prev,
          [activeDocument.id]: [ver, ...(prev[activeDocument.id] || [])],
        }));
      }
    }
  };

  const handleRestoreVersion = async (ver: DocumentVersion) => {
    await handleSaveDocument({
      nextTitle: ver.title,
      nextSections: ver.sections,
      createSnapshot: true,
      snapshotLabel: `Restored from v${ver.versionNumber}.0`,
      changeSummary: `Restored document state from version v${ver.versionNumber}.0 (${ver.label}).`,
    });
  };

  const handleDeleteDocument = async (docId: string) => {
    if (user) {
      await deleteCloudDocument(docId);
    } else {
      setLocalDocs((prev) => prev.filter((d) => d.id !== docId));
    }
    if (activeDocId === docId) {
      handleBackToDocuments();
    }
  };

  const handleRunAuditFromInspector = async () => {
    if (!activeDocument) return;
    setAuditing(true);
    try {
      const res = await fetch('/api/documents/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: liveTitle || activeDocument.title,
          category: activeDocument.category,
          jurisdiction: activeDocument.metadata?.jurisdiction || 'General',
          sections: (liveSections.length ? liveSections : activeDocument.sections).map((s) => ({
            heading: s.heading,
            body: s.body,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed.');
      setAuditResult(data as DocumentAuditResult);
    } finally {
      setAuditing(false);
    }
  };

  const handleApplyAuditFix = async (sectionHeading: string, recommendation: string) => {
    if (!activeDocument) return;
    const currentList = liveSections.length ? liveSections : activeDocument.sections;
    const match =
      currentList.find((s) =>
        s.heading.toLowerCase().includes(sectionHeading.toLowerCase())
      ) || currentList[0];
    if (!match) return;

    const res = await fetch('/api/documents/refine-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentTitle: liveTitle || activeDocument.title,
        category: activeDocument.category,
        tone: activeDocument.metadata?.tone || 'formal_legal',
        sectionHeading: match.heading,
        sectionBody: match.body,
        instruction: `Incorporate this review recommendation: ${recommendation}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to apply fix.');

    const nextSections = currentList.map((s) =>
      s.id === match.id
        ? { ...s, heading: data.heading || s.heading, body: data.body || s.body }
        : s
    );
    remotePatchHandlerRef.current({
      sectionId: match.id,
      heading: data.heading || match.heading,
      body: data.body || match.body,
    });
    emitSectionPatch({
      sectionId: match.id,
      heading: data.heading || match.heading,
      body: data.body || match.body,
    });
    await handleSaveDocument({
      nextTitle: liveTitle || activeDocument.title,
      nextSections,
      nextStatus: liveStatus,
      createSnapshot: true,
      snapshotLabel: `AI Audit Fix: ${match.heading.slice(0, 50)}`,
      changeSummary: data.changeSummary || `Applied audit recommendation to ${match.heading}.`,
    });
  };

  const currentStorageTier: StorageTier = userProfile?.storagePreference || 'standard_cloud';
  const totalSharedCount = totalCombinedDocs.filter((d) => d.visibility === 'shared').length;
  const totalVaultCount = totalCombinedDocs.filter(
    (d) => d.storageTier === 'vault_restricted'
  ).length;
  const customTemplateCount = user ? userTemplates.length : localTemplates.length;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden p-3 flex flex-col gap-3">
      {authError && (
        <div className="no-print bg-white border-[1.5px] border-[#d44c3c] rounded-lg px-4 py-2 text-xs text-[#d44c3c] flex items-center justify-between shrink-0">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="font-mono uppercase font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Pane Bento Shell */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-3">
        {/* Left Navigation Pane */}
        <aside className="no-print pane-glass p-6 flex flex-col justify-between">
          <div>
            <button
              type="button"
              onClick={handleBackToDocuments}
              className="flex items-center gap-3 mb-10 text-left group"
            >
              <span className="w-5 h-5 bg-[#d44c3c] border-[1.5px] border-[#1a2e2a] rotate-45 block shrink-0 transition-transform group-hover:rotate-90" />
              <span className="font-display font-extrabold text-2xl tracking-[-0.04em] text-[#1a2e2a] uppercase">
                Vellum
              </span>
            </button>

            <nav className="space-y-1.5">
              <span className="mono-label block px-1 mb-2">Primary</span>
              <button
                type="button"
                onClick={handleBackToDocuments}
                className={`w-full px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${
                  view === 'documents'
                    ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                    : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                }`}
              >
                <span>Documents</span>
                <span className="font-mono text-xs tabular-nums">
                  [{totalCombinedDocs.length}]
                </span>
              </button>

              <button
                type="button"
                onClick={() => setView('studio')}
                className={`w-full px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${
                  view === 'studio'
                    ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                    : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                }`}
              >
                <span>Draft Studio</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomizerTarget(null)}
                className="w-full px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between text-[#1a2e2a] hover:bg-[#1a2e2a]/10 transition-colors"
              >
                <span>Templates</span>
                <span className="font-mono text-xs tabular-nums">
                  [{allTemplates.length}]
                </span>
              </button>

              <button
                type="button"
                onClick={() => setView('storage')}
                className={`w-full px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${
                  view === 'storage'
                    ? 'bg-[#1a2e2a] text-[#fdfaf3]'
                    : 'text-[#1a2e2a] hover:bg-[#1a2e2a]/10'
                }`}
              >
                <span>Vault</span>
              </button>
            </nav>
          </div>

          <div className="pt-6 mt-6 border-t border-[#1a2e2a]/15">
            {user ? (
              <div className="space-y-3">
                <div className="px-1">
                  <span className="mono-label block">Signed In</span>
                  <p className="text-xs font-semibold text-[#1a2e2a] truncate mt-0.5">
                    {user.displayName || user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-secondary w-full py-2.5 px-3 text-xs rounded-sm inline-flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="btn-secondary w-full py-3.5 px-4 text-xs rounded-sm"
              >
                Sign In to Studio
              </button>
            )}
          </div>
        </aside>

        {/* Center Main Stage Pane */}
        <main className="pane-glass min-h-0 flex flex-col overflow-hidden">
          {view === 'documents' && (
            <DocumentsIndex
              documents={ownedDocs}
              sharedDocuments={visibleSharedDocs}
              loading={Boolean(user && cloudLoading)}
              isAuthenticated={Boolean(user)}
              onOpenDocument={handleOpenDocument}
              onCreateNew={() => setView('studio')}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {view === 'studio' && (
            <DraftStudio
              templates={allTemplates}
              defaultStorageTier={currentStorageTier}
              isAuthenticated={Boolean(user)}
              onCustomizeTemplate={(tpl) => setCustomizerTarget(tpl)}
              onDeleteCustomTemplate={handleDeleteCustomTemplate}
              onDraftGenerated={handleDraftGenerated}
            />
          )}

          {view === 'editor' && activeDocument && (
            <DocumentEditor
              key={activeDocument.id}
              document={activeDocument}
              currentUserId={user?.uid || 'local_user'}
              isAuthenticated={Boolean(user)}
              syncStatus={activeDocSync}
              collaborators={collaborators}
              activeSectionId={activeSectionId}
              onSelectSection={handleSelectSection}
              onRemotePatchBind={handleBindRemotePatch}
              emitSectionPatch={emitSectionPatch}
              onSectionsSnapshotChange={handleSectionsSnapshotChange}
              onBack={handleBackToDocuments}
              onSaveDocument={handleSaveDocument}
              onAuditResult={setAuditResult}
              onSwitchToAuditTab={() => setInspectorTab('audit')}
            />
          )}

          {view === 'editor' && !activeDocument && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md w-full bg-white border-[1.5px] border-[#1a2e2a] rounded-lg p-8 text-center space-y-4">
                <h2 className="font-display font-extrabold text-xl uppercase text-[#1a2e2a]">
                  {user ? 'Document Unavailable' : 'Sign In Required'}
                </h2>
                <p className="text-sm text-[#1a2e2a]/70">
                  {user
                    ? 'This document may have been removed or you do not have collaborator access.'
                    : 'Authenticate with your authorized Google account to open shared workspace documents.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {!user && (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="btn-cta px-4 py-2 text-xs rounded-sm"
                    >
                      Sign In with Google
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBackToDocuments}
                    className="btn-secondary px-4 py-2 text-xs rounded-sm"
                  >
                    Return to Archive
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'storage' && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-9 space-y-8">
              <div className="pb-5 border-b-[1.5px] border-[#1a2e2a]">
                <span className="mono-label block">Cloud Security & Persistence</span>
                <h1 className="font-display font-extrabold text-3xl sm:text-4xl uppercase tracking-tight text-[#1a2e2a] mt-2">
                  <span className="font-script text-[#d44c3c] text-3xl normal-case font-normal block -mb-2">
                    Security
                  </span>
                  Cloud Vault & Sync
                </h1>
                <p className="text-sm text-[#1a2e2a]/75 mt-2">
                  Configure default storage isolation, team access policies, and Cloud Firestore synchronization.
                </p>
              </div>

              <div className="bg-white border-[1.5px] border-[#1a2e2a] rounded-lg p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h2 className="text-sm font-bold text-[#1a2e2a] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#d44c3c]" />
                      Workspace Account & Cloud Vault
                    </h2>
                    <p className="text-xs text-[#1a2e2a]/75 leading-relaxed">
                      {user
                        ? `Signed in as ${user.email}. All documents, custom templates, and immutable version logs sync via Cloud Firestore security rules.`
                        : 'Currently operating in Local Session Mode. Sign in with Google to enable persistent encrypted cloud storage and real-time collaborator invites.'}
                    </p>
                  </div>
                  {!user && (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="btn-cta px-4 py-2.5 text-xs rounded-sm whitespace-nowrap shrink-0"
                    >
                      Connect Google
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#1a2e2a]/20">
                  <button
                    type="button"
                    disabled={!user}
                    onClick={() => user && updateUserStoragePreference(user.uid, 'standard_cloud')}
                    className={`text-left p-4 rounded-md border-[1.5px] transition-all ${
                      currentStorageTier === 'standard_cloud'
                        ? 'border-[#1a2e2a] bg-[#fdfaf3] shadow-[3px_3px_0_#d44c3c]'
                        : 'border-[#1a2e2a]/35 hover:border-[#1a2e2a]'
                    } disabled:opacity-60`}
                  >
                    <p className="font-display font-bold text-sm uppercase text-[#1a2e2a]">
                      Standard Cloud Sync
                    </p>
                    <p className="text-xs text-[#1a2e2a]/70 mt-1.5 leading-relaxed">
                      Enables instant multi-device synchronization, real-time collaborative editing rooms, and shareable team access controls.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={!user}
                    onClick={() => user && updateUserStoragePreference(user.uid, 'vault_restricted')}
                    className={`text-left p-4 rounded-md border-[1.5px] transition-all ${
                      currentStorageTier === 'vault_restricted'
                        ? 'border-[#1a2e2a] bg-[#fdfaf3] shadow-[3px_3px_0_#d44c3c]'
                        : 'border-[#1a2e2a]/35 hover:border-[#1a2e2a]'
                    } disabled:opacity-60`}
                  >
                    <p className="font-display font-bold text-sm uppercase text-[#1a2e2a]">
                      Restricted Private Vault
                    </p>
                    <p className="text-xs text-[#1a2e2a]/70 mt-1.5 leading-relaxed">
                      Defaults new contracts and executive reports to strict owner-only isolation with explicit per-email authorization required before sharing.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Utility / Inspector Pane */}
        <aside className="no-print pane-glass min-h-0 flex flex-col overflow-hidden">
          {view === 'editor' && activeDocument ? (
            <InspectorPanel
              activeTab={inspectorTab}
              onTabChange={setInspectorTab}
              document={{
                ...activeDocument,
                title: liveTitle || activeDocument.title,
                sections: liveSections.length ? liveSections : activeDocument.sections,
                status: liveStatus,
                wordCount: countWords(
                  liveSections.length ? liveSections : activeDocument.sections
                ),
              }}
              currentSections={liveSections.length ? liveSections : activeDocument.sections}
              activeSectionId={activeSectionId}
              isOwner={!user || activeDocument.ownerId === user.uid}
              isAuthenticated={Boolean(user)}
              socketConnected={connected}
              collaborators={collaborators}
              comments={activeComments}
              versions={activeVersions}
              auditResult={auditResult}
              auditing={auditing}
              onAddComment={async (sectionId, body) => {
                if (!user) return;
                const list = liveSections.length ? liveSections : activeDocument.sections;
                const sec = list.find((s) => s.id === sectionId) || list[0];
                await addDocumentComment({
                  document: activeDocument,
                  sectionId,
                  sectionHeading: sec?.heading || 'Section',
                  body,
                });
              }}
              onToggleCommentResolved={async (commentId, resolved) => {
                if (!user) return;
                await toggleCommentResolved(activeDocument.id, commentId, resolved);
              }}
              onSaveSnapshot={(label) =>
                handleSaveDocument({
                  nextTitle: liveTitle || activeDocument.title,
                  nextSections: liveSections.length ? liveSections : activeDocument.sections,
                  nextStatus: liveStatus,
                  createSnapshot: true,
                  snapshotLabel: label,
                })
              }
              onRestoreVersion={async (ver) => {
                remotePatchHandlerRef.current({ title: ver.title });
                for (const s of ver.sections) {
                  remotePatchHandlerRef.current({
                    sectionId: s.id,
                    heading: s.heading,
                    body: s.body,
                  });
                }
                await handleRestoreVersion(ver);
              }}
              onRunAudit={handleRunAuditFromInspector}
              onApplyAuditFix={handleApplyAuditFix}
              onUpdateSecurity={async (params) => {
                if (!user) return;
                await updateDocumentSecuritySettings({
                  documentId: activeDocument.id,
                  ...params,
                });
              }}
              onRequireSignIn={handleSignIn}
            />
          ) : (
            <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
              {/* Active Session Card */}
              <div className="border-[1.5px] border-[#1a2e2a] rounded bg-white p-4">
                <span className="mono-label block">Active Session</span>
                <p className="font-bold text-sm text-[#1a2e2a] mt-1">
                  {user ? 'Cloud Sync Active' : 'Local Session Only'}
                </p>
                <p className="text-xs text-[#1a2e2a]/60 mt-0.5 truncate">
                  {user ? user.email : 'Sign in for Cloud Sync'}
                </p>
              </div>

              {/* 2x2 Stat Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[#1a2e2a] p-4 rounded bg-white">
                  <span className="mono-label block">Files</span>
                  <div className="font-display font-extrabold text-2xl text-[#d44c3c] tabular-nums mt-1">
                    {totalCombinedDocs.length}
                  </div>
                </div>
                <div className="border border-[#1a2e2a] p-4 rounded bg-white">
                  <span className="mono-label block">Spaces</span>
                  <div className="font-display font-extrabold text-2xl text-[#d44c3c] tabular-nums mt-1">
                    {totalSharedCount}
                  </div>
                </div>
                <div className="border border-[#1a2e2a] p-4 rounded bg-white">
                  <span className="mono-label block">Vault</span>
                  <div className="font-display font-extrabold text-2xl text-[#d44c3c] tabular-nums mt-1">
                    {totalVaultCount}
                  </div>
                </div>
                <div className="border border-[#1a2e2a] p-4 rounded bg-white">
                  <span className="mono-label block">Custom</span>
                  <div className="font-display font-extrabold text-2xl text-[#d44c3c] tabular-nums mt-1">
                    {customTemplateCount}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizerTarget(null)}
                className="btn-secondary w-full py-3.5 px-4 text-xs rounded-sm"
              >
                Customize Templates
              </button>

              <button
                type="button"
                onClick={() => setView('studio')}
                className="btn-cta w-full py-4 px-4 text-xs rounded-sm inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                New AI Draft
              </button>

              {/* Dark Contrast Collaboration Card */}
              <div className="mt-auto bg-[#1a2e2a] text-[#fdfaf3] p-5 rounded-lg space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#d44c3c] block font-bold">
                  {user ? 'Cloud Vault Enabled' : 'Real-Time Collaboration'}
                </span>
                <p className="text-xs leading-relaxed text-[#fdfaf3]/90">
                  {user
                    ? 'Documents sync across sessions with immutable version control, WebSocket presence, and PDF/DOCX export.'
                    : 'Sign in with Google to persist drafts to Firestore, invite team reviewers, and sync live comments.'}
                </p>
                {!user && (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="pt-1 font-mono text-[11px] uppercase font-bold text-[#d44c3c] hover:underline block"
                  >
                    Connect Account →
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Quiet Footer */}
      <footer className="no-print flex flex-wrap items-center justify-between gap-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#1a2e2a]/55 shrink-0">
        <span>VellumDesk Studio</span>
        <span>Contracts · Business Reports · PDF & DOCX Export</span>
        <span>{user ? 'Storage: Cloud Firestore' : 'Storage: Local Session'}</span>
      </footer>

      {customizerTarget !== undefined && (
        <TemplateCustomizerModal
          initialTemplate={customizerTarget}
          ownerId={user?.uid || 'local_user'}
          isAuthenticated={Boolean(user)}
          onSave={handleSaveCustomTemplate}
          onClose={() => setCustomizerTarget(undefined)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
