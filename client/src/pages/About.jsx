import { Link } from "react-router-dom";
import { usePublicTranslation } from "../i18n/usePublicTranslation";

function About() {
  const { t } = usePublicTranslation();

  const values = [
    {
      title: t('public.trustFirst'),
      text: t('public.trustFirstText'),
    },
    {
      title: t('public.qualityMatch'),
      text: t('public.qualityMatchText'),
    },
    {
      title: t('public.simpleWorkflow'),
      text: t('public.simpleWorkflowText'),
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
        <section className="card-hero">
          <p className="label-uppercase-lg">
            {t('public.aboutShotSphere')}
          </p>
          <h1 className="mt-3 font-[Georgia, Times, 'Times_New_Roman', serif] text-4xl leading-tight sm:text-5xl">
            {t('public.aboutTitle')}
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-[var(--muted)] sm:text-base">
            {t('public.aboutDescription')}
          </p>
        </section>
        <section className="grid gap-6 lg:grid-cols-5">
          <article className="card-surface lg:col-span-3">
            <h2 className="font-[Georgia,Times, 'Time_New_Roman', serif] text-2xl">
              {t('public.ourStory')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {t('public.ourStoryPart1')}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {t('public.ourStoryPart2')}
            </p>
          </article>
          <article className="card-surface lg:col-span-2">
            <h1 className="font-[Georgia, Times, 'Times_New_Roman', serif] text-2xl">
              {t('public.atAGlance')}
            </h1>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="card-white">
                <p className="label-uppercase">
                  {t('public.marketplaceFocus')}
                </p>
                <p className="mt-2 text-sm">
                  {t('public.marketplaceFocusText')}
                </p>
              </div>
              <div className="card-white">
                <p className="label-uppercase">
                  {t('public.userRoles')}
                </p>
                <p className="mt-2 text-sm">
                  {t('public.userRolesText')}
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {values.map((value) => (
            <article
              key={value.title}
              className="card-surface"
            >
              <h3 className="text-lg font-semibold">{value.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{value.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--line)] bg-gradient-to-br from-[#FFFCF6] to-[#F1E8D6] p-8 text-center">
          <h2 className="font-[Georgia, Times,'Times_New_Roman', serif]  text-3xl">
            {t('public.readyToExplore')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
            {t('public.browseVerified')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
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

export default About;
