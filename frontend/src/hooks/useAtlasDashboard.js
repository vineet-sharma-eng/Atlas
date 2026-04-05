import { useEffect, useState } from 'react';
import { getAtlasDashboard } from '../api/atlasApi';

const EMPTY_DASHBOARD = {
  topInsight: null,
  insights: [],
  tips: [],
  motivation: null,
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
