import { useEffect, useState } from 'react';
import { GymDashboardPage } from './modules/gym/GymDashboardPage';
import { GymTrackingPage } from './modules/gym/GymTrackingPage';

const APP_VIEWS = {
  workout: GymTrackingPage,
  dashboard: GymDashboardPage,
};

const NAV_ITEMS = [
  { id: 'workout', label: 'Workout', title: 'Workout logging' },
  { id: 'dashboard', label: 'History', title: 'Templates and history' },
];

export default function App() {
  const [activeView, setActiveView] = useState(() => getRouteState(window.location.hash).view);
  const ActiveView = APP_VIEWS[activeView] || GymTrackingPage;

  useEffect(() => {
    function handleHashChange() {
      setActiveView(getRouteState(window.location.hash).view);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleChangeView(nextView) {
    const nextHash = nextView === 'workout' ? '' : '#dashboard/templates';
    window.location.hash = nextHash;
    setActiveView(nextView);
  }

  return (
    <div className="min-h-screen pb-[calc(78px+env(safe-area-inset-bottom)+20px)] md:pb-0">
      <div className="sticky top-0 z-20 hidden border-b border-atlas-line/80 bg-atlas-night/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
          <div className="text-xl font-semibold uppercase tracking-[0.14em] text-atlas-ink">
            Atlas Gym
          </div>
          <div className="grid w-full max-w-[320px] grid-cols-2 gap-2 rounded-[20px] border border-atlas-line/80 bg-atlas-panel/95 p-1.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-w-0 rounded-[14px] px-4 py-2.5 text-sm font-medium ${
                  activeView === item.id
                    ? 'bg-atlas-accent text-white'
                    : 'text-atlas-slate'
                }`}
                onClick={() => handleChangeView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-atlas-line/40 bg-atlas-night/70 md:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-atlas-ink">
            Atlas Gym
          </div>
        </div>
      </div>

      <ActiveView />

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 md:hidden">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-atlas-line/70 bg-atlas-night/92 px-3 py-3 shadow-panel backdrop-blur">
          <div className="flex items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.title}
                  className={`flex h-11 flex-1 items-center justify-center rounded-[20px] px-4 text-sm font-semibold ${
                    isActive
                      ? 'bg-atlas-accent text-white'
                      : 'bg-atlas-panel text-atlas-slate'
                  }`}
                  onClick={() => handleChangeView(item.id)}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function getRouteState(hash) {
  if (String(hash || '').startsWith('#dashboard')) {
    return { view: 'dashboard' };
  }

  return { view: 'workout' };
}
