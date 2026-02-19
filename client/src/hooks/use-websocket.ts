import { useEffect, useRef, useCallback, useState } from "react";
import type { Location } from "@shared/schema";

type MessageHandler = (data: any) => void;

const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const RECONNECT_DELAY = 2000; // 2 seconds

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageHandlersRef = useRef<Map<string, MessageHandler>>(new Map());
  const pendingMessagesRef = useRef<object[]>([]);
  const connectPromiseRef = useRef<Promise<void> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    connectPromiseRef.current = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        connectPromiseRef.current = null;
        
        // Send any pending messages
        while (pendingMessagesRef.current.length > 0) {
          const msg = pendingMessagesRef.current.shift();
          if (msg) {
            ws.send(JSON.stringify(msg));
          }
        }
        resolve();
      };

      ws.onclose = () => {
        setIsConnected(false);
        connectPromiseRef.current = null;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const handler = messageHandlersRef.current.get(message.type);
          if (handler) {
            handler(message.data);
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        connectPromiseRef.current = null;
        reject(error);
      };
    });

    return connectPromiseRef.current;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      connectPromiseRef.current = null;
    }
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message to send when connected
      pendingMessagesRef.current.push(message);
    }
  }, []);

  const onMessage = useCallback((type: string, handler: MessageHandler) => {
    messageHandlersRef.current.set(type, handler);
    return () => {
      messageHandlersRef.current.delete(type);
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, send, onMessage, isConnected };
}

export function useLocationSharer(locationId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const shouldBeSharing = useRef(false);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.log('Wake lock request failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
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
        type: "update",
        data: lastLocationRef.current,
      }));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        lastLocationRef.current = locationData;
        setCurrentPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "update",
            data: locationData,
          }));
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const connectAndShare = useCallback(() => {
    if (!locationId || !navigator.geolocation) return;

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
      ws.send(JSON.stringify({ type: "share", locationId }));
      setIsSharing(true);

      sendLocationUpdate(ws, true);

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
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "update",
              data: locationData,
            }));
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
              type: "update",
              data: lastLocationRef.current,
            }));
          }
        } else if (shouldBeSharing.current) {
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
  }, [locationId, requestWakeLock, releaseWakeLock, sendLocationUpdate, clearHeartbeat, clearReconnectTimeout]);

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
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsSharing(false);
    setIsConnected(false);
    setConnectionStatus('disconnected');
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

  return { startSharing, stopSharing, isSharing, isConnected, connectionStatus, currentPosition };
}

export function useLocationViewer(locationId: string | null, initialLocation: Location | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldBeViewing = useRef(true);
  const [location, setLocation] = useState<Location | null>(initialLocation);
  const [isLive, setIsLive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation);
    }
  }, [initialLocation]);

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
    if (!locationId) return;

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
      ws.send(JSON.stringify({ type: "subscribe", locationId }));
      setLastRefresh(new Date());

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
        if (message.type === "location" && message.data) {
          setLocation(message.data);
          setIsLive(true);
          setLastRefresh(new Date());
        } else if (message.type === "stopped") {
          setIsLive(false);
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      clearHeartbeat();

      // Only reconnect if we should still be viewing
      if (shouldBeViewing.current) {
        console.log('Viewer connection closed, scheduling reconnect...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [locationId, clearHeartbeat, clearReconnectTimeout]);

  const refresh = useCallback(async () => {
    if (!locationId) return;

    try {
      const response = await fetch(`/api/locations/${locationId}`);
      if (response.ok) {
        const data = await response.json();
        setLocation(data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error("Failed to refresh location:", error);
    }

    const wsState = wsRef.current?.readyState;
    if (wsState !== WebSocket.OPEN && wsState !== WebSocket.CONNECTING) {
      connect();
    }
  }, [locationId, connect]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && locationId) {
        console.log('Viewer page became visible, checking connection...');
        const wsState = wsRef.current?.readyState;
        
        if (wsState !== WebSocket.OPEN && wsState !== WebSocket.CONNECTING) {
          console.log('Viewer connection lost while in background, reconnecting...');
          connect();
        }
        
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [locationId, connect, refresh]);

  // Initial connection
  useEffect(() => {
    shouldBeViewing.current = true;
    connect();

    return () => {
      shouldBeViewing.current = false;
      clearReconnectTimeout();
      clearHeartbeat();
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }
    };
  }, [connect, clearReconnectTimeout, clearHeartbeat]);

  return { location, isLive, isConnected, refresh, lastRefresh };
}
