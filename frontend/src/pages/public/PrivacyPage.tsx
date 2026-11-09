import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import { appConfig } from '../../constants/config';

/**
 * Privacy policy, written to follow India's Digital Personal Data Protection Act, 2023 (DPDP Act).
 * DRAFT: must be reviewed by a lawyer before public launch. Fill in the [bracketed] details.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Who we are',
    body: (
      <>
        <p>
          BloodBridge connects people who need blood with voluntary donors. In this policy, “we” means [Company legal name], [registered address],
          the Data Fiduciary responsible for your personal data.
        </p>
        <p>
          Grievance Officer: [Name], [email], [phone]. We reply within [7] days. If you are not satisfied, you may complain to the Data Protection
          Board of India.
        </p>
      </>
    ),
  },
  {
    title: '2. What we collect',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Account:</strong> name, username, email, mobile number, date of birth, country, password (stored only as a secure hash).</li>
        <li><strong>Donor profile:</strong> blood group, state, district, city, PIN code, availability, donation dates and count.</li>
        <li>
          <strong>Health details you choose to give</strong> for the “Can I donate now?” check: sex, weight, and reasons to wait (for example a
          recent tattoo, illness, surgery or pregnancy).
        </li>
        <li><strong>Family:</strong> names, relationships, blood groups and dates of birth of family members you add.</li>
        <li><strong>Blood requests:</strong> patient name, blood group, hospital, and any document you upload to prove the request.</li>
        <li><strong>Payments:</strong> plan, amount, dates and payment reference. Card and UPI details are handled by Razorpay; we never see them.</li>
        <li><strong>Security records:</strong> sign-in times, important account actions and reports of misuse.</li>
      </ul>
    ),
  },
  {
    title: '3. Why we use it',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>To send blood requests to matching donors near the hospital, and to show donor counts (never donor lists) in Find Donors.</li>
        <li>To run the Family Circle you subscribe to, and the invite and savior links you share.</li>
        <li>To check that donors can safely donate before they are alerted (age, weight, time since last donation, reasons to wait).</li>
        <li>To detect fake or paid-blood requests and protect donors and families.</li>
        <li>To take payments, send receipts and renewal reminders, and meet legal and tax duties.</li>
      </ul>
    ),
  },
  {
    title: '4. Who can see your details',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>A donor sees the family’s mobile number only after accepting their request. Your own number is shared with a family only if you allow it.</li>
        <li>Public request pages never show the patient’s name, documents or phone numbers.</li>
        <li>A family you pledged to sees only what you allowed (your number, alerts, availability). You can change or remove this at any time.</li>
        <li>Our safety team can see what is needed to review reported or suspicious requests.</li>
        <li>Service providers that run the app for us (hosting, email, SMS, payments) process data only on our instructions.</li>
        <li><strong>We never sell your data</strong> and never use it for advertising.</li>
      </ul>
    ),
  },
  {
    title: '5. Your consent',
    body: (
      <p>
        We ask for your consent when you sign up and before using optional details such as health information or contact sharing. You can withdraw
        consent at any time in <Link className="text-brand-600 underline" to="/app/settings/privacy">Privacy Settings</Link>; this stops future use
        but does not undo what already happened.
      </p>
    ),
  },
  {
    title: '6. Your rights',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>See and download</strong> your data: Privacy Settings → Download Data.</li>
        <li><strong>Correct</strong> your data: Edit Profile.</li>
        <li><strong>Delete</strong> your account and data: Privacy Settings → Delete Account.</li>
        <li><strong>Complain</strong> to our Grievance Officer (section 1).</li>
        <li><strong>Nominate</strong> someone to use these rights if you die or cannot act: write to the Grievance Officer.</li>
      </ul>
    ),
  },
  {
    title: '7. How long we keep it',
    body: (
      <p>
        We keep your data while your account is open. When you delete your account, we delete your profile, family list, pledges, requests,
        uploaded documents and alerts. We keep only a short record without personal details, and payment references we are required by law to
        keep for tax and refunds.
      </p>
    ),
  },
  {
    title: '8. Security',
    body: (
      <p>
        Passwords are stored as secure hashes. Sessions end after a few minutes without activity. Uploaded documents are private and never shown on
        public pages. Mobile numbers are partly hidden until you choose to show them. No system is perfectly secure; if a breach affects you, we
        will tell you and the Data Protection Board as the law requires.
      </p>
    ),
  },
  {
    title: '9. Adults only (18+)',
    body: (
      <p>
        BloodBridge is only for people aged 18 or older. We ask for your date of birth and don’t create accounts for anyone younger. If we learn
        that an account belongs to someone under 18, we delete it and its data.
      </p>
    ),
  },
  {
    title: '10. Changes',
    body: (
      <p>
        If we change this policy, we will show the new version here and tell you in the app. Important changes will need your consent again.
        Questions: [support email].
      </p>
    ),
  },
];

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 bg-emerald-50 text-status-success px-3 py-1 rounded-full text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Policy Version {appConfig.currentPolicyVersion}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-main tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-ink-secondary max-w-2xl mx-auto">
          How BloodBridge collects, uses and protects your personal data, written to follow India’s Digital Personal Data Protection Act, 2023.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex gap-2" id="privacy-draft-notice">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Draft for legal review. Details in [brackets] will be filled in before public launch.</span>
      </div>

      <div className="space-y-5 text-sm text-ink-secondary leading-relaxed">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardContent className="p-6 sm:p-8 space-y-3">
              <h2 className="text-base font-bold text-ink-main">{s.title}</h2>
              {s.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
