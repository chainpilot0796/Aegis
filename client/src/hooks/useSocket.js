import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Socket.IO is mounted on the same Express server as the REST API.
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);
  const [prices, setPrices] = useState({});
  const [vaultStats, setVaultStats] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    socket.on('prices', (data) => {
      // Server sends { prices: { gold: { p, c }, ... }, timestamp }
      if (data && data.prices) {
        const normalized = {};
        for (const [id, raw] of Object.entries(data.prices)) {
          normalized[id] = {
            price: raw.p ?? raw.price,
            change24h: raw.c ?? raw.change24h,
          };
        }
        setPrices(normalized);
      }
    });

    socket.on('vaultStats', (data) => {
      setVaultStats(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, prices, vaultStats, connected };
}
