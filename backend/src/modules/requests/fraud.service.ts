import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';

/**
 * Fraud checks for blood requests.
 *
 * 1. Automatic risk score when a request is posted (warning signs below; asking for money alone = held).
 *    low (< 30): goes live · medium (30-59): live, marked "under review", admins alerted
 *    high (>= 60): held (no donor alerts) until an admin releases it.
 * 2. Patient document: re-used file, edited-image signs, and text read from the document (OCR)
 *    compared with the request (hospital, patient name, blood group, recent date).
 * 3. Donor reports: 3 reports pause the request automatically.
 *
 * Software cannot prove a stamp or signature is real; the hospital confirms that (admin "call hospital").
 */

export const RISK_MEDIUM = 30;
export const RISK_HIGH = 60;
export const REPORTS_TO_PAUSE = 3;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
export const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

/** Words that suggest money is being asked for, or a broker / agent is involved */
const MONEY_WORDS = [
  'pay', 'payment', 'paid', 'charges', 'charge', 'fee', 'fees', 'processing', 'rs.', 'rs ', 'rupees', '₹', 'inr',
  'upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'account number', 'ifsc', 'transfer', 'deposit', 'advance',
  'agent', 'broker', 'arrange donor', 'arrange donors', 'commission', 'donation amount', 'per unit cost',
];

export interface RiskFlag {
  code: string;
  label: string;
  points: number;
}

export function riskLevel(score: number): 'low' | 'medium' | 'high' {
  return score >= RISK_HIGH ? 'high' : score >= RISK_MEDIUM ? 'medium' : 'low';
}

export function findMoneyWords(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  return MONEY_WORDS.filter((w) => (w.length <= 4 ? new RegExp(`[^a-z]${w.replace('.', '\\.')}[^a-z]`).test(t) : t.includes(w)));
}

/** Warning signs when a request is posted */
export async function assessNewRequest(input: {
  requesterUserId: string;
  requestId: string;
  patientName: string;
  notes?: string | null;
  hospitalName: string;
  hospitalArea?: string | null;
  hospitalPinCode?: string | null;
  district: string;
  state: string;
  country: string;
  unitsNeeded: number;
  urgency: string;
  hospitalKnown: boolean;
}): Promise<RiskFlag[]> {
  const flags: RiskFlag[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { id: input.requesterUserId } });
  const newAccount = Boolean(user && Date.now() - user.createdAt.getTime() < 24 * 60 * 60 * 1000);
  if (newAccount) flags.push({ code: 'new_account', label: 'Account created less than a day ago', points: 20 });

  const recent = await prisma.bloodRequest.findMany({
    where: { requesterUserId: input.requesterUserId, id: { not: input.requestId }, createdAt: { gte: dayAgo } },
    select: { district: true },
  });
  if (recent.length >= 2) flags.push({ code: 'many_requests', label: `${recent.length + 1} requests in the last 24 hours`, points: 15 });
  if (recent.some((r) => r.district !== input.district)) {
    flags.push({ code: 'many_districts', label: 'Requests in different districts within 24 hours', points: 25 });
  }

  const samePatient = await prisma.bloodRequest.count({
    where: {
      id: { not: input.requestId },
      requesterUserId: { not: input.requesterUserId },
      patientName: input.patientName,
      createdAt: { gte: monthAgo },
    },
  });
  if (samePatient > 0) flags.push({ code: 'patient_reused', label: 'Same patient name posted by another account recently', points: 25 });

  if (input.notes && input.notes.trim().length >= 20) {
    const sameNotes = await prisma.bloodRequest.count({
      where: { id: { not: input.requestId }, requesterUserId: { not: input.requesterUserId }, notes: input.notes, createdAt: { gte: monthAgo } },
    });
    if (sameNotes > 0) flags.push({ code: 'notes_copied', label: 'Notes copied from another account’s request', points: 15 });
  }

  const money = findMoneyWords([input.notes, input.patientName, input.hospitalArea].filter(Boolean).join(' '));
  if (money.length) {
    flags.push({ code: 'money_words', label: `Mentions money or an agent ("${money.slice(0, 3).join('", "')}")`, points: 60 });
  }

  if (!input.hospitalKnown) flags.push({ code: 'unknown_hospital', label: 'Hospital not in our list yet', points: 10 });

  if (input.hospitalPinCode) {
    const elsewhere = await prisma.hospital.findFirst({
      where: { country: input.country, pinCode: input.hospitalPinCode, NOT: { district: input.district } },
      select: { district: true },
    });
    if (elsewhere) flags.push({ code: 'pin_mismatch', label: `PIN code belongs to ${elsewhere.district}, not ${input.district}`, points: 15 });
  }

  if (newAccount && input.urgency === 'critical' && input.unitsNeeded >= 4) {
    flags.push({ code: 'large_critical_new', label: 'New account asking for 4+ units as critical', points: 15 });
  }
  return flags;
}

