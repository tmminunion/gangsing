import React, { useState, useEffect, useRef } from 'react';
import { useTikTokLive } from './hooks/useTikTokLive';
import { JukeboxPanel } from './components/JukeboxPanel';
import { Music, Activity, Tv } from 'lucide-react';

export default function MusicPage() {
  const [currentYoutubeId, setCurrentYoutubeId] = useState<string | null>(null);
  const [currentYoutubeTitle, setCurrentYoutubeTitle] = useState<string | null>(null);
  const [jukeboxQueue, setJukeboxQueue] = useState<{ videoId: string; title: string }[]>([]);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isShuffle, setIsShuffle] = useState(false);

  const configRef = useRef({ currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle });
  useEffect(() => {
    configRef.current = { currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle };
  }, [currentYoutubeId, currentYoutubeTitle, jukeboxQueue, isAutoplay, isShuffle]);

  const {
    wsConnected: relayConnected,
    send: sendSocketMessage,
  } = useTikTokLive({
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
      setCurrentYoutubeId(state.currentYoutubeId);
      setCurrentYoutubeTitle(state.currentYoutubeTitle);
      setJukeboxQueue(state.jukeboxQueue || []);
      setIsAutoplay(state.isAutoplay);
      setIsShuffle(state.isShuffle);
    },
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-400 font-sans flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="max-w-4xl w-full flex items-center justify-between mb-8 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-emerald-500/10 rounded-2xl">
            <Music className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-emerald-500">Gangsing Music</h1>
            <p className="text-zinc-400 font-medium">Remote Jukebox Controller</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border ${relayConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
            <Activity className={`w-4 h-4 ${relayConnected ? 'animate-pulse' : ''}`} />
            {relayConnected ? 'Connected' : 'Disconnected'}
          </div>
          <a href="/" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 transition-colors text-emerald-500 rounded-xl text-sm font-bold flex items-center gap-2 border border-zinc-700">
            <Tv className="w-4 h-4" />
            Arena
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-[1fr_400px] gap-6">
        
        {/* Left Side: Now Playing Hero Section */}
        <div className="flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex-1 flex flex-col justify-center relative overflow-hidden">
            {/* Background blur from current song if any */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-zinc-900 pointer-events-none" />
            
            {currentYoutubeId ? (
              <div className="relative z-10 flex flex-col items-center text-center gap-6">
                <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/20 border-2 border-zinc-800">
                  <img 
                    src={`https://img.youtube.com/vi/${currentYoutubeId}/maxresdefault.jpg`} 
                    onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${currentYoutubeId}/hqdefault.jpg`; }}
                    alt="Cover" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Now Playing
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-500 line-clamp-2 px-4 leading-tight">{currentYoutubeTitle}</h2>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center text-center gap-4 opacity-50">
                <Music className="w-24 h-24 text-zinc-700" />
                <div>
                  <h2 className="text-xl font-bold text-zinc-500">No Track Playing</h2>
                  <p className="text-sm text-zinc-600">Search and queue a song to start</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Jukebox Panel */}
        <div className="h-[600px] [&>div]:h-full">
          <JukeboxPanel
            currentYoutubeId={currentYoutubeId}
            currentYoutubeTitle={currentYoutubeTitle}
            jukeboxQueue={jukeboxQueue}
            isAutoplay={isAutoplay}
            isShuffle={isShuffle}
            onSendSocketMessage={sendSocketMessage}
          />
        </div>
      </div>
    </div>
  );
}
