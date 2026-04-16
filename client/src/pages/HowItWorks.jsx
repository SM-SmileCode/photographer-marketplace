import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarCheck,
  Camera,
  Package,
  Search,
  Star,
} from "lucide-react";
import { usePublicTranslation } from "../i18n/usePublicTranslation";

function HowItWorks() {
  const { t } = usePublicTranslation();

  const steps = [
    {
      icon: Search,
      title: t('public.discoverPhotographers'),
      text: t('public.discoverPhotographersText'),
    },
    {
      icon: CalendarCheck,
      title: t('public.sendBookingRequest'),
      text: t('public.sendBookingRequestText'),
    },
    {
      icon: BadgeCheck,
      title: t('public.getConfirmation'),
      text: t('public.getConfirmationText'),
    },
    {
      icon: Camera,
      title: t('public.eventCoverage'),
      text: t('public.eventCoverageText'),
    },
    {
      icon: Package,
      title: t('public.receiveDeliverables'),
      text: t('public.receiveDeliverablesText'),
    },
    {
      icon: Star,
      title: t('public.rateReview'),
      text: t('public.rateReviewText'),
    },
  ];

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="card-hero sm:p-8">
          <p className="label-uppercase-lg">
            {t('public.howItWorksTitle')}
          </p>
          <h1 className="mt-3 font-[Georgia, Times, 'Times_New_Roman', serif] text-4xl leading-tight sm:text-5xl">
            {t('public.fromDiscoveryToDelivery')}
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-[var(--muted)] sm:text-base">
            {t('public.streamlineJourney')}
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={index}
                className="card-surface"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white text-lg"
                  >
                    <Icon className="h-5 w-5 text-[var(--accent)]" />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                    Step {index + 1}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm text-[var(--muted)] ">{step.text}</p>
              </article>
            );
          })}
        </section>
        <section className="rounded-3xl border border-[var(--line)] bg-gradient-to-br from-[var(--surface)] to-[#F1E8D6] p-8 text-center">
          <h2 className="font-[Georgia, Times, 'Times_New_Roman', serif] text-3xl">
            {t('public.readyToGetStarted')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
            {t('public.explorePhotographersDesc')}
          </p>
          <div className="mt-6  flex flex-wrap justify-center gap-3">
            <Link
              to="/explore"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] "
            >
              {t('public.explorePhotographers')}
            </Link>
            <Link
              to="/signup"
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F1ECE0]"
            >
              {t('public.createAccount')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HowItWorks;
