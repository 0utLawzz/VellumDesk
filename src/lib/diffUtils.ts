import type { DocumentSection } from '../types/document';

export interface SectionDiffItem {
  id: string;
  heading: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldBody: string;
  newBody: string;
}

export function computeSectionDiff(
  olderSections: DocumentSection[],
  newerSections: DocumentSection[]
): SectionDiffItem[] {
  const results: SectionDiffItem[] = [];
  const oldById = new Map(olderSections.map((s) => [s.id, s]));
  const seenIds = new Set<string>();

  for (const newer of newerSections) {
    seenIds.add(newer.id);
    const older = oldById.get(newer.id);
    if (!older) {
      results.push({
        id: newer.id,
        heading: newer.heading,
        status: 'added',
        oldBody: '',
        newBody: newer.body,
      });
    } else if (older.heading !== newer.heading || older.body !== newer.body) {
      results.push({
        id: newer.id,
        heading: newer.heading,
        status: 'modified',
        oldBody: older.body,
        newBody: newer.body,
      });
    } else {
      results.push({
        id: newer.id,
        heading: newer.heading,
        status: 'unchanged',
        oldBody: older.body,
        newBody: newer.body,
      });
    }
  }

  for (const older of olderSections) {
    if (!seenIds.has(older.id)) {
      results.push({
        id: older.id,
        heading: older.heading,
        status: 'removed',
        oldBody: older.body,
        newBody: '',
      });
    }
  }

  return results;
}
