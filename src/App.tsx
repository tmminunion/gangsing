import React, { useState, useEffect, useRef } from 'react';
import { BattleArena3D, BattleArenaRef } from './components/BattleArena3D';
import { playJukebox } from './utils/jukebox';
import { JukeboxPanel } from './components/JukeboxPanel';
import { Player, Gift, ChatMessage, MatchHistoryEntry } from './types';
import { findGift } from './data/giftUtils';
import { useTikTokLive } from './hooks/useTikTokLive';
import { ArsenalLogo, PSGLogo } from './components/TeamLogos';
import { 
  Tv, 
  Flame, 
  Coins, 
  Users, 
  Zap, 
  Volume2, 
  Layers, 
  Heart,
  Sparkles,
  EyeOff,
} from 'lucide-react';
// Memoized container to prevent React from re-rendering and destroying the YouTube iframe
const YoutubePlayerContainer = React.memo(() => {
  return (
    <div 
      id="yt-jukebox-player" 
      className="fixed -top-[1000px] -left-[1000px] w-[320px] h-[180px] z-[-1] opacity-0 pointer-events-none"
    />
  );
}, () => true);

export default function App() {
  const battleArenaRef = useRef<BattleArenaRef>(null);
  const objImportRef = useRef<HTMLInputElement>(null);
  const textureImportRef = useRef<HTMLInputElement>(null);

  // Jukebox State
  const [currentYoutubeId, setCurrentYoutubeId] = useState<string | null>(null);
  const [currentYoutubeTitle, setCurrentYoutubeTitle] = useState<string | null>(null);
  const [jukeboxQueue, setJukeboxQueue] = useState<{ videoId: string; title: string }[]>([]);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isShuffle, setIsShuffle] = useState(false);
  const [floorTheme, setFloorTheme] = useState('scifi');
  const [safeZoneRadius, setSafeZoneRadius] = useState(40);
  const ytPlayerRef = useRef<any>(null);

  // Connection settings
  const [tiktokUsername, setTiktokUsername] = useState(() => localStorage.getItem('tiktok_last_username') || '');
  const [tiktokSessionId, setTiktokSessionId] = useState(() => localStorage.getItem('tiktok_last_session_id') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // TikTok Live Relay Connection
  const {
    wsConnected: relayConnected,
    error: tikTokError,
    connect: connectToTikTokRelay,
    disconnect: disconnectFromTikTokRelay,
    send: sendSocketMessage,
  } = useTikTokLive({
    onChat: (user, text, nickname) => {
      triggerCommentAction(user, text, nickname);
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'comment',
        text: `@${nickname || user}: ${text}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },
    onGift: (user, giftName, amount, giftId, nickname) => {
      if (!battleArenaRef.current) return;
      const gift = findGift(giftId, giftName);

      battleArenaRef.current.triggerGift(user, gift.name, amount, nickname);
      setEarnedCoins(prev => prev + gift.cost * amount);
      setRecentGiftBanner({ username: nickname || user, gift, amount, id: Math.random().toString() });

      const newChat: ChatMessage = {
        id: Math.random().toString(),
        username: nickname || user,
        text: `mengirim ${gift.emoji} ${gift.name} x${amount}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        badge: 'gifter',
        avatarSeed: Math.random().toString(36).substring(2, 6).toUpperCase()
      };
      setChatMessages(prev => [...prev, newChat].slice(-15));

      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'gift',
        text: `@${nickname || user} mengirim ${gift.emoji} ${gift.name} x${amount}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },
    onLike: (user, likeCount, totalLikeCount, nickname) => {
      if (battleArenaRef.current) {
        battleArenaRef.current.triggerTap(0, 0);
      }
      setLikes(prev => prev + likeCount);
    },
    onViewerCount: (count) => {
      setViewerCount(count);
    },
    onMember: (user, nickname) => {
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'join',
        text: `@${nickname || user} bergabung ke live!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      // Auto-spawn player baru saat viewer join TikTok Live
      if (battleArenaRef.current) {
        const counts = battleArenaRef.current.getPlayerCounts();
        if (counts.alive < 30) {
          battleArenaRef.current.addPlayer(user, nickname || user, false);
        }
      }
    },
    onFollow: (user, nickname) => {
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'join',
        text: `@${nickname || user} mem-follow host!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      if (battleArenaRef.current) {
        const counts = battleArenaRef.current.getPlayerCounts();
        if (counts.alive < 30) {
          battleArenaRef.current.addPlayer(user, nickname || user, false);
        }
      }
    },
    onShare: (user, nickname) => {
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'join',
        text: `@${nickname || user} membagikan live!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      if (battleArenaRef.current) {
        const counts = battleArenaRef.current.getPlayerCounts();
        if (counts.alive < 30) {
          battleArenaRef.current.addPlayer(user, nickname || user, false);
        }
      }
    },
    onError: (message) => {
      setConnecting(false);
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'system',
        text: `⚠️ Error: ${message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },
    onConnectionChange: (connected, username) => {
      setIsConnected(connected);
      setConnecting(false);
      if (connected && username) {
        localStorage.setItem('tiktok_last_username', username);
        if (tiktokSessionId) {
          localStorage.setItem('tiktok_last_session_id', tiktokSessionId);
        }
      }
    },
    onPlayYoutube: (videoId, title) => {
      setCurrentYoutubeId(videoId);
      setCurrentYoutubeTitle(title);
    },
    onUpdateQueue: (queue) => {
      setJukeboxQueue(queue);
    },
    onToggleAutoplay: (autoplay) => {
      setIsAutoplay(autoplay);
    },
    onToggleShuffle: (shuffle) => {
      setIsShuffle(shuffle);
    },
    onJukeboxState: (state) => {
      if (state.currentYoutubeId !== undefined) setCurrentYoutubeId(state.currentYoutubeId);
      if (state.currentYoutubeTitle !== undefined) setCurrentYoutubeTitle(state.currentYoutubeTitle);
      if (state.jukeboxQueue !== undefined) setJukeboxQueue(state.jukeboxQueue);
      if (state.isAutoplay !== undefined) setIsAutoplay(state.isAutoplay);
      if (state.isShuffle !== undefined) setIsShuffle(state.isShuffle);
      if (state.floorTheme !== undefined) {
        setFloorTheme(state.floorTheme);
        setTimeout(() => {
          battleArenaRef.current?.changeFloorTheme(state.floorTheme);
        }, 1500);
      }
    },
    onSessionIdReceived: (sessionId) => {
      setTiktokSessionId(sessionId);
      localStorage.setItem('tiktok_last_session_id', sessionId);
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'system',
        text: '🔑 Session ID diterima dan disimpan otomatis dari browser!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },
    onInitAssets: (assets) => {
      console.log('🔌 [Socket] Initializing persistent assets:', assets.length);
      const relayHttpUrl = 'https://tikserver.nufat.id';
      setTimeout(() => {
        if (battleArenaRef.current) {
          battleArenaRef.current.clearAllImportedOBJs();
          assets.forEach((asset) => {
            battleArenaRef.current?.importOBJFromUrl(`${relayHttpUrl}${asset.url}`, asset.filename);
          });
        }
      }, 1500);
    },
    onImportObj: (filename, url) => {
      console.log('🔌 [Socket] New OBJ import broadcast received:', filename);
      const relayHttpUrl = 'https://tikserver.nufat.id';
      if (battleArenaRef.current) {
        battleArenaRef.current.importOBJFromUrl(`${relayHttpUrl}${url}`, filename);
      }
    },
    onClearObjs: () => {
      console.log('🔌 [Socket] Clear all OBJ assets command received');
      if (battleArenaRef.current) {
        battleArenaRef.current.clearAllImportedOBJs();
      }
    },
    onFloorThemeChange: (theme) => {
      console.log('🔌 [Socket] Floor theme change received:', theme);
      setFloorTheme(theme);
      battleArenaRef.current?.changeFloorTheme(theme);
    },
    onDiscoModeChange: (duration) => {
      console.log('🔌 [Socket] Disco mode trigger received, duration:', duration);
      battleArenaRef.current?.triggerDiscoMode(duration);
    },
  });

  // Stats
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [activeLeaderboard, setActiveLeaderboard] = useState<Player[]>([]);
  const [topKillScores, setTopKillScores] = useState<Record<string, number>>({});
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem('battle_royale_match_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Stream Feeds
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentGiftBanner, setRecentGiftBanner] = useState<{ username: string; gift: Gift; amount: number; id: string } | null>(null);
  const [liveFeedLogs, setLiveFeedLogs] = useState<{ id: string; type: 'gift' | 'comment' | 'kill' | 'system' | 'join'; text: string; time: string }[]>([]);

  // Top-right popup notifications for spawn & eliminated events
  const [topNotifications, setTopNotifications] = useState<{ id: string; text: string; type: 'join' | 'kill' }[]>([]);

  // TikTok Streamer Clear HUD Options — default ON (layar bersih)
  const [isLayarBersih, setIsLayarBersih] = useState(true);

  // Active Sound effects state toggle
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Simple path-based routing
  const currentRoute = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const isStreamMode = urlParams.get('stream') === 'true';
  const isYoutubeRoute = currentRoute === '/youtube' || window.location.hash === '#/youtube';
  const isDashRoute = !isStreamMode && !isYoutubeRoute && (currentRoute === '/dash' || currentRoute === '/stat' || window.location.hash === '#/dash' || window.location.hash === '#/stat');

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Force re-render on navigation
  const [, forceRender] = useState(0);
  useEffect(() => {
    const handleRouteChange = () => {
      forceRender(n => n + 1);
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  // Auto-connect if in stream mode and has last username
  useEffect(() => {
    if (isStreamMode && tiktokUsername && !isConnected && !connecting && relayConnected) {
      console.log('[StreamMode] Auto-connecting to TikTok:', tiktokUsername);
      setConnecting(true);
      connectToTikTokRelay(tiktokUsername, tiktokSessionId);
    }
  }, [isStreamMode, relayConnected]);

  // Force clean HUD in stream mode
  useEffect(() => {
    if (isStreamMode) {
      setIsLayarBersih(true);
    }
  }, [isStreamMode]);

  // Synchronize state config ref for YouTube player callbacks
  const configRef = useRef({ currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle });
  useEffect(() => {
    configRef.current = { currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle };
  }, [currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle]);

  const playNextInQueue = () => {
    const { jukeboxQueue: q, isShuffle: s, isAutoplay: a } = configRef.current;
    if (q.length > 0) {
      let next;
      if (s) {
        const randIdx = Math.floor(Math.random() * q.length);
        next = q[randIdx];
        const newQueue = [...q];
        newQueue.splice(randIdx, 1);
        sendSocketMessage({ type: 'update_queue', queue: newQueue });
      } else {
        next = q[0];
        const newQueue = q.slice(1);
        sendSocketMessage({ type: 'update_queue', queue: newQueue });
      }
      sendSocketMessage({ type: 'play_youtube', payload: next });
    } else if (a) {
      playSimilarSong();
    } else {
      sendSocketMessage({ type: 'play_youtube', payload: null });
    }
  };

  const playSimilarSong = (attempt = 1, initialVideoId = configRef.current.currentYoutubeId) => {
    const title = configRef.current.currentYoutubeTitle;
    if (!title) {
      sendSocketMessage({ type: 'play_random_history' });
      return;
    }
    const cleanTitle = title.replace(/\(Official.*?\)|\[Official.*?\]|official|video|audio|lyric|mv/gi, '').trim();
    fetch(`/api/youtube/search?q=${encodeURIComponent(cleanTitle + ' similar song')}&count=5`)
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.results || data.results.length === 0) {
          sendSocketMessage({ type: 'play_random_history' });
          return;
        }
        const candidates = data.results.filter((v: any) => v.videoId !== initialVideoId);
        const best = candidates[Math.floor(Math.random() * candidates.length)] || data.results[0];
        if (best) {
          sendSocketMessage({ type: 'play_youtube', payload: { videoId: best.videoId, title: best.title } });
        } else {
          sendSocketMessage({ type: 'play_random_history' });
        }
      })
      .catch(() => {
        sendSocketMessage({ type: 'play_random_history' });
      });
  };

  // Initialize YouTube Jukebox Player
  useEffect(() => {
    const init = () => {
      if (ytPlayerRef.current) return;
      console.log("[Jukebox] Init Player...");
      ytPlayerRef.current = new (window as any).YT.Player('yt-jukebox-player', {
        height: '1', width: '1', videoId: '',
        playerVars: { 'autoplay': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'modestbranding': 1, 'rel': 0, 'mute': 0 },
        events: {
          'onReady': (e: any) => { if (configRef.current.currentYoutubeId) e.target.loadVideoById(configRef.current.currentYoutubeId); },
          'onStateChange': (e: any) => { if (e.data === 0) playNextInQueue(); },
          'onError': (e: any) => { console.error('[Jukebox] Error:', e.data); playNextInQueue(); }
        }
      });
    };

    if ((window as any).YT && (window as any).YT.Player) init();
    else {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const first = document.getElementsByTagName('script')[0];
      if (first?.parentNode) first.parentNode.insertBefore(tag, first);
      (window as any).onYouTubeIframeAPIReady = init;
    }
  }, []);

  // Sync Video ID changes
  useEffect(() => {
    if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      if (currentYoutubeId) {
        ytPlayerRef.current.loadVideoById(currentYoutubeId);
      } else if (ytPlayerRef.current.stopVideo) {
        ytPlayerRef.current.stopVideo();
      }
    }
  }, [currentYoutubeId]);

  // Load custom pre-uploaded assets from /assets/airdrop and /assets/object directories
  useEffect(() => {
    const loadPreUploadedAssets = async () => {
      const relayHttpUrl = 'https://tikserver.nufat.id';
      try {
        const response = await fetch(`${relayHttpUrl}/api/custom-assets`);
        const data = await response.json();
        if (data.success) {
          console.log('[Assets] Loaded custom pre-uploaded assets:', data);
          // Wait for BattleArena3D component to fully mount
          setTimeout(() => {
            if (battleArenaRef.current) {
              let hasObstacles = false;
              if (data.airdrops && data.airdrops.length > 0) {
                data.airdrops.forEach((asset: any) => {
                  console.log('[Assets] Loading pre-uploaded airdrop:', asset.filename);
                  battleArenaRef.current?.importOBJFromUrl(`${relayHttpUrl}${asset.url}`, asset.filename);
                });
              }
              if (data.objects && data.objects.length > 0) {
                hasObstacles = true;
                data.objects.forEach((asset: any) => {
                  console.log('[Assets] Loading pre-uploaded obstacle:', asset.filename);
                  battleArenaRef.current?.importOBJFromUrl(`${relayHttpUrl}${asset.url}`, asset.filename);
                });
              }

              // Jika ada obstacles kustom yang dimuat, tunggu proses parsing OBJLoader (sekitar 3 detik)
              // lalu picu respawn agar model kustom langsung nampang di arena!
              if (hasObstacles) {
                setTimeout(() => {
                  console.log('[Assets] Triggering initial obstacle respawn with newly loaded custom meshes!');
                  battleArenaRef.current?.respawnObstacles();
                }, 3000);
              }
            }
          }, 3000);
        }
      } catch (err) {
        console.error('[Assets] Failed to fetch custom pre-uploaded assets:', err);
      }
    };

    loadPreUploadedAssets();
  }, []);

  // Connect to real TikTok Live via relay server
  const handleConnectStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUsername.trim()) return;

    if (!relayConnected) {
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'system',
        text: '⚠️ Relay server tidak terhubung. Jalankan server terlebih dahulu: npm run relay',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      return;
    }

    setConnecting(true);
    // Simpan ke localStorage segera agar tidak hilang saat refresh/retry
    localStorage.setItem('tiktok_last_username', tiktokUsername);
    if (tiktokSessionId) {
      localStorage.setItem('tiktok_last_session_id', tiktokSessionId);
    } else {
      localStorage.removeItem('tiktok_last_session_id');
    }
    connectToTikTokRelay(tiktokUsername, tiktokSessionId);

    setTimeout(() => {
      setConnecting(false);
    }, 10000);
  };

  const handleDisconnectStream = () => {
    disconnectFromTikTokRelay();
    setIsConnected(false);
    addLiveFeedEntry({
      id: Math.random().toString(),
      type: 'system',
      text: 'Terputus dari live stream TikTok.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  // Append items to live activity log + trigger top notifications for spawn/eliminated
  const addLiveFeedEntry = (newEntry: { id: string; type: 'gift' | 'comment' | 'kill' | 'system' | 'join'; text: string; time: string }) => {
    setLiveFeedLogs(prev => [newEntry, ...prev].slice(0, 50));

    // Trigger minimal popup for spawn (join) & eliminated (kill)
    if (newEntry.type === 'join' || newEntry.type === 'kill') {
      const notif = { id: newEntry.id, text: newEntry.text, type: newEntry.type };
      setTopNotifications(prev => [notif, ...prev].slice(0, 5));
      // Auto-dismiss after 3.5s
      setTimeout(() => {
        setTopNotifications(prev => prev.filter(n => n.id !== notif.id));
      }, 3500);
    }
  };

  // Receive a brand new kill point
  const handleKillScore = (attackerName: string) => {
    setTopKillScores(prev => {
       const current = prev[attackerName] || 0;
       return {
         ...prev,
         [attackerName]: current + 1
       };
    });
  };

  // Track cumulative boss MVP counts per player
  const [mvpCounts, setMvpCounts] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('battle_royale_mvp_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Store the most recent boss MVP username for match history
  const [recentBossMvp, setRecentBossMvp] = useState<string | null>(null);

  const handleBossMvp = (mvp: { username: string; damage: number }) => {
    setRecentBossMvp(mvp.username);
    setMvpCounts(prev => {
      const updated = { ...prev, [mvp.username.toLowerCase()]: (prev[mvp.username.toLowerCase()] || 0) + 1 };
      localStorage.setItem('battle_royale_mvp_counts', JSON.stringify(updated));
      return updated;
    });
  };

  const addMatchWinner = (winner: { username: string; color: string; kills: number }) => {
    const entry: MatchHistoryEntry = {
      id: Math.random().toString(),
      winnerName: winner.username,
      winnerColor: winner.color,
      kills: winner.kills,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bossMvpName: recentBossMvp || undefined
    };
    setRecentBossMvp(null); // reset for next match
    setMatchHistory(prev => {
      const updated = [entry, ...prev].slice(0, 5);
      localStorage.setItem('battle_royale_match_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleFloorThemeChange = (theme: string) => {
    setFloorTheme(theme);
    battleArenaRef.current?.changeFloorTheme(theme);
    sendSocketMessage({
      type: 'change_floor',
      theme: theme
    });
  };

  const handleClearMap = () => {
    if (confirm('Aa Baim yakin ingin menghapus semua bangunan & dekorasi 3D dari arena?')) {
      const relayHttpUrl = 'https://tikserver.nufat.id';
      fetch(`${relayHttpUrl}/api/clear-objs`, { method: 'POST' })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            console.log('✅ Map cleared on server');
          } else {
            alert(`❌ Gagal membersihkan arena: ${res.error}`);
          }
        })
        .catch(err => {
          console.error('Clear error:', err);
          alert(`❌ Gagal terhubung ke relay server: ${err.message}`);
        });
    }
  };

  const triggerCommentAction = (username: string, text: string, nickname?: string) => {
    if (!battleArenaRef.current) return;

    // Trigger action inside 3D environment
    battleArenaRef.current.triggerComment(username, text, nickname);

    // Insert to chat
    const newChat: ChatMessage = {
      id: Math.random().toString(),
      username: nickname || username,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: 'viewer',
      avatarSeed: Math.random().toString(36).substring(2, 6).toUpperCase()
    };

    setChatMessages(prev => [...prev, newChat].slice(-15));
  };

  // Simulated screen tap action
  const handleScreenDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!battleArenaRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    battleArenaRef.current.triggerTap(e.clientX, e.clientY);
    setLikes(prev => prev + 1);
  };

  // Clear or Restart match
  const handleResetMatch = () => {
    if (battleArenaRef.current) {
      battleArenaRef.current.resetGame();
      setLikes(0);
      setEarnedCoins(0);
      setChatMessages([]);
      setRecentGiftBanner(null);
    }
    setRecentBossMvp(null); // clear stale MVP on reset
  };

  // Remove gift banners after 4 seconds automatically
  useEffect(() => {
    if (!recentGiftBanner) return;
    const bannerTimer = setTimeout(() => {
      setRecentGiftBanner(null);
    }, 4500);
    return () => clearTimeout(bannerTimer);
  }, [recentGiftBanner]);

  // Leaderboard sorted by XP/level (descending by level, then XP)
  const xpLeaderboard = [...activeLeaderboard].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.xp - a.xp;
  });

  // Boss damage leaderboard (sorted by bossDamageDealt descending)
  const bossDamageLeaderboard = [...activeLeaderboard]
    .filter(p => (p.bossDamageDealt || 0) > 0)
    .sort((a, b) => (b.bossDamageDealt || 0) - (a.bossDamageDealt || 0));
  const totalBossDamage = bossDamageLeaderboard.reduce((sum, p) => sum + (p.bossDamageDealt || 0), 0);

  // Top 3 survivors computation
  const alivePlayers = activeLeaderboard.filter(p => p.status === 'alive');
  const deadPlayers = activeLeaderboard.filter(p => p.status === 'dead');

  // Battle Royale — every player is solo, no teams

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white flex flex-col antialiased relative overflow-hidden">
      {/* Hidden YouTube player container */}
      <YoutubePlayerContainer />
      {/* Hidden OBJ import file input — selalu ada di DOM */}
      <input
        ref={objImportRef}
        type="file"
        accept=".obj"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const textContent = event.target?.result as string;
              if (textContent) {
                const relayHttpUrl = 'https://tikserver.nufat.id';
                fetch(`${relayHttpUrl}/api/upload-obj`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filename: file.name,
                    content: textContent
                  })
                })
                .then(r => r.json())
                .then(res => {
                  if (res.success) {
                    console.log('✅ OBJ uploaded successfully:', res.filename);
                  } else {
                    alert(`❌ Gagal upload ke server: ${res.error}`);
                  }
                })
                .catch(err => {
                  console.error('Upload error:', err);
                  alert(`❌ Gagal terhubung ke relay server: ${err.message}`);
                });
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden Floor Texture import file input — selalu ada di DOM */}
      <input
        ref={textureImportRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64Content = event.target?.result as string;
              if (base64Content) {
                const relayHttpUrl = 'https://tikserver.nufat.id';
                fetch(`${relayHttpUrl}/api/upload-texture`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filename: file.name,
                    content: base64Content
                  })
                })
                .then(r => r.json())
                .then(res => {
                  if (res.success) {
                    console.log('✅ Custom floor texture uploaded successfully:', res.filename);
                    setFloorTheme(res.url);
                    battleArenaRef.current?.changeFloorTheme(res.url);
                  } else {
                    alert(`❌ Gagal upload tekstur ke server: ${res.error}`);
                  }
                })
                .catch(err => {
                  console.error('Texture upload error:', err);
                  alert(`❌ Gagal terhubung ke relay server: ${err.message}`);
                });
              }
            };
            reader.readAsDataURL(file); // Read image as base64 Data URL
            e.target.value = '';
          }
        }}
      />

      {/* 3D Battle Arena canvas — ALWAYS MOUNTED AND PLACED IN THE BACKGROUND */}
      <div 
        onDoubleClick={handleScreenDoubleTap} 
        className={`absolute inset-0 z-0 select-none ${isDashRoute ? 'pointer-events-none' : 'cursor-pointer'}`}
      >
        <BattleArena3D
          ref={battleArenaRef}
          onLeaderboardUpdate={setActiveLeaderboard}
          onLiveFeedMessage={addLiveFeedEntry}
          currentLikes={likes}
          onAddKillScore={handleKillScore}
          onWinnerDecided={addMatchWinner}
          onBossMvpDecided={handleBossMvp}
          onMusicAirdropTriggered={() => {
            sendSocketMessage({ type: 'request_webspy_song' });
          }}
          currentYoutubeTitle={currentYoutubeTitle}
          onNextSong={playNextInQueue}
          onSafeZoneUpdate={() => {}}
        />
      </div>

      {/* GLOBAL HUD ELEMENTS — Always on top of everything (z-100) */}
      {!isDashRoute && !isYoutubeRoute && (
        <>
          {/* 1. MUSIC HUD (Top - Lowered slightly) */}
          <div className="absolute top-10 left-0 right-0 flex flex-col items-center gap-1.5 z-[100] pointer-events-none select-none px-4">
            {/* Now Playing Title Card (Glassmorphism Emerald) */}
            <div className="bg-black/60 border border-white/10 p-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 pointer-events-none w-full max-w-[280px]">
              <div className="bg-emerald-500/20 p-2 rounded-xl shrink-0 border border-emerald-500/20">
                 <svg className="w-4 h-4 text-emerald-400 animate-[spin_4s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                 </svg>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                 <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest leading-none mb-1 font-mono">Now Playing</span>
                 <span className="text-white text-[11px] font-black truncate font-sans block">
                   {currentYoutubeTitle || 'Menunggu lagu...'}
                 </span>
              </div>
            </div>

            {/* Next Song Button — Glassmorphism style with more padding */}
            <button
              onClick={playNextInQueue}
              className="bg-black/60 hover:bg-black/80 border border-emerald-500/30 text-emerald-400 py-2.5 px-10 rounded-xl shadow-lg backdrop-blur-xl transition-all active:scale-90 pointer-events-auto cursor-pointer flex items-center justify-center gap-2 group mt-0.5"
            >
              <span className="text-[10px] font-black uppercase tracking-widest">Next Song</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Overlay ketika berada di rute dashboard atau youtube: semi-transparan, blur glassmorphic agar teks dashboard terbaca */}
      {(isDashRoute || isYoutubeRoute) && (
        <div className="absolute inset-0 bg-[#050814]/85 backdrop-blur-[6px] z-10 pointer-events-none transition-all duration-300" />
      )}

      {/* HEADER & NAV — ONLY ON DASHBOARD OR YOUTUBE ROUTE */}
      {(isDashRoute || isYoutubeRoute) && (
        <>
          {/* GLOWING AMBIENT HEADER BG */}
          <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-indigo-950/20 to-transparent pointer-events-none" />

          {/* TOP HEADER CONTROLS DESK */}
          <header className="relative border-b border-white/5 bg-slate-950/50 backdrop-blur-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 z-40">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-lg animate-pulse ${isYoutubeRoute ? 'bg-gradient-to-tr from-red-500 to-orange-600 shadow-red-950/40' : 'bg-gradient-to-tr from-rose-500 to-indigo-600 shadow-indigo-950/40'}`}>
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2 uppercase">
                  {isYoutubeRoute ? 'YouTube Live' : 'TikTok Live'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400">3D BATTLE ARENA</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium font-mono">
                  Real-time {isYoutubeRoute ? 'YouTube' : 'TikTok'} battle royale — terhubung ke stream langsung
                </p>
              </div>
            </div>

            {/* CONNECTION STATUS & INPUT (Switch between TikTok and YouTube inputs) */}
            <div className="flex items-center gap-3">
              {isYoutubeRoute ? (
                /* YouTube Connection UI */
                <div className="flex items-center gap-3">
                   <div className="bg-slate-900/90 border border-white/10 p-1.5 rounded-full shadow-md flex items-center gap-2">
                      <span className="pl-3 text-[11px] font-bold text-slate-400">youtube.com/</span>
                      <input 
                        type="text" 
                        placeholder="Channel ID / Live URL" 
                        className="bg-transparent border-0 ring-0 outline-none text-white text-xs font-black w-48 placeholder-slate-600"
                      />
                      <button className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-4 py-1.5 rounded-full transition-all">HUBUNGKAN YT</button>
                   </div>
                </div>
              ) : (
                /* TikTok Connection UI (Existing) */
                isConnected ? (
                  <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-500/20 px-3.5 py-1.5 rounded-full shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs text-emerald-300 font-black tracking-wide uppercase">
                      CONNECTED: @{tiktokUsername}
                    </span>
                    <button 
                      onClick={handleDisconnectStream}
                      className="text-[10px] text-white hover:text-rose-400 font-black cursor-pointer bg-emerald-950/60 transition-colors px-2.5 py-1 rounded"
                    >
                      DISCONNECT
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleConnectStream} className="flex flex-wrap lg:flex-nowrap items-center gap-2 bg-slate-900/90 border border-white/10 p-1.5 rounded-2xl lg:rounded-full shadow-md">
                    <div className="flex items-center pl-2.5 gap-1 text-[11px] font-bold text-slate-400">
                      <span>tiktok.com/@</span>
                    </div>
                    <input
                      type="text"
                      value={tiktokUsername}
                      onChange={(e) => setTiktokUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/gi, ''))}
                      placeholder="User_Id"
                      disabled={connecting}
                      className="bg-transparent border-0 ring-0 outline-none text-white text-xs font-black w-24 placeholder-slate-600 focus:ring-0 focus:outline-none"
                    />
                    <div className="w-px h-4 bg-white/10 hidden lg:block" />
                    <input
                      type="password"
                      value={tiktokSessionId}
                      onChange={(e) => setTiktokSessionId(e.target.value)}
                      placeholder="Session ID (Opsional)"
                      disabled={connecting}
                      className="bg-transparent border-0 ring-0 outline-none text-white text-xs font-black w-36 placeholder-slate-600 focus:ring-0 focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/30 rounded-full text-[10px] text-cyan-300 font-bold select-none">
                      <span>Auto:</span>
                      <a
                        href="javascript:(function(){const m=document.cookie.match(/sessionid=([^;]+)/);if(!m){alert('Aduh aa Baim, pastikan sudah login ke tiktok.com dulu ya!');return;}const s=m[1];navigator.clipboard.writeText(s).then(()=>{console.log('Session ID copied to clipboard');}).catch(()=>{});fetch('https://tikserver.nufat.id/api/set-session-id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:s})}).then(r=>r.json()).then(d=>{alert('✅ Berhasil! Session ID otomatis terkirim & disalin ke clipboard aa Baim.');}).catch(err=>{alert('⚠️ Session ID disalin ke clipboard! Silakan paste langsung di dashboard.');});})()"
                        className="bg-cyan-900/60 hover:bg-cyan-800 hover:text-white px-2 py-0.5 rounded transition-all cursor-pointer shadow-sm border border-cyan-700/40 text-cyan-200"
                        title="Seret tombol ini ke bookmarks bar browser. Buka tiktok.com, klik bookmark ini untuk mendapatkan Session ID otomatis."
                        onClick={(e) => {
                          if (e.button === 0) {
                            e.preventDefault();
                            alert("Aa Baim, caranya gampang:\n1. Seret (drag) tombol 'Auto Get 🚀' ini ke Bookmarks Bar browser aa Baim.\n2. Buka https://www.tiktok.com di tab baru (pastikan sudah login).\n3. Klik bookmark tersebut di Bookmarks Bar.\n4. Selesai! Halaman dashboard ini akan otomatis terisi Session ID-nya!");
                          }
                        }}
                      >
                        Auto Get 🚀
                      </a>
                    </div>
                    <button
                      type="submit"
                      disabled={connecting}
                      className="bg-gradient-to-r from-cyan-500 to-rose-500 hover:from-cyan-400 hover:to-rose-400 text-white font-black text-xs px-4 py-1.5 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {connecting ? 'Syncing...' : 'HUBUNGKAN LIVE'}
                    </button>
                  </form>
                )
              )}

              {/* Manual sound indicator toggle */}
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${soundEnabled ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'}`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* SIMPLE NAVIGATION BAR */}
          <div className="w-full max-w-[1700px] mx-auto px-4 lg:px-6 pt-4 flex items-center justify-between border-b border-white/5 pb-2.5 relative z-30 select-none">
            <div className="flex flex-wrap gap-2 p-1 bg-slate-950/80 border border-white/5 rounded-2xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
                  !isDashRoute && !isYoutubeRoute
                    ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-lg shadow-indigo-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>🎬 ARENA STREAM</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/dash')}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
                  isDashRoute
                    ? 'bg-emerald-600/90 text-white shadow-lg shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>📊 DASHBOARD</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/youtube')}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
                  isYoutubeRoute
                    ? 'bg-red-600/90 text-white shadow-lg shadow-red-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>🔴 YOUTUBE LIVE</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={handleResetMatch} 
                className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 hover:text-white text-xs font-black px-4 py-1.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all font-sans"
              >
                <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                RESET GAME
              </button>

              <button
                type="button"
                onClick={() => battleArenaRef.current?.exportScene()}
                className="bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-black px-4 py-1.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all font-sans"
                title="Export scene 3D sebagai file OBJ"
              >
                <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                EXPORT OBJ
              </button>

              <button
                type="button"
                onClick={() => {
                  objImportRef.current?.click();
                }}
                className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-black px-4 py-1.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all font-sans"
                title="Import file OBJ ke dalam scene 3D"
              >
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                IMPORT OBJ
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Aa Baim yakin ingin menghapus semua bangunan & dekorasi 3D dari arena?')) {
                    const relayHttpUrl = 'https://tikserver.nufat.id';
                    fetch(`${relayHttpUrl}/api/clear-objs`, { method: 'POST' })
                      .then(r => r.json())
                      .then(res => {
                        if (res.success) {
                          alert('✅ Arena dibersihkan dari bangunan tambahan!');
                        } else {
                          alert(`❌ Gagal membersihkan arena: ${res.error}`);
                        }
                      })
                      .catch(err => {
                        console.error('Clear error:', err);
                        alert(`❌ Gagal terhubung ke relay server: ${err.message}`);
                      });
                  }
                }}
                className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 hover:text-white text-xs font-black px-4 py-1.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all font-sans"
                title="Hapus semua struktur bangunan tambahan (.obj) dari peta"
              >
                <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                CLEAR MAP
              </button>

              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900/60 rounded-full border border-white/5 text-[10px] font-bold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {isDashRoute ? 'Dashboard Mode' : 'Stream Mode — HUD Bersih'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          ROUTE: / (ARENA STREAM) — STREAM OVERLAYS
          ========================================================================= */}
      {!isDashRoute && (
        <div className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden">
          {/* TOP-RIGHT POPUP NOTIFICATIONS — spawn & eliminated */}
          {topNotifications.length > 0 && (
            <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 items-end pointer-events-none select-none">
              <style>{`
                @keyframes notifSlideIn {
                  0% { transform: translateX(120px) scale(0.9); opacity: 0; }
                  100% { transform: translateX(0) scale(1); opacity: 1; }
                }
                .notif-enter {
                  animation: notifSlideIn 0.3s ease-out forwards;
                }
              `}</style>
              {topNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="notif-enter max-w-[320px] backdrop-blur-md rounded-lg px-4 py-2.5 shadow-2xl border"
                  style={{
                    background: notif.type === 'join'
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
                    borderColor: notif.type === 'join'
                      ? 'rgba(34,197,94,0.25)'
                      : 'rgba(239,68,68,0.25)',
                    boxShadow: notif.type === 'join'
                      ? '0 0 20px rgba(34,197,94,0.08)'
                      : '0 0 20px rgba(239,68,68,0.08)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">
                      {notif.type === 'join' ? '🪂' : '💀'}
                    </span>
                    <span
                      className="text-xs font-bold leading-tight"
                      style={{
                        color: notif.type === 'join' ? '#86EFAC' : '#FCA5A5',
                      }}
                    >
                      {/* Parse nama dari teks untuk minimal display */}
                      {notif.type === 'join'
                        ? notif.text.replace(/^@/, '').replace(/ memasuki arena battle royale!| bangkit kembali dan terjun ke arena!/, '')
                        : notif.text.replace(/^💀 @/, '').replace(/ dikirim kembali ke lobi oleh @.+$/, '')}
                    </span>
                  </div>
                  <div className="text-[9px] font-medium mt-0.5" style={{ color: notif.type === 'join' ? 'rgba(134,239,172,0.5)' : 'rgba(252,165,165,0.5)' }}>
                    {notif.type === 'join' ? 'MASUK ARENA' : 'TERELIMINASI'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty lobby */}
          {activeLeaderboard.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/85 z-30 backdrop-blur-sm pointer-events-none select-none text-center">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                <p className="text-sm font-black text-white">Menunggu Gladiator...</p>
                <p className="text-xs text-slate-400 max-w-[220px]">
                  Hubungkan ke TikTok Live untuk memulai pertarungan! Viewer yang bergabung akan otomatis spawn di arena.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ROUTE: /dash — FULL DASHBOARD WITH STATS, LOGS & LEADERBOARD
          ========================================================================= */}
      {isDashRoute && (
        <main className="flex-1 w-full max-w-[1700px] mx-auto p-4 lg:p-6 relative z-20 select-none">
          
          {/* BENTO STATS COUNTERS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 flex gap-3.5 items-center backdrop-blur-sm">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <Heart className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none font-sans">LIKES STREAM</span>
                <span className="text-white text-xl font-black mt-1 font-mono tracking-tight">{likes}</span>
              </div>
            </div>
            <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 flex gap-3.5 items-center backdrop-blur-sm">
              <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-xl">
                <Coins className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none font-sans">TOTAL KOIN</span>
                <span className="text-white text-xl font-black mt-1 font-mono tracking-tight">{earnedCoins}</span>
              </div>
            </div>
            <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 flex gap-3.5 items-center backdrop-blur-sm">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none font-sans">PENONTON LIVE</span>
                <span className="text-white text-xl font-black mt-1 font-mono tracking-tight">{viewerCount}</span>
              </div>
            </div>
            <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 flex gap-3.5 items-center backdrop-blur-sm">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none font-sans">GANGSING HIDUP</span>
                <span className="text-white text-xl font-black mt-1 font-mono tracking-tight">{alivePlayers.length} / {alivePlayers.length + deadPlayers.length}</span>
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID: JUKEBOX & MAP CONTROLS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              {/* Jukebox YouTube Panel Card */}
              <JukeboxPanel
                currentYoutubeId={currentYoutubeId}
                currentYoutubeTitle={currentYoutubeTitle}
                jukeboxQueue={jukeboxQueue}
                isAutoplay={isAutoplay}
                isShuffle={isShuffle}
                onSendSocketMessage={sendSocketMessage}
              />
            </div>

            {/* Map & Floor Customization Bento Card */}
            <div className="bg-slate-950/70 border border-white/5 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-black text-white tracking-wide uppercase">🗺️ Kustomisasi Arena</h2>
                </div>
                <p className="text-[11px] text-slate-400 font-medium font-sans mb-4 leading-normal">
                  Ubah tekstur lantai game secara real-time dan upload file 3D (.obj) untuk membangun jalan, gedung, rintangan, atau dekorasi arena.
                </p>

                {/* Floor Selector Section */}
                <div className="flex flex-col gap-2 mb-4">
                  <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase font-mono">Pilih Tema Lantai</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'scifi', label: '🤖 Sci-Fi' },
                      { id: 'grass', label: '🌿 Rumput' },
                      { id: 'sand', label: '🏜️ Pasir' },
                      { id: 'brick', label: '🧱 Bata' },
                      { id: 'stone', label: '🪨 Batu' },
                      { id: 'lava', label: '🌋 Lava' },
                      { id: 'ice', label: '❄️ Es' },
                      { id: 'wood', label: '🪵 Kayu' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleFloorThemeChange(theme.id)}
                        className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                          floorTheme === theme.id
                            ? 'bg-indigo-600/90 text-white border-indigo-500/50 shadow-lg shadow-indigo-950/40'
                            : 'bg-slate-900/40 text-slate-300 border-white/5 hover:bg-slate-900/60 hover:text-white'
                        }`}
                      >
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Upload Custom Texture Button */}
                  <button
                    type="button"
                    onClick={() => textureImportRef.current?.click()}
                    className="mt-2 w-full bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/25 text-indigo-300 hover:text-white text-xs font-black py-2.5 px-3 rounded-xl cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>🖼️ Upload Tekstur Lantai Custom</span>
                  </button>
                </div>
              </div>

              {/* 3D OBJ Actions Section */}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase font-mono">Struktur 3D (.obj)</span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => objImportRef.current?.click()}
                    className="bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/25 text-emerald-300 hover:text-white text-xs font-black py-2 px-3 rounded-xl cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    UPLOAD OBJ (BANGUNAN)
                  </button>

                  <button
                    type="button"
                    onClick={handleClearMap}
                    className="bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/25 text-rose-300 hover:text-white text-xs font-black py-2 px-3 rounded-xl cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    BERSIHKAN PETA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE FEED LOGS TERMINAL */}
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-black tracking-widest text-indigo-400 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Logs Aktivitas Live TikTok
              </span>
              <button onClick={() => setLiveFeedLogs([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-300 font-mono cursor-pointer">Clear Log</button>
            </div>
            <div className="w-full bg-[#030611] rounded-2xl p-3 border border-white/5 h-36 custom-scrollbar overflow-y-auto font-mono text-[10px] leading-tight text-slate-400 flex flex-col gap-1">
              {liveFeedLogs.map((log) => (
                <div key={log.id} className="flex gap-2 items-start py-0.5 select-text hover:bg-white/5 px-2 rounded transition-colors">
                  <span className="text-slate-600 font-bold shrink-0">[{log.time}]</span>
                  <span className={`font-semibold ${log.type === 'gift' ? 'text-purple-400 font-bold' : log.type === 'kill' ? 'text-red-400 font-bold' : log.type === 'join' ? 'text-indigo-400' : 'text-slate-400'}`}>{log.text}</span>
                </div>
              ))}
              {liveFeedLogs.length === 0 && (
                <div className="text-slate-600 italic py-4 text-center">Terminal standby. Log komentar, gift, dan kekalahan gladiator akan dicetak di sini secara real-time.</div>
              )}
            </div>
          </div>

        </main>
      )}

    </div>
  );
}
