import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebcastPushConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import yts from 'yt-search';
import fs from 'fs';
import path from 'path';
import { LiveChat } from 'youtube-chat';

// ========== Global Error Guards (prevent crashes from library exceptions) ==========
process.on('uncaughtException', (err: any) => {
  console.error('[Process] ⚠️ Uncaught Exception (server tetap jalan):', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[Process] ⚠️ Unhandled Rejection (server tetap jalan):', reason?.message || reason);
});

const PORT = parseInt(process.env.RELAY_PORT || '3011', 10);

// ========== Express Setup ==========
const app = express();
// Increase JSON limits to support uploading large OBJ files as text
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Create imported folder if it doesn't exist
const IMPORTED_DIR = path.join(process.cwd(), 'public', 'imported');
if (!fs.existsSync(IMPORTED_DIR)) {
  fs.mkdirSync(IMPORTED_DIR, { recursive: true });
}

// Serve imported files statically
app.use('/imported', express.static(IMPORTED_DIR));

// Serve local assets folder statically
const ASSETS_DIR = path.join(process.cwd(), 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.mkdirSync(path.join(ASSETS_DIR, 'airdrop'), { recursive: true });
  fs.mkdirSync(path.join(ASSETS_DIR, 'object'), { recursive: true });
}
app.use('/assets', express.static(ASSETS_DIR));

// Import assets persistence structures
interface ImportedAsset {
  filename: string;
  url: string;
}

const ASSETS_FILE = path.join(process.cwd(), 'server', 'imported_assets.json');
let importedAssets: ImportedAsset[] = [];

function loadImportedAssets() {
  try {
    if (fs.existsSync(ASSETS_FILE)) {
      const content = fs.readFileSync(ASSETS_FILE, 'utf8');
      importedAssets = JSON.parse(content);
      console.log(`[AssetsStore] Loaded ${importedAssets.length} persistent OBJ assets.`);
    }
  } catch (err: any) {
    console.error('[AssetsStore] Failed to load assets:', err?.message || err);
  }
}

function saveImportedAssets() {
  try {
    fs.writeFileSync(ASSETS_FILE, JSON.stringify(importedAssets, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[AssetsStore] Failed to save assets:', err?.message || err);
  }
}

// Load assets immediately
loadImportedAssets();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connected: !!currentConnection?.isConnected });
});

// YouTube Jukebox Search Endpoint
app.get('/api/youtube/search', async (req, res) => {
  const query = req.query.q as string;
  const count = Math.min(parseInt(req.query.count as string) || 1, 10);
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const r = await yts(query);
    const videos = r.videos.slice(0, count);
    if (videos.length > 0) {
      const first = videos[0];
      res.json({
        success: true,
        videoId: first.videoId,
        title: first.title,
        thumbnail: first.thumbnail,
        duration: first.timestamp,
        seconds: first.seconds,
        author: first.author?.name || null,
        results: videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: v.timestamp,
          seconds: v.seconds,
          author: v.author?.name || null
        }))
      });
    } else {
      res.status(404).json({ success: false, error: 'No video found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// Endpoint to receive Session ID from browser bookmarklet
app.post('/api/set-session-id', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Session ID is empty' });
  }
  
  activeSessionId = sessionId;
  console.log(`[Relay] Session ID updated via API: ${sessionId.substring(0, 8)}...`);
  
  broadcast({
    type: 'status',
    sessionId: sessionId
  });
  
  saveJukeboxState();
  
  res.json({ success: true, message: 'Session ID updated' });
});

// Endpoint to handle OBJ file upload
app.post('/api/upload-obj', (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) {
    return res.status(400).json({ success: false, error: 'Filename and content are required' });
  }

  try {
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(IMPORTED_DIR, safeFilename);
    
    // Write text OBJ content to disk
    fs.writeFileSync(filePath, content, 'utf8');
    
    const assetUrl = `/imported/${safeFilename}`;
    
    // Avoid duplicates in persistence list
    const exists = importedAssets.find(a => a.filename === safeFilename);
    if (!exists) {
      importedAssets.push({ filename: safeFilename, url: assetUrl });
      saveImportedAssets();
    }
    
    console.log(`[AssetsStore] New OBJ uploaded and stored: ${safeFilename}`);
    
    // Broadcast import message to all active WS clients
    broadcast({
      type: 'import_obj',
      filename: safeFilename,
      url: assetUrl
    });

    res.json({ success: true, url: assetUrl, filename: safeFilename });
  } catch (err: any) {
    console.error('[Upload] Failed to process OBJ:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to save file' });
  }
});

