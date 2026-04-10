import { useEffect, useState } from 'react';
import { getAtlasDashboard } from '../api/atlasApi';

const EMPTY_DASHBOARD = {
  topInsight: null,
  insights: [],
  tips: [],
  motivation: null,
  motivations: [],
  modules: {
    finance: {
      topInsight: null,
      insights: [],
      tips: [],
      motivation: null,
      motivations: [],
    },
    gym: {
      topInsight: null,
      insights: [],
      tips: [],
      motivation: null,
      motivations: [],
    },
  },
};

export function useAtlasDashboard() {
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError('');

      try {
        const payload = await getAtlasDashboard();

        if (isMounted) {
          setData({
            topInsight: payload?.topInsight || null,
            insights: Array.isArray(payload?.insights) ? payload.insights : [],
            tips: Array.isArray(payload?.tips) ? payload.tips : [],
            motivation: payload?.motivation || null,
            motivations: Array.isArray(payload?.motivations) ? payload.motivations : [],
            modules: {
              finance: normalizeModule(payload?.modules?.finance),
              gym: normalizeModule(payload?.modules?.gym),
            },
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Failed to load Atlas dashboard');
          setData(EMPTY_DASHBOARD);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...data,
    isLoading,
    error,
  };
}

function normalizeModule(modulePayload) {
  return {
    topInsight: modulePayload?.topInsight || null,
    insights: Array.isArray(modulePayload?.insights) ? modulePayload.insights : [],
    tips: Array.isArray(modulePayload?.tips) ? modulePayload.tips : [],
    motivation: modulePayload?.motivation || null,
    motivations: Array.isArray(modulePayload?.motivations) ? modulePayload.motivations : [],
  };
}
