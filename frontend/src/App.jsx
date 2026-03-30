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
      <div className="sticky top-0 z-10 border-b border-atlas-line/70 bg-[#f7f3ea]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-atlas-slate">
              Atlas
            </div>
            <div className="mt-1 text-lg font-semibold text-atlas-ink">Gym module</div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeView === 'workout'
                  ? 'bg-atlas-night text-white'
                  : 'border border-atlas-line bg-white text-atlas-ink'
              }`}
              onClick={() => handleChangeView('workout')}
            >
              Workout
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeView === 'dashboard'
                  ? 'bg-atlas-night text-white'
                  : 'border border-atlas-line bg-white text-atlas-ink'
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