// Endpoint to handle custom floor texture image upload
app.post('/api/upload-texture', (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) {
    return res.status(400).json({ success: false, error: 'Filename and content are required' });
  }

  try {
    const safeFilename = 'floor_' + filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(IMPORTED_DIR, safeFilename);

    // Strip out base64 metadata prefix if exists
    const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Write binary image to disk
    fs.writeFileSync(filePath, buffer);

    const assetUrl = `/imported/${safeFilename}`;
    console.log(`[AssetsStore] Custom floor texture uploaded and stored: ${safeFilename}`);

    // Update global floorTheme state
    floorTheme = assetUrl;
    saveJukeboxState();

    // Broadcast change_floor with custom texture URL
    broadcast({
      type: 'change_floor',
      theme: assetUrl
    });

    res.json({ success: true, url: assetUrl, filename: safeFilename });
  } catch (err: any) {
    console.error('[Upload] Failed to process custom floor texture:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to save texture file' });
  }
});

// Endpoint to clear all uploaded structures
app.post('/api/clear-objs', (req, res) => {
  try {
    const files = fs.readdirSync(IMPORTED_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(IMPORTED_DIR, file));
    }
    
    importedAssets = [];
    saveImportedAssets();
    
    console.log('[AssetsStore] Cleared all imported OBJ assets.');
    
    // Broadcast clear event
    broadcast({
      type: 'clear_objs'
    });
    
    res.json({ success: true, message: 'All OBJ assets cleared' });
  } catch (err: any) {
    console.error('[Upload] Failed to clear assets:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to clear assets' });
  }
});

// Endpoint to list custom assets inside /assets/airdrop and /assets/object
app.get('/api/custom-assets', (req, res) => {
  try {
    const airdropDir = path.join(process.cwd(), 'assets', 'airdrop');
    const objectDir = path.join(process.cwd(), 'assets', 'object');

    const airdrops: { filename: string; url: string }[] = [];
    const objects: { filename: string; url: string }[] = [];

    if (fs.existsSync(airdropDir)) {
      const files = fs.readdirSync(airdropDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.obj')) {
          airdrops.push({
            filename: file,
            url: `/assets/airdrop/${file}`
          });
        }
      }
    }

    if (fs.existsSync(objectDir)) {
      const files = fs.readdirSync(objectDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.obj')) {
          objects.push({
            filename: file,
            url: `/assets/object/${file}`
          });
        }
      }
    }

    res.json({
      success: true,
      airdrops,
      objects
    });
  } catch (err: any) {
    console.error('[AssetsStore] Failed to read custom assets directory:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to read custom assets' });
  }
});


// ========== HTTP Server + WebSocket ==========
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ========== YouTube Jukebox State ==========
let currentYoutubeId: string | null = null;
let currentYoutubeTitle: string | null = null;
let jukeboxQueue: { videoId: string; title: string }[] = [];
let jukeboxHistory: { videoId: string; title: string }[] = [];
let isAutoplay = true;
let isShuffle = false;
let floorTheme = 'scifi';
let activeSessionId: string | null = null;
let activeViewers = new Map<string, { handle: string, nickname: string }>();

const STATE_FILE = path.join(process.cwd(), 'server', 'jukebox_state.json');

function saveJukeboxState() {
  try {
    const state = {
      currentYoutubeId,
      currentYoutubeTitle,
      jukeboxQueue,
      jukeboxHistory,
      isAutoplay,
      isShuffle,
      floorTheme,
      activeSessionId,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[StateStore] Failed to save state:', err?.message || err);
  }
}

function loadJukeboxState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(content);
      if (state.currentYoutubeId !== undefined) currentYoutubeId = state.currentYoutubeId;
      if (state.currentYoutubeTitle !== undefined) currentYoutubeTitle = state.currentYoutubeTitle;
      if (state.jukeboxQueue !== undefined) jukeboxQueue = state.jukeboxQueue;
      if (state.jukeboxHistory !== undefined) jukeboxHistory = state.jukeboxHistory;
      if (state.isAutoplay !== undefined) isAutoplay = state.isAutoplay;
      if (state.isShuffle !== undefined) isShuffle = state.isShuffle;
      if (state.floorTheme !== undefined) floorTheme = state.floorTheme;
      if (state.activeSessionId !== undefined) activeSessionId = state.activeSessionId;
      console.log(`[StateStore] Successfully loaded jukebox state from ${STATE_FILE}`);
    }
  } catch (err: any) {
    console.error('[StateStore] Failed to load state:', err?.message || err);
  }
}

