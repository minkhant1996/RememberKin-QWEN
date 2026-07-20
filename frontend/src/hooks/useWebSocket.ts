import { useEffect } from 'react';
import { websocketService } from '../services/websocket.service';
import { useAuthStore } from '../store/authStore';

export function useWebSocket() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (isAuthenticated && token) {
      websocketService.connect();
    }

    return () => {
      // Don't disconnect on unmount, only on logout
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated) {
      websocketService.disconnect();
    }
  }, [isAuthenticated]);

  return websocketService;
}
