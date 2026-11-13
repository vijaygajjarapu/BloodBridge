import type { FamilyRelation } from '../../types/family';

export const RELATION_LABELS: Record<FamilyRelation, string> = {
  self: 'Me',
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  father: 'Father',
  mother: 'Mother',
  brother: 'Brother',
  sister: 'Sister',
  grandparent: 'Grandparent',
  other: 'Other',
};

/** "Manjusha's brother": how a pledger's family member is related to the person who pledged to you */
export function relationTo(personName: string, relation?: string | null): string {
  const word = relation && relation !== 'self' && relation !== 'other' ? (RELATION_LABELS[relation as FamilyRelation] || '').toLowerCase() : '';
  return `${personName}'s ${word || 'family member'}`;
}

export const RELATION_OPTIONS = (Object.keys(RELATION_LABELS) as FamilyRelation[]).map((value) => ({
  value,
  label: RELATION_LABELS[value],
}));