// Load state immediately on startup
loadJukeboxState();

let isAutoFilling = false;

async function fetchWebspySong() {
  if (isAutoFilling) return;
  isAutoFilling = true;
  console.log(`[WebSpy] Querying WebSpy for a hit song...`);
  try {
    const response = await fetch('https://webspy.nufat.id/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Berdasarkan history tontonan akun ini dan minat personal (Metal Gothic Indonesia, Dangdut Koplo, DJ, Funkot, Pop Indonesia, atau lagu trending), berikan 1 rekomendasi lagu YouTube yang berbeda dari sebelumnya. Cukup berikan format: Judul Lagu - Nama Penyanyi (tanpa teks penjelasan lain)'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const rawSong = data.response || data.answer || data.message || '';
    let cleanedSong = rawSong.trim();
    const lines = cleanedSong.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      cleanedSong = lines[0];
    }
    cleanedSong = cleanedSong.replace(/["'*]/g, '').trim();

    if (cleanedSong) {
      console.log(`[WebSpy] WebSpy returned: "${cleanedSong}". Searching YouTube...`);
      const r = await yts(cleanedSong);
      if (r.videos && r.videos.length > 0) {
        const song = { videoId: r.videos[0].videoId, title: r.videos[0].title };
        if (!currentYoutubeId) {
          currentYoutubeId = song.videoId;
          currentYoutubeTitle = song.title;
          console.log(`[WebSpy] Playing first song: ${song.title}`);
          broadcast({ type: 'play_youtube', videoId: song.videoId, title: song.title });
        } else {
          jukeboxQueue.push(song);
          console.log(`[WebSpy] Added to queue: ${song.title}`);
          broadcast({ type: 'update_queue', queue: jukeboxQueue });
        }
        saveJukeboxState();
      } else {
        console.warn(`[WebSpy] No YouTube search results for: "${cleanedSong}"`);
      }
    } else {
      console.warn('[WebSpy] WebSpy returned an empty response');
    }
  } catch (err: any) {
    console.error('[WebSpy] Failed to auto-fill queue:', err?.message || err);
  } finally {
    isAutoFilling = false;
  }
}

async function checkAndAutoFillQueue() {
  if (isAutoplay && jukeboxQueue.length <= 1) {
    console.log(`[AutoFill] Queue has ${jukeboxQueue.length} song(s) remaining. Triggering WebSpy...`);
    fetchWebspySong();
  }
}

// ========== YouTube Live Chat Helper & Processing ==========
function processChatMessage(handle: string, nick: string, text: string) {
  const msg = {
    type: 'chat',
    user: handle,
    nickname: nick,
    text: text,
    timestamp: Date.now(),
  };
  console.log(`💬 [Chat] ${nick} (@${handle}): ${text}`);
  broadcast(msg);

  // Jukebox auto-play/queue via chat comment
  const msgText = (msg.text || '').trim();
  const match = msgText.match(/^(?:music|play|mainkan|putar|request|next)\s+(.+)/i);

  if (match) {
    const query = match[1].trim();
    if (query) {
      yts(query).then((r) => {
        if (r.videos && r.videos.length > 0) {
          const song = { videoId: r.videos[0].videoId, title: r.videos[0].title };
          console.log(`🎵 Jukebox requested via chat: ${song.title}`);
          if (!currentYoutubeId) {
            currentYoutubeId = song.videoId;
            currentYoutubeTitle = song.title;
            broadcast({ type: 'play_youtube', videoId: song.videoId, title: song.title });
            saveJukeboxState();
            checkAndAutoFillQueue();
          } else {
            jukeboxQueue.push(song);
            broadcast({ type: 'update_queue', queue: jukeboxQueue });
            saveJukeboxState();
            checkAndAutoFillQueue();
          }
        }
      }).catch(err => {
        console.error('Jukebox search failed:', err);
      });
    }
  }
}

// ========== YouTube Live Connection Management ==========
let currentYoutubeConnection: LiveChat | null = null;
let currentYoutubeChannelId: string | null = null;
let isYoutubeConnected = false;

function parseYoutubeId(input: string): { channelId: string } | { liveId: string } | { handle: string } {
  const trimmed = input.trim();
  try {
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (url.searchParams.has('v')) {
        return { liveId: url.searchParams.get('v')! };
      }
      if (url.pathname.startsWith('/watch/')) {
        const parts = url.pathname.split('/');
        return { liveId: parts[2] };
      }
      if (url.hostname === 'youtu.be') {
        const id = url.pathname.slice(1);
        if (id) return { liveId: id };
      }
      if (url.pathname.startsWith('/channel/')) {
        const parts = url.pathname.split('/');
        return { channelId: parts[2] };
      }
      if (url.pathname.startsWith('/@')) {
        const parts = url.pathname.split('/');
        return { handle: parts[1] };
      }
    }
  } catch (e) {}
  if (trimmed.startsWith('@')) {
    return { handle: trimmed };
  }
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return { channelId: trimmed };
  }
  return { liveId: trimmed };
}