export function scoreOf(flags: RiskFlag[]) {
  return Math.min(100, flags.reduce((sum, f) => sum + f.points, 0));
}

export function parseFlags(json: string | null | undefined): RiskFlag[] {
  try {
    return json ? (JSON.parse(json) as RiskFlag[]) : [];
  } catch {
    return [];
  }
}

/** Adds flags to a request and applies the consequences (review / hold / admin alert) */
export async function applyRisk(requestId: string, newFlags: RiskFlag[], source: string) {
  const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
  if (!r) return null;
  const existing = parseFlags(r.riskFlags);
  const merged = [...existing.filter((f) => !newFlags.some((n) => n.code === f.code)), ...newFlags];
  const score = scoreOf(merged);
  const before = riskLevel(r.riskScore);
  const level = riskLevel(score);

  const data: Record<string, unknown> = { riskScore: score, riskFlags: JSON.stringify(merged) };
  if (level !== 'low' && r.verificationStatus === 'unverified') data.verificationStatus = 'pending_review';
  if (level === 'high' && !r.onHold && r.verificationStatus !== 'verified') {
    data.onHold = true;
    data.holdReason = 'Automatic safety check: our team is reviewing this request before donors are alerted.';
  }
  await prisma.bloodRequest.update({ where: { id: requestId }, data });

  if (level !== 'low' && level !== before) {
    const admins = await prisma.user.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const a of admins) {
      await prisma.notification.create({
        data: {
          recipientId: a.id,
          notificationType: 'system',
          title: `${level === 'high' ? 'Held' : 'Check'}: blood request ${r.publicCode} (risk ${score})`,
          message: `${source}: ${merged.map((f) => f.label).join('; ')}`,
          relatedEntity: '/admin/requests',
        },
      });
    }
  }
  if (merged.length) logger.warn(`Request ${r.publicCode} risk ${score} (${level}) after ${source}`);
  return { score, level, flags: merged };
}

// ---------------- Documents ----------------

function textHas(text: string, needle: string) {
  return text.includes(needle.toLowerCase());
}

/** Looks for signs that an image / PDF was produced or edited in a design or photo-editing app */
function editingSoftware(buf: Buffer): string | null {
  const head = buf.subarray(0, Math.min(buf.length, 256 * 1024)).toString('latin1');
  const tail = buf.subarray(Math.max(0, buf.length - 64 * 1024)).toString('latin1');
  const hay = head + tail;
  const tools = ['Adobe Photoshop', 'Photoshop', 'GIMP', 'Canva', 'PicsArt', 'Snapseed', 'Pixlr', 'Fotor', 'PhotoDirector', 'Lightroom', 'Paint.NET'];
  return tools.find((t) => hay.includes(t)) || null;
}

async function extractText(buf: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      const out = await pdfParse(buf);
      return out.text || '';
    }
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(buf);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  } catch (err: any) {
    logger.error(`Document text extraction failed: ${err?.message}`);
    return '';
  }
}

