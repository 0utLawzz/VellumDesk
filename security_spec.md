# Firestore Security Specification (Phase 0)

## Data Invariants
1. **Identity & Role Integrity**: Users may only create their own `/users/{userId}` profile with `role == 'member'` and `uid == request.auth.uid`. No user may self-assign elevated roles.
2. **Owner & Collaborator Isolation**: Private documents (`visibility == 'private'`) are readable and writable exclusively by `ownerId == request.auth.uid`. Shared documents (`visibility == 'shared'`) grant read/edit access only to `ownerId` or verified emails explicitly present in `sharedEmails` (bounded to <= 15).
3. **Immutable Version History**: Documents under `/documents/{documentId}/versions/{versionId}` cannot be updated or deleted once created, preserving an auditable trail.
4. **Master Gate Parent Integrity**: Subcollection reads (`get`), creates, updates, and deletes verify parent `/documents/{documentId}` existence and membership via `get()`.
5. **Temporal Integrity & Immortality**: `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt`, `ownerId`, and `id` are immutable after creation.

## Dirty Dozen Adversarial Payloads
1. **Shadow Field Injection on Document Create**: Including `{ isAdmin: true }` in `/documents/{docId}` create payload -> Rejected by `hasOnly(...)`.
2. **Owner Spoofing on Create**: Setting `ownerId` to another user's UID -> Rejected by `incoming().ownerId == request.auth.uid`.
3. **Privilege Escalation on User Profile**: Setting `role: 'admin'` on `/users/{uid}` -> Rejected by `incoming().role == 'member'`.
4. **Email Spoofing Attack**: Accessing a `shared` document with matching email claim when `request.auth.token.email_verified == false` -> Rejected by `isVerifiedEmail()`.
5. **Path ID Poisoning**: Creating a document with a 1500-char or slash-containing `documentId` -> Rejected by `isValidId(documentId)`.
6. **Client Timestamp Forgery**: Creating a document with backdated `createdAt` (`!= request.time`) -> Rejected by `incoming().createdAt == request.time`.
7. **Immortal Field Tampering**: Updating `ownerId` or `createdAt` on an existing document -> Rejected by update invariance checks.
8. **Version History Tampering**: Calling `update` or `delete` on `/documents/{docId}/versions/{versionId}` -> Rejected by `allow update, delete: if false;`.
9. **Archived Terminal State Mutation**: Collaborator editing sections of an `archived` document -> Rejected by terminal state guard (only owner may unarchive or modify).
10. **Unbounded Array Exhaustion**: Pushing > 15 emails into `sharedEmails` or > 30 sections into `sections` -> Rejected by `.size()` upper bounds.
11. **Orphaned Subcollection Write**: Creating a version or comment under a non-existent `documentId` -> Rejected by parent `exists()` / `get()` Master Gate.
12. **PII / Blanket Scraping**: Querying `/users` or `/documents` without owner/shared filter -> Rejected by `allow list` rules requiring `resource.data.ownerId == request.auth.uid` or verified `sharedEmails` membership.
