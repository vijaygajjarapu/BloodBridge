import React from 'react';
import { ShieldAlert, ShieldCheck, Flag, FileCheck2, PhoneOff, Ban } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';

/** Fraud & Safety policy: shown publicly and linked from every request */
export const SafetyPage: React.FC = () => (
  <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
    <div>
      <h1 className="text-3xl font-extrabold text-ink-main">Fraud &amp; Safety Policy</h1>
      <p className="text-sm text-ink-secondary mt-1">How BloodBridge keeps blood requests genuine, and what to do if something feels wrong.</p>
    </div>

    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="p-5 flex gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-bold">Donating blood is always free.</p>
          <p>Nobody on BloodBridge (not a family, an “agent”, a “coordinator” or our team) will ever ask you to pay, share bank or UPI details, or send a “processing fee” to donate or receive blood. If anyone does, it is a scam: stop, and report the request.</p>
        </div>
      </CardContent>
    </Card>

    <section className="space-y-3">
      <h2 className="text-lg font-bold text-ink-main">How we check every request</h2>
      {[
        { icon: <ShieldCheck className="w-5 h-5 text-brand-600" />, title: 'Automatic warning signs', text: 'When a request is posted we look for warning signs: brand-new accounts, many requests in a short time or in different districts, the same patient posted by different accounts, copied text, and mentions of money or agents. Requests with several warning signs are reviewed by our team, and high-risk ones are held before any donor is alerted.' },
        { icon: <FileCheck2 className="w-5 h-5 text-brand-600" />, title: 'Patient document checks', text: 'Requesters can upload the hospital’s blood requisition form or doctor’s note. We check that the file was not used in another request, look for signs of photo-editing apps, and read the text to match the hospital, patient name, blood group and a recent date. Software cannot prove a stamp or signature is real, so for doubtful requests our team calls the hospital’s blood bank.' },
        { icon: <Flag className="w-5 h-5 text-brand-600" />, title: 'Donor reports', text: 'Every request has a “Report this request” button. A request reported by 3 donors is paused automatically until our team reviews it. Reports about money are treated as the most serious.' },
        { icon: <PhoneOff className="w-5 h-5 text-brand-600" />, title: 'Private numbers', text: 'Donors’ numbers are never shown publicly. A donor sees the family’s number only after accepting, and shares their own number only if they choose to.' },
        { icon: <Ban className="w-5 h-5 text-brand-600" />, title: 'Consequences', text: 'Accounts found misusing BloodBridge are suspended. Their open requests are cancelled at once, and donors who accepted are told not to go.' },
      ].map((x) => (
        <Card key={x.title}>
          <CardContent className="p-4 flex gap-3">
            <div className="shrink-0 mt-0.5">{x.icon}</div>
            <div>
              <h3 className="text-sm font-bold text-ink-main">{x.title}</h3>
              <p className="text-sm text-ink-secondary">{x.text}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>

    <section className="space-y-2">
      <h2 className="text-lg font-bold text-ink-main">Tips for donors</h2>
      <ul className="list-disc pl-5 text-sm text-ink-secondary space-y-1">
        <li>Go only to the hospital named in the request, and donate at the hospital’s blood bank.</li>
        <li>Never hand over money, and never share OTPs, bank or UPI details.</li>
        <li>If the caller’s story or hospital doesn’t match the request, don’t go; report it.</li>
        <li>If you feel unsafe, leave and contact local police (dial 112 in India).</li>
      </ul>
    </section>
  </div>
);
