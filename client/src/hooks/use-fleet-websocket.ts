import { useEffect, useRef, useCallback, useState } from "react";
import type { Vehicle } from "@shared/schema";

const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const RECONNECT_DELAY = 2000; // 2 seconds

export function useVehicleSharer(vehicleId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wasReconnected, setWasReconnected] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const shouldBeSharing = useRef(false);
  const hadPreviousConnection = useRef(false);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
      } catch (err) {
        console.log('Wake lock request failed:', err);
        setWakeLockActive(false);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendLocationUpdate = useCallback((ws: WebSocket, forceNew: boolean = false) => {
    if (!navigator.geolocation) return;
    
    if (!forceNew && lastLocationRef.current && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "updateVehicle",
        data: lastLocationRef.current,
      }));
      setLastSentAt(new Date());
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        lastLocationRef.current = locationData;
        setCurrentPosition(locationData);
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "updateVehicle",
            data: locationData,
          }));
          setLastSentAt(new Date());
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const connectAndShare = useCallback(() => {
    if (!vehicleId || !navigator.geolocation) return;

    // Don't reconnect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    clearReconnectTimeout();
    clearHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    requestWakeLock();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      if (hadPreviousConnection.current) {
        setWasReconnected(true);
        setTimeout(() => setWasReconnected(false), 3000);
      }
      hadPreviousConnection.current = true;
      ws.send(JSON.stringify({ type: "shareVehicle", vehicleId }));
      setIsSharing(true);

      // Send immediate location update
      sendLocationUpdate(ws, true);

      // Clear any existing watch and start a new one
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          lastLocationRef.current = locationData;
          setCurrentPosition(locationData);
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "updateVehicle",
              data: locationData,
            }));
            setLastSentAt(new Date());
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 30000, 
          maximumAge: 1000
        }
      );

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          if (lastLocationRef.current) {
            ws.send(JSON.stringify({
              type: "updateVehicle",
              data: lastLocationRef.current,
            }));
            setLastSentAt(new Date());
          }
        } else if (shouldBeSharing.current) {
          // Connection lost, try to reconnect
          console.log('Heartbeat detected dead connection, reconnecting...');
          clearHeartbeat();
          reconnectTimeoutRef.current = setTimeout(() => {
            connectAndShare();
          }, RECONNECT_DELAY);
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      clearHeartbeat();
      
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Auto-reconnect if we should still be sharing
      if (shouldBeSharing.current) {
        console.log('Connection closed, scheduling reconnect...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connectAndShare();
        }, RECONNECT_DELAY);
      } else {
        releaseWakeLock();
        setIsSharing(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [vehicleId, requestWakeLock, releaseWakeLock, sendLocationUpdate, clearHeartbeat, clearReconnectTimeout]);

  const startSharing = useCallback(() => {
    shouldBeSharing.current = true;
    connectAndShare();
  }, [connectAndShare]);

  const stopSharing = useCallback(() => {
    shouldBeSharing.current = false;
    clearReconnectTimeout();
    clearHeartbeat();
    releaseWakeLock();
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stopVehicle" }));
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsSharing(false);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setCurrentPosition(null);
    setLastSentAt(null);
    hadPreviousConnection.current = false;
  }, [releaseWakeLock, clearReconnectTimeout, clearHeartbeat]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldBeSharing.current) {
        console.log('Page became visible, checking connection...');
        const wsState = wsRef.current?.readyState;
        
        if (wsState !== WebSocket.OPEN && wsState !== WebSocket.CONNECTING) {
          console.log('Connection lost while in background, reconnecting...');
          connectAndShare();
        } else if (wsState === WebSocket.OPEN) {
          // Force a fresh location update when resuming
          sendLocationUpdate(wsRef.current!, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectAndShare, sendLocationUpdate]);

  // Re-acquire wake lock when released
  useEffect(() => {
    const handleWakeLockRelease = async () => {
      if (document.visibilityState === 'visible' && shouldBeSharing.current) {
        await requestWakeLock();
      }
    };

    if (wakeLockRef.current) {
      wakeLockRef.current.addEventListener('release', handleWakeLockRelease);
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.removeEventListener('release', handleWakeLockRelease);
      }
    };
  }, [requestWakeLock, isSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      clearHeartbeat();
      releaseWakeLock();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [releaseWakeLock, clearReconnectTimeout, clearHeartbeat]);

  return { startSharing, stopSharing, isSharing, isConnected, connectionStatus, currentPosition, wakeLockActive, wasReconnected, lastSentAt };
}

export function useFleetViewer(fleetId: string | null, initialVehicles: Vehicle[]) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (initialVehicles.length > 0) {
      setVehicles(initialVehicles);
    }
  }, [initialVehicles]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!fleetId) return;

    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    clearReconnectTimeout();
    clearHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "subscribeFleet", fleetId }));
      setLastRefresh(new Date());

      // Start heartbeat to detect dead connections
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log('Viewer heartbeat detected dead connection, reconnecting...');
          clearHeartbeat();
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "vehicles" && message.data) {
          setVehicles(message.data);
          setLastRefresh(new Date());
        } else if (message.type === "vehicleUpdate" && message.data) {
          const updatedVehicle = message.data as Vehicle;
          setVehicles(prev => 
            prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v)
          );
          setLastRefresh(new Date());
        } else if (message.type === "vehicleStopped" && message.data?.vehicleId) {
          setVehicles(prev => 
            prev.map(v => v.id === message.data.vehicleId ? { ...v, isLive: false } : v)
          );
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      clearHeartbeat();

      // Auto-reconnect for viewers (they always want to stay connected)
      console.log('Viewer connection closed, scheduling reconnect...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [fleetId, clearHeartbeat, clearReconnectTimeout]);

  const refresh = useCallback(async () => {
    if (!fleetId) return;

    // Fetch fresh data from API
    try {
      const response = await fetch(`/api/fleets/${fleetId}/vehicles`);
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error("Failed to refresh vehicles:", error);
    }

    // Ensure WebSocket is connected
    const wsState = wsRef.current?.readyState;
    if (wsState !== WebSocket.OPEN && wsState !== WebSocket.CONNECTING) {
      connect();
    }
  }, [fleetId, connect]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && fleetId) {
        console.log('Viewer page became visible, checking connection...');
        const wsState = wsRef.current?.readyState;
        
        if (wsState !== WebSocket.OPEN && wsState !== WebSocket.CONNECTING) {
          console.log('Viewer connection lost while in background, reconnecting...');
          connect();
        }
        
        // Always fetch fresh data when becoming visible
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fleetId, connect, refresh]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      clearReconnectTimeout();
      clearHeartbeat();
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }
    };
  }, [connect, clearReconnectTimeout, clearHeartbeat]);

  return { vehicles, isConnected, refresh, lastRefresh };
}
