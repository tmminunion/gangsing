import React, { useState, useEffect, useRef } from 'react';
import { BattleArena3D, BattleArenaRef } from './components/BattleArena3D';
import { Player, Gift, ChatMessage, GiftEvent, MatchHistoryEntry } from './types';
import { TIKTOK_GIFTS } from './data/gifts';
import { SIMULATED_USERNAMES, SIMULATED_COMMENTS, TIKTOK_LIVE_GUIDELINES } from './data/simulation';
import { ArsenalLogo, PSGLogo } from './components/TeamLogos';
import { 
  Tv, 
  Flame, 
  Coins, 
  ThumbsUp, 
  Users, 
  Send, 
  Zap, 
  UserPlus, 
  RefreshCw, 
  Volume2, 
  Terminal, 
  Layers, 
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  Heart,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  EyeOff,
  Maximize2,
  Gift as GiftIcon
} from 'lucide-react';

export default function App() {
  const battleArenaRef = useRef<BattleArenaRef>(null);

  // Connection settings
  const [tiktokUsername, setTiktokUsername] = useState('bungtemin');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Sim Stats
  const [viewerCount, setViewerCount] = useState(1280);
  const [likes, setLikes] = useState(1420);
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

  // Simulation controls
  const [isAutoPilot, setIsAutoPilot] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState<'low' | 'medium' | 'high'>('medium');
  const [manualTarget, setManualTarget] = useState('');
  const [customCommentText, setCustomCommentText] = useState('');

  // Active Sound effects state toggle
  const [soundEnabled, setSoundEnabled] = useState(false);

  // TikTok Streamer Clear HUD Options
  const [isLayarBersih, setIsLayarBersih] = useState(false); // Hides overlays on phone glass
  const [isModeLayarPenuh, setIsModeLayarPenuh] = useState(false); // Hides side columns for pure OBS stream mapping

  // Separate Navigation views: arena, simulator, logs
  const getInitialTab = (): 'arena' | 'simulator' | 'logs' => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/stat' || hash === '#/stat') return 'logs';
    if (path === '/simulator' || hash === '#/simulator') return 'simulator';
    return 'arena';
  };
  const [activeTab, setActiveTabState] = useState<'arena' | 'simulator' | 'logs'>(getInitialTab);

  const setActiveTab = (tab: 'arena' | 'simulator' | 'logs') => {
    setActiveTabState(tab);
    const newPath = tab === 'logs' ? '/stat' : tab === 'simulator' ? '/simulator' : '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    const targetHash = tab === 'logs' ? '#/stat' : tab === 'simulator' ? '#/simulator' : '#/arena';
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/stat' || hash === '#/stat') {
        setActiveTabState('logs');
      } else if (path === '/simulator' || hash === '#/simulator') {
        setActiveTabState('simulator');
      } else {
        setActiveTabState('arena');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Pre-fill target name when clicking a survivor in lists
  const handleSelectTarget = (username: string) => {
    setManualTarget(username);
  };

  // Connect simulated stream
  const handleConnectStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUsername.trim()) return;

    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setIsConnected(true);
      addLiveFeedEntry({
        id: Math.random().toString(),
        type: 'system',
        text: `Koneksi berhasil! Membaca aktivitas live stream TikTok @${tiktokUsername}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }, 1500);
  };

  const handleDisconnectStream = () => {
    setIsConnected(false);
    addLiveFeedEntry({
      id: Math.random().toString(),
      type: 'system',
      text: 'Terputus dari live stream TikTok.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  // Append items to live activity log
  const addLiveFeedEntry = (newEntry: { id: string; type: 'gift' | 'comment' | 'kill' | 'system' | 'join'; text: string; time: string }) => {
    setLiveFeedLogs(prev => [newEntry, ...prev].slice(0, 50));
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

  const addMatchWinner = (winner: { username: string; color: string; kills: number }) => {
    const entry: MatchHistoryEntry = {
      id: Math.random().toString(),
      winnerName: winner.username,
      winnerColor: winner.color,
      kills: winner.kills,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setMatchHistory(prev => {
      const updated = [entry, ...prev].slice(0, 5);
      localStorage.setItem('battle_royale_match_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Trigger manual comments
  const handleSendManualComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCommentText.trim()) return;

    const sender = manualTarget.trim() || 'Moderator_Live';
    triggerCommentAction(sender, customCommentText);
    setCustomCommentText('');
  };

  const triggerCommentAction = (username: string, text: string) => {
    if (!battleArenaRef.current) return;

    // Trigger action inside 3D environment
    battleArenaRef.current.triggerComment(username, text);

    // Insert to chat
    const newChat: ChatMessage = {
      id: Math.random().toString(),
      username,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: username.toLowerCase() === 'moderator_live' ? 'moderator' : 'viewer',
      avatarSeed: Math.random().toString(36).substring(2, 6).toUpperCase()
    };

    setChatMessages(prev => [...prev, newChat].slice(-15));
  };

  // Trigger manual gift trigger
  const handleSendManualGift = (gift: Gift) => {
    if (!battleArenaRef.current) return;

    const sender = manualTarget.trim() || 'Sultan_Donatur';
    const amount = 1;

    // Trigger in 3D Arena
    battleArenaRef.current.triggerGift(sender, gift.name, amount);

    // Calculate Coin reward increase
    setEarnedCoins(prev => prev + gift.cost);

    // Dynamic Sliding ribbon alert
    setRecentGiftBanner({
      username: sender,
      gift,
      amount,
      id: Math.random().toString()
    });

    // Add to chat feed
    const newChat: ChatMessage = {
      id: Math.random().toString(),
      username: sender,
      text: `mengirim ${gift.emoji} ${gift.name}!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: 'gifter',
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
  };

  // Bot Generator Simulator loop
  useEffect(() => {
    if (!isAutoPilot) return;

    let delay = 3000;
    if (simulationSpeed === 'low') delay = 4500;
    if (simulationSpeed === 'high') delay = 1000;

    const interval = setInterval(() => {
      if (!battleArenaRef.current) return;

      const actionDice = Math.random();

      // Fluctuate viewer counts randomly
      setViewerCount(prev => Math.max(300, prev + Math.floor((Math.random() - 0.49) * 15)));

      if (actionDice < 0.50) {
        // 1. Simulate Comment Call
        const randomUser = SIMULATED_USERNAMES[Math.floor(Math.random() * SIMULATED_USERNAMES.length)];
        const randomText = SIMULATED_COMMENTS[Math.floor(Math.random() * SIMULATED_COMMENTS.length)];
        
        triggerCommentAction(randomUser, randomText);
      } 
      else if (actionDice < 0.82) {
        // 2. Simulate screen tap Likes
        const canvasContainer = document.getElementById('battle_arena_container');
        if (canvasContainer) {
          const rect = canvasContainer.getBoundingClientRect();
          const cx = rect.left + Math.random() * rect.width;
          const cy = rect.top + Math.random() * rect.height;
          battleArenaRef.current.triggerTap(cx, cy);
          setLikes(prev => prev + 1);
        }
      } 
      else {
        // 3. Simulate Gift Drop
        const randomUser = SIMULATED_USERNAMES[Math.floor(Math.random() * SIMULATED_USERNAMES.length)];
        
        // Distribution of gifts (Cheaper ones are much more frequent)
        const giftRng = Math.random();
        let selectedGift = TIKTOK_GIFTS[0]; // Rose

        if (giftRng < 0.40) selectedGift = TIKTOK_GIFTS[0]; // Rose
        else if (giftRng < 0.65) selectedGift = TIKTOK_GIFTS[1]; // Finger Heart
        else if (giftRng < 0.80) selectedGift = TIKTOK_GIFTS[2]; // Ice Cream
        else if (giftRng < 0.90) selectedGift = TIKTOK_GIFTS[3]; // TikTok icon
        else if (giftRng < 0.95) selectedGift = TIKTOK_GIFTS[4]; // Donut
        else if (giftRng < 0.98) selectedGift = TIKTOK_GIFTS[5]; // Box Crate
        else if (giftRng < 0.995) selectedGift = TIKTOK_GIFTS[6]; // Diamond
        else selectedGift = TIKTOK_GIFTS[7]; // Universe!

        const amount = selectedGift.cost === 1 ? Math.floor(Math.random() * 5) + 1 : 1;

        battleArenaRef.current.triggerGift(randomUser, selectedGift.name, amount);
        setEarnedCoins(prev => prev + selectedGift.cost * amount);

        // Ribbon Alert Update
        setRecentGiftBanner({
          username: randomUser,
          gift: selectedGift,
          amount,
          id: Math.random().toString()
        });

        // Chat add
        const newChat: ChatMessage = {
          id: Math.random().toString(),
          username: randomUser,
          text: `mengirim ${selectedGift.emoji} ${selectedGift.name} x${amount}!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          badge: 'gifter',
          avatarSeed: Math.random().toString(36).substring(2, 6).toUpperCase()
        };
        setChatMessages(prev => [...prev, newChat].slice(-15));
      }
    }, delay);

    return () => clearInterval(interval);
  }, [isAutoPilot, simulationSpeed]);

  // Remove gift banners after 4 seconds automatically
  useEffect(() => {
    if (!recentGiftBanner) return;
    const bannerTimer = setTimeout(() => {
      setRecentGiftBanner(null);
    }, 4500);
    return () => clearTimeout(bannerTimer);
  }, [recentGiftBanner]);

  // Top 3 survivors computation
  const alivePlayers = activeLeaderboard.filter(p => p.status === 'alive');
  const deadPlayers = activeLeaderboard.filter(p => p.status === 'dead');

  // Arsenal / PSG team state calculations (Real-time)
  const arsenalPlayers = activeLeaderboard.filter(p => p.team === 'arsenal');
  const psgPlayers = activeLeaderboard.filter(p => p.team === 'psg');
  const arsenalAliveCount = arsenalPlayers.filter(p => p.status === 'alive').length;
  const psgAliveCount = psgPlayers.filter(p => p.status === 'alive').length;
  const arsenalKills = arsenalPlayers.reduce((sum, p) => sum + p.kills, 0);
  const psgKills = psgPlayers.reduce((sum, p) => sum + p.kills, 0);

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white flex flex-col antialiased">
      
      {/* GLOWING AMBIENT HEADER BG */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-indigo-950/20 to-transparent pointer-events-none" />

      {/* TOP HEADER CONTROLS DESK */}
      <header className="relative border-b border-white/5 bg-slate-950/50 backdrop-blur-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 shadow-lg shadow-indigo-950/40 animate-pulse">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              TIKTOK LIVE <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400">3D BATTLE ARENA</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium font-mono">
              Gladiator Royale simulator optimized for TikTok Live vertical portrait feeds
            </p>
          </div>
        </div>

        {/* CONNECTION STATUS & SEED SELECTOR */}
        <div className="flex items-center gap-3">
          {isConnected ? (
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
            <form onSubmit={handleConnectStream} className="flex items-center gap-2 bg-slate-900/90 border border-white/10 px-2 py-1 rounded-full shadow-md">
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
              <button
                type="submit"
                disabled={connecting}
                className="bg-gradient-to-r from-cyan-500 to-rose-500 hover:from-cyan-400 hover:to-rose-400 text-white font-black text-xs px-4 py-1.5 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {connecting ? 'Syncing...' : 'HUBUNGKAN LIVE'}
              </button>
            </form>
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

      {/* SEPARATE NAVIGATION PAGES/TABS: ARENA | SIMULATOR & PENGATURAN | LOGS & PANDUAN */}
      <div className={`w-full max-w-[1700px] mx-auto px-4 lg:px-6 pt-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2.5 relative z-30 gap-4 select-none ${isModeLayarPenuh ? 'hidden' : 'flex'}`}>
        <div className="flex flex-wrap gap-2 p-1 bg-slate-950/80 border border-white/5 rounded-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab('arena')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
              activeTab === 'arena'
                ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-lg shadow-indigo-950/40 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>🖥️ ARENA DASHBOARD</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>⚙️ SIMULATOR & PENGATURAN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-emerald-600/90 text-white shadow-lg shadow-emerald-950/40 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📈 STATISTIK & LOGS</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900/60 rounded-full border border-white/5 text-[10px] font-bold text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>Sistem Pemantau Live Berjalan</span>
        </div>
      </div>

      {/* CORE WORKSPACE CONTENT PANEL */}
      <main className={`flex-1 w-full max-w-[1700px] mx-auto p-4 lg:p-6 relative z-10 select-none transition-all duration-500 ${isModeLayarPenuh ? 'flex flex-col items-center justify-center min-h-[75vh]' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'}`}>
        
        {/* =========================================================================
            LEFT COLUMN: 9:16 LIVESTREAM PHONE SCREEN PREVIEW (CORES 1-4 OF 12 COLS)
            ========================================================================= */}
        <div className={`flex flex-col items-center justify-start relative z-10 select-none transition-all duration-500 ${isModeLayarPenuh ? 'w-full max-w-[410px]' : 'lg:col-span-5 xl:col-span-4'}`}>
          
          {/* STREAMER TIKTOK CONTROLS HEADER BAR */}
          <div className="w-full max-w-full sm:max-w-[390px] mb-3.5 bg-slate-950/90 border border-slate-800 backdrop-blur-md p-3 rounded-2xl flex flex-col gap-2.5 shadow-xl shadow-black/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-400 font-extrabold tracking-widest uppercase flex items-center gap-1.5 leading-none">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" /> TIKTOK LIVE OVERLAY
              </span>
              <span className="text-[9px] font-mono text-slate-400">Streamer Kit v1.1</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsLayarBersih(!isLayarBersih)}
                className={`py-2 px-3 rounded-xl border font-black text-[9px] tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                  isLayarBersih
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow shadow-emerald-500/10'
                    : 'bg-slate-900 border-white/5 hover:border-white/10 text-slate-300'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                {isLayarBersih ? 'HUD BERSIH: ON' : 'BERSIHKAN HUD'}
              </button>

              <button
                type="button"
                onClick={() => setIsModeLayarPenuh(!isModeLayarPenuh)}
                className={`py-2 px-3 rounded-xl border font-black text-[9px] tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                  isModeLayarPenuh
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow shadow-indigo-500/10'
                    : 'bg-slate-900 border-white/5 hover:border-white/10 text-slate-300'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                {isModeLayarPenuh ? 'DASHBOARD: ON' : 'OBS FULL ARTL'}
              </button>
            </div>
          </div>

          {/* Portrait Framed Screen Phone Body casing wrapper */}
          <div className="w-full max-w-full sm:max-w-[390px] aspect-[9/16] bg-slate-950 rounded-[28px] sm:rounded-[44px] shadow-2xl border-2 sm:border-4 border-slate-800 shadow-indigo-950/50 p-1.5 sm:p-2.5 flex flex-col relative select-none">
            
            {/* Top Speaker phone notch decoration */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
              <span className="w-12 h-1 bg-slate-800 rounded-full" />
              <span className="w-2 h-2 bg-slate-900 rounded-full" />
            </div>

            {/* Simulated Glass glare highlight overlay */}
            <div className="absolute inset-2 rounded-[34px] overflow-hidden pointer-events-none z-30 select-none">
              <div className="absolute -top-[100%] -left-[100%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none rotate-12" />
            </div>

            {/* LIVE STREAM FEED PHONE INNER FRAME */}
            <div 
              onDoubleClick={handleScreenDoubleTap} 
              className="relative flex-1 rounded-[34px] bg-slate-900 overflow-hidden cursor-pointer select-none flex flex-col"
            >
              {/* 3D Battle Arena canvas scene component */}
              <div className="absolute inset-0 z-0">
                <BattleArena3D
                  ref={battleArenaRef}
                  onLeaderboardUpdate={setActiveLeaderboard}
                  onLiveFeedMessage={addLiveFeedEntry}
                  currentLikes={likes}
                  onAddKillScore={handleKillScore}
                  onWinnerDecided={addMatchWinner}
                />
              </div>

              {/* OVERLAY CORE 1: TIKTOK CHIP HEADER BAR */}
              <div className={`absolute top-4 left-0 right-0 px-3 flex items-center justify-between z-20 pointer-events-none select-none transition-all duration-300 ${isLayarBersih ? 'opacity-0 scale-95' : 'opacity-100'}`}>
                
                {/* Left side Host Information */}
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1.5 bg-black/45 hover:bg-black/60 transition-colors backdrop-blur-md px-1.5 py-1 rounded-full border border-white/5 pointer-events-auto">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                      {tiktokUsername.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex flex-col pr-1 pr-1.5">
                      <span className="text-white text-[10px] font-black tracking-tight leading-tight">@{tiktokUsername}</span>
                      <span className="text-[8px] text-cyan-300 font-extrabold flex items-center leading-none">
                        🔴 LIVE
                      </span>
                    </div>
                    <button className="bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-[8px] py-1 px-2.5 rounded-full shadow-inner font-sans tracking-wide">
                      Ikuti
                    </button>
                  </div>

                  <div className="bg-black/45 backdrop-blur-md py-1 px-3.5 rounded-full border border-white/5 flex flex-col leading-tight">
                    <span className="text-yellow-400 text-[10px] font-black flex items-center">
                      🪙 {earnedCoins}
                    </span>
                  </div>
                </div>

                {/* Right side Viewer Counts & Exit buttons */}
                <div className="flex items-center gap-1.5">
                  <div className="bg-black/45 backdrop-blur-md py-1 px-2.5 rounded-full border border-white/5 flex items-center gap-1">
                    <Users className="w-3 h-3 text-white" />
                    <span className="text-white text-[9px] font-black tracking-tight">{viewerCount}</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/5 text-white/80 text-[10px] font-bold">
                    ✕
                  </div>
                </div>
              </div>

              {/* OVERLAY TEAM SCOREBOARD: ARSENAL VS PSG */}
              <div className={`absolute top-[68px] left-3 right-3 z-20 bg-black/75 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 select-none shadow-lg shadow-black/40 flex flex-col gap-1.5 pointer-events-auto transition-all duration-300 ${isLayarBersih ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center justify-between">
                  {/* Left Team (Arsenal 🔴) */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <ArsenalLogo className="w-6.5 h-6.5 shrink-0 filter drop-shadow" />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-[10px] font-sans font-black text-rose-100 uppercase tracking-tight flex items-center gap-1">
                        ARSENAL <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      </span>
                      <div className="flex gap-1.5 text-[8px] text-slate-400 font-extrabold font-mono">
                        <span>🧍{arsenalAliveCount} hidup</span>
                        <span>💀{arsenalKills}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mid VS Emblem */}
                  <div className="px-1.5 shrink-0">
                    <div className="bg-slate-950 border border-yellow-500/30 px-2 py-0.5 rounded text-[8px] font-extrabold text-yellow-400 font-mono tracking-wider animate-pulse uppercase">
                      VS
                    </div>
                  </div>

                  {/* Right Team (PSG 🔵) */}
                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0 text-right">
                    <div className="flex flex-col min-w-0 leading-tight items-end">
                      <span className="text-[10px] font-sans font-black text-blue-100 uppercase tracking-tight flex items-center gap-1">
                        PSG <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      </span>
                      <div className="flex gap-1.5 text-[8px] text-slate-400 font-extrabold font-mono justify-end">
                        <span>💀{psgKills}</span>
                        <span>🧍{psgAliveCount} hidup</span>
                      </div>
                    </div>
                    <PSGLogo className="w-6.5 h-6.5 shrink-0 filter drop-shadow" />
                  </div>
                </div>

                {/* Score / Alive Ratio visual tug-of-war bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div 
                    style={{ 
                      width: `${
                        arsenalAliveCount + psgAliveCount === 0 
                          ? 50 
                          : (arsenalAliveCount / (arsenalAliveCount + psgAliveCount)) * 100
                      }%` 
                    }} 
                    className="h-full bg-red-500 shadow-inner transition-all duration-300" 
                  />
                  <div 
                    style={{ 
                      width: `${
                        arsenalAliveCount + psgAliveCount === 0 
                          ? 50 
                          : (psgAliveCount / (arsenalAliveCount + psgAliveCount)) * 100
                      }%` 
                    }} 
                    className="h-full bg-blue-500 shadow-inner transition-all duration-300" 
                  />
                </div>
              </div>

              {/* OVERLAY CORE 1.5: STREAM DETAILS (LIKES TIMER) */}
              <div className={`absolute top-[132px] right-3 z-20 pointer-events-none flex flex-col items-end gap-1 font-mono transition-all duration-300 ${isLayarBersih ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-black/50 backdrop-blur-sm p-1.5 rounded-lg border border-white/5 flex flex-col items-end">
                  <span className="text-[7px] text-slate-400 tracking-wider font-bold">SUKA / LIKES</span>
                  <span className="text-rose-400 text-xs font-black flex items-center gap-0.5">
                    ❤️ {likes}
                  </span>
                </div>
              </div>

              {/* OVERLAY CORE 2: CRITICAL KILLSTREAK FEED LOG (TOP-LEFT UNDER PROFILE) */}
              <div className={`absolute top-[132px] left-3 z-20 pointer-events-none max-w-[160px] flex flex-col gap-1.5 select-none leading-none transition-all duration-300 ${isLayarBersih ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/5 shadow-md">
                  <h3 className="text-white text-[8px] font-black tracking-widest uppercase mb-1 flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-rose-500 animate-pulse" /> TOKO PEMBANTAI
                  </h3>
                  <div className="flex flex-col gap-1 custom-scrollbar overflow-y-auto max-h-[85px]">
                    {alivePlayers.slice(0, 3).map((p, idx) => (
                      <div key={p.id} className="flex justify-between items-center text-[9px] text-slate-300">
                        <span className="font-extrabold truncate max-w-[90px]" style={{ color: p.color }}>
                          #{idx+1} {p.username}
                        </span>
                        <span className="font-mono text-emerald-400 font-bold ml-1">💀{p.kills}</span>
                      </div>
                    ))}
                    {alivePlayers.length === 0 && (
                      <div className="text-[8px] text-slate-500 font-bold italic">
                        Menunggu ksatria...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* OVERLAY CORE 3: GIFT SLIDING BANNER (FROM LEFT) */}
              {recentGiftBanner && !isLayarBersih && (
                <div 
                  key={recentGiftBanner.id}
                  id="gift_banner_alert"
                  style={{ animation: 'slideInLeft 4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                  className="absolute top-[35%] left-3 z-30 pointer-events-none bg-gradient-to-r from-purple-950/90 via-slate-900/90 to-transparent backdrop-blur-md pl-1.5 pr-8 py-1.5 rounded-full border border-purple-500/30 flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-base shadow-sm">
                    {recentGiftBanner.gift.emoji}
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-white text-[10px] font-black truncate max-w-[110px]">
                      @{recentGiftBanner.username}
                    </span>
                    <span className="text-[8px] text-purple-300 font-bold flex items-center gap-1 leading-none">
                      mengirim <strong className="text-yellow-400">{recentGiftBanner.gift.name}</strong>
                    </span>
                  </div>
                  <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 ml-1 font-mono tracking-tighter">
                    x{recentGiftBanner.amount}
                  </div>
                </div>
              )}

              {/* OVERLAY CORE 4: TRANSPARENT SCR_SCROLLING CHAT LIST (BOTTOM-LEFT) */}
              <div className={`absolute bottom-4 left-3 right-12 z-20 pointer-events-none flex flex-col gap-1 max-h-[170px] justify-end overflow-hidden transition-all duration-300 ${isLayarBersih ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100'}`}>
                {chatMessages.map((msg) => {
                  const isGifter = msg.badge === 'gifter';
                  const isMod = msg.badge === 'moderator';

                  return (
                    <div 
                      key={msg.id} 
                      className="bg-black/35 backdrop-blur-sm py-1 px-2.5 rounded-xl border border-white/5 flex flex-wrap items-center gap-1.5 max-w-[280px] leading-tight text-[10px] animate-[fadeIn_0.2s_ease-out_forwards]"
                    >
                      {/* Badge Tags */}
                      {isMod && (
                        <span className="bg-blue-500 text-white font-extrabold text-[7px] px-1.5 py-0.5 rounded-sm scale-90">
                          MOD
                        </span>
                      )}
                      {isGifter && (
                        <span className="bg-yellow-500 text-slate-900 font-extrabold text-[7px] px-1.5 py-0.5 rounded-sm scale-90">
                          DONATOR
                        </span>
                      )}

                      <span className="text-cyan-300 font-black tracking-tight select-all">
                        @{msg.username}
                      </span>
                      <span className={`${isGifter ? 'text-yellow-300 font-extrabold' : 'text-slate-100 font-medium'}`}>
                        {msg.text}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* OVERLAY CORE 5: TAP ACTION FEEDBACK WATERMARK & HELP INFO */}
              <div className={`absolute bottom-4 right-3 z-20 pointer-events-none flex flex-col items-center gap-1 transition-all duration-300 ${isLayarBersih ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100'}`}>
                <div className="w-10 h-10 rounded-full bg-rose-500/80 backdrop-blur-sm border border-rose-400/30 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-rose-950/30 animate-pulse pointer-events-auto active:scale-90">
                  ❤️
                </div>
                <span className="text-[7px] text-rose-300 font-black tracking-widest uppercase">TAP TAP</span>
              </div>

              {/* EMPTY LOBBY INTENT INDICATOR WATERMARK */}
              {activeLeaderboard.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/85 z-10 backdrop-blur-sm pointer-events-none select-none text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-sm font-black text-white">Menunggu Gladiator...</p>
                    <p className="text-xs text-slate-400 max-w-[200px]">
                      Aktifkan Bot Simulator atau tambahkan nama pemain untuk memulai pertarungan!
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          <p className="mt-4 text-xs font-semibold text-slate-500 tracking-wide">
            Double-click area game untuk simulator tap ❤️
          </p>
        </div>


        {/* =========================================================================
            RIGHT COLUMN: STREAMS DESK BOARD & SIMULATOR PLUGINS (CORES 5-12 COLS)
            ========================================================================= */}
        <div className={`lg:col-span-7 xl:col-span-8 flex flex-col gap-6 select-none relative z-10 transition-all duration-500 ${isModeLayarPenuh ? 'hidden opacity-0 pointer-events-none' : 'opacity-100'}`}>
          
          {/* =======================================================
              TAB 1: ARENA (MAIN PORTAL VISITOR DIRECTORY & CURRENT METRICS)
              ======================================================= */}
          {activeTab === 'arena' && (
            <>
              {/* BENTO STATS COUNTERS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                
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

              {/* TWO COLUMN GRID FOR DIRECTORY & HISTORY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Active gangsing traditional spinning tops catalog list */}
                <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
                  <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2 font-sans">
                    <Users className="w-4 h-4 text-indigo-400" />
                    GANGSING AKTIF DI ARENA ({alivePlayers.length})
                  </h3>

                  <div className="custom-scrollbar overflow-y-auto max-h-[380px] flex flex-col gap-1.5 pr-1">
                    {activeLeaderboard.map((p, index) => {
                      const isAlive = p.status === 'alive';
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isAlive ? 'bg-slate-900/40 border-white/5 hover:border-cyan-500/30 cursor-pointer hover:bg-slate-900/80' : 'bg-slate-950/20 border-slate-950 select-none opacity-40'}`}
                        >
                          <div className="flex items-center gap-2.5 font-sans">
                            <span className="text-[10px] font-mono font-black text-slate-500 w-4">#{index+1}</span>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="text-xs font-black text-white">@{p.username}</span>
                            <span className="text-[8.5px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded capitalize font-mono">
                              {p.weapon.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] text-slate-500 tracking-wider font-sans">DARAH</span>
                              <span className={`font-black ${isAlive ? 'text-red-400' : 'text-slate-600'}`}>
                                {isAlive ? `${p.hp}/${p.maxHp} HP` : 'DEAD'}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] text-slate-500 tracking-wider font-extrabold uppercase leading-none font-sans">KILLS</span>
                              <span className="text-emerald-400 font-extrabold">💀{p.kills}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {activeLeaderboard.length === 0 && (
                      <div className="text-center py-12 text-xs text-slate-500 font-bold italic font-sans whitespace-normal leading-relaxed">
                        Belum ada gangsing di arena. Berpindah ke menu "SIMULATOR & PENGATURAN" untuk memicu pendaratan gangsing baru!
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Winner History Card */}
                <div id="match-history" className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
                  <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2 font-sans">
                    <Trophy className="w-4 h-4 text-yellow-500 animate-pulse" />
                    RIWAYAT PERTANDINGAN (5 PEMENANG TERAKHIR)
                  </h3>

                  <div className="flex flex-col gap-2">
                    {matchHistory.map((m, index) => (
                      <div 
                        key={m.id} 
                        className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-white/5 hover:border-indigo-500/20 hover:bg-slate-900/60 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2.5 font-sans">
                          <span className="text-[11px] font-mono font-black text-yellow-500 w-4 flex items-center justify-center">
                            {index === 0 ? '👑' : `#${index + 1}`}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: m.winnerColor }} />
                          <span className="text-xs font-black text-white truncate max-w-[150px]">
                            @{m.winnerName}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex flex-col items-end">
                            <span className="text-[7px] text-slate-500 tracking-wider font-extrabold uppercase leading-none font-sans">WAKTU</span>
                            <span className="text-slate-300 font-bold text-[9px] mt-0.5">{m.timestamp}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[7px] text-slate-500 tracking-wider font-extrabold uppercase leading-none font-sans">KILLS</span>
                            <span className="text-emerald-400 font-black text-[10px] mt-0.5">💀{m.kills} Kills</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {matchHistory.length === 0 && (
                      <div className="text-center py-12 text-xs text-slate-500 font-bold italic border border-dashed border-white/5 rounded-2xl bg-black/20 font-sans leading-relaxed whitespace-normal">
                        Belum ada riwayat kemenangan. Pemenang akan otomatis tercatat ketika ada gangsing yang bertahan paling terakhir di arena!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}



          {/* CORE SECTION 1: AUTOPILOT AI SIMULATOR ENGINE (BENTO 4) */}
          {activeTab === 'simulator' && (
            <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 relative overflow-hidden backdrop-blur-md">
              
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-l from-indigo-500/5 to-transparent rounded-full pointer-events-none blur-3xl" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl ${isAutoPilot ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-900 text-slate-500'}`}>
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-md font-black text-white tracking-tight flex items-center gap-2 font-sans">
                      BOT AUTO-PILOT SIMULATOR
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-black">
                        RECOMMENDED FOR OBS
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium font-sans">
                      Secara otomatis menyimulasikan komentar, tap, dan gift secara berkala untuk demonstrasi live.
                    </p>
                  </div>
                </div>

                {/* Dynamic Pilot Switch Button */}
                <button 
                  onClick={() => setIsAutoPilot(!isAutoPilot)}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl font-black text-xs cursor-pointer shadow-md tracking-wide transition-all active:scale-95 ${isAutoPilot ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/35' : 'bg-slate-900 border border-white/10 text-slate-400'}`}
                >
                  {isAutoPilot ? (
                    <>
                      <ToggleRight className="w-4 h-4" /> AUTO-PILOT AKTIF
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" /> PILOT MANUAL
                    </>
                  )}
                </button>
              </div>

              {/* Automation customization options */}
              {isAutoPilot && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col gap-1.5 font-sans">
                    <label className="text-xs text-slate-400 font-bold tracking-wide uppercase">Intensitas Live Stream:</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5 font-sans">
                      {(['low', 'medium', 'high'] as const).map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setSimulationSpeed(spd)}
                          className={`text-[10px] font-black uppercase py-2 px-1.5 rounded-lg cursor-pointer transition-all ${simulationSpeed === spd ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
                        >
                          {spd === 'low' ? 'Sepi' : spd === 'medium' ? 'Normal' : 'Viral! (Sultan)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* CORE SECTION 2: MANUAL INTERACTIVE SIMULATION RIG (GIFT CONTROLS & SPAWNERS) */}
          {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* 1. Clickable Gift Launcher Panel (Left: 7cols of 12) */}
            <div className="xl:col-span-7 bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
              <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                <GiftIcon className="w-4 h-4 text-rose-500" />
                SIMULASI KIRIM GIFT TIKTOK
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TIKTOK_GIFTS.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => handleSendManualGift(gift)}
                    className="group bg-slate-900/60 hover:bg-slate-900/90 hover:border-purple-500/40 border border-white/5 p-3 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all shadow-sm active:scale-95"
                  >
                    <span className="text-3xl group-hover:scale-125 transition-transform duration-200">{gift.emoji}</span>
                    <strong className="text-white text-xs mt-1.5 truncate max-w-full font-sans tracking-tight">{gift.name}</strong>
                    <span className="text-[9px] text-yellow-400 font-bold font-mono mt-0.5">🪙 {gift.cost} Koin</span>
                    <span className="text-[7.5px] text-slate-500 font-medium leading-tight mt-1 group-hover:text-slate-400 line-clamp-2">
                      {gift.effectDescription}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Custom Commenter & Force Spawn Controller (Right: 5cols of 12) */}
            <div className="xl:col-span-5 flex flex-col gap-6">
              
              {/* Force comment generator */}
              <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 backdrop-blur-md">
                <h3 className="text-sm font-black text-white tracking-widest uppercase mb-4 flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  KIRIM KOMENTAR MANUAL
                </h3>

                <form onSubmit={handleSendManualComment} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Nama Viewer Target:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={manualTarget}
                        onChange={(e) => setManualTarget(e.target.value.replace(/[^a-z0-9_]/gi, ''))}
                        placeholder="Klik survivor di samping atau ketik nama"
                        className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs font-black placeholder-slate-600 text-cyan-300 outline-none ring-0 focus:border-cyan-500/40"
                      />
                      {manualTarget && (
                        <button 
                          type="button" 
                          onClick={() => setManualTarget('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Pesan Komentar:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCommentText}
                        onChange={(e) => setCustomCommentText(e.target.value)}
                        placeholder="Ketik komentar e.g. serang merah!, lompat!"
                        className="flex-1 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-600 outline-none ring-0 focus:border-indigo-500/40"
                      />
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const defaultNames = ['Saka_Gangsing', 'Rex_Panggal', 'Gasing_Pro', 'Bambu_Fly', 'Henry_G', 'Wrighty_X'];
                          const user = manualTarget.trim() || defaultNames[Math.floor(Math.random() * defaultNames.length)] + '_' + Math.floor(Math.random() * 99);
                          if (battleArenaRef.current) battleArenaRef.current.addPlayer(user, false, 'arsenal');
                          setManualTarget('');
                        }}
                        className="flex-1 bg-red-950/40 hover:bg-red-950/60 border border-red-500/20 hover:border-red-500/40 text-red-100 text-[10.5px] font-black py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all font-sans"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" /> SPAWN GANGSING MERAH
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const defaultNames = ['Parisian_Top', 'Mbappe_Top', 'Vitinha_Top', 'Hakimi_Gasing', 'Zlatan_Spin', 'Neymar_S'];
                          const user = manualTarget.trim() || defaultNames[Math.floor(Math.random() * defaultNames.length)] + '_' + Math.floor(Math.random() * 99);
                          if (battleArenaRef.current) battleArenaRef.current.addPlayer(user, false, 'psg');
                          setManualTarget('');
                        }}
                        className="flex-1 bg-blue-950/40 hover:bg-blue-950/60 border border-blue-500/20 hover:border-blue-500/40 text-blue-100 text-[10.5px] font-black py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all font-sans"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" /> SPAWN GANGSING BIRU
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetMatch}
                      className="w-full bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/10 text-white text-xs font-black py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all font-sans"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-rose-400" /> RESET GAME SECARA TOTAL
                    </button>
                  </div>
                </form>
              </div>

            </div>

          </div>
          )}


          {/* CORE SECTION 3: BOTTOM AREA DETAILS (LEADERBOARD HISTORY, TIKTOK OUTLINE) */}
          {activeTab === 'logs' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Survivor Arena Directory and Match History (Left Column) */}
            <div className="flex flex-col gap-6">
              {/* Survivor Arena Directory Card */}
              <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
                <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  KSATRIA AKTIF DI ARENA ({alivePlayers.length})
                </h3>

                <div className="custom-scrollbar overflow-y-auto max-h-[220px] flex flex-col gap-1.5 pr-1">
                  {activeLeaderboard.map((p, index) => {
                    const isAlive = p.status === 'alive';
                    return (
                      <div
                        key={p.id}
                        onClick={() => isAlive && handleSelectTarget(p.username)}
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isAlive ? 'bg-slate-900/40 border-white/5 hover:border-cyan-500/30 cursor-pointer hover:bg-slate-900/80' : 'bg-slate-950/20 border-slate-950 select-none opacity-40'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-mono fonts-black text-slate-500 w-4">#{index+1}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-xs font-black text-white">@{p.username}</span>
                          <span className="text-[8.5px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded capitalize">
                            {p.weapon.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-slate-500 tracking-wider">DARAH</span>
                            <span className={`font-black ${isAlive ? 'text-red-400' : 'text-slate-600'}`}>
                              {isAlive ? `${p.hp}/${p.maxHp} HP` : 'DEAD'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-slate-500 tracking-wider">KILLS</span>
                            <span className="text-emerald-400 font-black">💀{p.kills}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {activeLeaderboard.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-500 font-bold italic">
                      Belum ada ksatria bertanding. Harap spawn atau nyalakan Bot Auto-Pilot!
                    </div>
                  )}
                </div>
              </div>

              {/* Match History Card */}
              <div id="match-history" className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
                <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400 animate-pulse" />
                  RIWAYAT PERTANDINGAN (5 PEMENANG TERAKHIR)
                </h3>

                <div className="flex flex-col gap-2">
                  {matchHistory.map((m, index) => (
                    <div 
                      key={m.id} 
                      className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-white/5 hover:border-indigo-500/20 hover:bg-slate-900/60 transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono font-black text-yellow-500 w-4 flex items-center justify-center">
                          {index === 0 ? '👑' : `#${index + 1}`}
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: m.winnerColor }} />
                        <span className="text-xs font-black text-white truncate max-w-[150px]">
                          @{m.winnerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="flex flex-col items-end">
                          <span className="text-[7px] text-slate-500 tracking-wider font-extrabold uppercase leading-none">WAKTU</span>
                          <span className="text-slate-300 font-bold text-[9px] mt-0.5">{m.timestamp}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[7px] text-slate-500 tracking-wider font-extrabold uppercase leading-none">KILLS</span>
                          <span className="text-emerald-400 font-black text-[10px] mt-0.5">💀{m.kills} Kills</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {matchHistory.length === 0 && (
                    <div className="text-center py-7 text-xs text-slate-500 font-bold italic border border-dashed border-white/5 rounded-2xl bg-black/20">
                      Belum ada riwayat kemenangan. Pemenang akan otomatis tercatat ketika ada ksatria yang bertahan hingga akhir arena!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Live Broadcast connection tips & setup logs (Right Column) */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md">
              <h3 className="text-sm font-black text-slate-300 tracking-widest uppercase flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                PANDUAN KONEKSI STREAMER
              </h3>

              <div className="flex flex-col gap-3.5 divide-y divide-white/5">
                {TIKTOK_LIVE_GUIDELINES.steps.map((st, idx) => (
                  <div key={st.num} className={`flex gap-3.5 items-start ${idx > 0 ? 'pt-3.5' : ''}`}>
                    <span className="w-5 h-5 shrink-0 rounded-md bg-slate-900 text-slate-400 font-bold text-[10px] flex items-center justify-center font-mono border border-white/10">
                      {st.num}
                    </span>
                    <div className="flex flex-col gap-1 leading-tight">
                      <h4 className="text-white text-xs font-bold">{st.title}</h4>
                      <p className="text-slate-400 text-[10px] leading-relaxed font-normal">{st.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          
          {/* BOTTOM TERMINAL LIVE FEED LOG BAR */}
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-black tracking-widest text-indigo-400 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Logs Aktivitas Live TikTok
              </span>
              <button 
                onClick={() => setLiveFeedLogs([])}
                className="text-[9px] font-bold text-slate-500 hover:text-slate-300 font-mono"
              >
                Clear Log
              </button>
            </div>
            <div className="w-full bg-[#030611] rounded-2xl p-3 border border-white/5 h-28 custom-scrollbar overflow-y-auto font-mono text-[10px] leading-tight text-slate-400 flex flex-col gap-1">
              {liveFeedLogs.map((log) => (
                <div key={log.id} className="flex gap-2 items-start py-0.5 select-text hover:bg-white/5 px-2 rounded transition-colors">
                  <span className="text-slate-600 font-bold shrink-0">[{log.time}]</span>
                  <span className={`font-semibold ${log.type === 'gift' ? 'text-purple-400 font-bold' : log.type === 'kill' ? 'text-red-400 font-bold' : log.type === 'join' ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {log.text}
                  </span>
                </div>
              ))}
              {liveFeedLogs.length === 0 && (
                <div className="text-slate-600 italic py-4 text-center">
                  Terminal standby. Log komentar, gift, dan kekalahan gladiator akan dicetak di sini secara real-time.
                </div>
              )}
            </div>
          </div>
            </>
          )}

        </div>

      </main>

    </div>
  );
}
