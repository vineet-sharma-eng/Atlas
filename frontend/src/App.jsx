import { useEffect, useState } from 'react';
import { GymDashboardPage } from './modules/gym/GymDashboardPage';
import { GymTrackingPage } from './modules/gym/GymTrackingPage';

const APP_VIEWS = {
  workout: GymTrackingPage,
  dashboard: GymDashboardPage,
};

export default function App() {
  const [activeView, setActiveView] = useState(() => getViewFromHash(window.location.hash));
  const ActiveView = APP_VIEWS[activeView] || GymTrackingPage;

  useEffect(() => {
    function handleHashChange() {
      setActiveView(getViewFromHash(window.location.hash));
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleChangeView(nextView) {
    window.location.hash = nextView === 'workout' ? '' : nextView;
    setActiveView(nextView);
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b border-atlas-line/80 bg-atlas-night/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-atlas-slate">
              Atlas
            </div>
            <div className="mt-1 text-base font-semibold text-atlas-ink sm:text-lg">Gym module</div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-atlas-panel p-1">
            <button
              type="button"
              className={`rounded-[14px] px-4 py-2.5 text-sm font-medium ${
                activeView === 'workout'
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-slate'
              }`}
              onClick={() => handleChangeView('workout')}
            >
              Workout
            </button>
            <button
              type="button"
              className={`rounded-[14px] px-4 py-2.5 text-sm font-medium ${
                activeView === 'dashboard'
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-slate'
              }`}
              onClick={() => handleChangeView('dashboard')}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>

      <ActiveView />
    </div>
  );
}

function getViewFromHash(hash) {
  return hash === '#dashboard' ? 'dashboard' : 'workout';
}
