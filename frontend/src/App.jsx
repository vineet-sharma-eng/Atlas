import { useEffect, useState } from 'react';
import { GymDashboardPage } from './modules/gym/GymDashboardPage';
import { GymTrackingPage } from './modules/gym/GymTrackingPage';

const APP_VIEWS = {
  workout: GymTrackingPage,
  dashboard: GymDashboardPage,
};

const NAV_ITEMS = [
  { id: 'workout', label: 'Workout', shortLabel: 'W', title: 'Workout logging' },
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'D', title: 'Templates and history' },
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
    <div className="min-h-screen pb-[calc(48px+env(safe-area-inset-bottom)+16px)] md:pb-0">
      <div className="sticky top-0 z-20 hidden border-b border-atlas-line/80 bg-atlas-night/95 backdrop-blur md:block">
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="text-sm font-semibold text-atlas-ink">Atlas gym</div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-atlas-panel p-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-[14px] px-4 py-2 text-sm font-medium ${
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

      <ActiveView />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-atlas-line/80 bg-atlas-night/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-around gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                className={`flex h-10 min-w-[72px] items-center justify-center rounded-2xl px-3 text-sm font-semibold ${
                  isActive
                    ? 'bg-atlas-accent text-white'
                    : 'bg-atlas-panel text-atlas-slate'
                }`}
                onClick={() => handleChangeView(item.id)}
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
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
