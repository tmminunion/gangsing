import { useEffect, useRef, useCallback, useState } from 'react';

export interface TikTokEvent {
  type: 'chat' | 'gift' | 'member' | 'like' | 'roomUser' | 'follow' | 'share' | 'connected' | 'disconnected' | 'error' | 'status' | 'play_youtube' | 'update_queue' | 'toggle_autoplay' | 'toggle_shuffle' | 'jukebox_state' | 'init_assets' | 'import_obj' | 'clear_objs' | 'change_floor';
  user?: string;
  nickname?: string;
  text?: string;
  gift?: string;
  giftId?: number;
  amount?: number;
  likeCount?: number;
  totalLikeCount?: number;
  viewerCount?: number;
  username?: string;
  connected?: boolean;
  message?: string;
  timestamp?: number;
}

export interface TikTokLiveOptions {
  /** WebSocket relay server URL */
  serverUrl?: string;
  /** Called when a chat message arrives */
  onChat?: (user: string, text: string, nickname?: string) => void;
  /** Called when a gift is received */
  onGift?: (user: string, giftName: string, amount: number, giftId?: number, nickname?: string) => void;
  /** Called when someone joins */
  onMember?: (user: string, nickname?: string) => void;
  /** Called when a like event arrives */
  onLike?: (user: string, likeCount: number, totalLikeCount: number, nickname?: string) => void;
  /** Called when viewer count updates */
  onViewerCount?: (count: number) => void;
  /** Called when someone follows */
  onFollow?: (user: string, nickname?: string) => void;
  /** Called when someone shares */
  onShare?: (user: string, nickname?: string) => void;
  /** Called on connection state change */
  onConnectionChange?: (connected: boolean, username?: string) => void;
  /** Called on error */
  onError?: (message: string) => void;
  /** Jukebox YouTube Callbacks */
  onPlayYoutube?: (videoId: string | null, title: string | null) => void;
  onUpdateQueue?: (queue: any[]) => void;
  onToggleAutoplay?: (autoplay: boolean) => void;
  onToggleShuffle?: (shuffle: boolean) => void;
  onJukeboxState?: (state: any) => void;
  onSessionIdReceived?: (sessionId: string) => void;
  onInitAssets?: (assets: { filename: string; url: string }[]) => void;
  onImportObj?: (filename: string, url: string) => void;
  onClearObjs?: () => void;
  onFloorThemeChange?: (theme: string) => void;
}

export function useTikTokLive(options: TikTokLiveOptions = {}) {
  const {
    serverUrl = 'wss://tikserver.nufat.id',
    onChat,
    onGift,
    onMember,
    onLike,
    onViewerCount,
    onFollow,
    onShare,
    onConnectionChange,
    onError,
    onPlayYoutube,
    onUpdateQueue,
    onToggleAutoplay,
    onToggleShuffle,
    onJukeboxState,
    onSessionIdReceived,
    onInitAssets,
    onImportObj,
    onClearObjs,
    onFloorThemeChange,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [tikTokConnected, setTikTokConnected] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((username: string, sessionId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Relay server not connected');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'connect', username, sessionId }));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
    }
    setTikTokConnected(false);
    setConnectedUsername(undefined);
  }, []);

  // WebSocket connection management
  useEffect(() => {
    let ws: WebSocket;
    let isUnmounted = false;

    function connectWs() {
      if (isUnmounted) return;

      ws = new WebSocket(serverUrl);

      ws.onopen = () => {
        if (isUnmounted) {
          ws.close();
          return;
        }
        console.log('[TikTokLive] WebSocket connected');
        setWsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;

        let data: TikTokEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (data.type) {
          case 'status':
            setTikTokConnected(!!data.connected);
            if (data.username) setConnectedUsername(data.username as string);
            if ((data as any).sessionId) {
              onSessionIdReceived?.((data as any).sessionId);
            }
            // Update connection state di App berdasarkan status dari server
            onConnectionChange?.(!!data.connected, data.username as string | undefined);
            break;

          case 'connected':
            setTikTokConnected(true);
            setConnectedUsername(data.username);
            setError(null);
            onConnectionChange?.(true, data.username);
            break;

          case 'disconnected':
            setTikTokConnected(false);
            setConnectedUsername(undefined);
            onConnectionChange?.(false);
            break;

          case 'chat':
            if (data.user && data.text) onChat?.(data.user, data.text, data.nickname);
            break;

          case 'gift':
            if (data.user && data.gift) onGift?.(data.user, data.gift, data.amount || 1, data.giftId, data.nickname);
            break;

          case 'member':
            if (data.user) onMember?.(data.user, data.nickname);
            break;

          case 'like':
            if (data.user) onLike?.(data.user, data.likeCount || 1, data.totalLikeCount || 0, data.nickname);
            break;

          case 'roomUser':
            if (data.viewerCount !== undefined) onViewerCount?.(data.viewerCount);
            break;

          case 'follow':
            if (data.user) onFollow?.(data.user, data.nickname);
            break;

          case 'share':
            if (data.user) onShare?.(data.user, data.nickname);
            break;

          case 'error':
            setError(data.message || 'Unknown error');
            onError?.(data.message || 'Unknown error');
            break;

          case 'play_youtube':
            onPlayYoutube?.((data as any).videoId || null, (data as any).title || null);
            break;

          case 'update_queue':
            if ((data as any).queue) onUpdateQueue?.((data as any).queue);
            break;

          case 'toggle_autoplay':
            if ((data as any).autoplay !== undefined) onToggleAutoplay?.((data as any).autoplay);
            break;

          case 'toggle_shuffle':
            if ((data as any).shuffle !== undefined) onToggleShuffle?.((data as any).shuffle);
            break;

          case 'jukebox_state':
            onJukeboxState?.(data);
            break;

          case 'init_assets':
            if ((data as any).assets) onInitAssets?.((data as any).assets);
            break;

          case 'import_obj':
            if ((data as any).filename && (data as any).url) {
              onImportObj?.((data as any).filename, (data as any).url);
            }
            break;

          case 'clear_objs':
            onClearObjs?.();
            break;

          case 'change_floor':
            if ((data as any).theme) onFloorThemeChange?.((data as any).theme);
            break;
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        console.log('[TikTokLive] WebSocket disconnected, reconnecting in 3s...');
        setWsConnected(false);
        // Jangan reset tikTokConnected di sini!
        // Server akan kirim 'status' saat WebSocket reconnect
        // sehingga status TikTok tetap akurat

        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmounted) connectWs();
        }, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };

      wsRef.current = ws;
    }

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    wsConnected,
    tikTokConnected,
    connectedUsername,
    error,
    connect,
    disconnect,
    send,
  };
}