async function connectToYoutube(youtubeId: string) {
  disconnectFromYoutube();
  currentYoutubeChannelId = youtubeId;

  try {
    const options = parseYoutubeId(youtubeId);
    console.log(`[YouTube] Connecting using options:`, options);
    
    const liveChat = new LiveChat(options);

    liveChat.on('chat', (chatItem) => {
      const text = chatItem.message.map((item: any) => {
        if ('text' in item) return item.text;
        if ('emojiText' in item) return item.emojiText;
        return '';
      }).join('');

      const authorName = chatItem.author.name || 'Anonymous';
      const channelId = chatItem.author.channelId || 'unknown';

      // 1. Process as chat command/msg
      processChatMessage(channelId, authorName, text);

      // 2. Map Super Chat to Gift
      if (chatItem.superchat) {
        const amountStr = chatItem.superchat.amount || '';
        console.log(`[YouTube SuperChat] ${authorName} sent ${amountStr}: ${text}`);
        const cleanAmount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
        
        let giftName = 'Rose';
        let giftAmount = 1;
        let giftId = 5655; // Rose

        if (cleanAmount >= 100000 || (cleanAmount > 0 && cleanAmount <= 100 && cleanAmount >= 20)) {
          giftName = 'Universe';
          giftId = 13248;
        } else if (cleanAmount >= 50000 || (cleanAmount > 0 && cleanAmount <= 20 && cleanAmount >= 5)) {
          giftName = 'Donut';
          giftId = 12965;
        } else if (cleanAmount >= 10000 || (cleanAmount > 0 && cleanAmount > 1 && cleanAmount < 5)) {
          giftName = 'Finger Heart';
          giftId = 12750;
        }

        const giftMsg = {
          type: 'gift',
          user: channelId,
          nickname: authorName,
          gift: giftName,
          giftId: giftId,
          amount: giftAmount,
          timestamp: Date.now(),
        };
        broadcast(giftMsg);
      }
    });

    liveChat.on('error', (err: any) => {
      console.error('[YouTube] LiveChat error:', err?.message || err);
      broadcast({ type: 'error', message: `YouTube Live Chat error: ${err?.message || err}` });
    });

    liveChat.on('start', (liveId: string) => {
      console.log(`✅ Started YouTube LiveChat scraping for: ${liveId}`);
      isYoutubeConnected = true;
      broadcast({ type: 'youtube_connected', youtubeId });
    });

    liveChat.on('end', (reason?: string) => {
      console.warn(`⚠️ YouTube LiveChat ended: ${reason}`);
      isYoutubeConnected = false;
      broadcast({ type: 'youtube_disconnected' });
    });

    const ok = await liveChat.start();
    if (!ok) {
      throw new Error("Could not start YouTube live chat parsing.");
    }
    currentYoutubeConnection = liveChat;
  } catch (err: any) {
    console.error('❌ Failed to connect to YouTube Live:', err?.message || err);
    broadcast({ type: 'error', message: `Failed to connect to YouTube Live: ${err?.message || err}` });
    isYoutubeConnected = false;
    currentYoutubeConnection = null;
  }
}