const BLOOD_WORDS: Record<string, string[]> = {
  'A+': ['a+', 'a +ve', 'a positive', 'a pos', 'a+ve'],
  'A-': ['a-', 'a -ve', 'a negative', 'a neg', 'a-ve'],
  'B+': ['b+', 'b +ve', 'b positive', 'b pos', 'b+ve'],
  'B-': ['b-', 'b -ve', 'b negative', 'b neg', 'b-ve'],
  'AB+': ['ab+', 'ab +ve', 'ab positive', 'ab pos', 'ab+ve'],
  'AB-': ['ab-', 'ab -ve', 'ab negative', 'ab neg', 'ab-ve'],
  'O+': ['o+', 'o +ve', 'o positive', 'o pos', 'o+ve', '0+', '0 +ve', '0 positive'],
  'O-': ['o-', 'o -ve', 'o negative', 'o neg', 'o-ve', '0-', '0 -ve', '0 negative'],
};

function recentDateIn(text: string): 'recent' | 'old' | 'none' {
  const re = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = re.exec(text))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    found = true;
    const t = new Date(y, mo - 1, d).getTime();
    const ageDays = (Date.now() - t) / 86_400_000;
    if (ageDays >= -2 && ageDays <= 30) return 'recent';
  }
  return found ? 'old' : 'none';
}

export interface DocCheck {
  code: string;
  label: string;
  outcome: 'pass' | 'warn' | 'fail' | 'info';
}

/** Saves a document and starts the checks (text reading runs in the background) */
export async function addDocument(userId: string, requestId: string, input: { fileName: string; mimeType: string; dataBase64: string }) {
  const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
  if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
  const ext = ALLOWED_TYPES[input.mimeType];
  if (!ext) {
    throw new AppError('Please upload a photo (JPG or PNG) or a PDF.', 400, 'VALIDATION_FAILED', { document: 'Please upload a photo (JPG or PNG) or a PDF.' });
  }
  const buf = Buffer.from(input.dataBase64.replace(/^data:[^,]+,/, ''), 'base64');
  if (!buf.length) throw new AppError('The file is empty.', 400, 'VALIDATION_FAILED', { document: 'The file is empty.' });
  if (buf.length > MAX_DOC_BYTES) {
    throw new AppError('The file is larger than 5 MB. Please upload a smaller photo.', 400, 'VALIDATION_FAILED', { document: 'The file is larger than 5 MB.' });
  }
  const count = await prisma.requestDocument.count({ where: { requestId } });
  if (count >= 3) throw new AppError('You can upload up to 3 documents per request.', 400, 'VALIDATION_FAILED');

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const rel = path.join('requests', requestId, `${sha256.slice(0, 16)}.${ext}`);
  await fs.mkdir(path.join(UPLOAD_ROOT, 'requests', requestId), { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, rel), buf);

  const doc = await prisma.requestDocument.create({
    data: {
      requestId,
      uploaderUserId: userId,
      fileName: input.fileName.slice(0, 120),
      mimeType: input.mimeType,
      sizeBytes: buf.length,
      sha256,
      storagePath: rel,
      result: 'checking',
    },
  });
  await prisma.bloodRequest.update({ where: { id: requestId }, data: { documentStatus: 'checking' } });

  // Run the checks without making the person wait
  void checkDocument(doc.id).catch((err) => logger.error(`Document check failed: ${err?.message}`));
  return doc;
}

