/**
 * Deletes test blood requests (patient name ending in "(test)") and the alerts they sent.
 * Run with "launch\6 - Delete Test Requests.cmd".
 */
import { PrismaClient } from '@prisma/client';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.bloodRequest.findMany({
    where: { patientName: { endsWith: '(test)' } },
    select: { id: true, publicCode: true, patientName: true },
  });
  if (!requests.length) {
    console.log('No test requests found (patient name ending in "(test)").');
    return;
  }
  for (const r of requests) {
    const n = await prisma.notification.deleteMany({ where: { relatedEntity: `/app/requests/${r.id}` } });
    await prisma.bloodRequest.delete({ where: { id: r.id } }); // responses, documents and reports are removed with it
    await rm(resolve(process.cwd(), 'uploads', 'requests', r.id), { recursive: true, force: true });
    console.log(`DELETED  ${r.publicCode} (${r.patientName}) and ${n.count} alert(s)`);
  }
}

main()
  .catch((err) => {
    console.error('FAILED:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
