export type DocumentCategory = 'contract' | 'report';

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export type DocumentVisibility = 'private' | 'shared';

export type StorageTier = 'standard_cloud' | 'vault_restricted';

export type TemplateTone =
  | 'formal_legal'
  | 'executive_concise'
  | 'boardroom_analytical'
  | 'commercial_balanced';

export interface TemplateSectionSpec {
  id: string;
  title: string;
  guidance: string;
}

export interface DocumentTemplate {
  id: string;
  ownerId: string;
  isBuiltIn?: boolean;
  name: string;
  category: DocumentCategory;
  description: string;
  tone: TemplateTone;
  jurisdiction: string;
  sections: TemplateSectionSpec[];
  variables: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentSection {
  id: string;
  heading: string;
  body: string;
  order: number;
}

export interface DocumentMetadata {
  partyA?: string;
  partyB?: string;
  effectiveDate?: string;
  jurisdiction?: string;
  contractValue?: string;
  reportPeriod?: string;
  executiveSponsor?: string;
  tone?: TemplateTone;
  [key: string]: string | undefined;
}

export interface ManagedDocument {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category: DocumentCategory;
  templateId: string;
  templateName: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  storageTier: StorageTier;
  sharedEmails: string[];
  metadata: DocumentMetadata;
  sections: DocumentSection[];
  currentVersion: number;
  wordCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  docOwnerId: string;
  docVisibility: DocumentVisibility;
  docSharedEmails: string[];
  versionNumber: number;
  label: string;
  changeSummary: string;
  authorId: string;
  authorName: string;
  title: string;
  sections: DocumentSection[];
  createdAt?: unknown;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  docOwnerId: string;
  docVisibility: DocumentVisibility;
  docSharedEmails: string[];
  sectionId: string;
  sectionHeading: string;
  authorId: string;
  authorName: string;
  body: string;
  resolved: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentAuditFinding {
  severity: 'high' | 'medium' | 'low';
  sectionHeading: string;
  issue: string;
  recommendation: string;
}

export interface DocumentAuditResult {
  summary: string;
  findings: DocumentAuditFinding[];
}

export interface CollaboratorPresence {
  clientId: string;
  uid: string;
  name: string;
  color: string;
  activeSectionId: string | null;
  isTyping?: boolean;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: 'member';
  storagePreference: StorageTier;
  createdAt?: unknown;
  updatedAt?: unknown;
}
