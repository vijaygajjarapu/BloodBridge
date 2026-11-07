import type { BloodGroup } from '../types/donor';

export const BLOOD_GROUPS: {
  value: BloodGroup;
  label: string;
  canDonateTo: BloodGroup[];
  canReceiveFrom: BloodGroup[];
  isUniversalDonor?: boolean;
  isUniversalRecipient?: boolean;
}[] = [
  {
    value: 'O-',
    label: 'O Negative (O-)',
    canDonateTo: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    canReceiveFrom: ['O-'],
    isUniversalDonor: true,
  },
  {
    value: 'O+',
    label: 'O Positive (O+)',
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O+', 'O-'],
  },
  {
    value: 'A-',
    label: 'A Negative (A-)',
    canDonateTo: ['A+', 'A-', 'AB+', 'AB-'],
    canReceiveFrom: ['A-', 'O-'],
  },
  {
    value: 'A+',
    label: 'A Positive (A+)',
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
  },
  {
    value: 'B-',
    label: 'B Negative (B-)',
    canDonateTo: ['B+', 'B-', 'AB+', 'AB-'],
    canReceiveFrom: ['B-', 'O-'],
  },
  {
    value: 'B+',
    label: 'B Positive (B+)',
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
  },
  {
    value: 'AB-',
    label: 'AB Negative (AB-)',
    canDonateTo: ['AB+', 'AB-'],
    canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
  },
  {
    value: 'AB+',
    label: 'AB Positive (AB+)',
    canDonateTo: ['AB+'],
    canReceiveFrom: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    isUniversalRecipient: true,
  },
];

export const BLOOD_GROUP_VALUES: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
