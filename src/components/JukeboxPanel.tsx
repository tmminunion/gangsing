import React, { useState } from 'react';
import { Search, Music, Play, Trash2, Plus, ListMusic, VolumeX, Loader2, Repeat, Shuffle } from 'lucide-react';

interface JukeboxPanelProps {
  currentYoutubeId: string | null;
  currentYoutubeTitle: string | null;
  jukeboxQueue: { videoId: string; title: string }[];
  isAutoplay: boolean;
  isShuffle: boolean;
  onSendSocketMessage: (data: any) => void;
}

interface SearchResult {
  videoId: string;
  title: string;
  thumbnail?: string;
  duration?: string;
}

export function JukeboxPanel({
  currentYoutubeId,
  currentYoutubeTitle,
  jukeboxQueue,
  isAutoplay,
  isShuffle,
  onSendSocketMessage
}: JukeboxPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults([{ videoId: data.videoId, title: data.title, thumbnail: data.thumbnail, duration: data.duration }]);
        // Add to recent searches
        setRecentSearches(prev => {
          const filtered = prev.filter(s => s !== searchQuery.trim());
          return [searchQuery.trim(), ...filtered].slice(0, 5);
        });
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlayOrQueue = (song: { videoId: string; title: string }) => {
    if (!currentYoutubeId) {
      // Nothing playing — play immediately
      onSendSocketMessage({ type: 'play_youtube', payload: song });
    } else {
      // Something is playing — add to queue
      const newQueue = [...jukeboxQueue, song];
      onSendSocketMessage({ type: 'update_queue', queue: newQueue });
    }
    // Clear search after adding
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleRemoveFromQueue = (index: number) => {
    const newQueue = [...jukeboxQueue];
    newQueue.splice(index, 1);
    onSendSocketMessage({ type: 'update_queue', queue: newQueue });
  };

  const handleStopMusic = () => {
    onSendSocketMessage({ type: 'play_youtube', payload: null });
  };

  const handleSearchResultClick = (result: SearchResult) => {
    handlePlayOrQueue({ videoId: result.videoId, title: result.title });
  };

  const handleRecentSearchClick = (q: string) => {
    setSearchQuery(q);
    setIsSearching(true);
    fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSearchResults([{ videoId: data.videoId, title: data.title, thumbnail: data.thumbnail, duration: data.duration }]);
        }
      })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  };

  const isQueueEmpty = jukeboxQueue.length === 0;

  return (
    <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-5 flex flex-col gap-4 backdrop-blur-md h-full max-h-[490px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Music className="w-4 h-4" />
          </div>
          <span className="text-sm font-black tracking-widest text-zinc-200 uppercase font-sans">Jukebox YouTube</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSendSocketMessage({ type: 'toggle_shuffle', shuffle: !isShuffle })}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              isShuffle
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'
            }`}
            title={isShuffle ? 'Shuffle aktif' : 'Shuffle mati'}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSendSocketMessage({ type: 'toggle_autoplay', autoplay: !isAutoplay })}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              isAutoplay
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'
            }`}
            title={isAutoplay ? 'Autoplay aktif (similar search)' : 'Autoplay mati'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) setSearchResults([]);
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              showSearch ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
            }`}
            title="Cari lagu"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Now Playing */}
      {currentYoutubeId ? (
        <div className="bg-gradient-to-r from-emerald-500/12 to-emerald-500/4 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Sedang Diputar</span>
            </div>
            <button
              onClick={handleStopMusic}
              className="text-[9px] px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 rounded-xl cursor-pointer transition-colors border border-rose-500/10 flex items-center gap-1 font-bold font-sans"
            >
              <VolumeX className="w-3 h-3" /> STOP
            </button>
          </div>
          <p className="text-xs font-black text-white truncate pl-1 font-sans">{currentYoutubeTitle || 'Unknown Title'}</p>
        </div>
      ) : (
        <div className="bg-slate-950/40 rounded-2xl p-5 text-center border border-dashed border-slate-800">
          <Music className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold font-sans">Tidak ada lagu yang diputar</p>
          <p className="text-[10px] text-slate-600 mt-1 font-sans">Cari lagu atau minta penonton ketik "play [lagu]"</p>
        </div>
      )}

      {/* Search Input Box */}
      {showSearch && (
        <div className="bg-black/30 rounded-2xl p-3 border border-white/5 flex flex-col gap-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul lagu..."
                className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600 font-sans"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[10px] font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-sans"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Cari
            </button>
          </form>

          {/* Recent searches */}
          {recentSearches.length > 0 && searchResults.length === 0 && !searchQuery && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] text-slate-500 font-mono uppercase tracking-wider font-bold">Pencarian Terakhir</span>
              <div className="flex flex-wrap gap-1">
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleRecentSearchClick(q)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] rounded-lg cursor-pointer transition-colors border border-white/5 font-sans"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
              <span className="text-[8px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Hasil Pencarian</span>
              {searchResults.map((result) => (
                <div
                  key={result.videoId}
                  className="flex items-center gap-2.5 p-2 bg-black/40 rounded-xl border border-white/5 hover:bg-slate-900/60 transition-colors group cursor-pointer"
                  onClick={() => handleSearchResultClick(result)}
                >
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-12 h-9 rounded object-cover shrink-0 bg-slate-850"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white truncate leading-tight font-sans">{result.title}</p>
                    {result.duration && (
                      <span className="text-[8px] text-slate-500 font-mono">{result.duration}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSearchResultClick(result);
                    }}
                    className={`p-1.5 rounded-lg cursor-pointer transition-all border shrink-0 ${
                      currentYoutubeId
                        ? 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border-emerald-500/20'
                        : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/20'
                    }`}
                    title={currentYoutubeId ? 'Tambah ke antrian' : 'Putar sekarang'}
                  >
                    {currentYoutubeId ? <Plus className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue / Playlist */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ListMusic className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Antrian</span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md font-bold">
              {jukeboxQueue.length}
            </span>
          </div>
        </div>

        {isQueueEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-1 border border-dashed border-slate-900/60 rounded-2xl bg-slate-950/20">
            <Music className="w-5 h-5 text-slate-800" />
            <p className="text-[10px] text-slate-600 font-mono italic">Antrian kosong</p>
          </div>
        ) : (
          <div className="custom-scrollbar overflow-y-auto max-h-[160px] flex flex-col gap-1.5 pr-1">
            {jukeboxQueue.map((item, i) => (
              <div
                key={`${item.videoId}-${i}`}
                className="flex items-center gap-2 p-2 bg-slate-900/30 rounded-xl border border-white/5 group hover:bg-slate-900/60 transition-all"
              >
                <span className="text-[9px] font-mono text-slate-500 w-4 text-right shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-200 font-bold font-sans truncate">{item.title}</p>
                </div>
                <button
                  onClick={() => handleRemoveFromQueue(i)}
                  className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded hover:bg-rose-500/10 shrink-0"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