export async function checkDocument(documentId: string) {
  const doc = await prisma.requestDocument.findUnique({ where: { id: documentId } });
  if (!doc) return;
  const r = await prisma.bloodRequest.findUnique({ where: { id: doc.requestId } });
  if (!r) return;
  const buf = await fs.readFile(path.join(UPLOAD_ROOT, doc.storagePath));
  const checks: DocCheck[] = [];
  const riskFlags: RiskFlag[] = [];

  // 1. Same file used in another request
  const reused = await prisma.requestDocument.findFirst({
    where: { sha256: doc.sha256, requestId: { not: doc.requestId } },
    select: { requestId: true },
  });
  if (reused) {
    checks.push({ code: 'reused', label: 'This exact file was already used in another request', outcome: 'fail' });
    riskFlags.push({ code: 'doc_reused', label: 'Document re-used from another request', points: 35 });
  } else {
    checks.push({ code: 'reused', label: 'Not used in any other request', outcome: 'pass' });
  }

  // 2. Editing software traces
  const tool = editingSoftware(buf);
  if (tool) {
    checks.push({ code: 'edited', label: `File was saved by an editing app (${tool})`, outcome: 'warn' });
    riskFlags.push({ code: 'doc_edited', label: `Document edited with ${tool}`, points: 15 });
  } else {
    checks.push({ code: 'edited', label: 'No signs of photo-editing apps', outcome: 'pass' });
  }

  // 3. Read the text and compare with the request
  const raw = await extractText(buf, doc.mimeType);
  const text = raw.toLowerCase().replace(/\s+/g, ' ');
  let matched = 0;
  if (text.trim().length < 20) {
    checks.push({ code: 'text', label: 'Could not read text from the document (blurry or handwritten?)', outcome: 'warn' });
  } else {
    const hospitalWords = r.hospitalName.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !['hospital', 'hospitals', 'clinic'].includes(w));
    const hospitalOk = hospitalWords.length ? hospitalWords.some((w) => textHas(text, w)) : textHas(text, r.hospitalName);
    checks.push({ code: 'hospital', label: hospitalOk ? `Hospital name found (${r.hospitalName})` : `Hospital name "${r.hospitalName}" not found`, outcome: hospitalOk ? 'pass' : 'warn' });
    if (hospitalOk) matched++;

    const nameWords = r.patientName.toLowerCase().replace(/\(test\)/, '').split(/[^a-z]+/).filter((w) => w.length >= 3);
    const nameOk = nameWords.some((w) => textHas(text, w));
    checks.push({ code: 'patient', label: nameOk ? 'Patient name found' : 'Patient name not found', outcome: nameOk ? 'pass' : 'warn' });
    if (nameOk) matched++;

    const groupOk = (BLOOD_WORDS[r.bloodGroup] || []).some((w) => textHas(text, w));
    checks.push({ code: 'group', label: groupOk ? `Blood group ${r.bloodGroup} found` : `Blood group ${r.bloodGroup} not found`, outcome: groupOk ? 'pass' : 'warn' });
    if (groupOk) matched++;

    const date = recentDateIn(text);
    checks.push({
      code: 'date',
      label: date === 'recent' ? 'Has a date from the last 30 days' : date === 'old' ? 'Only older dates found' : 'No date found',
      outcome: date === 'recent' ? 'pass' : 'warn',
    });
    if (date === 'old') riskFlags.push({ code: 'doc_old', label: 'Document dates are older than 30 days', points: 10 });
    if (date === 'recent') matched++;

    const money = findMoneyWords(text).filter((w) => !['rs.', 'rs ', '₹', 'inr', 'fee', 'fees', 'charges', 'charge'].includes(w));
    if (money.length) {
      checks.push({ code: 'money', label: `Mentions payment/agent words (${money.slice(0, 3).join(', ')})`, outcome: 'warn' });
      riskFlags.push({ code: 'doc_money', label: 'Document mentions payment or agent', points: 20 });
    }
    if (matched < 2) riskFlags.push({ code: 'doc_mismatch', label: 'Document does not match the request details', points: 20 });
  }
  checks.push({ code: 'stamp', label: 'Stamp and signature need the hospital to confirm (our team can call them)', outcome: 'info' });

  const result = checks.some((c) => c.outcome === 'fail') ? 'failed' : checks.some((c) => c.outcome === 'warn') ? 'warnings' : 'passed';
  await prisma.requestDocument.update({
    where: { id: doc.id },
    data: { ocrText: raw.slice(0, 5000), checks: JSON.stringify(checks), result },
  });

  // Request-level document status = best document wins, but any failure is kept
  const docs = await prisma.requestDocument.findMany({ where: { requestId: r.id }, select: { result: true } });
  const status = docs.some((d) => d.result === 'failed')
    ? 'failed'
    : docs.some((d) => d.result === 'passed')
      ? 'passed'
      : docs.some((d) => d.result === 'checking')
        ? 'checking'
        : 'warnings';
  await prisma.bloodRequest.update({ where: { id: r.id }, data: { documentStatus: status } });
  if (riskFlags.length) await applyRisk(r.id, riskFlags, 'Document check');
  logger.info(`Document ${doc.id} for ${r.publicCode}: ${result}`);
}

