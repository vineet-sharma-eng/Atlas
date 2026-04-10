import { useAtlasDashboard } from '../../hooks/useAtlasDashboard';

const MODULE_CARDS = [
  {
    id: 'finance',
    eyebrow: 'Finance',
    title: 'Import and review spending',
    description: 'Upload Google Pay PDF statements, refresh analysis, and keep your finance context current.',
  },
  {
    id: 'gym',
    eyebrow: 'Gym',
    title: 'Log workouts and manage history',
    description: 'Jump into fast logging or review templates and completed sessions from the gym module.',
  },
];

export function AtlasDashboardPage({ onOpenModule }) {
  const atlasDashboard = useAtlasDashboard();

  return (
    <main className="min-h-screen px-3 py-3 pb-24 sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Atlas
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-atlas-ink sm:text-3xl">
            Command dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate">
            Start from the overview, then jump into the module that needs attention right now.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {MODULE_CARDS.map((module) => (
            <button
              key={module.id}
              type="button"
              className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-5 py-5 text-left shadow-panel transition hover:border-atlas-accent/50 hover:bg-atlas-mist"
              onClick={() => onOpenModule(module.id)}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                {module.eyebrow}
              </p>
              <h2 className="mt-3 text-xl font-semibold text-atlas-ink">
                {module.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-atlas-slate">
                {module.description}
              </p>
            </button>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Atlas Intelligence
                </p>
                <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                  Prioritized guidance
                </h2>
              </div>
              {atlasDashboard.isLoading ? (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-atlas-slate">
                  Loading
                </span>
              ) : null}
            </div>

            {atlasDashboard.error ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {atlasDashboard.error}
              </div>
            ) : null}

            {atlasDashboard.topInsight ? (
              <article className="mt-4 rounded-[20px] border border-atlas-accent/30 bg-atlas-accent/10 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-ink">
                  <span>{atlasDashboard.topInsight.domain}</span>
                  <span className="rounded-full border border-atlas-accent/40 px-2 py-1 text-[10px]">
                    {atlasDashboard.topInsight.priority}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-atlas-ink">
                  {atlasDashboard.topInsight.content}
                </p>
              </article>
            ) : (
              !atlasDashboard.isLoading && !atlasDashboard.error ? (
                <div className="mt-4 rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4 text-sm text-atlas-slate">
                  No active insights yet. Atlas will surface them here after the background jobs write fresh intelligence.
                </div>
              ) : null
            )}

            {atlasDashboard.insights.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {atlasDashboard.insights.map((insight) => (
                  <article
                    key={insight.id}
                    className="rounded-[18px] border border-atlas-line/70 bg-atlas-night/45 px-4 py-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                      {insight.domain}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-atlas-ink">
                      {insight.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                Motivation
              </p>
              <p className="mt-3 text-base leading-7 text-atlas-ink">
                {atlasDashboard.motivation?.content || 'Fresh motivation will appear here as soon as Atlas rotates a valid quote.'}
              </p>
            </section>

            <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Quick Tips
                </p>
                <span className="text-[11px] text-atlas-slate">
                  Max 2
                </span>
              </div>

              {atlasDashboard.tips.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {atlasDashboard.tips.map((tip) => (
                    <article
                      key={tip.id}
                      className="rounded-[18px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                        {tip.domain}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-atlas-ink">
                        {tip.content}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                !atlasDashboard.isLoading && !atlasDashboard.error ? (
                  <p className="mt-3 text-sm leading-6 text-atlas-slate">
                    No active tips yet. They will appear here after the next successful background run.
                  </p>
                ) : null
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
