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

export const RELATION_OPTIONS = (Object.keys(RELATION_LABELS) as FamilyRelation[]).map((value) => ({
  value,
  label: RELATION_LABELS[value],
}));