export async function listDocuments(requestId: string) {
  const docs = await prisma.requestDocument.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' } });
  return docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    result: d.result,
    checks: d.checks ? (JSON.parse(d.checks) as DocCheck[]) : [],
    uploadedAt: d.createdAt.toISOString(),
  }));
}

export async function documentFile(userId: string, role: string, requestId: string, documentId: string) {
  const doc = await prisma.requestDocument.findUnique({ where: { id: documentId }, include: { request: { select: { requesterUserId: true } } } });
  if (!doc || doc.requestId !== requestId) throw new AppError('Document not found.', 404, 'NOT_FOUND');
  if (role !== 'admin' && doc.request.requesterUserId !== userId) throw new AppError('Document not found.', 404, 'NOT_FOUND');
  return { path: path.join(UPLOAD_ROOT, doc.storagePath), mimeType: doc.mimeType, fileName: doc.fileName };
}

// ---------------- Reports ----------------

export const REPORT_REASONS = ['money_demanded', 'fake_request', 'wrong_number', 'other'] as const;
const REPORT_LABELS: Record<string, string> = {
  money_demanded: 'asked for money',
  fake_request: 'looks fake',
  wrong_number: 'wrong or unreachable number',
  other: 'other problem',
};

export async function reportRequest(userId: string, requestId: string, input: { reason: string; details?: string }) {
  const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
  if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
  if (r.requesterUserId === userId) throw new AppError('You cannot report your own request.', 400, 'BAD_REQUEST');
  const already = await prisma.requestReport.findUnique({ where: { requestId_reporterUserId: { requestId, reporterUserId: userId } } });
  if (already) return { success: true, alreadyReported: true, message: 'You already reported this request. Our team is looking into it.' };

  await prisma.requestReport.create({ data: { requestId, reporterUserId: userId, reason: input.reason, details: input.details?.slice(0, 500) || null } });
  const reportCount = await prisma.requestReport.count({ where: { requestId } });
  await prisma.bloodRequest.update({ where: { id: requestId }, data: { reportCount } });

  const pts = input.reason === 'money_demanded' ? 40 : 20;
  await applyRisk(requestId, [{ code: `report_${reportCount}`, label: `Reported by a donor: ${REPORT_LABELS[input.reason] || input.reason}`, points: pts }], 'Donor report');

  if (reportCount >= REPORTS_TO_PAUSE) {
    await prisma.bloodRequest.update({
      where: { id: requestId },
      data: { onHold: true, holdReason: `Paused after ${reportCount} reports from donors. Our team is reviewing it.` },
    });
  }
  await prisma.auditLog.create({
    data: { actorId: userId, action: 'BLOOD_REQUEST_REPORTED', entityType: 'BloodRequest', entityId: requestId, details: JSON.stringify(input) },
  });
  return { success: true, alreadyReported: false, message: 'Thank you. Our team will review this request. Never pay anyone for blood donation.' };
}

/** When an admin suspends an account: cancel its live requests and tell donors who accepted not to go */
export async function cancelRequestsOfSuspendedUser(userId: string) {
  const live = await prisma.bloodRequest.findMany({
    where: { requesterUserId: userId, status: { notIn: ['fulfilled', 'cancelled', 'expired', 'closed'] } },
    include: { responses: { where: { status: 'accepted' }, select: { donorUserId: true } } },
  });
  for (const r of live) {
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { status: 'cancelled', closedAt: new Date(), onHold: true, holdReason: 'Account suspended' } });
    for (const x of r.responses) {
      await prisma.notification.create({
        data: {
          recipientId: x.donorUserId,
          notificationType: 'request_update',
          title: 'Request cancelled: please don’t go',
          message: `The ${r.bloodGroup} request at ${r.hospitalName} was cancelled by our safety team. Please don’t go, and never pay anyone for blood donation.`,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
    }
  }
  return live.length;
}