function disconnectFromYoutube() {
  if (currentYoutubeConnection) {
    try {
      currentYoutubeConnection.stop('User disconnected');
    } catch (_) {}
    currentYoutubeConnection = null;
  }
  isYoutubeConnected = false;
  currentYoutubeChannelId = null;
}

// ========== TikTok Live Connection Management ==========
let currentConnection: WebcastPushConnection | null = null;
let currentUsername: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isTikTokConnected = false; // track status secara eksplisit

// Broadcast to all connected WebSocket clients
function broadcast(data: Record<string, unknown>) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Cache Room ID per username agar tidak perlu fetch ulang tiap reconnect
const roomIdCache: Record<string, string> = {};

// Fetch halaman live user, ambil roomId via regex dari JSON data di HTML
async function fetchRoomIdViaApi(username: string): Promise<string | null> {
  try {
    const cleanUser = username.replace('@', '');
    // Fetch halaman live user, ambil roomId via regex dari JSON data di HTML
    const url = `https://www.tiktok.com/@${cleanUser}/live`;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    };
    if (activeSessionId) {
      headers['Cookie'] = `sessionid=${activeSessionId}; tt_webid_v2=1`;
    }
    const res = await fetch(url, { headers });
    const html = await res.text();
    // Extract roomId dari JSON di dalam HTML
    const match = html.match(/"roomId":"(\\d+)"/);
    if (match && match[1] && match[1] !== '') {
      const roomId = match[1];
      console.log(`[RoomID] Fetched from live page: ${roomId}`);
      roomIdCache[username] = roomId;
      return roomId;
    }
    console.warn(`[RoomID] roomId not found in live page HTML (mungkin tidak live)`);
  } catch (err: any) {
    console.warn(`[RoomID] fetch failed: ${err?.message}`);
  }
  return null;
}

