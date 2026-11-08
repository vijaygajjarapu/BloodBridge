import React from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  ShieldCheck,
  Users,
  Share2,
  ArrowRight,
  Activity,
  Award,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 sm:pt-16 pb-12 sm:pb-20 bg-gradient-to-b from-brand-50/60 to-surface-light border-b border-line-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center space-x-2 bg-brand-100 text-brand-700 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                <span>Verified Referral Blood Donation Network</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink-main leading-tight">
                Be a Donor. <br />
                <span className="text-brand-500">Be a Savior.</span>
              </h1>

              <p className="text-base sm:text-lg text-ink-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                BloodBridge is an invite-driven, consent-first community platform connecting verified whole-blood donors with local emergency hospital teams during life-critical shortages.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link to="/auth/register" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    rightIcon={<ArrowRight className="w-5 h-5" />}
                    className="w-full shadow-md"
                  >
                    Join as a Donor
                  </Button>
                </Link>

                <Link to="/auth/login" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full">
                    Existing Donor Sign In
                  </Button>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-line-border/80 text-center sm:text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-ink-main">Free</div>
                  <div className="text-xs text-ink-secondary">Find Donors &amp; Request Blood</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-ink-main">100%</div>
                  <div className="text-xs text-ink-secondary">Consent-Controlled</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-ink-main">₹0</div>
                  <div className="text-xs text-ink-secondary">Blood Is Never Sold Here</div>
                </div>
              </div>
            </div>

            {/* Right Interactive Card Preview */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md">
                <div className="absolute -top-4 -right-4 w-64 h-64 bg-brand-200/40 rounded-full blur-3xl -z-10" />
                <div className="absolute -bottom-4 -left-4 w-64 h-64 bg-amber-100/50 rounded-full blur-3xl -z-10" />

                <Card className="border-2 border-brand-100 shadow-xl overflow-hidden bg-white/95 backdrop-blur-sm">
                  <div className="p-6 bg-brand-500 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Heart className="w-6 h-6 fill-current text-white" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold">Savior Circle Invitation</h2>
                        <p className="text-[11px] text-white/80">Example of what a friend’s invite looks like</p>
                      </div>
                    </div>
                    <span className="text-xs bg-white text-brand-600 font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                      O- Universal
                    </span>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start space-x-3 text-xs text-ink-secondary bg-gray-50 p-3 rounded-lg border border-line-border">
                      <ShieldCheck className="w-4 h-4 text-status-success mt-0.5 flex-shrink-0" />
                      <span>
                        Invited by <strong className="text-ink-main">someone you know</strong>. Your personal contact details remain encrypted until you explicitly authorize emergency contact.
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium text-ink-secondary">
                        <span>Urgent Donor Readiness</span>
                        <span className="text-status-success font-bold">Near the hospital</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-brand-500 h-2.5 rounded-full w-4/5" />
                      </div>
                    </div>

                    <Link to="/auth/register" className="block pt-2">
                      <Button variant="primary" className="w-full justify-center">
                        Join Free
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-2">
            The Savior Protocol
          </h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            How BloodBridge Saves Lives
          </h3>
          <p className="text-sm sm:text-base text-ink-secondary mt-3">
            Traditional public directories suffer from fake entries and unresponsive contacts. BloodBridge is free for finding donors and posting requests. An optional Family Circle adds a trusted donor list for your own family.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <Card className="p-6 relative text-left hover:border-brand-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg mb-4">
              01
            </div>
            <h4 className="text-lg font-bold text-ink-main mb-2">Join Free</h4>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Sign up free, or through a savior’s invitation. Add your blood type and locality. Finding donors and posting requests never cost anything.
            </p>
          </Card>

          {/* Step 2 */}
          <Card className="p-6 relative text-left hover:border-brand-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg mb-4">
              02
            </div>
            <h4 className="text-lg font-bold text-ink-main mb-2">Build Your Family Circle (optional)</h4>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              With the Family Circle subscription, share your savior link and invite friends, family and colleagues to become your family’s own ready donors. Track who has joined through your link.
            </p>
          </Card>

          {/* Step 3 */}
          <Card className="p-6 relative text-left hover:border-brand-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg mb-4">
              03
            </div>
            <h4 className="text-lg font-bold text-ink-main mb-2">Rapid Emergency Dispatch</h4>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              When a critical shortage strikes nearby, authorized coordinators match with your blood type. Only with your verified consent are phone contacts shared.
            </p>
          </Card>
        </div>
      </section>

      {/* Privacy & Transparency Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-brand-900 text-white rounded-2xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 bg-brand-800 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Public Scraping &bull; Explicit Consent Required</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Your Contact Information Belongs to You.
              </h3>
              <p className="text-sm text-gray-200 leading-relaxed max-w-2xl">
                Unlike public directories, your mobile number is never visible to search engines or commercial aggregators. You control exactly who can view your contact details and can revoke consent at any moment with one click.
              </p>
              <div className="pt-2">
                <Link to="/privacy">
                  <Button variant="secondary" size="md">
                    Read Our Data Privacy Charter
                  </Button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4 flex justify-center">
              <div className="w-36 h-36 rounded-full bg-brand-800/80 border-4 border-brand-700 flex items-center justify-center">
                <Activity className="w-16 h-16 text-brand-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-4 text-center space-y-6">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-ink-main">
          Ready to save a life in your neighborhood?
        </h3>
        <p className="text-sm sm:text-base text-ink-secondary">
          Join your community’s saviors. One blood donation can help up to three patients.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth/register" className="w-full sm:w-auto">
            <Button variant="primary" size="lg" className="w-full">
              Join as a Savior Today
            </Button>
          </Link>
          <Link to="/about" className="w-full sm:w-auto">
            <Button variant="ghost" size="lg" className="w-full">
              Learn More About Our Mission
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
