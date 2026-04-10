import { useEffect, useState } from 'react';
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
  const intelligenceCards = [
    ...(atlasDashboard.topInsight ? [atlasDashboard.topInsight] : []),
    ...atlasDashboard.insights,
  ].slice(0, 5);

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

        {atlasDashboard.error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {atlasDashboard.error}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          <CarouselPanel
            eyebrow="Atlas Intelligence"
            title="Prioritized guidance"
            subtitle="A rotating stack of the most relevant guidance across Atlas."
            isLoading={atlasDashboard.isLoading}
            items={intelligenceCards}
            emptyMessage="No active insights yet. Atlas will surface them here after the background jobs write fresh intelligence."
            renderItem={(item) => <InsightCard item={item} />}
          />
          <CarouselPanel
            eyebrow="Motivation"
            title="Momentum cues"
            subtitle="A rotating set of prompts to keep the pace steady."
            items={atlasDashboard.motivations}
            emptyMessage="Fresh motivation will appear here as soon as Atlas rotates a valid quote."
            renderItem={(item) => <MotivationCard item={item} />}
          />
          <CarouselPanel
            eyebrow="Quick Tips"
            title="Actionable nudges"
            subtitle="Short suggestions pulled from both modules."
            items={atlasDashboard.tips}
            emptyMessage="No active tips yet. They will appear here after the next successful background run."
            renderItem={(item) => <TipCard item={item} />}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ModuleIntelligenceCard
            title="Finance"
            subtitle="Finance-specific insight, tips, and motivation"
            moduleData={atlasDashboard.modules.finance}
          />
          <ModuleIntelligenceCard
            title="Gym"
            subtitle="Gym-specific insight, tips, and motivation"
            moduleData={atlasDashboard.modules.gym}
          />
        </section>
      </div>
    </main>
  );
}

function ModuleIntelligenceCard({ title, subtitle, moduleData }) {
  return (
    <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
        {title}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
        Module intelligence
      </h2>
      <p className="mt-2 text-sm leading-6 text-atlas-slate">
        {subtitle}
      </p>

      <div className="mt-4 grid gap-4">
        <CarouselPanel
          eyebrow="Insights"
          title="What Atlas sees"
          items={moduleData.insights}
          emptyMessage="No active insight yet for this module."
          renderItem={(item) => <InsightCard item={item} compact />}
        />
        <CarouselPanel
          eyebrow="Tips"
          title="What to do next"
          items={moduleData.tips}
          emptyMessage="No active tips yet for this module."
          renderItem={(item) => <TipCard item={item} compact />}
        />
        <CarouselPanel
          eyebrow="Motivation"
          title="Stay in motion"
          items={moduleData.motivations}
          emptyMessage="Fresh motivation will appear here soon."
          renderItem={(item) => <MotivationCard item={item} compact />}
        />
      </div>
    </section>
  );
}

function CarouselPanel({
  eyebrow,
  title,
  subtitle,
  items,
  renderItem,
  emptyMessage,
  isLoading = false,
}) {
  return (
    <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            {eyebrow}
          </p>
          {title ? (
            <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-atlas-slate">
              {subtitle}
            </p>
          ) : null}
        </div>
        {isLoading ? (
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-atlas-slate">
            Loading
          </span>
        ) : (
          <span className="rounded-full border border-atlas-line/70 px-3 py-1 text-[11px] text-atlas-slate">
            {items.length || 0} cards
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <AutoSwipeCarousel
          items={items}
          className="mt-4"
          renderItem={renderItem}
        />
      ) : (
        <div className="mt-4 rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4 text-sm text-atlas-slate">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function AutoSwipeCarousel({ items, renderItem, className = '' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1 || isPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [items.length, isPaused]);

  function goToNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function goToPrevious() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  function handleTouchStart(event) {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;

    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setTouchStartX(null);
  }

  const activeItem = items[activeIndex] || null;

  return (
    <div
      className={className}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div
        className="min-h-[220px] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeItem ? (
          <div
            key={activeItem.id || `${activeIndex}-${activeItem.content || activeItem.domain}`}
            className="animate-[atlasCardIn_420ms_ease-out]"
          >
            {renderItem(activeItem, activeIndex)}
          </div>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {items.map((item, index) => (
              <button
                key={`dot-${item.id || index}`}
                type="button"
                aria-label={`Go to card ${index + 1}`}
                className={`min-h-0 h-2 w-2 rounded-full p-0 transition ${
                  activeIndex === index ? 'bg-atlas-accent shadow-[0_0_0_3px_rgba(59,130,246,0.14)]' : 'bg-atlas-line/70'
                }`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-atlas-line/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-atlas-slate"
              onClick={goToPrevious}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-full border border-atlas-line/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-atlas-slate"
              onClick={goToNext}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InsightCard({ item, compact = false }) {
  return (
    <article className={`rounded-[20px] border border-atlas-accent/30 bg-atlas-accent/10 ${compact ? 'px-4 py-4' : 'px-5 py-5'}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-ink">
        <span>{item.domain}</span>
        {item.priority ? (
          <span className="rounded-full border border-atlas-accent/40 px-2 py-1 text-[10px]">
            {item.priority}
          </span>
        ) : null}
      </div>
      <p className={`mt-3 ${compact ? 'text-sm' : 'text-base'} leading-7 text-atlas-ink`}>
        {item.content}
      </p>
    </article>
  );
}

function TipCard({ item, compact = false }) {
  return (
    <article className={`rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 ${compact ? 'px-4 py-4' : 'px-5 py-5'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
        {item.domain}
      </p>
      <p className={`mt-3 ${compact ? 'text-sm' : 'text-base'} leading-7 text-atlas-ink`}>
        {item.content}
      </p>
    </article>
  );
}

function MotivationCard({ item, compact = false }) {
  return (
    <article className={`rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 ${compact ? 'px-4 py-4' : 'px-5 py-5'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
        {item.domain}
      </p>
      <p className={`mt-3 ${compact ? 'text-sm' : 'text-base'} leading-7 text-atlas-ink`}>
        {item.content}
      </p>
    </article>
  );
}