// Create and connect to a TikTok Live stream
async function connectToTikTok(username: string) {
  // Disconnect existing connection
  disconnectFromTikTok();

  currentUsername = username;
  const connectionOptions: any = {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,  // skip extra fetch yang tidak perlu
    enableExtendedGiftInfo: false,  // skip fetch extra gift info
    requestPollingInterval: 1000,
    ttTargetIdc: 'row',
    clientParams: {
      "app_language": "id-ID",
      "device_platform": "web"
    }
  };

  if (activeSessionId) {
    connectionOptions.sessionId = activeSessionId;
    connectionOptions.authenticateWs = false;
    console.log(`[TikTok] Connecting with sessionId cookie for @${username}`);
  } else {
    console.log(`[TikTok] Connecting without sessionId for @${username}`);
  }

  // Coba dapat Room ID via API dulu (bypass HTML scraping yang di-block TikTok)
  let roomId: string | undefined = roomIdCache[username] || undefined;
  if (!roomId) {
    const fetched = await fetchRoomIdViaApi(username);
    roomId = fetched || undefined;
  }
  if (roomId) {
    console.log(`[TikTok] Using Room ID: ${roomId} (skip HTML scraping)`);
  } else {
    console.warn(`[TikTok] Room ID tidak ditemukan, library akan coba scraping...`);
  }

  const connection = new WebcastPushConnection(username, connectionOptions);

  currentConnection = connection;

  // ---- Event Handlers ----

  connection.on(WebcastEvent.CHAT, (data: any) => {
    const handle = data.uniqueId || 'unknown';
    const nick = data.nickname || data.uniqueId || 'viewer';
    processChatMessage(handle, nick, data.comment || '');
  });

  connection.on(WebcastEvent.GIFT, (data: any) => {
    const handle = data.uniqueId || 'unknown';
    const nick = data.nickname || data.uniqueId || 'viewer';
    const giftName = data.giftName || data.gift?.name || 'Gift';
    const repeatCount = data.repeatCount || 1;
    const repeatEnd = data.repeatEnd ?? true;
    const giftType = data.giftType ?? 0;
    // Try to extract giftId from multiple possible sources
    const giftId = data.giftId || data.gift?.id || data.extendedGiftInfo?.id || undefined;

    // Handle streak logic: only process on final repeat or non-streakable gifts
    if (giftType === 1 && !repeatEnd) {
      // Streak in progress, skip intermediate events
      return;
    }

    const msg = {
      type: 'gift',
      user: handle,
      nickname: nick,
      gift: giftName,
      giftId: giftId || undefined,
      amount: repeatCount,
      timestamp: Date.now(),
    };
    console.log(`🎁 ${nick} (@${handle}) sent ${giftName} (ID:${giftId || '?'}) x${repeatCount}`);
    broadcast(msg);
  });

  connection.on(WebcastEvent.MEMBER, (data: any) => {
    const handle = data.uniqueId || 'someone';
    const nick = data.nickname || data.uniqueId || 'someone';
    const msg = {
      type: 'member',
      user: handle,
      nickname: nick,
      timestamp: Date.now(),
    };
    console.log(`👋 ${nick} (@${handle}) joined`);
    broadcast(msg);
  });

  connection.on(WebcastEvent.LIKE, (data: any) => {
    const handle = data.uniqueId || 'someone';
    const nick = data.nickname || data.uniqueId || 'someone';
    const likeCount = data.likeCount || 1;
    const totalLikeCount = data.totalLikeCount || 0;
    const msg = {
      type: 'like',
      user: handle,
      nickname: nick,
      likeCount,
      totalLikeCount,
      timestamp: Date.now(),
    };
    console.log(`❤️ ${nick} liked! (+${likeCount})`);
    broadcast(msg);
  });

  connection.on(WebcastEvent.ROOM_USER, (data: any) => {
    const viewerCount = data.viewerCount || 0;
    const msg = {
      type: 'roomUser',
      viewerCount,
      timestamp: Date.now(),
    };
    broadcast(msg);
  });

  connection.on(WebcastEvent.SOCIAL, (data: any) => {
    const handle = data.uniqueId || 'someone';
    const nick = data.nickname || data.uniqueId || 'someone';
    const eventType: 'follow' | 'share' = data.displayType?.toLowerCase?.()?.includes('share') ? 'share' : 'follow';
    const msg = {
      type: eventType,
      user: handle,
      nickname: nick,
      timestamp: Date.now(),
    };
    console.log(`📢 ${nick} (@${handle}) ${eventType}ed`);
    broadcast(msg);
  });

  // Control events
  connection.on(ControlEvent.CONNECTED, () => {
    console.log(`✅ Connected to TikTok Live @${username}`);
    reconnectAttempts = 0;
    isTikTokConnected = true;
    broadcast({ type: 'connected', username });
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    console.warn(`⚠️ Disconnected from TikTok Live @${username}`);
    isTikTokConnected = false;
    currentConnection = null;
    currentUsername = null;
    broadcast({ type: 'disconnected' });
    // Tidak auto-reconnect — biarkan user klik Hubungkan lagi
    // Auto-reconnect menyebabkan loop & menghabiskan rate limit Euler Stream
  });

  // Standard Node.js 'error' event — WAJIB ada listener, kalau tidak ada Node.js crash!
  (connection as any).on('error', (err: any) => {
    console.error('[Process] ⚠️ Connection error event:', err?.message || err);
  });

  connection.on(ControlEvent.ERROR, (err: any) => {
    const errMsg = err?.exception?.message || err?.exception || err?.message || String(err);
    console.error('❌ TikTok Live error:', errMsg);
    broadcast({ type: 'error', message: errMsg });
  });

  // Connect!
  try {
    const state = await connection.connect(roomId);
    console.log(`🔗 Room ID: ${state.roomId}`);
    console.log(`✅ Connected to TikTok Live @${username}`);
    broadcast({ type: 'connected', username });
    return state;
  } catch (err: any) {
    const errMsg = err?.message || 'Unknown error';
    console.error('❌ Failed to connect:', errMsg);
    broadcast({ type: 'error', message: `Failed to connect: ${errMsg}` });
    currentConnection = null;
    currentUsername = null;
    // TIDAK throw — supaya tidak crash dan PM2 tidak restart
  }
}

function disconnectFromTikTok() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (currentConnection) {
    try {
      currentConnection.disconnect();
    } catch (_) {
      // ignore
    }
    currentConnection = null;
  }
  currentUsername = null;
}

