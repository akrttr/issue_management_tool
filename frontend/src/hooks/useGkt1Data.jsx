import { useState, useEffect, useRef } from 'react';
import { gkt1API } from '../../services/api';
import { toast } from 'react-toastify';

export function useGkt1Data(autoRefresh = true, refreshInterval = 30000) {
    const [data, setData] = useState({
        tle: null,
        passes: [],
        track: [],
        currentPosition: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);

    const fetchAllData = async () => {
        // Cancel previous request if still pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        try {
            setLoading(true);
            setError(null);

            // Fetch all data in parallel
            const [tleRes, passesRes, trackRes, positionRes] = await Promise.all([
                gkt1API.getTLE(),
                gkt1API.getTodayPasses(),
                gkt1API.getTodayTrack(),
                gkt1API.getCurrentPosition(),
            ]);

            setData({
                tle: tleRes.data,
                passes: passesRes.data.passes || [],
                track: trackRes.data.points || [],
                currentPosition: positionRes.data,
            });

            setLoading(false);
        } catch (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return; // Ignore aborted requests
            }

            console.error('Error fetching GKT1 data:', err);
            setError(err.message || 'Uydu verileri yüklenemedi');
            setLoading(false);

            toast.error('GKT1 uydu verileri yüklenirken hata oluştu', {
                toastId: 'gkt1-error',
            });
        }
    };

    useEffect(() => {
        fetchAllData();

        // Setup auto-refresh if enabled
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchAllData, refreshInterval);
        }

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, refreshInterval]);

    const retry = () => {
        fetchAllData();
    };

    return { data, loading, error, retry };
}