import { useState, useEffect, useCallback, useRef } from 'react';
import { satelliteAPI } from '../../services/api';

export const useSatelliteData = (autoRefreshInterval = 10000) => { // Reduced to 10 seconds for smoother updates
  const [passes, setPasses] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [tle, setTle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const lastUpdateRef = useRef(null);

  const fetchAllData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [tleData, passesData, trackData, coverageData] = await Promise.all([
        satelliteAPI.getTLE(),
        satelliteAPI.getTodayPasses(),
        satelliteAPI.getCurrentTrack(120), // 2 hours of track data
        satelliteAPI.getGroundStationCoverage()
      ]);

      setTle(tleData);
      setPasses(passesData.passes || []);
      setCurrentTrack(trackData);
      setCoverage(coverageData);
      setError(null);
      lastUpdateRef.current = new Date();
      
      console.log(`Satellite data updated at ${lastUpdateRef.current.toISOString()}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching satellite data:', err);
        setError(err.message || 'Failed to load satellite data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Initial load
  useEffect(() => {
    fetchAllData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAllData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshInterval) return;

    const intervalId = setInterval(() => {
      console.log('Auto-refreshing satellite data...');
      fetchAllData();
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, fetchAllData]);

  return {
    passes,
    currentTrack,
    coverage,
    tle,
    loading,
    error,
    retry,
    refresh: fetchAllData,
    lastUpdate: lastUpdateRef.current
  };
};