// ========== WebSocket Message Handling ==========
wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 Frontend client connected');

  // Send current connection state
  ws.send(JSON.stringify({
    type: 'status',
    connected: isTikTokConnected,
    username: currentUsername,
    hasSessionId: !!activeSessionId,
    youtubeConnected: isYoutubeConnected,
    youtubeChannelId: currentYoutubeChannelId,
    activeViewers: Array.from(activeViewers.values()),
  }));

  // Send current Jukebox state
  ws.send(JSON.stringify({
    type: 'jukebox_state',
    currentYoutubeId,
    currentYoutubeTitle,
    jukeboxQueue,
    isAutoplay,
    isShuffle,
    floorTheme,
  }));

  ws.on('message', (raw: Buffer) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const command = data.type as string;

    switch (command) {
      case 'connect': {
        const username = data.username as string;
        const sessionId = data.sessionId as string | undefined;
        if (!username) {
          ws.send(JSON.stringify({ type: 'error', message: 'Username required' }));
          return;
        }
        if (sessionId) {
          activeSessionId = sessionId;
          saveJukeboxState();
        }
        // If no sessionId provided, keep the existing activeSessionId (don't reset it)
        connectToTikTok(username).catch(() => {
          // Error already broadcast
        });
        break;
      }

      case 'disconnect':
        disconnectFromTikTok();
        broadcast({ type: 'disconnected' });
        break;

      case 'connect_youtube': {
        const youtubeId = data.youtubeId as string;
        if (!youtubeId) {
          ws.send(JSON.stringify({ type: 'error', message: 'YouTube Channel ID / Live URL required' }));
          return;
        }
        connectToYoutube(youtubeId).catch(() => {
          // Error already broadcast
        });
        break;
      }

      case 'disconnect_youtube':
        disconnectFromYoutube();
        broadcast({ type: 'youtube_disconnected' });
        break;

      case 'skip_youtube':
        broadcast({ type: 'skip_youtube' });
        break;

      case 'play_youtube': {
        const payload = data.payload as { videoId: string; title: string } | null;
        if (payload) {
          currentYoutubeId = payload.videoId;
          currentYoutubeTitle = payload.title;
          // Simpan ke histori (maksimal 200 lagu), hindari duplikat berurutan
          if (jukeboxHistory.length === 0 || jukeboxHistory[jukeboxHistory.length - 1].videoId !== payload.videoId) {
            jukeboxHistory.push(payload);
            if (jukeboxHistory.length > 200) jukeboxHistory.shift();
          }
        } else {
          currentYoutubeId = null;
          currentYoutubeTitle = null;
          jukeboxQueue = [];
        }
        broadcast({ type: 'play_youtube', videoId: currentYoutubeId, title: currentYoutubeTitle });
        broadcast({ type: 'update_queue', queue: jukeboxQueue });
        saveJukeboxState();
        checkAndAutoFillQueue();
        break;
      }

      case 'play_random_history': {
        if (jukeboxHistory.length > 0) {
          const randomIndex = Math.floor(Math.random() * jukeboxHistory.length);
          const song = jukeboxHistory[randomIndex];
          currentYoutubeId = song.videoId;
          currentYoutubeTitle = song.title;
          broadcast({ type: 'play_youtube', videoId: currentYoutubeId, title: currentYoutubeTitle });
          saveJukeboxState();
          checkAndAutoFillQueue();
        }
        break;
      }

      case 'request_webspy_song': {
        // Panggil webspy paksa walaupun antrean masih ada
        isAutoFilling = false; // Reset lock just in case
        fetchWebspySong();
        broadcast({ type: 'trigger_disco', duration: 20 });
        break;
      }

      case 'update_queue': {
        jukeboxQueue = (data.queue || []) as { videoId: string; title: string }[];
        broadcast({ type: 'update_queue', queue: jukeboxQueue });
        saveJukeboxState();
        checkAndAutoFillQueue();
        break;
      }

      case 'toggle_autoplay': {
        isAutoplay = !!data.autoplay;
        broadcast({ type: 'toggle_autoplay', autoplay: isAutoplay });
        saveJukeboxState();
        break;
      }

      case 'toggle_shuffle': {
        isShuffle = !!data.shuffle;
        broadcast({ type: 'toggle_shuffle', shuffle: isShuffle });
        saveJukeboxState();
        break;
      }

      case 'change_floor': {
        const theme = data.theme as string;
        if (theme) {
          floorTheme = theme;
          saveJukeboxState();
          broadcast({ type: 'change_floor', theme });
        }
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown command: ${command}` }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Frontend client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// ========== Start Server ==========
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TikTok Live Relay Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
