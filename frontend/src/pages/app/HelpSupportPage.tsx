import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  HelpCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Phone,
  Mail,
  Send,
} from 'lucide-react';
import { supportInquirySchema, type SupportInquiryFormData } from '../../schemas/supportSchemas';
import { supportService } from '../../services';
import { useAuth } from '../../hooks/useAuth';
import { appConfig } from '../../constants/config';
import { countryOrDefault } from '../../constants/countries';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export const HelpSupportPage: React.FC = () => {
  const { user } = useAuth();
  const emergencyNumber = appConfig.emergencyUrgentLine || countryOrDefault(user?.country).nationalEmergencyNumber;
  const [faqs, setFaqs] = useState<{ question: string; answer: string; category: string }[]>([]);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);
  const [ticketResult, setTicketResult] = useState<{ ticketId: string; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchFaqs = async () => {
      try {
        const items = await supportService.getFaqs();
        if (isMounted) setFaqs(items);
      } catch (err) {
        console.error(err);
      }
    };

    fetchFaqs();
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportInquiryFormData>({
    resolver: zodResolver(supportInquirySchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      category: 'Donation Coordination',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: SupportInquiryFormData) => {
    setErrorMsg(null);
    try {
      const res = await supportService.submitInquiry(data);
      setTicketResult(res);
      reset();
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to submit inquiry.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
          Help &amp; Savior Support
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Frequently asked questions, emergency coordination guidance, and support ticketing
        </p>
      </div>

      {/* Emergency Contact Quick Box */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-900 block">
              Urgent Medical Need?
            </span>
            <span className="text-sm text-brand-800">
              {emergencyNumber === appConfig.emergencyUrgentLine
                ? <>For emergency blood requests, call our 24/7 hotline: <strong>{emergencyNumber}</strong></>
                : <>In a medical emergency, call <strong>{emergencyNumber}</strong> and contact the nearest hospital blood bank.</>}
            </span>
          </div>
        </div>

        <a href={`tel:${emergencyNumber}`} className="w-full sm:w-auto">
          <Button variant="primary" size="sm" className="w-full">
            Call {emergencyNumber}
          </Button>
        </a>
      </div>

      {/* FAQs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-ink-main">Frequently Asked Questions</h2>
          </div>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-line-border">
          {faqs.map((faq, index) => {
            const isExpanded = expandedFaqIndex === index;
            return (
              <div key={faq.question} className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                  className="w-full text-left flex items-center justify-between min-h-[44px] focus:outline-none"
                >
                  <div className="pr-4">
                    <span className="text-xs font-bold text-brand-600 block mb-0.5">
                      {faq.category}
                    </span>
                    <span className="text-sm font-semibold text-ink-main">{faq.question}</span>
                  </div>
                  <div className="text-ink-muted">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {isExpanded && (
                  <p className="mt-2 text-xs sm:text-sm text-ink-secondary leading-relaxed pt-2 border-t border-line-border/60">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Support Ticket Submission Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-ink-main">Submit an Inquiry or Issue</h2>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-4">
          {errorMsg && <ErrorBanner message={errorMsg} onRetry={() => setErrorMsg(null)} />}

          {ticketResult ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-center">
              <CheckCircle2 className="w-10 h-10 text-status-success mx-auto" />
              <h3 className="font-bold text-ink-main">Ticket Created: {ticketResult.ticketId}</h3>
              <p className="text-xs text-ink-secondary">{ticketResult.message}</p>
              <div className="pt-2">
                <Button variant="secondary" size="sm" onClick={() => setTicketResult(null)}>
                  Submit Another Inquiry
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Your Name"
                  required
                  error={errors.name?.message}
                  {...register('name')}
                />

                <Input
                  label="Email Address"
                  type="email"
                  required
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Inquiry Category"
                  options={[
                    { value: 'Donation Coordination', label: 'Donation Coordination' },
                    { value: 'Referral System Question', label: 'Referral System Question' },
                    { value: 'Data Privacy / Consent', label: 'Data Privacy / Consent' },
                    { value: 'Report Technical Bug', label: 'Report Technical Bug' },
                    { value: 'Hospital Partnership', label: 'Hospital Partnership' },
                  ]}
                  error={errors.category?.message}
                  {...register('category')}
                />

                <Input
                  label="Subject"
                  placeholder="Summary of your question"
                  required
                  error={errors.subject?.message}
                  {...register('subject')}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-ink-main mb-1.5">
                  Detailed Message <span className="text-status-error">*</span>
                </label>
                <textarea
                  id="message"
                  rows={4}
                  required
                  placeholder="Please describe how we can assist you..."
                  className={`block w-full rounded-lg border bg-white p-3 text-sm text-ink-main focus:ring-2 focus:ring-brand-500 focus:outline-none ${
                    errors.message ? 'border-status-error' : 'border-line-border'
                  }`}
                  {...register('message')}
                />
                {errors.message && (
                  <p className="mt-1 text-xs text-status-error font-medium">{errors.message.message}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Send Support Ticket
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
