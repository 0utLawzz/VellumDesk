import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type {
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
} from '../types/document';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function makeSafeId(prefix = 'id'): string {
  const raw = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function sanitizeId(value: string, fallbackPrefix = 'id'): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return ID_PATTERN.test(cleaned) && cleaned.length > 0 ? cleaned : makeSafeId(fallbackPrefix);
}

export function countWords(sections: DocumentSection[]): number {
  return sections.reduce((total, sec) => {
    const text = `${sec.heading} ${sec.body}`.trim();
    if (!text) return total;
    return total + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

function clampString(val: unknown, max: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.slice(0, max);
}

function sanitizeMetadata(meta: DocumentMetadata): Record<string, string> {
  const cleaned: Record<string, string> = {};
  const entries = Object.entries(meta || {}).slice(0, 16);
  for (const [k, v] of entries) {
    if (typeof v === 'string' && k.trim().length > 0) {
      cleaned[k.slice(0, 48)] = v.slice(0, 300);
    }
  }
  return cleaned;
}

function sanitizeSections(sections: DocumentSection[]): DocumentSection[] {
  const safe = (sections || []).slice(0, 30).map((s, idx) => ({
    id: sanitizeId(s.id || `sec_${idx + 1}`, 'sec'),
    heading: clampString(s.heading, 200, `Section ${idx + 1}`).trim() || `Section ${idx + 1}`,
    body: clampString(s.body, 20000, ''),
    order: idx + 1,
  }));
  if (safe.length === 0) {
    return [{ id: 'sec_1', heading: 'Overview', body: '', order: 1 }];
  }
  return safe;
}

function sanitizeSharedEmails(emails: string[]): string[] {
  const unique = new Set<string>();
  for (const email of emails || []) {
    const normalized = email.trim().toLowerCase();
    if (normalized.includes('@') && normalized.length <= 160) {
      unique.add(normalized);
    }
    if (unique.size >= 15) break;
  }
  return Array.from(unique);
}

export async function ensureUserProfile(user: User): Promise<UserProfile | null> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profile: Record<string, unknown> = {
      uid: user.uid,
      displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Workspace Member', 120, 'Workspace Member'),
      role: 'member',
      storagePreference: 'standard_cloud',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      profile.photoURL = clampString(user.photoURL, 500);
    }
    await setDoc(ref, profile);
    return {
      uid: user.uid,
      displayName: profile.displayName as string,
      photoURL: profile.photoURL as string | undefined,
      role: 'member',
      storagePreference: 'standard_cloud',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserStoragePreference(
  userId: string,
  storagePreference: StorageTier
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      storagePreference,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeOwnedDocuments(
  uid: string,
  onData: (docs: ManagedDocument[], fromCache: boolean) => void
): Unsubscribe {
  const path = 'documents';
  const q = query(collection(db, path), where('ownerId', '==', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ManagedDocument);
      onData(items, snap.metadata.fromCache);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeSharedDocuments(
  email: string,
  onData: (docs: ManagedDocument[]) => void
): Unsubscribe {
  const path = 'documents';
  const normalized = email.trim().toLowerCase();
  const q = query(
    collection(db, path),
    where('visibility', '==', 'shared'),
    where('sharedEmails', 'array-contains', normalized)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ManagedDocument);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeDocument(
  documentId: string,
  onData: (docData: ManagedDocument | null, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void
): Unsubscribe {
  const path = `documents/${documentId}`;
  return onSnapshot(
    doc(db, 'documents', documentId),
    { includeMetadataChanges: true },
    (snap) => {
      onData(snap.exists() ? (snap.data() as ManagedDocument) : null, {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeVersions(
  documentId: string,
  onData: (versions: DocumentVersion[]) => void
): Unsubscribe {
  const path = `documents/${documentId}/versions`;
  const q = query(collection(db, 'documents', documentId, 'versions'), orderBy('versionNumber', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as DocumentVersion));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeComments(
  documentId: string,
  onData: (comments: DocumentComment[]) => void
): Unsubscribe {
  const path = `documents/${documentId}/comments`;
  const q = query(collection(db, 'documents', documentId, 'comments'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as DocumentComment));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserTemplates(
  uid: string,
  onData: (templates: DocumentTemplate[]) => void
): Unsubscribe {
  const path = 'templates';
  const q = query(collection(db, path), where('ownerId', '==', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as DocumentTemplate));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCloudDocument(
  docInput: Omit<ManagedDocument, 'createdAt' | 'updatedAt' | 'wordCount' | 'currentVersion'>,
  initialVersionLabel: string,
  changeSummary: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required for cloud storage.');

  const safeId = sanitizeId(docInput.id, 'doc');
  const safeSections = sanitizeSections(docInput.sections);
  const safeEmails = sanitizeSharedEmails(docInput.sharedEmails);
  const wordCount = countWords(safeSections);
  const ownerName = clampString(currentUser.displayName || currentUser.email || 'Author', 120, 'Author');

  const path = `documents/${safeId}`;
  try {
    const payload = {
      id: safeId,
      ownerId: currentUser.uid,
      ownerName,
      title: clampString(docInput.title, 200, 'Untitled Document').trim() || 'Untitled Document',
      category: docInput.category,
      templateId: clampString(docInput.templateId, 128, 'custom'),
      templateName: clampString(docInput.templateName, 140, 'Custom Template'),
      status: docInput.status,
      visibility: docInput.visibility,
      storageTier: docInput.storageTier,
      sharedEmails: safeEmails,
      metadata: sanitizeMetadata(docInput.metadata),
      sections: safeSections,
      currentVersion: 1,
      wordCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'documents', safeId), payload);

    const versionId = makeSafeId('ver');
    await setDoc(doc(db, 'documents', safeId, 'versions', versionId), {
      id: versionId,
      documentId: safeId,
      docOwnerId: currentUser.uid,
      docVisibility: docInput.visibility,
      docSharedEmails: safeEmails,
      versionNumber: 1,
      label: clampString(initialVersionLabel, 160, 'Initial AI Draft'),
      changeSummary: clampString(changeSummary, 500, 'Initial generated draft.'),
      authorId: currentUser.uid,
      authorName: ownerName,
      title: payload.title,
      sections: safeSections,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDocumentAndSnapshot(params: {
  document: ManagedDocument;
  nextTitle: string;
  nextSections: DocumentSection[];
  nextMetadata?: DocumentMetadata;
  nextStatus?: DocumentStatus;
  createSnapshot?: boolean;
  snapshotLabel?: string;
  changeSummary?: string;
}): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const {
    document: existingDoc,
    nextTitle,
    nextSections,
    nextMetadata,
    nextStatus,
    createSnapshot = false,
    snapshotLabel = 'Manual Revision',
    changeSummary = 'Updated document content.',
  } = params;

  const safeSections = sanitizeSections(nextSections);
  const safeTitle = clampString(nextTitle, 200, existingDoc.title).trim() || 'Untitled Document';
  const wordCount = countWords(safeSections);
  const nextVersion = createSnapshot ? existingDoc.currentVersion + 1 : existingDoc.currentVersion;
  const isOwner = existingDoc.ownerId === currentUser.uid;
  const path = `documents/${existingDoc.id}`;

  try {
    const updatePayload: Record<string, unknown> = {
      title: safeTitle,
      sections: safeSections,
      metadata: sanitizeMetadata(nextMetadata ?? existingDoc.metadata),
      currentVersion: nextVersion,
      wordCount,
      updatedAt: serverTimestamp(),
    };

    if (nextStatus && (isOwner || nextStatus === 'draft' || nextStatus === 'in_review')) {
      updatePayload.status = nextStatus;
    }

    await updateDoc(doc(db, 'documents', existingDoc.id), updatePayload);

    if (createSnapshot) {
      const versionId = makeSafeId('ver');
      const authorName = clampString(
        currentUser.displayName || currentUser.email || 'Collaborator',
        120,
        'Collaborator'
      );
      await setDoc(doc(db, 'documents', existingDoc.id, 'versions', versionId), {
        id: versionId,
        documentId: existingDoc.id,
        docOwnerId: existingDoc.ownerId,
        docVisibility: existingDoc.visibility,
        docSharedEmails: existingDoc.sharedEmails || [],
        versionNumber: nextVersion,
        label: clampString(snapshotLabel, 160, `Revision v${nextVersion}`),
        changeSummary: clampString(changeSummary, 500, 'Saved revision snapshot.'),
        authorId: currentUser.uid,
        authorName,
        title: safeTitle,
        sections: safeSections,
        createdAt: serverTimestamp(),
      });
    }

    return nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDocumentSecuritySettings(params: {
  documentId: string;
  visibility: DocumentVisibility;
  storageTier: StorageTier;
  sharedEmails: string[];
  status: DocumentStatus;
}): Promise<void> {
  const { documentId, visibility, storageTier, sharedEmails, status } = params;
  const safeEmails = sanitizeSharedEmails(sharedEmails);
  const path = `documents/${documentId}`;

  try {
    await updateDoc(doc(db, 'documents', documentId), {
      visibility,
      storageTier,
      sharedEmails: safeEmails,
      status,
      updatedAt: serverTimestamp(),
    });

    // Propagate ACL visibility & sharedEmails to subcollections so list queries stay synced
    const [versionsSnap, commentsSnap] = await Promise.all([
      getDocs(collection(db, 'documents', documentId, 'versions')),
      getDocs(collection(db, 'documents', documentId, 'comments')),
    ]);

    const batch = writeBatch(db);
    let opCount = 0;
    for (const v of versionsSnap.docs) {
      batch.update(v.ref, { docVisibility: visibility, docSharedEmails: safeEmails });
      opCount++;
    }
    for (const c of commentsSnap.docs) {
      batch.update(c.ref, {
        docVisibility: visibility,
        docSharedEmails: safeEmails,
        updatedAt: serverTimestamp(),
      });
      opCount++;
    }
    if (opCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudDocument(documentId: string): Promise<void> {
  const path = `documents/${documentId}`;
  try {
    await deleteDoc(doc(db, 'documents', documentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUserTemplate(template: DocumentTemplate): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required to save templates.');

  const safeId = sanitizeId(template.id, 'tpl');
  const path = `templates/${safeId}`;
  try {
    const existing = await getDoc(doc(db, 'templates', safeId));
    const safeSections = (template.sections || []).slice(0, 20).map((s, idx) => ({
      id: sanitizeId(s.id || `tsec_${idx + 1}`, 'tsec'),
      title: clampString(s.title, 140, `Section ${idx + 1}`),
      guidance: clampString(s.guidance, 400, ''),
    }));
    const safeVars = (template.variables || [])
      .slice(0, 20)
      .map((v) => clampString(v.trim(), 60))
      .filter(Boolean);

    if (existing.exists()) {
      await updateDoc(doc(db, 'templates', safeId), {
        name: clampString(template.name, 140, 'Custom Template'),
        category: template.category,
        description: clampString(template.description, 600, ''),
        tone: template.tone,
        jurisdiction: clampString(template.jurisdiction, 120, 'Delaware, United States'),
        sections: safeSections,
        variables: safeVars,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'templates', safeId), {
        id: safeId,
        ownerId: currentUser.uid,
        name: clampString(template.name, 140, 'Custom Template'),
        category: template.category,
        description: clampString(template.description, 600, ''),
        tone: template.tone,
        jurisdiction: clampString(template.jurisdiction, 120, 'Delaware, United States'),
        sections: safeSections,
        variables: safeVars,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserTemplate(templateId: string): Promise<void> {
  const path = `templates/${templateId}`;
  try {
    await deleteDoc(doc(db, 'templates', templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addDocumentComment(params: {
  document: ManagedDocument;
  sectionId: string;
  sectionHeading: string;
  body: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Sign in to post review comments.');

  const commentId = makeSafeId('cmt');
  const path = `documents/${params.document.id}/comments/${commentId}`;
  try {
    await setDoc(doc(db, 'documents', params.document.id, 'comments', commentId), {
      id: commentId,
      documentId: params.document.id,
      docOwnerId: params.document.ownerId,
      docVisibility: params.document.visibility,
      docSharedEmails: params.document.sharedEmails || [],
      sectionId: clampString(params.sectionId, 128, 'sec_1'),
      sectionHeading: clampString(params.sectionHeading, 200, 'Section'),
      authorId: currentUser.uid,
      authorName: clampString(
        currentUser.displayName || currentUser.email || 'Reviewer',
        120,
        'Reviewer'
      ),
      body: clampString(params.body.trim(), 2000, ''),
      resolved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleCommentResolved(
  documentId: string,
  commentId: string,
  resolved: boolean
): Promise<void> {
  const path = `documents/${documentId}/comments/${commentId}`;
  try {
    await updateDoc(doc(db, 'documents', documentId, 'comments', commentId), {
      resolved,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
