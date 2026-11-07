import { prisma } from '../../config/database.js';

/**
 * A small SAMPLE list of well-known hospitals so suggestions work from day one.
 * Areas are given; PIN codes are left empty on purpose (they get filled in when someone enters them).
 * The list grows automatically from the hospitals people type when posting requests.
 */
const SAMPLE_HOSPITALS: { name: string; area: string; city: string; district: string; state: string }[] = [
  { name: 'Apollo Hospitals', area: 'Jubilee Hills', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Yashoda Hospitals', area: 'Secunderabad', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Yashoda Hospitals', area: 'Somajiguda', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'KIMS Hospitals', area: 'Secunderabad', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Nizam’s Institute of Medical Sciences (NIMS)', area: 'Punjagutta', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Osmania General Hospital', area: 'Afzal Gunj', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Gandhi Hospital', area: 'Musheerabad', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'CARE Hospitals', area: 'Banjara Hills', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Niloufer Hospital', area: 'Red Hills', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Rainbow Children’s Hospital', area: 'Banjara Hills', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Continental Hospitals', area: 'Gachibowli', city: 'Hyderabad', district: 'Rangareddy', state: 'Telangana' },
  { name: 'AIG Hospitals', area: 'Gachibowli', city: 'Hyderabad', district: 'Rangareddy', state: 'Telangana' },
];

export const nameKeyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

let seeded = false;
export async function ensureSampleHospitals() {
  if (seeded) return;
  seeded = true;
  const count = await prisma.hospital.count();
  if (count > 0) return;
  for (const h of SAMPLE_HOSPITALS) {
    // Same chain in two areas: keep both by adding the area to the key
    const nameKey = nameKeyOf(`${h.name} ${h.area}`);
    await prisma.hospital
      .create({ data: { ...h, country: 'IN', nameKey, source: 'sample' } })
      .catch(() => undefined);
  }
}

/** Suggestions for a district (and PIN code), best matches first */
export async function suggestHospitals(q: { country: string; state: string; district?: string; pinCode?: string; search?: string }) {
  await ensureSampleHospitals();
  const where: any = { country: q.country, state: q.state };
  if (q.district) where.district = q.district;
  const search = (q.search || '').trim().toLowerCase();
  const rows = await prisma.hospital.findMany({ where, take: 300 });
  const scored = rows
    .filter((h) => !search || h.nameKey.includes(search) || (h.area || '').toLowerCase().includes(search))
    .map((h) => ({
      h,
      score: (q.pinCode && h.pinCode === q.pinCode ? 100 : 0) + (search && h.nameKey.startsWith(search) ? 20 : 0) + Math.min(h.useCount, 50),
    }))
    .sort((a, b) => b.score - a.score || a.h.name.localeCompare(b.h.name))
    .slice(0, 12);
  return scored.map(({ h }) => ({
    id: h.id,
    name: h.name,
    area: h.area,
    city: h.city,
    district: h.district,
    state: h.state,
    pinCode: h.pinCode,
    samePin: Boolean(q.pinCode && h.pinCode === q.pinCode),
  }));
}

/** Remember the hospital typed in a request (fills in area / PIN code that were missing) */
export async function rememberHospital(h: { name: string; area?: string | null; city?: string | null; district: string; state: string; country: string; pinCode?: string | null }) {
  const plainKey = nameKeyOf(h.name);
  const areaKey = h.area ? nameKeyOf(`${h.name} ${h.area}`) : null;
  const existing = await prisma.hospital.findFirst({
    where: { country: h.country, state: h.state, district: h.district, nameKey: { in: [plainKey, ...(areaKey ? [areaKey] : [])] } },
  });
  if (existing) {
    await prisma.hospital.update({
      where: { id: existing.id },
      data: {
        useCount: { increment: 1 },
        area: existing.area || h.area || null,
        city: existing.city || h.city || null,
        pinCode: existing.pinCode || h.pinCode || null,
      },
    });
    return true; // already known
  }
  await prisma.hospital
    .create({
      data: {
        nameKey: areaKey || plainKey,
        name: h.name.trim(),
        area: h.area || null,
        city: h.city || null,
        district: h.district,
        state: h.state,
        country: h.country,
        pinCode: h.pinCode || null,
        source: 'user',
        useCount: 1,
      },
    })
    .catch(() => undefined);
  return false; // new hospital
}
