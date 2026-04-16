import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pageThemeVars } from "../styles/themeVars";
import { usePublicTranslation } from "../i18n/usePublicTranslation";
import { fetchHomeMetrics } from "../services/exploreService";

const fallbackHomeData = {
  stats: {
    sessionsBooked: 0,
    activePros: 0,
    avgRating: "0.0",
  },
  featuredPhotographers: [],
};

function Home() {
  const { t } = usePublicTranslation();
  const [homeData, setHomeData] = useState(fallbackHomeData);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const data = await fetchHomeMetrics();
        if (!isMounted) return;

        setHomeData({
          stats: {
            sessionsBooked: Number(data?.stats?.sessionsBooked || 0),
            activePros: Number(data?.stats?.activePros || 0),
            avgRating: String(data?.stats?.avgRating || "0.0"),
          },
          featuredPhotographers: Array.isArray(data?.featuredPhotographers)
            ? data.featuredPhotographers
            : [],
        });
      } catch {
        if (isMounted) {
          setHomeData(fallbackHomeData);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)]"
      style={pageThemeVars}
    >
      <style>
        {`
          @keyframes floatSlow {
            0% { transform: translateY(0px) translateX(0px); }
            50% { transform: translateY(-10px) translateX(8px); }
            100% { transform: translateY(0px) translateX(0px); }
          }

          @keyframes fadeSlide {
            0% { opacity: 0; transform: translateY(16px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-[#D9C9A5]/45 blur-3xl [animation:floatSlow_8s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-[#C7E5E2]/50 blur-3xl [animation:floatSlow_10s_ease-in-out_infinite]" />

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-14 md:py-20 lg:px-8">
          <div className="[animation:fadeSlide_.6s_ease-out]">
            <p className="mb-4 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
              {t('public.photographerMarketplace')}
            </p>
            <h1 className="font-[Georgia,Times,'Times_New_Roman',serif] text-4xl leading-tight sm:text-5xl">
              {t('public.homeTitle')}
            </h1>
            <p className="mt-5 max-w-xl text-base text-[var(--muted)] sm:text-lg">
              {t('public.homeSubtitle')}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/explore"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                {t('public.findPhotographer')}
              </Link>
              <Link
                to="/signup"
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F1ECE0]"
              >
                {t('public.joinAsPhotographer')}
              </Link>
            </div>
          </div>

          <div className="[animation:fadeSlide_.85s_ease-out]">
            <div className="card-hero">
              <p className="label-uppercase-lg">
                {t('public.thisMonth')}
              </p>
              <h2 className="mt-3 font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                {t('public.trustedByCreators')}
              </h2>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-[var(--line)] bg-[#FFFDF8] p-3">
                  <p className="text-2xl font-semibold">
                    {homeData.stats.sessionsBooked.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{t('public.sessionsBooked')}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[#FFFDF8] p-3">
                  <p className="text-2xl font-semibold">
                    {homeData.stats.activePros.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{t('public.activePros')}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[#FFFDF8] p-3">
                  <p className="text-2xl font-semibold">{homeData.stats.avgRating}</p>
                  <p className="text-xs text-[var(--muted)]">{t('public.avgRating')}</p>
                </div>
              </div>
              <p className="mt-5 text-sm text-[var(--muted)]">
                {t('public.homeStats')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              {t('public.howItWorks')}
            </p>
            <h2 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
              {t('public.threeClearSteps')}
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: t('public.discover'), text: t('public.discoverText') },
            { title: t('public.compare'), text: t('public.compareText') },
            { title: t('public.book'), text: t('public.bookText') },
          ].map((step, index) => (
            <article
              key={step.title}
              className="card-surface transition-transform hover:-translate-y-1"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
                {t('public.featured')}
              </p>
              <h2 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                {t('public.popularPhotographers')}
              </h2>
            </div>
            <Link
              to="/explore"
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              {t('public.seeAllProfiles')}
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {homeData.featuredPhotographers.map((photographer) => (
              <article
                key={photographer.name}
                className="rounded-2xl border border-[var(--line)] bg-[#FFFDF8] p-5 transition-transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{photographer.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {photographer.specialty}
                    </p>
                  </div>
                  <span className="badge-status">
                    {photographer.rating}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{photographer.city}</span>
                  <span className="font-semibold">{photographer.startsFrom}</span>
                </div>
                <Link
                  to={photographer.slug ? `/photographers/${photographer.slug}` : "/explore"}
                  className="mt-4 block w-full rounded-full border border-[var(--line)] px-4 py-2 text-center text-sm font-semibold transition-colors hover:bg-[#F3EEE2]"
                >
                  {t('public.viewPortfolio')}
                </Link>
              </article>
            ))}
            {!homeData.featuredPhotographers.length ? (
              <article className="rounded-2xl border border-[var(--line)] bg-[#FFFDF8] p-5 text-sm text-[var(--muted)] md:col-span-3">
                No featured photographers yet.
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--line)] bg-gradient-to-br from-[#FFFCF6] to-[#F1E8D6] p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
            {t('public.readyToStart')}
          </p>
          <h2 className="mt-3 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
            {t('public.bookYourNextSession')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
            {t('public.bookYourNextSessionDesc')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/explore"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
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
        </div>
      </section>
    </div>
  );
}

export default Home;
