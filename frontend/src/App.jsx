import { startTransition, useEffect, useState } from 'react';
import { AtlasDashboardPage } from './modules/atlas/AtlasDashboardPage';
import { FinanceDashboardPage } from './modules/finance/FinanceDashboardPage';
import { GymDashboardPage } from './modules/gym/GymDashboardPage';
import { GymTrackingPage } from './modules/gym/GymTrackingPage';

const APP_VIEWS = {
  dashboard: AtlasDashboardPage,
  finance: FinanceDashboardPage,
  gym: GymModulePage,
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', title: 'Atlas dashboard' },
  { id: 'finance', label: 'Finance', title: 'Finance module' },
  { id: 'gym', label: 'Gym', title: 'Gym module' },
];

export default function App() {
  const [routeState, setRouteState] = useState(() => getRouteState(window.location.hash));
  const ActiveView = APP_VIEWS[routeState.view] || AtlasDashboardPage;

  useEffect(() => {
    function handleHashChange() {
      startTransition(() => {
        setRouteState(getRouteState(window.location.hash));
      });
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleChangeView(nextView) {
    const nextHash = getDefaultHashForView(nextView);
    window.location.hash = nextHash;

    startTransition(() => {
      setRouteState(getRouteState(nextHash));
    });
  }

  return (
    <div className="min-h-screen pb-[calc(78px+env(safe-area-inset-bottom)+20px)] md:pb-0">
      <div className="sticky top-0 z-20 hidden border-b border-atlas-line/80 bg-atlas-night/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
          <div className="text-xl font-semibold uppercase tracking-[0.14em] text-atlas-ink">
            Atlas
          </div>
          <div className="grid w-full max-w-[420px] grid-cols-3 gap-2 rounded-[20px] border border-atlas-line/80 bg-atlas-panel/95 p-1.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-w-0 rounded-[14px] px-4 py-2.5 text-sm font-medium ${
                  routeState.view === item.id
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
            Atlas
          </div>
        </div>
      </div>

      <ActiveView routeState={routeState} onOpenModule={handleChangeView} />

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 md:hidden">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-atlas-line/70 bg-atlas-night/92 px-3 py-3 shadow-panel backdrop-blur">
          <div className="flex items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const isActive = routeState.view === item.id;

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

function GymModulePage({ routeState }) {
  const gymPanel = routeState.panel === 'history' || routeState.panel === 'templates'
    ? 'dashboard'
    : 'workout';

  return (
    <div>
      <div className="mx-auto max-w-5xl px-3 pt-3 sm:px-4">
        <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-1">
          {[
            { id: 'workout', label: 'Workout', hash: '#gym/workout' },
            { id: 'dashboard', label: 'History', hash: '#gym/templates' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-[16px] px-4 py-3 text-sm font-medium ${
                gymPanel === item.id
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-slate'
              }`}
              onClick={() => {
                window.location.hash = item.hash;
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {gymPanel === 'dashboard' ? <GymDashboardPage /> : <GymTrackingPage />}
    </div>
  );
}

function getRouteState(hash) {
  const normalizedHash = String(hash || '');

  if (!normalizedHash || normalizedHash === '#' || normalizedHash === '#dashboard') {
    return { view: 'dashboard' };
  }

  if (normalizedHash.startsWith('#finance')) {
    return { view: 'finance' };
  }

  if (normalizedHash.startsWith('#gym')) {
    return {
      view: 'gym',
      ...parseGymModuleHash(normalizedHash),
    };
  }

  if (normalizedHash.startsWith('#workout')) {
    return { view: 'gym', panel: 'workout', sessionId: '' };
  }

  if (normalizedHash.startsWith('#dashboard/')) {
    return {
      view: 'gym',
      ...parseLegacyGymHash(normalizedHash),
    };
  }

  return { view: 'dashboard' };
}

function getDefaultHashForView(view) {
  if (view === 'finance') {
    return '#finance';
  }

  if (view === 'gym') {
    return '#gym/workout';
  }

  return '#dashboard';
}

function parseGymModuleHash(hash) {
  const parts = hash.replace(/^#gym\/?/, '').split('/').filter(Boolean);

  if (parts[0] === 'history') {
    return { panel: 'history', sessionId: parts[1] || '' };
  }

  if (parts[0] === 'templates') {
    return { panel: 'templates', sessionId: '' };
  }

  return { panel: 'workout', sessionId: '' };
}

function parseLegacyGymHash(hash) {
  const parts = hash.replace(/^#dashboard\/?/, '').split('/').filter(Boolean);
  const panel = parts[0] === 'history' ? 'history' : 'templates';

  return {
    panel,
    sessionId: panel === 'history' ? (parts[1] || '') : '',
  };
}
