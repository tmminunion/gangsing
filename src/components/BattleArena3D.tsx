import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Player, WeaponType, Airdrop, AirdropType, ActivePowerUp } from '../types';
import type { Boss, BossAttackPattern, Minion } from '../types';
import { playBossLaserSound, playBossPoundSound, playBossSummonSound, playBossVortexSound, playBossMissileSound, playClashLightSound, playClashMediumSound, playClashHeavySound, playParryClashSound } from '../utils/soundEffects';
import { fakerID_ID as faker } from '@faker-js/faker';

interface BattleArena3DProps {
  onLeaderboardUpdate: (players: Player[]) => void;
  onLiveFeedMessage: (msg: { id: string; type: 'gift' | 'comment' | 'kill' | 'system' | 'join'; text: string; time: string }) => void;
  currentLikes: number;
  onAddKillScore: (username: string) => void;
  onWinnerDecided?: (winner: { username: string; color: string; kills: number }) => void;
  onBossMvpDecided?: (mvp: { username: string; damage: number }) => void;
  onKillEvent?: (data: { killer: string; victim: string; killerColor: string; streak: number; streakText: string }) => void;
  onMusicAirdropTriggered?: () => void;
  currentYoutubeTitle?: string | null;
  onNextSong?: () => void;
  onSafeZoneUpdate?: (radius: number) => void;
}
export interface BattleArenaRef {
  addPlayer: (username: string, nickname: string, isPremium?: boolean, forcedColor?: string) => void;
  triggerComment: (username: string, text: string, nickname?: string) => void;
  triggerGift: (username: string, giftName: string, amount: number, nickname?: string) => void;
  triggerTap: (x: number, y: number) => void;
  resetGame: () => void;
  getPlayerCounts: () => { alive: number; dead: number; total: number };
  exportScene: () => void;
  importOBJ: (file: File) => void;
  importOBJFromUrl: (url: string, filename: string) => void;
  clearAllImportedOBJs: () => void;
  changeFloorTheme: (theme: string) => void;
  respawnObstacles: () => void;
}

export const BattleArena3D = forwardRef<BattleArenaRef, BattleArena3DProps>(({
  onLeaderboardUpdate,
  onLiveFeedMessage,
  currentLikes,
  onAddKillScore,
  onWinnerDecided,
  onBossMvpDecided,
  onKillEvent,
  onMusicAirdropTriggered,
  currentYoutubeTitle,
  onNextSong,
  onSafeZoneUpdate
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // References to keep game state fast & avoid React re-render lags
  const playersRef = useRef<Map<string, Player>>(new Map());
  const airdropsRef = useRef<Airdrop[]>([]);
  const obstaclesRef = useRef<THREE.Object3D[]>([]);
  const projectileRef = useRef<{ id: string; mesh: THREE.Mesh; targetX: number; targetZ: number; speed: number; damage: number; owner: string }[]>([]);
  const particlesRef = useRef<{ mesh: THREE.Points; life: number; velocity: THREE.Vector3[] }[]>([]);
  const glassShardsRef = useRef<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; rotX: number; rotY: number; rotZ: number; life: number; maxLife: number }[]>([]);

  // Parry/Clash system
  const playerVelocitiesRef = useRef<Map<string, { vx: number; vz: number; prevX: number; prevZ: number }>>(new Map());
  const parryCooldownRef = useRef<Map<string, number>>(new Map()); // key: "p1id_p2id" -> timestamp when parry available again

  // Battle Point system — multiple convergence points where tops clash (max 75% of alive players)
  const battlePointsRef = useRef<{ x: number; z: number; active: boolean; spawnTime: number; ringMesh: THREE.Mesh | null; beamMesh: THREE.Mesh | null }[]>([]);

  // Simulation state
  const [safeZoneRadius, setSafeZoneRadius] = useState<number>(40);
  const safeZoneRadiusRef = useRef<number>(40);
  const [syncedPlayers, setSyncedPlayers] = useState<Player[]>([]);
  const [floatingLabels, setFloatingLabels] = useState<{ id: string; name: string; hp: number; maxHp: number; shield: number; kills: number; xp: number; level: number; x: number; y: number; textBubble?: string; color: string; size: number }[]>([]);
  const [floatingText, setFloatingText] = useState<{ id: string; text: string; color: string; x: number; y: number; age: number }[]>([]);

  // ThreeJS runtime references
  const mainSceneRef = useRef<THREE.Scene | null>(null);
  const mainCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mainRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const safeZoneDirectionRef = useRef<number>(-1); // -1 = shrinking, +1 = expanding
  const safeZoneRingMeshRef = useRef<THREE.LineLoop | null>(null);
  const safeZonePulseMeshRef = useRef<THREE.Mesh | null>(null);
  const airdropSpawnTimerRef = useRef<number>(0);
  const arenaFloorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const airdropMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  // Boss system refs
  const bossRef = useRef<Boss | null>(null);
  const bossMeshRef = useRef<THREE.Group | null>(null);
  const minionsRef = useRef<Minion[]>([]);
  const minionMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  // Camera shake system
  const cameraShakeRef = useRef<{ intensity: number; decay: number; offsetX: number; offsetZ: number }>({ intensity: 0, decay: 0.9, offsetX: 0, offsetZ: 0 });
  // MVP golden effects tracking
  const mvpPlayerIdRef = useRef<string | null>(null);
  const customObstacleGeometriesRef = useRef<THREE.Group[]>([]);
  const customAirdropGeometriesRef = useRef<THREE.Group[]>([]);

  // Track consecutive kills per player for streak announcements
  const killStreakRef = useRef<Map<string, { count: number; lastKillTime: number }>>(new Map());

  // NPC bot player IDs — so we can count + manage auto-spawning
  const npcBotIdsRef = useRef<Set<string>>(new Set());

  // Track last reset time to prevent duplicate auto-restarts
  const lastResetTimeRef = useRef<number>(0);
  
  // Track accumulated likes to drop airdrops systematically
  const likeCounterRef = useRef<number>(0);

  // Weather & Lights refs
  const currentWeatherRef = useRef<string>('normal');
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const spotlightRef = useRef<THREE.SpotLight | null>(null);
  const movingPointLightRef = useRef<THREE.PointLight | null>(null);
  const movingLightOrbRef = useRef<THREE.Mesh | null>(null);
  const movingLightTargetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const rainRef = useRef<THREE.Points | null>(null);
  const tornadoMeshRef = useRef<THREE.Group | null>(null);
  const tornadoPosRef = useRef<{ x: number; z: number; vx: number; vz: number }>({ x: 0, z: 0, vx: 0.08, vz: 0.05 });

  // Colors dictionary
  const BRAND_COLORS = [
    '#3B82F6', // Neon Blue
    '#EF4444', // Neon Crimson
    '#10B981', // Neon Jade
    '#F59E0B', // Golden Amber
    '#EC4899', // Hyper Pink
    '#8B5CF6', // Electric Violet
    '#06B6D4', // Cool Cyan
    '#14B8A6'  // Sunset Teal
  ];

  // Parse color name from comment text to spawn gangsing with matching color
  const COLOR_KEYWORDS: Record<string, string> = {
    'merah': '#EF4444',
    'biru': '#3B82F6',
    'kuning': '#F59E0B',
    'hijau': '#10B981',
    'pink': '#EC4899',
    'ungu': '#8B5CF6',
    'cyan': '#06B6D4',
    'orange': '#F97316',
    'putih': '#F1F5F9',
    'hitam': '#1E293B',
    'silver': '#94A3B8'
  };

  const parseColorFromText = (text: string): string | null => {
    const lower = text.toLowerCase();
    for (const [keyword, color] of Object.entries(COLOR_KEYWORDS)) {
      if (lower.includes(keyword)) {
        return color;
      }
    }
    return null;
  };

  // Helper to generate dynamic face seed
  const getRandomSeed = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  // Helper to trigger floating combat damage text
  const addFloatingCombatText = (text: string, x: number, y: number, z: number, color: string) => {
    if (!mainCameraRef.current || !mainRendererRef.current) return;
    const pos = new THREE.Vector3(x, y + 2, z);
    pos.project(mainCameraRef.current);

    const widthHalf = (canvasRef.current?.clientWidth || 0) / 2;
    const heightHalf = (canvasRef.current?.clientHeight || 0) / 2;

    const screenX = (pos.x * widthHalf) + widthHalf;
    const screenY = -(pos.y * heightHalf) + heightHalf;

    const textId = Math.random().toString();
    setFloatingText(prev => [
      ...prev,
      { id: textId, text, color, x: screenX, y: screenY, age: 0 }
    ]);
  };

  const initRain = (scene: THREE.Scene) => {
    const rainCount = 1500;
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    
    for (let i = 0; i < rainCount; i++) {
      positions.push(
        (Math.random() - 0.5) * 80, // X
        Math.random() * 30,         // Y
        (Math.random() - 0.5) * 80  // Z
      );
    }
    
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.15,
      transparent: true,
      opacity: 0.6
    });
    
    const rainParticles = new THREE.Points(geom, mat);
    scene.add(rainParticles);
    rainRef.current = rainParticles;
    rainParticles.visible = false;
  };

  const initTornado = (scene: THREE.Scene) => {
    const group = new THREE.Group();
    const segments = 6;
    for (let i = 0; i < segments; i++) {
      const r = 1.0 + i * 0.8;
      const geo = new THREE.RingGeometry(r - 0.1, r + 0.1, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4 - i * 0.04
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = i * 1.5;
      group.add(ring);
    }
    
    scene.add(group);
    tornadoMeshRef.current = group;
    group.visible = false;
  };

  const changeWeather = (weather: string) => {
    console.log('[Weather] Changing weather to:', weather);
    currentWeatherRef.current = weather;
    
    // 1. Reset lighting intensities
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 2.0;
      ambientLightRef.current.color.setHex(0xffffff);
    }
    if (dirLightRef.current) dirLightRef.current.intensity = 4.0;
    if (spotlightRef.current) spotlightRef.current.intensity = 5;
    
    // 2. Toggle visuals
    if (rainRef.current) rainRef.current.visible = (weather === 'hujan');
    if (tornadoMeshRef.current) {
      tornadoMeshRef.current.visible = (weather === 'badai');
      tornadoPosRef.current = { x: 0, z: 0, vx: 0.08 + Math.random() * 0.04, vz: 0.05 + Math.random() * 0.04 };
      tornadoMeshRef.current.position.set(0, 0.1, 0);
    }
    
    // 3. Apply settings
    if (weather === 'malam') {
      if (ambientLightRef.current) ambientLightRef.current.intensity = 0.15;
      if (dirLightRef.current) dirLightRef.current.intensity = 0.3;
      if (spotlightRef.current) spotlightRef.current.intensity = 0.8;
      addFloatingCombatText('🌙 MALAM TIBA (Neon Glow!)', 0, 4, 0, '#818cf8');
    } else if (weather === 'hujan') {
      addFloatingCombatText('🌧️ HUJAN TURUN (Lantai Licin!)', 0, 4, 0, '#60a5fa');
    } else if (weather === 'badai') {
      addFloatingCombatText('🌪️ BADAI DATANG (Awas Tornado!)', 0, 4, 0, '#94a3b8');
    } else {
      addFloatingCombatText('☀️ CUACA NORMAL', 0, 4, 0, '#facc15');
    }
  };

  const applyFloorTheme = (theme: string) => {
    if (!arenaFloorMeshRef.current) return;
    console.log('[Floor] Applying floor theme:', theme);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    let metalness = 0.1;
    let roughness = 0.8;

    // Toggle grid helper visibility based on theme (only show grid helper on 'scifi')
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = (theme === 'scifi');
    }

    // Check if the theme is actually a custom uploaded texture URL
    if (theme.startsWith('/imported/') || theme.includes('.')) {
      console.log('[Floor] Loading custom texture image from:', theme);
      const loader = new THREE.TextureLoader();
      loader.load(
        theme,
        (loadedTexture) => {
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.RepeatWrapping;
          loadedTexture.repeat.set(12, 12); // Repeat to avoid stretching
          
          if (arenaFloorMeshRef.current) {
            const mat = arenaFloorMeshRef.current.material as THREE.MeshStandardMaterial;
            mat.map = loadedTexture;
            mat.color.setHex(0xffffff); // reset filter
            mat.metalness = 0.1;
            mat.roughness = 0.8;
            mat.needsUpdate = true;
          }
        },
        undefined,
        (err) => {
          console.error('[Floor] Failed to load custom texture image:', err);
        }
      );
      return; // Return early as loading is asynchronous
    }

    if (theme === 'grass') {
      // Rich grass texture with color variations, clover leaves, and tiny flowers
      const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 360);
      grad.addColorStop(0, '#155e75'); // subtle cyan-green undertone
      grad.addColorStop(0.5, '#14532d'); // dark forest green
      grad.addColorStop(1, '#052e16'); // deep forest green
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Draw grass blades
      for (let i = 0; i < 40000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const len = 4 + Math.random() * 7;
        const angle = (Math.random() - 0.5) * 0.5;
        const colVal = Math.random();
        const col = colVal < 0.3 ? '#166534' : colVal < 0.6 ? '#15803d' : colVal < 0.85 ? '#22c55e' : '#4ade80';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2 + Math.random() * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(angle) * len, y - Math.cos(angle) * len);
        ctx.stroke();
      }

      // Draw clover leaves and tiny decorative flowers
      for (let i = 0; i < 150; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        if (Math.random() < 0.6) {
          // Clover leaf
          ctx.fillStyle = '#16a34a';
          const size = 2 + Math.random() * 2;
          ctx.beginPath();
          ctx.arc(cx - size/2, cy, size, 0, Math.PI * 2);
          ctx.arc(cx + size/2, cy, size, 0, Math.PI * 2);
          ctx.arc(cx, cy - size/2, size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Tiny white daisy-like flower
          const petals = 5;
          const r = 2.5 + Math.random() * 2.0;
          ctx.fillStyle = '#ffffff';
          for (let p = 0; p < petals; p++) {
            const angle = (p / petals) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, r * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#facc15'; // yellow core
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      metalness = 0.0;
      roughness = 0.95;
    } 
    else if (theme === 'sand') {
      // Golden sand with sand dune wave patterns and sparkles
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#fef08a'); // soft yellow highlight
      grad.addColorStop(0.5, '#eab308'); // warm gold
      grad.addColorStop(1, '#ca8a04'); // deep yellow-brown shadow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Fine sand dust grains
      for (let i = 0; i < 50000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() < 0.5 ? '#eab308' : '#fef9c3';
        ctx.fillRect(x, y, 1.0, 1.0);
      }

      // 3D emboss look wind ripple waves
      for (let y = -24; y < 536; y += 40) {
        // Highlight crest line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-10, y);
        for (let x = 0; x <= 522; x += 16) {
          const waveY = y + Math.sin(x * 0.04) * 8;
          ctx.lineTo(x, waveY);
        }
        ctx.stroke();

        // Shadow trough line
        ctx.strokeStyle = 'rgba(133, 77, 14, 0.35)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-10, y + 4);
        for (let x = 0; x <= 522; x += 16) {
          const waveY = y + 4 + Math.sin(x * 0.04) * 8;
          ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
      metalness = 0.05;
      roughness = 0.9;
    } 
    else if (theme === 'brick') {
      // Premium 3D-bevel brick masonry
      ctx.fillStyle = '#1e1b4b'; // deep mortar color in joints
      ctx.fillRect(0, 0, 512, 512);

      const brickW = 128;
      const brickH = 64;
      const gap = 4;

      for (let row = 0; row < 9; row++) {
        const y = row * brickH;
        const offset = (row % 2) * (brickW / 2);
        for (let col = -1; col < 5; col++) {
          const x = col * brickW + offset;
          
          // Brick base color with natural red/orange variations
          const baseHue = 10 + Math.floor(Math.random() * 15);
          const s = 65 + Math.floor(Math.random() * 15);
          const l = 35 + Math.floor(Math.random() * 20);
          ctx.fillStyle = `hsl(${baseHue}, ${s}%, ${l}%)`;
          ctx.fillRect(x + gap, y + gap, brickW - gap * 2, brickH - gap * 2);

          // Emboss lighting (Bevel effect)
          const grad = ctx.createLinearGradient(x + gap, y + gap, x + gap, y + brickH - gap);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.18)'); // light shine on top edge
          grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.45)'); // deep shadow on bottom edge
          ctx.fillStyle = grad;
          ctx.fillRect(x + gap, y + gap, brickW - gap * 2, brickH - gap * 2);

          // Brick surface texture/grunge
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          for (let j = 0; j < 30; j++) {
            const rx = x + gap + Math.random() * (brickW - gap*2);
            const ry = y + gap + Math.random() * (brickH - gap*2);
            ctx.fillRect(rx, ry, 1.5 + Math.random()*2, 1.5 + Math.random()*2);
          }
          
          // Bevel stroke highlights
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + gap, y + brickH - gap);
          ctx.lineTo(x + gap, y + gap);
          ctx.lineTo(x + brickW - gap, y + gap);
          ctx.stroke();
        }
      }
      metalness = 0.1;
      roughness = 0.8;
    } 
    else if (theme === 'stone') {
      // Cobblestone path with moss & cracks
      ctx.fillStyle = '#0f172a'; // dark earthy joints
      ctx.fillRect(0, 0, 512, 512);

      // Draw wild moss growing in gaps
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() < 0.5 ? '#15803d' : '#166534';
        ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }

      const rows = 8;
      const cols = 8;
      const stoneW = 512 / cols;
      const stoneH = 512 / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c * stoneW + stoneW / 2 + (Math.random() - 0.5) * 12;
          const cy = r * stoneH + stoneH / 2 + (Math.random() - 0.5) * 12;
          const rx = (stoneW / 2) - 4 - Math.random() * 3;
          const ry = (stoneH / 2) - 4 - Math.random() * 3;
          const rotation = Math.random() * Math.PI;

          // Natural stone base gray color
          const lightness = 40 + Math.floor(Math.random() * 25);
          ctx.fillStyle = `hsl(215, 12%, ${lightness}%)`;
          
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
          ctx.fill();

          // 3D spherical dome light mapping
          const grad = ctx.createRadialGradient(cx - rx*0.3, cy - ry*0.3, 2, cx, cy, rx);
          grad.addColorStop(0, 'rgba(255,255,255,0.25)'); // highlights
          grad.addColorStop(0.7, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.55)'); // shadows at borders
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
          ctx.fill();

          // Outlines
          ctx.strokeStyle = `hsl(215, 12%, ${lightness - 20}%)`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
          ctx.stroke();

          // Cracks on stones
          if (Math.random() < 0.25) {
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (Math.random() - 0.5) * rx, cy + (Math.random() - 0.5) * ry);
            ctx.stroke();
          }
        }
      }
      metalness = 0.15;
      roughness = 0.75;
    } 
    else if (theme === 'lava') {
      // Lava & Volcanic Crust
      ctx.fillStyle = '#09090b'; // dark cooling crust background
      ctx.fillRect(0, 0, 512, 512);

      // Glowing magma rivers in the background
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f97316';
      
      const riversCount = 18;
      for (let i = 0; i < riversCount; i++) {
        const startX = Math.random() * 512;
        const startY = Math.random() * 512;
        
        // Orange glow base
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        let curX = startX;
        let curY = startY;
        for (let j = 0; j < 5; j++) {
          curX += (Math.random() - 0.5) * 80;
          curY += (Math.random() - 0.5) * 80;
          ctx.lineTo(curX, curY);
        }
        ctx.stroke();

        // Hot yellow center stream
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        curX = startX;
        curY = startY;
        for (let j = 0; j < 5; j++) {
          curX += (Math.random() - 0.5) * 80;
          curY += (Math.random() - 0.5) * 80;
          ctx.lineTo(curX, curY);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0; // reset shadow for speed

      // Cooling Basalt Rock Plates overlay
      ctx.fillStyle = '#18181b';
      for (let i = 0; i < 45; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const size = 30 + Math.random() * 50;
        
        ctx.beginPath();
        ctx.moveTo(cx + size, cy);
        for (let side = 0; side < 6; side++) {
          const angle = (side / 6) * Math.PI * 2;
          const jitterSize = size + (Math.random() - 0.5) * 12;
          ctx.lineTo(cx + Math.cos(angle) * jitterSize, cy + Math.sin(angle) * jitterSize);
        }
        ctx.closePath();
        ctx.fill();

        // Bevel look on basalt plates
        const innerGrad = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
        innerGrad.addColorStop(0, 'rgba(251, 146, 60, 0.12)'); // orange ambient underglow
        innerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)'); // shadow
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Noise on rocks
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let j = 0; j < 15; j++) {
          ctx.fillRect(cx + (Math.random() - 0.5) * size, cy + (Math.random() - 0.5) * size, 3, 3);
        }
      }
      metalness = 0.4;
      roughness = 0.65;
    } 
    else if (theme === 'ice') {
      // Ice sheet with cracks and sub-surface details
      const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 360);
      grad.addColorStop(0, '#e0f2fe'); // crystal blue-white core
      grad.addColorStop(0.5, '#38bdf8'); // sky ice blue
      grad.addColorStop(1, '#0369a1'); // deep arctic ice blue
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Frost lines / micro-cracks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.lineTo(Math.random() * 512, Math.random() * 512);
        ctx.stroke();
      }

      // Poly shard reflections overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 30; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const size = 40 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (Math.random() - 0.5) * size, cy + (Math.random() - 0.5) * size);
        ctx.lineTo(cx + (Math.random() - 0.5) * size, cy + (Math.random() - 0.5) * size);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      metalness = 0.85;
      roughness = 0.12;
    } 
    else if (theme === 'wood') {
      // Premium wooden parket/plank floor
      ctx.fillStyle = '#27160c'; // dark grain joint margins
      ctx.fillRect(0, 0, 512, 512);

      const boardH = 64;
      const numBoards = 512 / boardH;
      
      for (let i = 0; i < numBoards; i++) {
        const y = i * boardH;
        
        // Base mahogany-cedar wood tones
        const brightness = 20 + Math.floor(Math.random() * 16);
        ctx.fillStyle = `hsl(22, 55%, ${brightness}%)`;
        ctx.fillRect(0, y + 2, 512, boardH - 4);

        // Wood grains
        ctx.strokeStyle = `hsl(22, 60%, ${brightness - 7}%)`;
        ctx.lineWidth = 1.5;
        for (let wave = 0; wave < 3; wave++) {
          ctx.beginPath();
          ctx.moveTo(0, y + 10 + wave * 16);
          for (let x = 0; x <= 512; x += 32) {
            const grainY = y + 10 + wave * 16 + Math.sin(x * 0.02) * 5 + (Math.random() - 0.5) * 1.5;
            ctx.lineTo(x, grainY);
          }
          ctx.stroke();
        }

        // Tree knots/rings in the grain
        if (Math.random() < 0.5) {
          const kx = Math.random() * 512;
          const ky = y + 15 + Math.random() * 30;
          ctx.fillStyle = `hsl(22, 60%, ${brightness - 10}%)`;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 8, 4, Math.random() * 0.2, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.strokeStyle = `hsl(22, 60%, ${brightness - 14}%)`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 16, 8, Math.random() * 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Wood sheen (Top light, bottom shading)
        const plankGrad = ctx.createLinearGradient(0, y + 2, 0, y + boardH - 2);
        plankGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        plankGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        ctx.fillStyle = plankGrad;
        ctx.fillRect(0, y + 2, 512, boardH - 4);
      }
      metalness = 0.05;
      roughness = 0.65;
    }
    else {
      // Default: High-tech neon sci-fi grid with circuit tracings
      ctx.fillStyle = '#060814'; // deep indigo void space
      ctx.fillRect(0, 0, 512, 512);

      // Soft center glowing hub
      const centerGrad = ctx.createRadialGradient(256, 256, 10, 256, 256, 300);
      centerGrad.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
      centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Electronic circuitry lines
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        const startX = Math.floor(Math.random() * 8) * 64;
        const startY = Math.floor(Math.random() * 8) * 64;
        ctx.moveTo(startX, startY);
        if (Math.random() < 0.5) {
          ctx.lineTo(startX + 45, startY + 45);
          ctx.lineTo(startX + 45, startY + 90);
        } else {
          ctx.lineTo(startX + 64, startY);
          ctx.lineTo(startX + 96, startY + 32);
        }
        ctx.stroke();
      }

      // Futuristic glowing grid lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)'; // neon indigo grid lines
      ctx.lineWidth = 3.5;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }

      // Neon light junctions/dots at line crossings
      ctx.fillStyle = '#06b6d4'; // neon cyan dots
      for (let x = 0; x <= 512; x += 64) {
        for (let y = 0; y <= 512; y += 64) {
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0; // reset shadow
      metalness = 0.5;
      roughness = 0.25;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);

    const mat = arenaFloorMeshRef.current.material as THREE.MeshStandardMaterial;
    mat.map = texture;
    mat.color.setHex(0xffffff); // reset filter
    mat.metalness = metalness;
    mat.roughness = roughness;
    mat.needsUpdate = true;
  };

  // 1. Core Functions exposed to Parent
  useImperativeHandle(ref, () => ({
    exportScene: () => {
      if (!mainSceneRef.current) return;
      import('three/examples/jsm/exporters/OBJExporter.js').then(({ OBJExporter }) => {
        const exporter = new OBJExporter();
        const result = exporter.parse(mainSceneRef.current!);
        const blob = new Blob([result], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gangsing_scene_${Date.now()}.obj`;
        a.click();
        URL.revokeObjectURL(url);
      });
    },
    importOBJ: (file: File) => {
      if (!mainSceneRef.current) {
        alert('Scene belum siap, coba lagi sebentar.');
        return;
      }
      console.log('[Import] Loading OBJ:', file.name, file.size, 'bytes');
      import('three/examples/jsm/loaders/OBJLoader.js').then(({ OBJLoader }) => {
        const loader = new OBJLoader();
        const url = URL.createObjectURL(file);
        loader.load(
          url,
          (obj) => {
            console.log('[Import] OBJ parsed, children:', obj.children.length);
            
            const box = new THREE.Box3().setFromObject(obj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0.001) {
              obj.scale.setScalar(1.5 / maxDim);
            } else {
              obj.scale.setScalar(1);
            }

            obj.name = file.name;
            const lowerName = file.name.toLowerCase();
            if (lowerName.includes('airdrop') || lowerName.includes('air_drop')) {
              customAirdropGeometriesRef.current.push(obj);
              alert(`✅ Berhasil memuat model Airdrop kustom: ${file.name}`);
            } else {
              customObstacleGeometriesRef.current.push(obj);
              alert(`✅ Berhasil memuat model Rintangan/Batu kustom: ${file.name}`);
            }
            URL.revokeObjectURL(url);
          },
          (progress) => {
            console.log('[Import] Progress:', progress.loaded, '/', progress.total);
          },
          (err) => {
            console.error('[Import] OBJ load error:', err);
            URL.revokeObjectURL(url);
            alert(`❌ Gagal load OBJ: ${err}`);
          }
        );
      }).catch(err => {
        console.error('[Import] OBJLoader import failed:', err);
        alert(`❌ OBJLoader tidak bisa dimuat: ${err}`);
      });
    },

    importOBJFromUrl: (url: string, filename: string) => {
      if (!mainSceneRef.current) return;
      console.log('[Import] Loading OBJ from URL:', url, filename);
      import('three/examples/jsm/loaders/OBJLoader.js').then(({ OBJLoader }) => {
        const loader = new OBJLoader();
        loader.load(
          url,
          (obj) => {
            console.log('[Import] OBJ from URL parsed, children:', obj.children.length);
            
            const box = new THREE.Box3().setFromObject(obj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0.001) {
              obj.scale.setScalar(4.5 / maxDim);
            } else {
              obj.scale.setScalar(4.5);
            }

            obj.name = filename;
            const lowerUrl = url.toLowerCase();
            const lowerName = filename.toLowerCase();
            if (
              lowerUrl.includes('/airdrop/') ||
              lowerName.includes('airdrop') ||
              lowerName.includes('air_drop')
            ) {
              customAirdropGeometriesRef.current.push(obj);
              console.log(`[Import] Registered custom airdrop model from URL/filename: ${filename}`);
            } else {
              customObstacleGeometriesRef.current.push(obj);
              console.log(`[Import] Registered custom obstacle model from URL/filename: ${filename}`);
            }
          },
          (progress) => {
            console.log('[Import] URL progress:', progress.loaded, '/', progress.total);
          },
          (err) => {
            console.error('[Import] URL load error:', err);
          }
        );
      }).catch(err => {
        console.error('[Import] OBJLoader from URL failed to load:', err);
      });
    },

    clearAllImportedOBJs: () => {
      if (!mainSceneRef.current) return;
      console.log('[Import] Clearing all imported OBJs');
      customObstacleGeometriesRef.current = [];
      customAirdropGeometriesRef.current = [];
      const toRemove: THREE.Object3D[] = [];
      mainSceneRef.current.traverse((child) => {
        if (child.name && child.name.startsWith('imported_')) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((child) => {
        mainSceneRef.current?.remove(child);
        console.log('[Import] Removed persistent asset:', child.name);
      });
    },

    changeFloorTheme: (theme: string) => {
      applyFloorTheme(theme);
    },

    respawnObstacles: () => {
      if (!mainSceneRef.current) return;
      console.log('[Import] Respawning obstacles with new models');
      obstaclesRef.current.forEach(obs => {
        if (mainSceneRef.current) mainSceneRef.current.remove(obs);
      });
      obstaclesRef.current = [];
      
      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 20;
        spawnObstacleAt(Math.cos(ang) * d, Math.sin(ang) * d);
      }
    },

    addPlayer: (username: string, nickname: string, isPremium = false, forcedColor?: string) => {
      const id = username.toLowerCase();
      if (playersRef.current.has(id)) {
        // Revive or heal if already exists
        const p = playersRef.current.get(id);
        if (p) {
          if (nickname) p.username = nickname;
          if (p.status === 'dead') {
            p.status = 'alive';
            p.hp = isPremium ? 150 : 100;
            p.maxHp = isPremium ? 150 : 100;
            p.shield = 50;
            p.weapon = isPremium ? 'glowing_laser' : 'fist';
            p.size = isPremium ? 1.5 : 1.0;
            // Respawn close to center
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * (safeZoneRadiusRef.current * 0.6);
            p.x = Math.cos(ang) * dist;
            p.z = Math.sin(ang) * dist;
            p.y = 15; // drop from sky
            onLiveFeedMessage({
              id: Math.random().toString(),
              type: 'join',
              text: `@${nickname || username} bangkit kembali dan terjun ke arena!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            createSpawnExplosion(p.x, 0, p.z, p.color);
          } else {
            // Heal if already alive
            p.hp = Math.min(p.maxHp, p.hp + 40);
            p.shield = Math.min(100, p.shield + 20);
            p.lastActionText = "GABUNG / PULIH";
            p.lastActionTime = Date.now();
            
          }
        }
        return;
      }

      // Battle Royale - gangsing color from comment keyword or random
      const randomColor = forcedColor || BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * (safeZoneRadiusRef.current * 0.7);
      
      const newPlayer: Player = {
        id,
        username: nickname || username,
        avatarSeed: getRandomSeed(),
        hp: isPremium ? 150 : 100,
        maxHp: isPremium ? 150 : 100,
        shield: isPremium ? 80 : 25,
        mental: 100,
        maxMental: 100,
        kills: 0,
        score: 0,
        size: isPremium ? 1.4 : 1.0,
        weapon: isPremium ? 'sword' : 'fist',
        color: randomColor,
        status: 'alive',
        xp: 0,
        level: 1,
        x: Math.cos(ang) * dist,
        y: 12, // Land dropping from sky
        z: Math.sin(ang) * dist,
        damageCooldown: 0,
        attackCooldown: 0,
        bossDamageDealt: 0,
        powerUpsCollected: 0,
        activePowerUps: [],
        bpTime: 0,
        lastActionText: "🛬 Mendarat di Arena!",
        lastActionTime: Date.now()
      };

      playersRef.current.set(id, newPlayer);

      // Create 3D Mesh
      if (mainSceneRef.current) {
        const playerGroup = createPlayerMesh(newPlayer);
        mainSceneRef.current.add(playerGroup);
        playerMeshesRef.current.set(id, playerGroup);
        
        // Spawn effect
        createSpawnExplosion(newPlayer.x, 0, newPlayer.z, randomColor);
      }

      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'join',
        text: `📢 GLADIATOR BARU: @${nickname || username} telah mendarat di arena!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },

    triggerComment: (username: string, text: string, nickname?: string) => {
      const id = username.toLowerCase();

      // Parse color keyword from comment (merah, biru, kuning, etc.)
      const parsedColor = parseColorFromText(text);

      // Make them join if not in match — use their requested color!
      if (!playersRef.current.has(id)) {
        (ref as any).current.addPlayer(username, nickname || username, false, parsedColor);
      }

      const p = playersRef.current.get(id);
      if (p && p.status === 'alive') {
        // Clean bracketed TikTok emojis (e.g. [wow] -> 😲)
        let cleanedText = text
          .replace(/\[wow\]/gi, '😲')
          .replace(/\[love\]/gi, '❤️')
          .replace(/\[smile\]/gi, '😊')
          .replace(/\[laugh\]/gi, '😂')
          .replace(/\[cry\]/gi, '😢')
          .replace(/\[angry\]/gi, '😠')
          .replace(/\[surprised\]/gi, '😮')
          .replace(/\[blink\]/gi, '😉')
          .replace(/\[kira\]/gi, '✨')
          .replace(/\[funny\]/gi, '🤣')
          .replace(/\[wrong\]/gi, '❌')
          .replace(/\[correct\]/gi, '✅')
          .replace(/\[rose\]/gi, '🌹')
          .replace(/\[heart\]/gi, '❤️')
          .replace(/\[.*?\]/g, ''); // Remove any other unknown bracketed tags

        p.lastActionText = cleanedText.trim().substring(0, 30) || text.substring(0, 30);
        p.lastActionTime = Date.now();

        const cmdText = text.toLowerCase().trim();

        // 1. Weather & Music control commands via chat
        if (cmdText === 'hujan' || cmdText === 'badai' || cmdText === 'malam' || cmdText === 'normal') {
          changeWeather(cmdText);
        }

        if (cmdText === 'skip' || cmdText === 'next') {
          onNextSong?.();
        }

        // 2. Targeting command (#serang @nickname)
        if (cmdText.startsWith('#serang')) {
          const targetName = cmdText.replace('#serang', '').replace('@', '').trim();
          if (targetName) {
            let targetPlayer: Player | null = null;
            // Search for target player
            for (const other of Array.from(playersRef.current.values()) as Player[]) {
              if (other.id !== p.id && other.status === 'alive' &&
                  (other.username.toLowerCase().includes(targetName) || other.id.includes(targetName))) {
                targetPlayer = other;
                break;
              }
            }

            if (targetPlayer) {
              p.targetPlayerId = targetPlayer.id;
              p.targetTimer = 8; // Lock target for 8 seconds
              p.lastActionText = `⚔️ Dendam target @${targetPlayer.username}`;
              p.lastActionTime = Date.now();
              // Spawn red angry fire sparks
              createSpawnExplosion(p.x, p.y, p.z, '#ef4444', 6);
            }
          }
        } else if (cmdText.includes('serang') || cmdText.includes('attack') || cmdText.includes('hantam')) {
          p.attackCooldown = 0; // immediate trigger attack seek
        } else if (cmdText.includes('lompat') || cmdText.includes('jump')) {
          if (p.y <= 0.2) p.y = 5; // vertical leap jump
        }

        awardPlayerXp(p, 10);
      }
    },

    triggerGift: (username: string, giftName: string, amount: number, nickname?: string) => {
      const id = username.toLowerCase();
      if (!playersRef.current.has(id)) {
        (ref as any).current.addPlayer(username, nickname || username, true);
      }

      const p = playersRef.current.get(id);
      if (p && p.status === 'alive') {
        const lowerGift = giftName.toLowerCase();
        onLiveFeedMessage({
          id: Math.random().toString(),
          type: 'gift',
          text: `@${username} mengirim ${giftName} x${amount}!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });

        // Trigger action based on type of gift
        if (lowerGift.includes('rose') || lowerGift.includes('mawar')) {
          p.hp = Math.min(p.maxHp, p.hp + 35 * amount);
          p.lastActionText = `TERIMA MAWAR 🌹 (+Heal)`;
          p.lastActionTime = Date.now();
          
          createHealParticle(p.x, p.z, '#FF4B72');
        } 
        else if (lowerGift.includes('heart') || lowerGift.includes('cinta')) {
          p.shield = Math.min(100, p.shield + 50 * amount);
          p.lastActionText = `SENTUHAN CINTA 🫰 (+Shield)`;
          p.lastActionTime = Date.now();
          
          createHealParticle(p.x, p.z, '#FF6EA7');
        } 
        else if (lowerGift.includes('ice') || lowerGift.includes('es')) {
          // Spawn obstacles around the player
          spawnObstacleAt(p.x + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 6);
          p.lastActionText = `SUMMON ES KRIM 🍦 (Benteng)`;
          p.lastActionTime = Date.now();
        } 
        else if (lowerGift.includes('tiktok') || lowerGift.includes('nada') || lowerGift.includes('sound')) {
          p.weapon = 'glowing_laser';
          p.size = Math.min(2.5, p.size + 0.2);
          p.lastActionText = `SENJATA LASER 🎵 (OP!)`;
          p.lastActionTime = Date.now();
          updateWeaponMesh(p);
        }
        else if (lowerGift.includes('donut') || lowerGift.includes('donat')) {
          p.size = Math.min(2.5, p.size + 0.15);
          p.hp = p.maxHp;
          p.lastActionText = `MINUM SERUM DONAT 🍩 (Speed UP)`;
          p.lastActionTime = Date.now();
        } 
        else if (lowerGift.includes('box') || lowerGift.includes('crate') || lowerGift.includes('kado')) {
          p.weapon = 'golden_lance';
          p.shield = 100;
          p.lastActionText = `SENJATA TOMBAK EMAS 🎁`;
          p.lastActionTime = Date.now();
          updateWeaponMesh(p);
        } 
        else if (lowerGift.includes('diamond') || lowerGift.includes('berlian')) {
          // Trigger dynamic orbital damage strike to all other nearby players
          p.lastActionText = `ORBITAL LASER STRIKE 💎`;
          p.lastActionTime = Date.now();
          orbitalLaserStrike(p);
        } 
        else if (lowerGift.includes('universe') || lowerGift.includes('semesta') || lowerGift.includes('galaxy')) {
          // Super Giant Form!
          p.maxHp = 300;
          p.hp = 300;
          p.shield = 100;
          p.size = 2.8;
          p.weapon = 'golden_lance';
          p.lastActionText = `PENGUASA SEMESTA 🌌 (GIANT BOSS!)`;
          p.lastActionTime = Date.now();
          updateWeaponMesh(p);
          createSpawnExplosion(p.x, 0, p.z, '#8B5CF6', 20);
        }

        // Dynamic XP award on gift reception
        let giftXp = 20 * amount;
        if (lowerGift.includes('rose') || lowerGift.includes('mawar')) giftXp = 15 * amount;
        else if (lowerGift.includes('heart') || lowerGift.includes('cinta')) giftXp = 25 * amount;
        else if (lowerGift.includes('ice') || lowerGift.includes('es')) giftXp = 20 * amount;
        else if (lowerGift.includes('tiktok') || lowerGift.includes('nada') || lowerGift.includes('sound')) giftXp = 50 * amount;
        else if (lowerGift.includes('donut') || lowerGift.includes('donat')) giftXp = 60 * amount;
        else if (lowerGift.includes('box') || lowerGift.includes('crate') || lowerGift.includes('kado')) giftXp = 80 * amount;
        else if (lowerGift.includes('diamond') || lowerGift.includes('berlian')) giftXp = 150 * amount;
        else if (lowerGift.includes('universe') || lowerGift.includes('semesta') || lowerGift.includes('galaxy')) giftXp = 300 * amount;

        // Activate Giga Mode if the gift has high value (>= 50 XP)
        if (giftXp >= 50) {
          p.isGiga = true;
          p.gigaTimer = 15; // 15 seconds of Giga status!
          
          // Trigger visual size changes immediately
          const mesh = playerMeshesRef.current.get(p.id);
          if (mesh) {
            mesh.scale.setScalar(2.5);
          }
          
          addFloatingCombatText(`🌟 GIGA MODE: @${p.username} 🌟`, p.x, p.y + 2, p.z, '#facc15');
          createSpawnExplosion(p.x, p.y, p.z, '#ffcc00', 18);
        }

        awardPlayerXp(p, giftXp);
      }
    },

    triggerTap: (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      // If coordinates are 0, 0 (meaning background automated/TikTok Live like event),
      // randomize them so the floating hearts float from the bottom area of the stream naturally.
      let targetX = clientX;
      let targetY = clientY;
      if (clientX === 0 && clientY === 0) {
        targetX = rect.left + rect.width * (0.2 + Math.random() * 0.6);
        targetY = rect.top + rect.height * (0.7 + Math.random() * 0.25);
      }

      const xPercent = ((targetX - rect.left) / rect.width) * 100;
      const yPercent = ((targetY - rect.top) / rect.height) * 100;

      // Spawn random floating emoji heart
      // const teamColor = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
      // addTapHeart(xPercent, yPercent, teamColor);

      // --- GAMEPLAY IMPACT OF TAPPING / LIKING ---
      const alivePlayers = (Array.from(playersRef.current.values()) as Player[]).filter(p => p.status === 'alive');
      
      // Optimization: Only apply effects every 10 taps to reduce lag (cumulative effect)
      const shouldTriggerEffect = (likeCounterRef.current % 10 === 0);

      if (alivePlayers.length > 0 && shouldTriggerEffect) {
        // Pick a random alive player to receive the "Like Boost"
        const luckyPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        
        // 1. Recover HP (Cumulative +30 HP since it triggers every 10 taps)
        const healAmt = 30;
        luckyPlayer.hp = Math.min(luckyPlayer.maxHp, luckyPlayer.hp + healAmt);
        
        // 2. Physical push (impulse boost speed)
        const vel = playerVelocitiesRef.current.get(luckyPlayer.id);
        if (vel) {
          const angle = Math.random() * Math.PI * 2;
          const pushForce = 15 + Math.random() * 10; // stronger push since it's rarer
          vel.vx += Math.cos(angle) * pushForce;
          vel.vz += Math.sin(angle) * pushForce;
        }

        // 3. Float combat text above player (DISABLED for performance during auto-taps)
        // addFloatingCombatText(`🔥 ULTIMATE LIKE BOOST! (+${healAmt} HP)`, luckyPlayer.x, luckyPlayer.y + 1.2, luckyPlayer.z, '#10B981');
        
        // 4. Spawn colorful explosion particles
        createSpawnExplosion(luckyPlayer.x, luckyPlayer.y, luckyPlayer.z, luckyPlayer.color, 12);
      }

      // --- SYSTEMATIC AIRDROP DROP BASED ON ACCUMULATED LIKES ---
      likeCounterRef.current += 1;
      const LIKES_MILESTONE = 10; // drop a crate every 10 likes (updated from 30)
      if (likeCounterRef.current >= LIKES_MILESTONE) {
        likeCounterRef.current = 0; // reset counter
        spawnRandomAirdrop();
        
        // Broadcast a floating indicator in the middle of the arena
        addFloatingCombatText(`🎁 AIRDROP JATUH (10 LIKES)!`, 0, 4, 0, '#F59E0B');
      }
    },

    resetGame: () => {
      // Clear game and rebuild
      lastResetTimeRef.current = performance.now();
      safeZoneRadiusRef.current = 40;
      safeZoneDirectionRef.current = -1; // start shrinking
      setSafeZoneRadius(40);
      
      // Remove MVP visual effects
      mvpPlayerIdRef.current = null;
      // Remove 3D meshes
      playersRef.current.forEach((p, id) => {
        const mesh = playerMeshesRef.current.get(id);
        if (mesh && mainSceneRef.current) {
          mainSceneRef.current.remove(mesh);
        }
      });
      playerMeshesRef.current.clear();
      playersRef.current.clear();

      airdropsRef.current.forEach(ad => {
        const mesh = airdropMeshesRef.current.get(ad.id);
        if (mesh && mainSceneRef.current) mainSceneRef.current.remove(mesh);
      });
      airdropMeshesRef.current.clear();
      airdropsRef.current = [];

      obstaclesRef.current.forEach(obs => {
        if (mainSceneRef.current) mainSceneRef.current.remove(obs);
      });
      obstaclesRef.current = [];

      // Remove all battle point meshes
      battlePointsRef.current.forEach(bp => {
        if (bp.ringMesh && mainSceneRef.current) mainSceneRef.current.remove(bp.ringMesh);
        if (bp.beamMesh && mainSceneRef.current) mainSceneRef.current.remove(bp.beamMesh);
      });
      battlePointsRef.current = [];

      // Clear NPC bot tracking
      npcBotIdsRef.current.clear();

      setSyncedPlayers([]);
      setFloatingLabels([]);
      setFloatingText([]);

      // Spawn initial custom barrier obstacles
      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 20;
        spawnObstacleAt(Math.cos(ang) * d, Math.sin(ang) * d);
      }

      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'system',
        text: 'Game direset! Arena gladiator 3D siap diluncurkan.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // Spawn NPC bots to populate battle immediately (battle royale)
      const npcCount = 5;
      for (let i = 0; i < npcCount; i++) {
        setTimeout(() => {
          spawnSingleNpcBot();
        }, i * 500);
      };
    },

    getPlayerCounts: () => {
      let alive = 0;
      let dead = 0;
      playersRef.current.forEach(p => {
        if (p.status === 'alive') alive++;
        else dead++;
      });
      return { alive, dead, total: playersRef.current.size };
    }
  }));

  // Helper: spawn a single NPC bot with faker-generated unique name
  const spawnSingleNpcBot = () => {
    if (playersRef.current.size >= 30) return; // hard cap on total players
    let botName = faker.person.firstName();
    let attempts = 0;
    while (attempts < 20) {
      const id = botName.toLowerCase();
      if (!playersRef.current.has(id) && !npcBotIdsRef.current.has(id)) break;
      botName = faker.person.firstName();
      attempts++;
    }
    const id = botName.toLowerCase();
    if (playersRef.current.has(id)) return;

    const botColor = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * 25;
    const p: Player = {
      id,
      username: botName,
      avatarSeed: getRandomSeed(),
      hp: 100,
      maxHp: 100,
      shield: 50,
      mental: 100,
      maxMental: 100,
      kills: 0,
      score: 0,
      size: 1.0,
      weapon: 'fist',
      color: botColor,
      status: 'alive',
      xp: 0,
      level: 1,
      x: Math.cos(ang) * dist,
      y: 10,
      z: Math.sin(ang) * dist,
      damageCooldown: 0,
      attackCooldown: 0,
      bossDamageDealt: 0,
      powerUpsCollected: 0,
      activePowerUps: [],
      bpTime: 0
    };

    playersRef.current.set(id, p);
    npcBotIdsRef.current.add(id);
    if (mainSceneRef.current) {
      const mesh = createPlayerMesh(p);
      mainSceneRef.current.add(mesh);
      playerMeshesRef.current.set(id, mesh);
      createSpawnExplosion(p.x, 0, p.z, botColor);
    }
  };

  // Periodic NPC bot spawning — every 60s, maintain up to 5 NPC bots
  useEffect(() => {
    const npcTimer = setInterval(() => {
      const npcCount = npcBotIdsRef.current.size;
      if (npcCount < 5) {
        // Clean up dead NPCs from tracking set so we can repopulate
        npcBotIdsRef.current.forEach(npcId => {
          const p = playersRef.current.get(npcId);
          if (!p || p.status === 'dead') {
            npcBotIdsRef.current.delete(npcId);
          }
        });
        // Spawn fresh NPC bots to reach max of 5
        const currentNpc = npcBotIdsRef.current.size;
        const needed = Math.min(5 - currentNpc, 3); // max 3 per tick to avoid burst
        for (let i = 0; i < needed; i++) {
          spawnSingleNpcBot();
        }
      }
    }, 60000);
    return () => clearInterval(npcTimer);
  }, []);

  // Floating Taps
  const [tapHearts, setTapHearts] = useState<{ id: string; x: number; y: number; color: string; offset: number }[]>([]);
  const addTapHeart = (x: number, y: number, color: string) => {
    const id = Math.random().toString();
    setTapHearts(prev => [...prev, { id, x, y, color, offset: (Math.random() - 0.5) * 40 }]);
  };

  const createProfileCanvasTexture = (p: Player) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Dark background base
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 128, 128);

    // 2. High-contrast gradient based on player's random color
    const baseCol = new THREE.Color(p.color);
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
    const c1 = p.color;
    const darker = baseCol.clone().multiplyScalar(0.35).getStyle();
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, darker);

    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Modern digital grid lines
    const lighter = baseCol.clone().lerp(new THREE.Color('#ffffff'), 0.6).getStyle();
    ctx.strokeStyle = lighter;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(64, 5);
    ctx.lineTo(64, 123);
    ctx.moveTo(5, 64);
    ctx.lineTo(123, 64);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 4. Draw customized avatar face/emoticon using their seed hash
    let hash = 0;
    for (let i = 0; i < p.avatarSeed.length; i++) {
      hash = p.avatarSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorHue = Math.abs(hash) % 360;

    ctx.save();
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.clip(); // circular clip for profile photo

    // Draw suit shoulders
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(64, 115, 36, 0, Math.PI, true);
    ctx.fill();

    // Draw main high-tech digital helmet with seeded color
    ctx.fillStyle = `hsl(${colorHue}, 75%, 45%)`;
    ctx.beginPath();
    ctx.arc(64, 62, 26, 0, Math.PI * 2);
    ctx.fill();

    // Draw glowing LED glass visor/goggles
    const visorColors = ['#00f5ff', '#ff007f', '#00ff66', '#ffaa00', '#ab5cff'];
    const visorColor = visorColors[Math.abs(hash + 2) % visorColors.length];
    ctx.fillStyle = visorColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(44, 52, 40, 18, 9);
    } else {
      ctx.rect(44, 52, 40, 18);
    }
    ctx.fill();

    // Draw cute interactive LED emoticon eyes inside visor
    ctx.fillStyle = '#ffffff';
    const faceStyle = Math.abs(hash) % 5;
    ctx.beginPath();
    if (faceStyle === 0) { // Happy eyes ^ ^
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(52, 63, 3, Math.PI, 0);
      ctx.arc(76, 63, 3, Math.PI, 0);
      ctx.stroke();
    } else if (faceStyle === 1) { // Cyber lines / Matrix HUD
      ctx.fillRect(50, 59, 28, 3.5);
    } else if (faceStyle === 2) { // Focused circles
      ctx.arc(52, 61, 3.5, 0, Math.PI * 2);
      ctx.arc(76, 61, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (faceStyle === 3) { // Star eyes * *
      ctx.fillText('★', 47, 65);
      ctx.fillText('★', 71, 65);
    } else { // Winking cute eyes ^ -
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.moveTo(48, 62); ctx.lineTo(56, 62);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(76, 62, 3, Math.PI, 0);
      ctx.stroke();
    }

    // Outer white shine gloss overlay
    const shineGrad = ctx.createLinearGradient(0, 0, 128, 128);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    shineGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.05)');
    shineGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 5. Golden outer profile ring & bezel
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.stroke();

    // High Tech Inner ring frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.stroke();

    // 6. Player name — main display, large centered text following the gangsing
    // Draw a dark semi-transparent field for contrast
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(10, 30, 108, 50, 8);
    } else {
      ctx.rect(10, 30, 108, 50);
    }
    ctx.fill();
    
    // Outer stroke glow
    ctx.strokeStyle = baseCol.clone().lerp(new THREE.Color('#ffffff'), 0.3).getStyle();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Draw the player name in large bold text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Inter, sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = p.username.slice(0, 10).toUpperCase();
    
    // Text glow shadow effect
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillText(displayName, 64, 55);
    ctx.shadowBlur = 0;
    
    // Show level badge integrated
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(38, 82, 52, 18, 6);
    } else {
      ctx.rect(38, 82, 52, 18);
    }
    ctx.fill();
    
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 10px Inter, sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv.${p.level}`, 64, 91);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // 2. Mesh Creators
  const createPlayerMesh = (p: Player) => {
    const group = new THREE.Group();
    group.position.set(p.x, p.y, p.z);

    // Premium gangsing (spinning top) colored layers — derived from player's random color
    const bodyColor = p.color;
    const pCol3 = new THREE.Color(p.color);
    const jewelColor = pCol3.clone().offsetHSL(0, 0.2, 0.2).getStyle();
    const ringColor = pCol3.clone().offsetHSL(0, -0.1, 0.3).getStyle();
    const glowColor = p.color;

    // This is the spinning body which will receive the high-speed continuous spin animation!
    const spinningBody = new THREE.Group();
    spinningBody.name = 'spinningBody';
    group.add(spinningBody);

    // 1. Bottom Metallic Point (Iron/Steel Tip) - "Paku Seng"
    const tipGeo = new THREE.CylinderGeometry(0.04 * p.size, 0.005 * p.size, 0.22 * p.size, 16);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // Shiny silver titanium
      metalness: 1.0,
      roughness: 0.1
    });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.y = 0.11 * p.size;
    tipMesh.castShadow = true;
    spinningBody.add(tipMesh);

    // 2. Futuristic tiered lower cone housing (Concentric rings)
    const lowerConeGeo = new THREE.ConeGeometry(0.55 * p.size, 0.4 * p.size, 16);
    lowerConeGeo.rotateZ(Math.PI);
    const lowerConeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Tech carbon fiber dark gray
      metalness: 0.9,
      roughness: 0.2
    });
    const lowerConeMesh = new THREE.Mesh(lowerConeGeo, lowerConeMat);
    lowerConeMesh.position.y = 0.42 * p.size;
    lowerConeMesh.castShadow = true;
    spinningBody.add(lowerConeMesh);

    const upperConeGeo = new THREE.CylinderGeometry(0.72 * p.size, 0.54 * p.size, 0.3 * p.size, 16);
    const upperConeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColor),
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(bodyColor).multiplyScalar(0.25)
    });
    const upperConeMesh = new THREE.Mesh(upperConeGeo, upperConeMat);
    upperConeMesh.position.y = 0.72 * p.size;
    upperConeMesh.castShadow = true;
    spinningBody.add(upperConeMesh);

    // 3. High-Velocity Chrome Flywheel Weight Plate (Piringan penyeimbang / Strike ring)
    const plateGeo = new THREE.CylinderGeometry(0.92 * p.size, 0.88 * p.size, 0.18 * p.size, 24);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Glossy metallic casing
      metalness: 1.0,
      roughness: 0.15
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.y = 0.93 * p.size;
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    spinningBody.add(plateMesh);

    // 4. Futuristic Laser Blades / Curved Teeth (Gigi penyerang Beyblade style)
    // 6 aerodynamic blades around the perimeter
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const toothGeo = new THREE.BoxGeometry(0.18 * p.size, 0.08 * p.size, 0.35 * p.size);
      const toothMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(ringColor),
        emissive: new THREE.Color(glowColor),
        emissiveIntensity: 1.6,
        metalness: 1.0,
        roughness: 0.1
      });
      const toothMesh = new THREE.Mesh(toothGeo, toothMat);
      toothMesh.position.set(
        Math.cos(angle) * 0.95 * p.size,
        0.93 * p.size,
        Math.sin(angle) * 0.95 * p.size
      );
      toothMesh.rotation.y = -angle + Math.PI / 4;
      toothMesh.rotation.z = Math.PI / 12; // tilted for aggressive modern aesthetic
      toothMesh.castShadow = true;
      spinningBody.add(toothMesh);
    }

    // 5. Center Round Profile Photo Glass Display Screen (Ditengah ada gambar bulat untuk poto profil)
    const screenBezelGeo = new THREE.CylinderGeometry(0.58 * p.size, 0.62 * p.size, 0.08 * p.size, 18);
    const screenBezelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Sleek dark gunmetal bezel
      metalness: 0.9,
      roughness: 0.25
    });
    const screenBezelMesh = new THREE.Mesh(screenBezelGeo, screenBezelMat);
    screenBezelMesh.position.y = 1.05 * p.size;
    screenBezelMesh.castShadow = true;
    spinningBody.add(screenBezelMesh);

    // The actual circular profile texture display surface
    const profileTex = createProfileCanvasTexture(p);
    const screenGeo = new THREE.CylinderGeometry(0.52 * p.size, 0.52 * p.size, 0.02 * p.size, 24);
    const screenMat = new THREE.MeshBasicMaterial({
      map: profileTex || undefined,
      transparent: false
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.y = 1.10 * p.size; // Raised slightly above bezel
    screenMesh.castShadow = true;
    spinningBody.add(screenMesh);

    // Glowing Neon Holographic Frame Ring around the profile picture
    const holoRingGeo = new THREE.TorusGeometry(0.55 * p.size, 0.015 * p.size, 8, 32);
    const holoRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    const holoRing = new THREE.Mesh(holoRingGeo, holoRingMat);
    holoRing.rotation.x = Math.PI / 2;
    holoRing.position.y = 1.11 * p.size;
    spinningBody.add(holoRing);

    // Glowing peripheral orbit energy ring around the base of display screen
    const energyRingGeo = new THREE.TorusGeometry(0.80 * p.size, 0.03 * p.size, 8, 32);
    const energyRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 2.0,
      roughness: 0.1
    });
    const energyRing = new THREE.Mesh(energyRingGeo, energyRingMat);
    energyRing.rotation.x = Math.PI / 2;
    energyRing.position.y = 1.02 * p.size;
    energyRing.name = 'hoverRing'; // keep hoverRing identification so it spins / flows beautifully
    spinningBody.add(energyRing);

    // 7. Companion drone (remains outside spinningBody so its orbit is independent)
    const companionGroup = new THREE.Group();
    companionGroup.name = 'companion';
    companionGroup.position.set(0, 1.2 * p.size, 0);

    const droneContainer = new THREE.Group();
    droneContainer.position.set(1.1 * p.size, 0, 0);

    const droneGeo = new THREE.BoxGeometry(0.15 * p.size, 0.15 * p.size, 0.15 * p.size);
    const droneMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });
    const droneMesh = new THREE.Mesh(droneGeo, droneMat);
    droneContainer.add(droneMesh);

    const droneEyeGeo = new THREE.SphereGeometry(0.06 * p.size, 4, 4);
    const droneEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const droneEye = new THREE.Mesh(droneEyeGeo, droneEyeMat);
    droneEye.position.set(0, 0, 0.08 * p.size);
    droneContainer.add(droneEye);

    const droneRingGeo = new THREE.TorusGeometry(0.2 * p.size, 0.02 * p.size, 4, 12);
    const droneRingMat = new THREE.MeshStandardMaterial({ color: 0x00fecb, emissive: 0x00fecb, emissiveIntensity: 2.0 });
    const droneRing = new THREE.Mesh(droneRingGeo, droneRingMat);
    droneRing.rotation.x = Math.PI / 2;
    droneContainer.add(droneRing);

    companionGroup.add(droneContainer);
    group.add(companionGroup);

    // Initial Weapon holder (remains outside spinningBody so we swing straight forward)
    const weaponGroup = new THREE.Group();
    weaponGroup.name = 'weaponGroup';
    weaponGroup.position.set(0.6 * p.size, 0.6 * p.size, 0.2 * p.size);
    group.add(weaponGroup);

    return group;
  };

  // Update Weapon Mesh triggers dynamically
  const updateWeaponMesh = (p: Player) => {
    const group = playerMeshesRef.current.get(p.id);
    if (!group) return;

    const weaponGroup = group.getObjectByName('weaponGroup') as THREE.Group;
    if (!weaponGroup) return;

    // Remove existing weapon children
    while (weaponGroup.children.length > 0) {
      weaponGroup.remove(weaponGroup.children[0]);
    }

    if (p.weapon === 'sword') {
      // Glow laser katana blade!
      const bladeGeo = new THREE.BoxGeometry(0.08 * p.size, 1.3 * p.size, 0.12 * p.size);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xff0055,
        emissive: 0xff0055,
        emissiveIntensity: 1.5,
        roughness: 0.1
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      
      const guardGeo = new THREE.BoxGeometry(0.25 * p.size, 0.08 * p.size, 0.18 * p.size);
      const guardMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
      const guard = new THREE.Mesh(guardGeo, guardMat);
      
      const bladeGroup = new THREE.Group();
      blade.position.y = 0.65 * p.size;
      guard.position.y = 0.05 * p.size;
      bladeGroup.add(blade);
      bladeGroup.add(guard);
      
      bladeGroup.rotation.z = Math.PI / 5;
      weaponGroup.add(bladeGroup);
    } else if (p.weapon === 'glowing_laser') {
      const laserGeo = new THREE.CylinderGeometry(0.08 * p.size, 0.08 * p.size, 1.5 * p.size, 8);
      const laserMat = new THREE.MeshStandardMaterial({
        color: 0x25f4ee,
        emissive: 0x25f4ee,
        emissiveIntensity: 2.0
      });
      const hiltGeo = new THREE.BoxGeometry(0.15 * p.size, 0.3 * p.size, 0.15 * p.size);
      const hiltMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.position.y = 0.7 * p.size;
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);

      weaponGroup.add(laser);
      weaponGroup.add(hilt);
    } else if (p.weapon === 'golden_lance') {
      const lanceGeo = new THREE.CylinderGeometry(0.06 * p.size, 0.06 * p.size, 2.3 * p.size, 8);
      const lanceMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.5,
        metalness: 1.0,
        roughness: 0.1
      });
      const lance = new THREE.Mesh(lanceGeo, lanceMat);
      lance.rotation.x = Math.PI / 2;
      lance.position.set(0, 0, 0.8 * p.size);
      weaponGroup.add(lance);
    } else if (p.weapon === 'battle_hammer') {
      const shaftGeo = new THREE.CylinderGeometry(0.05 * p.size, 0.05 * p.size, 1.8 * p.size, 8);
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.rotation.z = Math.PI / 4;
      shaft.position.y = 0.4 * p.size;
      
      const headGeo = new THREE.BoxGeometry(0.5 * p.size, 0.5 * p.size, 0.8 * p.size);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.9,
        roughness: 0.2
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-0.6 * p.size, 1.0 * p.size, 0);
      head.rotation.z = Math.PI / 4;

      const energyGeo = new THREE.BoxGeometry(0.53 * p.size, 0.3 * p.size, 0.83 * p.size);
      const energyMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xa855f7,
        emissiveIntensity: 1.8
      });
      const energy = new THREE.Mesh(energyGeo, energyMat);
      head.add(energy);

      weaponGroup.add(shaft);
      weaponGroup.add(head);
    }
  };

  // Orbital Strike 3D blast
  const orbitalLaserStrike = (p: Player) => {
    if (!mainSceneRef.current) return;
    
    // Animate a giant 3D red laser cylinder crashing down on the arena floor near enemies
    playersRef.current.forEach(other => {
      if (other.id === p.id || other.status === 'dead') return;
      
      const dx = other.x - p.x;
      const dz = other.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 20) {
        // Drop a thunder bolt mesh
        const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 30, 8);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.7 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(other.x, 15, other.z);
        mainSceneRef.current?.add(beam);

        // Remove after 300ms
        setTimeout(() => {
          mainSceneRef.current?.remove(beam);
        }, 300);

        // Apply massive hit
        damagePlayer(other, 60, p.username);
        createSpawnExplosion(other.x, 0, other.z, '#ff3366', 8);
      }
    });
  };

  // Combat projectile triggers
  const shootLaserProjectile = (from: Player, rotRad: number) => {
    if (!mainSceneRef.current) return;
    const projGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const projMat = new THREE.MeshBasicMaterial({ color: 0x25f4ee });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.set(from.x, 1.2, from.z);
    mainSceneRef.current.add(mesh);

    const speed = 2.0;
    projectileRef.current.push({
      id: Math.random().toString(),
      mesh,
      targetX: from.x + Math.sin(rotRad) * 40,
      targetZ: from.z + Math.cos(rotRad) * 40,
      speed,
      damage: 25,
      owner: from.username
    });
  };

  // Spawn Obstacles
  const spawnObstacleAt = (x: number, z: number, isFalling = false) => {
    if (!mainSceneRef.current) return;

    // Randomize glowing crystal color palette (Vibrant neon colors)
    const obstacleColors = [
      0x8B5CF6, // Purple
      0xEC4899, // Pink
      0x3B82F6, // Blue
      0x10B981, // Jade Green
      0xF59E0B, // Gold/Amber
      0xEF4444, // Red
      0x06B6D4  // Cyan
    ];
    const chosenColor = obstacleColors[Math.floor(Math.random() * obstacleColors.length)];
    
    // HP Based on color (Merah paling kuat) - Starting from 1000 with random variance
    let baseHp = 1000;
    if (chosenColor === 0xEF4444) baseHp = 2500;
    else if (chosenColor === 0xF59E0B) baseHp = 1800;
    else if (chosenColor === 0x8B5CF6 || chosenColor === 0xEC4899) baseHp = 1500;
    
    // Tambahkan variasi acak +/- 20% agar HP tidak kaku
    const hp = Math.floor(baseHp * (0.8 + Math.random() * 0.4));

    let obs: THREE.Object3D;

    // 50% chance to use custom model, 50% chance to use default shapes (segi-segi) to ensure variation
    const useCustom = customObstacleGeometriesRef.current.length > 0 && Math.random() < 0.5;

    if (useCustom) {
      const idx = Math.floor(Math.random() * customObstacleGeometriesRef.current.length);
      const template = customObstacleGeometriesRef.current[idx];
      const customObs = template.clone();
      
      // Randomize height scale slightly
      const heightScale = 1.0 + (Math.random() - 0.5) * 0.4;
      customObs.scale.multiplyScalar(heightScale);
      
      // Randomize rotation
      customObs.rotation.y = Math.random() * Math.PI * 2;
      
      // Position Y aligned to sit on ground or falling from sky
      const startY = isFalling ? 25 : 0.1;
      customObs.position.set(x, startY, z);
      
      customObs.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: chosenColor,
            emissive: chosenColor,
            emissiveIntensity: 0.4, // Glow nicely
            roughness: 0.25,
            metalness: 0.8,
            side: THREE.DoubleSide
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      obs = customObs;
    } else {
      // Fallback: Random shape cylinder segments (batu segi-segi)
      const shapeSegments = [3, 4, 5, 6, 8];
      const segments = shapeSegments[Math.floor(Math.random() * shapeSegments.length)];
      const height = 3 + Math.random() * 4;
      const geo = new THREE.CylinderGeometry(0.8, 1.2, height, segments);
      const mat = new THREE.MeshStandardMaterial({
        color: chosenColor,
        emissive: chosenColor,
        emissiveIntensity: 0.4, // Glow nicely
        roughness: 0.25,
        metalness: 0.8
      });
      const fallbackMesh = new THREE.Mesh(geo, mat);
      const startY = isFalling ? 25 : height / 2;
      fallbackMesh.position.set(x, startY, z);
      fallbackMesh.castShadow = true;
      fallbackMesh.receiveShadow = true;
      obs = fallbackMesh;
    }
    
    // Store metadata
    obs.userData = { 
      hp: hp, 
      maxHp: hp, 
      isFalling: isFalling, 
      color: chosenColor,
      baseY: useCustom ? 0.1 : (obs as any).geometry?.parameters?.height / 2 || 2
    };

    mainSceneRef.current.add(obs);
    obstaclesRef.current.push(obs);
  };

  // Spawn a supply crate
  const spawnRandomAirdrop = () => {
    if (!mainSceneRef.current) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * (safeZoneRadiusRef.current * 0.7);
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;

    // Support 7 different airdrop types
    const types: AirdropType[] = ['health_crate', 'shield_crate', 'weapon_crate', 'bomb_prank', 'gold_crate', 'orbital_orbs', 'music_crate'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const id = Math.random().toString();
    const ad: Airdrop = {
      id,
      x,
      z,
      type: chosenType,
      size: 1.5,
      y: 18 // Falls down
    };

    airdropsRef.current.push(ad);

    // Group mesh for visual style
    const group = new THREE.Group();
    group.position.set(x, ad.y, z);

    const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    
    // Draw letter directly on a canvas texture to paint on the box faces!
    const boxCanvas = document.createElement('canvas');
    boxCanvas.width = 128;
    boxCanvas.height = 128;
    const boxCtx = boxCanvas.getContext('2d')!;
    
    let boxColorStr = '#10b981'; // health
    let boxColor = 0x10b981;
    let letter = 'H';
    
    if (chosenType === 'shield_crate') {
      boxColorStr = '#3b82f6';
      boxColor = 0x3b82f6;
      letter = 'S';
    } else if (chosenType === 'weapon_crate') {
      boxColorStr = '#f59e0b';
      boxColor = 0xf59e0b;
      letter = 'W';
    } else if (chosenType === 'bomb_prank') {
      boxColorStr = '#ef4444'; // Red for Bomb
      boxColor = 0xef4444;
      letter = 'B'; // B for Bomb
    } else if (chosenType === 'gold_crate') {
      boxColorStr = '#eab308'; // Golden yellow for Gold Crate
      boxColor = 0xeab308;
      letter = 'G'; // G for Gold
    } else if (chosenType === 'orbital_orbs') {
      boxColorStr = '#a855f7'; // Purple for Orb Crate
      boxColor = 0xa855f7;
      letter = 'O'; // O for Orb
    } else if (chosenType === 'music_crate') {
      boxColorStr = '#ec4899'; // Pink for Music Crate
      boxColor = 0xec4899;
      letter = '♫'; // Music Note
    }
    
    // Background fill
    boxCtx.fillStyle = boxColorStr;
    boxCtx.fillRect(0, 0, 128, 128);
    
    // Nice white border inside the face
    boxCtx.strokeStyle = '#ffffff';
    boxCtx.lineWidth = 8;
    boxCtx.strokeRect(12, 12, 104, 104);
    
    // Big bold white letter: H (Heal), S (Shield), W (Weapon), B (Bomb), G (Gold)
    boxCtx.fillStyle = '#ffffff';
    boxCtx.font = 'bold 72px sans-serif';
    boxCtx.textAlign = 'center';
    boxCtx.textBaseline = 'middle';
    boxCtx.fillText(letter, 64, 64);
    
    const boxTex = new THREE.CanvasTexture(boxCanvas);
    const boxMat = new THREE.MeshStandardMaterial({
      map: boxTex,
      metalness: 0.5,
      roughness: 0.4
    });
    
    let boxMesh: THREE.Object3D;
    // Peluang 50% menggunakan model kustom (jika ada), 50% menggunakan kubus tekstur huruf bawaan agar bervariasi
    const useCustomAirdrop = customAirdropGeometriesRef.current.length > 0 && Math.random() < 0.5;

    if (useCustomAirdrop) {
      const idx = Math.floor(Math.random() * customAirdropGeometriesRef.current.length);
      const template = customAirdropGeometriesRef.current[idx];
      const customBoxMesh = template.clone();
      
      customBoxMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: boxColor,
            emissive: boxColor,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.6,
            side: THREE.DoubleSide
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      boxMesh = customBoxMesh;
    } else {
      boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.castShadow = true;
    }
    
    boxMesh.name = 'box';
    group.add(boxMesh);

    // Glowing flare ring on ground below
    const ringGeo = new THREE.RingGeometry(1.5, 1.6, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: boxColor, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -ad.y + 0.1;
    ringMesh.name = 'flare';
    group.add(ringMesh);

    // ── Floating text label di atas krate ──
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 80;
    const ctx2d = labelCanvas.getContext('2d')!;
    let labelText = '⚔️ WEAPON';
    let labelColor = '#f59e0b';
    if (chosenType === 'health_crate') {
      labelText = '❤️ HEAL';
      labelColor = '#10b981';
    } else if (chosenType === 'shield_crate') {
      labelText = '🛡️ SHIELD';
      labelColor = '#3b82f6';
    } else if (chosenType === 'bomb_prank') {
      labelText = '💥 BOMB?';
      labelColor = '#ef4444';
    } else if (chosenType === 'gold_crate') {
      labelText = '⭐ GOLD';
      labelColor = '#eab308';
    } else if (chosenType === 'orbital_orbs') {
      labelText = '🔮 ORB SKILL';
      labelColor = '#a855f7';
    } else if (chosenType === 'music_crate') {
      labelText = '🎵 MUSIC BOX';
      labelColor = '#ec4899';
    }
    // Background pill
    ctx2d.clearRect(0, 0, 256, 80);
    ctx2d.fillStyle = 'rgba(0,0,0,0.65)';
    ctx2d.beginPath();
    ctx2d.roundRect(10, 10, 236, 60, 16);
    ctx2d.fill();
    // Border
    ctx2d.strokeStyle = labelColor;
    ctx2d.lineWidth = 3;
    ctx2d.beginPath();
    ctx2d.roundRect(10, 10, 236, 60, 16);
    ctx2d.stroke();
    // Text
    ctx2d.fillStyle = '#ffffff';
    ctx2d.font = 'bold 26px Arial';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(labelText, 128, 40);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.scale.set(3.5, 1.1, 1);
    labelSprite.position.set(0, 1.6, 0);
    labelSprite.name = 'label';
    group.add(labelSprite);

    mainSceneRef.current.add(group);
    airdropMeshesRef.current.set(id, group);

    let feedText = `Airdrop ${chosenType === 'health_crate' ? 'Heal' : chosenType === 'shield_crate' ? 'Shield' : chosenType === 'orbital_orbs' ? 'Orb Skill' : chosenType === 'music_crate' ? 'Music Box' : 'Weapon'} jatuh dari langit! 🎁`;
    if (chosenType === 'bomb_prank') feedText = `Airdrop Misterius jatuh dari langit! 📦`;
    if (chosenType === 'gold_crate') feedText = `Airdrop Emas Jackpot jatuh dari langit! ⭐`;

    onLiveFeedMessage({
      id: Math.random().toString(),
      type: 'system',
      text: feedText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  const triggerStoneRain = () => {
    if (!mainSceneRef.current) return;
    
    onLiveFeedMessage({
      id: Math.random().toString(),
      type: 'system',
      text: '☄️ PERINGATAN: HUJAN BATU AKAN TURUN!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    const players = Array.from(playersRef.current.values()) as Player[];
    const alivePlayers = players.filter(p => p.status === 'alive');
    
    // Trigger 1-5 stones per minute (random amount, max 5)
    const count = 1 + Math.floor(Math.random() * 5);
    const spawnedPositions: {x: number, z: number}[] = [];
    const minStoneDist = 8; // Minimal 8 units distance between falling stones

    for (let i = 0; i < count; i++) {
      let tx = 0, tz = 0;
      let validPos = false;
      let attempts = 0;

      while (!validPos && attempts < 15) {
        attempts++;
        const rand = Math.random();
        
        if (alivePlayers.length > 0) {
          if (rand < 0.3) {
            // Random position
            tx = (Math.random() - 0.5) * 65;
            tz = (Math.random() - 0.5) * 65;
          } else if (rand < 0.65) {
            // Target low HP player (pick from bottom 3)
            const sorted = [...alivePlayers].sort((a, b) => a.hp - b.hp);
            const target = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
            tx = target.x + (Math.random() - 0.5) * 6;
            tz = target.z + (Math.random() - 0.5) * 6;
          } else {
            // Target high XP player (pick from top 3)
            const sorted = [...alivePlayers].sort((a, b) => b.xp - a.xp);
            const target = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
            tx = target.x + (Math.random() - 0.5) * 6;
            tz = target.z + (Math.random() - 0.5) * 6;
          }
        } else {
          tx = (Math.random() - 0.5) * 55;
          tz = (Math.random() - 0.5) * 55;
        }

        // Ensure minimum distance from other stones in this batch
        validPos = spawnedPositions.every(pos => {
          const d = Math.sqrt(Math.pow(pos.x - tx, 2) + Math.pow(pos.z - tz, 2));
          return d >= minStoneDist;
        });
      }

      if (validPos || i === 0) {
        spawnedPositions.push({x: tx, z: tz});
        setTimeout(() => {
          spawnObstacleAt(tx, tz, true);
        }, i * 500);
      }
    }
  };

  // Particle Generation
  const createSpawnExplosion = (x: number, y: number, z: number, color: string, count = 15) => {
    if (!mainSceneRef.current) return;
    
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions.push(x, y + 0.5, z);
      // Explode radially outward high
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 5
      ));
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.5,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });

    const pMesh = new THREE.Points(geom, mat);
    mainSceneRef.current.add(pMesh);
    particlesRef.current.push({ mesh: pMesh, life: 1.0, velocity: velocities });
  };

  const createHealParticle = (x: number, z: number, color: string) => {
    if (!mainSceneRef.current) return;
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < 10; i++) {
      positions.push(x + (Math.random() - 0.5) * 1.5, 0.2, z + (Math.random() - 0.5) * 1.5);
      velocities.push(new THREE.Vector3(0, Math.random() * 2 + 1, 0));
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(color), size: 0.3 });
    const pMesh = new THREE.Points(geom, mat);
    mainSceneRef.current.add(pMesh);
    particlesRef.current.push({ mesh: pMesh, life: 0.8, velocity: velocities });
  };

  const awardPlayerXp = (p: Player, amount: number) => {
    if (p.status === 'dead') return;
    p.xp += amount;
    
    let leveledUp = false;
    let nextXpNeeded = p.level * 100;
    while (p.xp >= nextXpNeeded && p.level < 10) {
      p.xp -= nextXpNeeded;
      p.level += 1;
      p.maxHp += 15;
      p.hp = p.maxHp; // Full dynamic recovery reward
      p.shield = Math.min(100, p.shield + 50); // Bonus shield allocation
      p.size = Math.min(2.5, 1.0 + (p.level - 1) * 0.015); // Grow standard size factor
      leveledUp = true;
      nextXpNeeded = p.level * 100;
    }

    if (amount > 0) {
      
    }

    if (leveledUp) {
      
      
      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'system',
        text: `⭐ @${p.username} naik ke LEVEL ${p.level}! (Max HP +15)`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // Update 3D model scale representation instantly
      const oldMesh = playerMeshesRef.current.get(p.id);
      if (oldMesh && mainSceneRef.current) {
        mainSceneRef.current.remove(oldMesh);
        const newMesh = createPlayerMesh(p);
        mainSceneRef.current.add(newMesh);
        playerMeshesRef.current.set(p.id, newMesh);
        // Re-apply MVP visuals if this player is the current MVP
        if (mvpPlayerIdRef.current === p.id) {
          addMvpVisuals(p.id);
        }
      }
    }
  };

  // MVP Visual Effects — Golden Crown + Halo Aura
  const addMvpVisuals = (playerId: string) => {
    // Remove old MVP visuals from this player first (cleanup)
    removeMvpVisuals(playerId);

    const group = playerMeshesRef.current.get(playerId);
    if (!group) return;
    const p = playersRef.current.get(playerId);
    if (!p || p.status === 'dead') return;

    const sz = p.size || 1;
    const gold = 0xFFD700;

    // 1. Golden Crown Ring (sits above the profile screen)
    const crownGroup = new THREE.Group();
    crownGroup.name = 'mvpCrown';

    const ringGeo = new THREE.TorusGeometry(0.55 * sz, 0.04 * sz, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 2.0, metalness: 1.0, roughness: 0.1 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 1.25 * sz;
    crownGroup.add(ringMesh);

    // 8 golden spikes around the crown
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const spikeGeo = new THREE.ConeGeometry(0.06 * sz, 0.18 * sz, 6);
      const spikeMat = new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 1.5, metalness: 0.9, roughness: 0.1 });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.cos(ang) * 0.55 * sz, 1.38 * sz, Math.sin(ang) * 0.55 * sz);
      spike.rotation.z = Math.PI / 2;
      spike.rotation.y = -ang;
      crownGroup.add(spike);
    }

    // Golden glow gem on top
    const gemGeo = new THREE.SphereGeometry(0.08 * sz, 8, 8);
    const gemMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    gemMesh.position.y = 1.48 * sz;
    crownGroup.add(gemMesh);

    // 2. Pulsing Golden Halo (orbits below the player)
    const haloGroup = new THREE.Group();
    haloGroup.name = 'mvpHalo';

    const haloGeo = new THREE.TorusGeometry(0.9 * sz, 0.025 * sz, 8, 24);
    const haloMat = new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 1.0, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = 0.2 * sz;
    haloGroup.add(haloMesh);

    // Outer glow ring
    const glowGeo = new THREE.TorusGeometry(1.05 * sz, 0.04 * sz, 8, 24);
    const glowMat = new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 0.5, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = Math.PI / 2;
    glowMesh.position.y = 0.1 * sz;
    haloGroup.add(glowMesh);

    // 3. Orbiting golden star particles
    const starGroup = new THREE.Group();
    starGroup.name = 'mvpStars';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const starGeo = new THREE.SphereGeometry(0.04 * sz, 4, 4);
      const starMat = new THREE.MeshBasicMaterial({ color: gold });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(Math.cos(ang) * 1.3 * sz, 0.6 * sz + Math.sin(ang * 3) * 0.3, Math.sin(ang) * 1.3 * sz);
      starGroup.add(star);
    }

    group.add(crownGroup);
    group.add(haloGroup);
    group.add(starGroup);

    // Mark player as MVP
    if (p) p.isMvp = true;
  };

  const removeMvpVisuals = (playerId: string) => {
    const group = playerMeshesRef.current.get(playerId);
    if (!group) return;

    const names = ['mvpCrown', 'mvpHalo', 'mvpStars'];
    names.forEach(n => {
      const child = group.getObjectByName(n);
      if (child) group.remove(child);
    });

    // Clear MVP flag on player
    const p = playersRef.current.get(playerId);
    if (p) p.isMvp = false;
  };

  // ===== DRAMATIC COLLISION HELPERS =====
  /** Trigger camera shake with given intensity */
  const triggerScreenShake = (intensity: number) => {
    // Highly minimized multiplier from 0.3 to 0.1
    cameraShakeRef.current.intensity = Math.max(cameraShakeRef.current.intensity, intensity * 0.1);
  };

  /** Create a shockwave ring (visual AOE indicator) */
  const createShockwaveRing = (radius: number, cx = 0, cz = 0, colorStr = '#EF4444') => {
    if (!mainSceneRef.current) return;
    const ringGeo2 = new THREE.RingGeometry(radius - 0.15, radius + 0.15, 24);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorStr), side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ringMesh = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(cx, 0.1, cz);
    if (mainSceneRef.current) {
      mainSceneRef.current.add(ringMesh);
      setTimeout(() => { mainSceneRef.current?.remove(ringMesh); }, 600);
    }
  };

  /** Push a player away from a point with given force */
  const applyKnockback = (target: Player, fromX: number, fromZ: number, force: number) => {
    const dx = target.x - fromX;
    const dz = target.z - fromZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) {
      // Random direction if standing on the same spot
      const ang = Math.random() * Math.PI * 2;
      target.x += Math.cos(ang) * force;
      target.z += Math.sin(ang) * force;
      return;
    }
    target.x += (dx / dist) * force;
    target.z += (dz / dist) * force;
    target.targetX = undefined; // recalc path
  };

  /** Create dramatic glass shatter effect (pecahan kaca) — flat triangles/quads that scatter and spin */
  const createGlassShatter = (x: number, z: number, color1: string, color2: string, count = 8) => {
    if (!mainSceneRef.current) return;
    for (let i = 0; i < count; i++) {
      const isTri = Math.random() < 0.5;
      const w = 0.06 + Math.random() * 0.12;
      const h = 0.06 + Math.random() * 0.12;
      let geo: THREE.BufferGeometry;
      if (isTri) {
        // Triangle shard
        const hw = w / 2;
        const verts = new Float32Array([-hw, -h/3, 0, hw, -h/3, 0, 0, h*2/3, 0]);
        geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.setIndex([0, 1, 2]);
        geo.computeVertexNormals();
      } else {
        // Diamond/quad shard
        const hw = w / 2;
        const hh = h / 2;
        const verts = new Float32Array([-hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0]);
        geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        geo.computeVertexNormals();
      }
      const col = i % 2 === 0 ? new THREE.Color(color1).lerp(new THREE.Color('#FFFFFF'), 0.3) : new THREE.Color(color2).lerp(new THREE.Color('#FFFFFF'), 0.3);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.4);
      mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      const sc = 0.5 + Math.random() * 1.0;
      mesh.scale.set(sc, sc, sc);
      mainSceneRef.current.add(mesh);
      glassShardsRef.current.push({
        mesh,
        vx: (Math.random() - 0.5) * 7,
        vy: 3 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 7,
        rotX: (Math.random() - 0.5) * 12,
        rotY: (Math.random() - 0.5) * 12,
        rotZ: (Math.random() - 0.5) * 12,
        life: 1.0,
        maxLife: 0.4 + Math.random() * 0.6
      });
    }
  };

  /** Spawn a battle point — glowing convergence target for all tops */
  /** Spawn one battle point at a random location */
  const spawnSingleBattlePoint = () => {
    if (!mainSceneRef.current) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * (safeZoneRadiusRef.current * 0.6);
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * dist;
    
    const ringGeo = new THREE.RingGeometry(0.5, 0.55, 32); // Thinner, more elegant ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, 0.05, bz); // Closer to floor
    mainSceneRef.current.add(ring);
    
    // Pillar removed for performance and aesthetics
    
    battlePointsRef.current.push({
      x: bx, z: bz, active: true,
      spawnTime: Date.now(),
      ringMesh: ring,
      beamMesh: null
    });
  };

  /** Deactivate a battle point — remove meshes from scene */
  const deactivateBattlePoint = (bp: { x: number; z: number; active: boolean; spawnTime: number; ringMesh: THREE.Mesh | null; beamMesh: THREE.Mesh | null }) => {
    if (!mainSceneRef.current) return;
    if (bp.ringMesh) {
      mainSceneRef.current.remove(bp.ringMesh);
      bp.ringMesh = null;
    }
    // No beam to remove anymore
    bp.active = false;
  };

  /** Ensure enough active battle points (max 75% of alive players) */
  const ensureBattlePoints = () => {
    let activeCount = 0;
    battlePointsRef.current.forEach(bp => { if (bp.active) activeCount++; });
    const aliveCount = (Array.from(playersRef.current.values()) as Player[]).filter(p => p.status === 'alive').length;
    const maxBP = Math.max(1, Math.floor(aliveCount * 0.75));
    const needed = maxBP - activeCount;
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        spawnSingleBattlePoint();
      }
    }
    // Clean up fully deactivated BPs
    for (let i = battlePointsRef.current.length - 1; i >= 0; i--) {
      if (!battlePointsRef.current[i].active && !battlePointsRef.current[i].ringMesh) {
        battlePointsRef.current.splice(i, 1);
      }
    }
  };

  /** Create a dramatic impact explosion (big spark burst + glass shatter) */
  const createImpactExplosion = (x: number, z: number, color1: string, color2: string, intensity = 1.0) => {
    if (!mainSceneRef.current) return;
    const count = Math.floor(15 * intensity);
    for (let c = 0; c < 2; c++) {
      const col = c === 0 ? color1 : color2;
      const geom = new THREE.BufferGeometry();
      const positions: number[] = [];
      const velocities: THREE.Vector3[] = [];
      for (let i = 0; i < count; i++) {
        positions.push(x, 0.3 + Math.random() * 0.5, z);
        velocities.push(new THREE.Vector3(
          (Math.random() - 0.5) * 8 * intensity,
          Math.random() * 6 * intensity + 2,
          (Math.random() - 0.5) * 8 * intensity
        ));
      }
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: new THREE.Color(col),
        size: 0.3 * intensity,
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: true
      });
      const pMesh = new THREE.Points(geom, mat);
      mainSceneRef.current.add(pMesh);
      particlesRef.current.push({ mesh: pMesh, life: 0.5, velocity: velocities });
    }
    // Shockwave ring
    createShockwaveRing(0.5 + Math.random() * 0.5, x, z, color1);
    // Glass shatter burst (pecahan kaca dramatis)
    createGlassShatter(x, z, color1, color2, Math.floor(8 * intensity));
  };

  // 3. Gameplay Logic Operations
  const damagePlayer = (target: Player, damage: number, attackerName: string) => {
    if (target.status === 'dead') return;

    // Floor damage to integer so HP numbers never show decimals (e.g. -7.887 → -7)
    damage = Math.floor(damage);

    // Shield blocks first
    if (target.shield > 0) {
      if (target.shield >= damage) {
        target.shield -= damage;
        
      } else {
        const excess = Math.floor(damage - target.shield);
        target.shield = 0;
        target.hp = Math.max(0, target.hp - excess);
        
      }
    } else {
      target.hp = Math.max(0, target.hp - damage);
      
    }

    // Clear parry bonus on damage taken (punish if hit before attacking)
    target.parryAttackBonus = false;

    // Award hit XP to the attacker
    if (attackerName && attackerName !== 'SAFE_ZONE') {
      const attacker = playersRef.current.get(attackerName.toLowerCase());
      if (attacker && attacker.id !== target.id) {
        const gXp = Math.min(60, Math.floor(damage * 1.5));
        awardPlayerXp(attacker, gXp);
      }
    }

    // ==== DRAMATIC KNOCKBACK + IMPACT ====
    // Push target away from attacker direction
    if (attackerName && attackerName !== 'SAFE_ZONE') {
      const attacker = playersRef.current.get(attackerName.toLowerCase());
      if (attacker && attacker.id !== target.id) {
        // Knockback force scales with damage and target size
        const knockbackForce = Math.min(4, 0.5 + damage * 0.08);
        applyKnockback(target, attacker.x, attacker.z, knockbackForce);
        // Attacker also recoils slightly
        applyKnockback(attacker, target.x, target.z, knockbackForce * 0.35);
        // Camera shake proportional to damage
        triggerScreenShake(Math.min(1.5, 0.5 + damage * 0.04));
        // Impact spark burst
        const midX = (target.x + attacker.x) / 2;
        const midZ = (target.z + attacker.z) / 2;
        createImpactExplosion(midX, midZ, target.color, attacker.color, Math.min(1.5, 0.5 + damage * 0.02));
        // Play clash sound based on target size (ringan/sedang/keras)
        if (target.size < 1.0) playClashLightSound();
        else if (target.size < 1.5) playClashMediumSound();
        else playClashHeavySound();
      }
    }

    // Hit reaction
    createSpawnExplosion(target.x, target.y, target.z, '#EF4444', 5);

    if (target.hp <= 0) {
      target.status = 'dead';

      // ===== DRAMATIC DEATH EFFECTS =====
      // 1. Big death explosion at victim's location
      createSpawnExplosion(target.x, target.y, target.z, '#EF4444', 35);
      
      // 2. Glass shatter burst
      createGlassShatter(target.x, target.z, target.color, '#EF4444', 12);
      
      // 3. Expanding shockwave ring
      createShockwaveRing(1.5, target.x, target.z, '#FF4444');
      setTimeout(() => {
        createShockwaveRing(3, target.x, target.z, '#FF6666');
      }, 200);
      setTimeout(() => {
        createShockwaveRing(5, target.x, target.z, '#FF0000');
      }, 400);
      
      // 4. Intense camera shake
      triggerScreenShake(2);
      
      // 5. Giant "ELIMINATED!" floating text at death location
      addFloatingCombatText('💀 ELIMINATED!', target.x, target.y + 3, target.z, '#EF4444');
      
      // Find killer early for streak text positioning
      const killer = attackerName && attackerName !== 'SAFE_ZONE' ? (Array.from(playersRef.current.values()) as Player[]).find(p => p.username === attackerName) : undefined;

      // 6. Kill streak tracking
      let streak = 0;
      let streakText = '';
      if (killer && attackerName !== 'SAFE_ZONE') {
        const now = Date.now();
        const streakEntry = killStreakRef.current.get(attackerName.toLowerCase()) || { count: 0, lastKillTime: 0 };
        // Streak window: 15 seconds between kills to maintain streak
        if (now - streakEntry.lastKillTime < 15000) {
          streakEntry.count += 1;
        } else {
          streakEntry.count = 1;
        }
        streakEntry.lastKillTime = now;
        killStreakRef.current.set(attackerName.toLowerCase(), streakEntry);
        streak = streakEntry.count;
        
        // Streak announcement
        if (streak >= 5) streakText = 'LEGENDA KILL! 🔥';
        else if (streak >= 4) streakText = 'QUADRA KILL! ⚡';
        else if (streak >= 3) streakText = 'TRIPLE KILL! 💥';
        else if (streak >= 2) streakText = 'DOUBLE KILL! 🗡️';
        
        if (streakText) {
          // Big golden streak text at attacker's location
          
        }
      }

      // Trigger death system event
      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'kill',
        text: `💀 @${target.username} dikirim kembali ke lobi oleh @${attackerName}!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // Award killer point
      onAddKillScore(attackerName);
      if (killer) {
        killer.kills += 1;
        killer.hp = Math.min(killer.maxHp, killer.hp + 25); // health siphon on kill!
        killer.size = Math.min(2.5, killer.size + 0.1); // grow slightly on kill
        
        awardPlayerXp(killer, 120); // Extra kill XP burst
        
        // Notify parent for UI kill banner
        if (onKillEvent && attackerName !== target.username) {
          onKillEvent({
            killer: killer.username,
            victim: target.username,
            killerColor: killer.color,
            streak,
            streakText
          });
        }
      }

      // Remove 3D Mesh
      const mesh = playerMeshesRef.current.get(target.id);
      if (mesh && mainSceneRef.current) {
        mainSceneRef.current.remove(mesh);
        playerMeshesRef.current.delete(target.id);
      }

      // Check for match victory
      const allPlayers = Array.from(playersRef.current.values()) as Player[];
      const remainingAlive = allPlayers.filter(p => p.status === 'alive');
      if (remainingAlive.length === 1 && allPlayers.length > 1) {
        const winner = remainingAlive[0];
        // Trigger celebration explosion
        createSpawnExplosion(winner.x, winner.y, winner.z, winner.color, 45);

        onLiveFeedMessage({
          id: Math.random().toString(),
          type: 'system',
          text: `🏆 @${winner.username} MENANGKAN BATTLE ROYALE! (Kills: ${winner.kills})`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });

        if (onWinnerDecided) {
          onWinnerDecided({
            username: winner.username,
            color: winner.color,
            kills: winner.kills
          });
        }

        // Auto restart the match after a 5 second celebration delay to keep stream moving!
        setTimeout(() => {
          const currentAlive = (Array.from(playersRef.current.values()) as Player[]).filter(p => p.status === 'alive');
          if (currentAlive.length === 1 && currentAlive[0].id === winner.id) {
            const refObj = (ref as any)?.current;
            if (refObj && refObj.resetGame) {
              refObj.resetGame();
            }
          }
        }, 5000);
      }
    }
  };

  // TAPs Floating up
  useEffect(() => {
    if (tapHearts.length === 0) return;
    const timer = setTimeout(() => {
      setTapHearts(prev => prev.filter(t => Date.now() - parseFloat(t.id) < 2000));
    }, 100);
    return () => clearTimeout(timer);
  }, [tapHearts]);

  // Main game tick: Three.js Setup & Simulation Logic loop
  useEffect(() => {
    // Detect stream mode for performance optimization
    const urlParams = new URLSearchParams(window.location.search);
    const isStreamMode = urlParams.get('stream') === 'true';

    // 1. Scene Construction
    const scene = new THREE.Scene();
    mainSceneRef.current = scene;

    // Outer Space sky color slate dark glow
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);

    // 2. Camera Setup (Fixed Orthographic looking down - ideal view for portrait stream streaming)
    const camera = new THREE.PerspectiveCamera(45, (canvasRef.current?.clientWidth || 360) / (canvasRef.current?.clientHeight || 640), 0.1, 1000);
    camera.position.set(0, 32, 28);
    camera.lookAt(0, 0, 0);
    mainCameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      antialias: !isStreamMode, // Disable antialias in stream mode to save CPU
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);

    // Reduce pixel ratio in stream mode (1.0 is enough for software rendering)
    renderer.setPixelRatio(isStreamMode ? 1.0 : Math.min(window.devicePixelRatio, 2));

    // Disable shadows in stream mode - huge CPU boost!
    renderer.shadowMap.enabled = !isStreamMode;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mainRendererRef.current = renderer;
    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Diubah jadi lebih terang (putih dengan intensitas 2.0)
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0x8B5CF6, 4.0); // Diterangkan intensitasnya menjadi 4.0
    dirLight.position.set(15, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Subtle blue spotlight to center
    const spotlight = new THREE.SpotLight(0x25f4ee, 5, 50, Math.PI / 4, 0.5, 1);
    spotlight.position.set(0, 25, 0);
    spotlight.target.position.set(0, 0, 0);
    scene.add(spotlight);
    spotlightRef.current = spotlight;

    // Secondary directional light (hot neon pink/purple color contrast)
    const dirLight2 = new THREE.DirectionalLight(0xEC4899, 1.8);
    dirLight2.position.set(-20, 25, -15);
    scene.add(dirLight2);

    // Moving Neon PointLight
    const movingLightColor = 0xF59E0B; // Start with gold
    const movingLight = new THREE.PointLight(movingLightColor, 8, 30);
    movingLight.position.set(0, 4, 0);
    scene.add(movingLight);
    movingPointLightRef.current = movingLight;

    // A beautiful glowing orb mesh representing the source of the moving light
    const orbGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const orbMat = new THREE.MeshBasicMaterial({
      color: movingLightColor
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(0, 4, 0);
    scene.add(orb);
    movingLightOrbRef.current = orb;

    // Initial random target for the moving light
    movingLightTargetRef.current = {
      x: (Math.random() - 0.5) * 50,
      z: (Math.random() - 0.5) * 50
    };

    // Initialize Weather Effects
    initRain(scene);
    initTornado(scene);

    // 5. Grid/Floor styling
    const arenaRadius = 40;
    const floorGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius + 1, 1, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.9
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);
    arenaFloorMeshRef.current = floor;

    // Glowing Neon Grid overlay via grid helper
    const gridHelper = new THREE.GridHelper(80, 40, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Apply default procedural theme on startup
    applyFloorTheme('scifi');

    // Safe Zone Ring (border ring)
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta), 0.05, Math.sin(theta)));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xff3b30,
      linewidth: 3 // won't work in most browsers, but we will scale it
    });
    const safeZoneRing = new THREE.LineLoop(ringGeo, ringMat);
    scene.add(safeZoneRing);
    safeZoneRingMeshRef.current = safeZoneRing;

    // Pulse red floor glow for border
    const pulseGeo = new THREE.RingGeometry(39, 40, 32);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
    pulseRing.rotation.x = Math.PI / 2;
    pulseRing.position.y = 0.02;
    scene.add(pulseRing);
    safeZonePulseMeshRef.current = pulseRing;

    // Obstacles decoration
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 20;
      const ox = Math.cos(ang) * d;
      const oz = Math.sin(ang) * d;
      
      const obGeo = new THREE.CylinderGeometry(0.8, 1.2, 3 + Math.random() * 3, 6);
      const obMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.3 });
      const ob = new THREE.Mesh(obGeo, obMat);
      ob.position.set(ox, 1.5, oz);
      ob.castShadow = true;
      ob.receiveShadow = true;
      scene.add(ob);
      obstaclesRef.current.push(ob);
    }

    // 6. ANIMATION & PHYSICS loop
    let animeFrameId: number;
    let lastTime = performance.now();

    // ==================== BOSS SYSTEM ====================

    // ==================== BOSS SPECIAL ATTACK PATTERNS ====================

    // 🔴 KRAKEN: Laser Beam - sweeping beam
    const executeLaserBeam = (boss: any, players: any[]) => {
      playBossLaserSound();
      const beamLength = 25;
      const beamGeo = new THREE.BoxGeometry(beamLength, 0.5, 1);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0.7 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      const rad = boss.laserAngle || 0;
      beam.position.set(boss.x + Math.sin(rad) * beamLength / 2, 0.5, boss.z + Math.cos(rad) * beamLength / 2);
      beam.rotation.y = -rad;
      scene.add(beam);
      // Heatwave particles along beam
      for (let i = 0; i < 6; i++) {
        const t = (i / 5) * beamLength;
        createSpawnExplosion(boss.x + Math.sin(rad) * t, 0, boss.z + Math.cos(rad) * t, '#EF4444', 3);
      }
      // Damage players hit by beam (Reduced to prevent instant elimination)
      const dmg = boss.phase >= 3 ? 10 : boss.phase >= 2 ? 8 : 6;
      players.forEach((target: any) => {
        if (target.status === 'dead') return;
        const dx = target.x - boss.x;
        const dz = target.z - boss.z;
        const angleToTarget = Math.atan2(dx, dz);
        const angleDiff = Math.abs(normalizeAngle(angleToTarget - rad));
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (angleDiff < 0.4 && dist < beamLength) {
          damagePlayer(target, dmg, boss.name);
          
          triggerScreenShake(3);
        }
      });
      setTimeout(() => { scene.remove(beam); }, 500);
      boss.laserAngle = (boss.laserAngle || 0) + 0.3;
    };

    /** Normalize angle to -PI..PI */
    const normalizeAngle = (a: number) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };

    // 🟣 CYBER DRAGON: Ground Pound - AOE shockwave
    const executeGroundPound = (boss: any, players: any[]) => {
      playBossPoundSound();
      const radius = boss.phase >= 3 ? 12 : boss.phase >= 2 ? 10 : 8;
      // Reduced damage to prevent instant elimination
      const dmg = boss.phase >= 3 ? 10 : boss.phase >= 2 ? 8 : 5;
      // Expanding ring visual
      for (let ri = 0; ri < 4; ri++) {
        setTimeout(() => {
          createShockwaveRing(2 + ri * 2.5, boss.x, boss.z, '#A855F7');
        }, ri * 100);
      }
      // Ground crackle particles
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const dist = 2 + Math.random() * radius;
        setTimeout(() => {
          createSpawnExplosion(boss.x + Math.cos(ang) * dist, 0, boss.z + Math.sin(ang) * dist, '#A855F7', 4);
        }, 100 + Math.random() * 200);
      }
      // Damage + shake
      triggerScreenShake(2);
      players.forEach((target: any) => {
        if (target.status === 'dead') return;
        const dx = target.x - boss.x;
        const dz = target.z - boss.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < radius) {
          const falloff = 1 - (dist / radius);
          damagePlayer(target, Math.floor(dmg * falloff), boss.name);
          
        }
      });
    };

    // 🟡 TITAN: Summon Minion
    const executeSummonMinion = (boss: any, players: any[]) => {
      playBossSummonSound();
      const count = boss.phase >= 3 ? 3 : 2;
      boss.summonCount = (boss.summonCount || 0) + count;
      // Golden portal flash
      createSpawnExplosion(boss.x, 0, boss.z, '#F59E0B', 20);
      triggerScreenShake(2);
      for (let mi = 0; mi < count; mi++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 2;
        const mx = boss.x + Math.cos(ang) * dist;
        const mz = boss.z + Math.sin(ang) * dist;
        const minion: Minion = {
          id: 'minion_' + Date.now() + '_' + mi,
          x: mx, z: mz,
          // Lower HP and speed to balance gameplay
          hp: boss.phase >= 3 ? 20 : 15,
          maxHp: boss.phase >= 3 ? 20 : 15,
          size: 0.6,
          color: '#F59E0B',
          speed: boss.phase >= 3 ? 3.5 : 2.5,
          targetX: 0, targetZ: 0,
          lastAttackTime: 0
        };
        minionsRef.current.push(minion);
        // Create 3D mesh
        const bodyGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, emissive: 0xF59E0B, emissiveIntensity: 0.5 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(mx, 0.3, mz);
        const ringGeo = new THREE.TorusGeometry(0.4, 0.04, 4, 8);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, emissive: 0xF59E0B, emissiveIntensity: 1 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.set(mx, 0.6, mz);
        scene.add(bodyMesh);
        scene.add(ringMesh);
        minionMeshesRef.current.set(minion.id, bodyMesh);
        minionMeshesRef.current.set(minion.id + '_ring', ringMesh);
        createSpawnExplosion(mx, 0, mz, '#F59E0B', 6);
      }
    };

    // 🔵 RAJA GANGSING: Vortex Spin - pull + damage
    const executeVortexSpin = (boss: any, players: any[]) => {
      playBossVortexSound();
      boss.vortexTimer = 3;
      const radius = boss.phase >= 3 ? 14 : 11;
      // Reduced damage to prevent instant elimination
      const dmg = boss.phase >= 3 ? 8 : 5;
      triggerScreenShake(4);
      // Cyclone spiral particles
      for (let ci = 0; ci < 24; ci++) {
        const t = ci / 24;
        const ang = t * Math.PI * 8;
        const dist = t * radius;
        setTimeout(() => {
          createSpawnExplosion(boss.x + Math.cos(ang) * dist, 0.5, boss.z + Math.sin(ang) * dist, '#3B82F6', 3);
        }, ci * 60);
      }
      // Pull indicator rings
      for (let ri = 0; ri < 3; ri++) {
        setTimeout(() => {
          createShockwaveRing((ri + 1) * 3, boss.x, boss.z, '#3B82F6');
        }, ri * 300);
      }
      // Pull players + damage
      players.forEach((target: any) => {
        if (target.status === 'dead') return;
        const dx = target.x - boss.x;
        const dz = target.z - boss.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < radius) {
          // Pull toward boss
          target.x -= (dx / dist) * 0.8;
          target.z -= (dz / dist) * 0.8;
          damagePlayer(target, dmg, boss.name);
          
        }
      });
    };

    // 🟢 MECHA MONSTER: Missile Barrage
    const executeMissileBarrage = (boss: any, players: any[]) => {
      playBossMissileSound();
      const count = boss.phase >= 3 ? 5 : boss.phase >= 2 ? 4 : 3;
      // Reduced damage to prevent instant elimination
      const dmg = boss.phase >= 3 ? 10 : boss.phase >= 2 ? 8 : 6;
      const aliveTargets = players.filter((p: any) => p.status === 'alive');
      const targetCount = Math.min(count, aliveTargets.length);
      for (let mi = 0; mi < targetCount; mi++) {
        const target = aliveTargets[mi];
        // Create missile mesh
        const missileGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const missileMat = new THREE.MeshBasicMaterial({ color: 0x22C55E });
        const missile = new THREE.Mesh(missileGeo, missileMat);
        missile.position.set(boss.x + (Math.random() - 0.5) * 2, 3, boss.z + (Math.random() - 0.5) * 2);
        scene.add(missile);
        // Animate missile toward target
        let missileLife = 0;
        const missileInterval = setInterval(() => {
          missileLife += 0.05;
          if (missileLife > 4) {
            clearInterval(missileInterval);
            scene.remove(missile);
            return;
          }
          // Move toward target
          const tdx = target.x - missile.position.x;
          const tdz = target.z - missile.position.z;
          const tdist = Math.sqrt(tdx*tdx + tdz*tdz);
          if (tdist > 0.3) {
            missile.position.x += (tdx / tdist) * 0.4;
            missile.position.z += (tdz / tdist) * 0.4;
          }
          // Green trail smoke
          if (Math.random() < 0.5) {
            createSpawnExplosion(missile.position.x, 0, missile.position.z, '#22C55E', 2);
          }
          // Check hit
          if (tdist < 1.2 && target.status === 'alive') {
            clearInterval(missileInterval);
            scene.remove(missile);
            damagePlayer(target, dmg, boss.name);
            
            createSpawnExplosion(target.x, 0, target.z, '#22C55E', 10);
            triggerScreenShake(3);
          }
        }, 50);
      }
      
    };

    /** Spawn a random boss if none exist */
    const spawnBoss = () => {
      if (bossRef.current && bossRef.current.alive) return;
      if (playersRef.current.size < 3) return;
      const bossNames = ['KRAKEN', 'CYBER DRAGON', 'TITAN', 'RAJA GANGSING', 'MECHA MONSTER'];
      const bossPatterns: BossAttackPattern[] = ['laser_beam', 'ground_pound', 'summon_minion', 'vortex_spin', 'missile_barrage'];
      const bossColors = ['#EF4444', '#A855F7', '#F59E0B', '#3B82F6', '#22C55E'];
      const bossSizes = [2.0, 2.2, 2.5, 1.8, 2.3];
      const bossHps = [800, 1000, 1400, 700, 1600];
      const idx = Math.floor(Math.random() * bossNames.length);
      const ang = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 15;
      const now = Date.now();
      const boss: Boss = {
        id: 'boss_' + now,
        name: bossNames[idx],
        hp: bossHps[idx],
        maxHp: bossHps[idx],
        shield: 200,
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        y: 0,
        size: bossSizes[idx],
        phase: 1,
        color: bossColors[idx],
        alive: true,
        spawnTime: now,
        lastAttackTime: 0,
        targetX: 0,
        targetZ: 0,
        attackPattern: bossPatterns[idx],
        lastSpecialAttack: 0
      };
      bossRef.current = boss;
      // Create 3D boss mesh - giant spinning top
      const bossGroup = new THREE.Group();
      bossGroup.position.set(boss.x, 0, boss.z);
      const bodyGeo2 = new THREE.CylinderGeometry(boss.size * 0.8, boss.size, boss.size * 1.5, 8);
      const bodyMat2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(boss.color), emissive: new THREE.Color(boss.color), emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2 });
      const bodyMesh2 = new THREE.Mesh(bodyGeo2, bodyMat2);
      bodyMesh2.position.y = boss.size * 0.75;
      bodyMesh2.castShadow = true;
      bossGroup.add(bodyMesh2);
      // Crown ring
      const crownGeo = new THREE.TorusGeometry(boss.size * 0.9, 0.12, 8, 16);
      const crownMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(boss.color), emissive: new THREE.Color(boss.color), emissiveIntensity: 1.5 });
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.rotation.x = Math.PI / 2;
      crownMesh.position.y = boss.size * 1.5;
      bossGroup.add(crownMesh);
      // Eye glow
      const eyeGeo = new THREE.SphereGeometry(0.3, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
      eyeMesh.position.set(0, boss.size * 0.8, boss.size * 0.65);
      bossGroup.add(eyeMesh);
      scene.add(bossGroup);
      bossMeshRef.current = bossGroup;
      createSpawnExplosion(boss.x, 0, boss.z, boss.color, 30);
      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'system',
        text: '🐉 BOSS ' + boss.name + ' muncul di arena! Kalahkan dia untuk hadiah!' ,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    };

    const animate = () => {

      animeFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Pulse the safe zone boundary ring
      if (safeZonePulseMeshRef.current) {
        const timeFactor = now * 0.003;
        const scale = safeZoneRadiusRef.current;
        safeZonePulseMeshRef.current.scale.set(scale, scale, 1);
        safeZonePulseMeshRef.current.material.opacity = 0.15 + Math.sin(timeFactor) * 0.1;
      }
      if (safeZoneRingMeshRef.current) {
        safeZoneRingMeshRef.current.scale.set(safeZoneRadiusRef.current, 1, safeZoneRadiusRef.current);
      }

      // Oscillate safe zone between 10 and 200
      const SAFE_ZONE_MIN = 10;
      const SAFE_ZONE_MAX = 40;
      const safeZoneSpeed = 0.01; // units per second (sedang)
      safeZoneRadiusRef.current += safeZoneDirectionRef.current * safeZoneSpeed * delta;
      if (safeZoneRadiusRef.current <= SAFE_ZONE_MIN) {
        safeZoneRadiusRef.current = SAFE_ZONE_MIN;
        safeZoneDirectionRef.current = 1; // start expanding
      } else if (safeZoneRadiusRef.current >= SAFE_ZONE_MAX) {
        safeZoneRadiusRef.current = SAFE_ZONE_MAX;
        safeZoneDirectionRef.current = -1; // start shrinking
      }
      setSafeZoneRadius(safeZoneRadiusRef.current);
      onSafeZoneUpdate?.(safeZoneRadiusRef.current);

      // Animate Moving Neon PointLight (Random target walk with RGB cycling)
      if (movingPointLightRef.current && movingLightOrbRef.current) {
        const light = movingPointLightRef.current;
        const orb = movingLightOrbRef.current;
        const target = movingLightTargetRef.current;

        const dx = target.x - light.position.x;
        const dz = target.z - light.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // If close to target, pick a new random target within the arena
        if (dist < 1.0) {
          const ang = Math.random() * Math.PI * 2;
          const r = 5 + Math.random() * 30; // keep inside arena bounds
          target.x = Math.cos(ang) * r;
          target.z = Math.sin(ang) * r;
        } else {
          // Move towards target smoothly
          const speed = 7.0; // units per second
          light.position.x += (dx / dist) * speed * delta;
          light.position.z += (dz / dist) * speed * delta;
          
          // Hover height oscillates gently
          light.position.y = 3.5 + Math.sin(now * 0.0015) * 1.2;

          // Sync orb mesh position with light source
          orb.position.copy(light.position);
          
          // Smooth RGB color cycle over time
          const hue = (now * 0.02) % 360;
          const nextColor = new THREE.Color(`hsl(${hue}, 95%, 60%)`);
          light.color.copy(nextColor);
          if (orb.material) {
            (orb.material as THREE.MeshBasicMaterial).color.copy(nextColor);
          }
        }
      }

      // Process Projectile animations
      const activeProj = projectileRef.current;
      for (let i = activeProj.length - 1; i >= 0; i--) {
        const proj = activeProj[i];
        const dir = new THREE.Vector3(proj.targetX - proj.mesh.position.x, 0, proj.targetZ - proj.mesh.position.z).normalize();
        proj.mesh.position.addScaledVector(dir, proj.speed);

        // Check bounds or lifespan
        const travelDist = Math.sqrt(Math.pow(proj.mesh.position.x - proj.targetX, 2) + Math.pow(proj.mesh.position.z - proj.targetZ, 2));
        
        let hit = false;
        playersRef.current.forEach(target => {
          if (hit || target.status === 'dead' || target.username === proj.owner) return;
          const distToProj = Math.sqrt(Math.pow(proj.mesh.position.x - target.x, 2) + Math.pow(proj.mesh.position.z - target.z, 2));
          if (distToProj < 1.2 * target.size) {
            damagePlayer(target, proj.damage, proj.owner);
            hit = true;
          }
        });

        if (travelDist < 1.0 || hit) {
          scene.remove(proj.mesh);
          activeProj.splice(i, 1);
        }
      }

      // Weather: rain animation update
      if (currentWeatherRef.current === 'hujan' && rainRef.current && rainRef.current.visible) {
        const positions = rainRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= delta * 35; // fall speed
          if (positions[i] < 0) {
            positions[i] = 30 + Math.random() * 5; // wrap to top
          }
        }
        rainRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Weather: tornado movement and suction update
      if (currentWeatherRef.current === 'badai' && tornadoMeshRef.current && tornadoMeshRef.current.visible) {
        const t = tornadoPosRef.current;
        t.x += t.vx * (delta * 60);
        t.z += t.vz * (delta * 60);
        
        // Bounce off bounds
        const dist = Math.sqrt(t.x * t.x + t.z * t.z);
        if (dist > 35) {
          const nx = -t.x / dist;
          const nz = -t.z / dist;
          const dot = t.vx * nx + t.vz * nz;
          t.vx = t.vx - 2 * dot * nx;
          t.vz = t.vz - 2 * dot * nz;
          t.x = nx * -34.5;
          t.z = nz * -34.5;
        }
        
        tornadoMeshRef.current.position.set(t.x, 0.1, t.z);
        
        // Spin layers
        tornadoMeshRef.current.children.forEach((child, idx) => {
          child.rotation.z += (0.05 + idx * 0.01) * (delta * 60);
        });
        
        // Apply wind suction/forces on alive players
        const listPlayersTemp = Array.from(playersRef.current.values()) as Player[];
        listPlayersTemp.forEach((pl) => {
          if (pl.status === 'dead') return;
          const dx = pl.x - t.x;
          const dz = pl.z - t.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 7) {
            const force = (7 - d) * 2.5;
            const vel = playerVelocitiesRef.current.get(pl.id);
            if (vel) {
              const angle = Math.atan2(dz, dx) + 0.3; // suction + swirl spin!
              vel.vx += Math.cos(angle) * force * delta * 10;
              vel.vz += Math.sin(angle) * force * delta * 10;
            }
            pl.hp = Math.max(1, pl.hp - 1.5 * delta); // environmental friction
            
            if (Math.random() < 0.05) {
              addFloatingCombatText('🌪️ BADAI!', pl.x, pl.y + 1, pl.z, '#ef4444');
            }
          }
        });
      }

      // Process Particles life
      const activePart = particlesRef.current;
      for (let i = activePart.length - 1; i >= 0; i--) {
        const p = activePart[i];
        p.life -= delta * 1.5;

        // Apply physics move
        const posAttr = p.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr) {
          const arr = posAttr.array as Float32Array;
          for (let j = 0; j < arr.length / 3; j++) {
            // Apply velocity
            const vel = p.velocity[j];
            arr[j * 3] += vel.x * delta;
            arr[j * 3 + 1] += vel.y * delta;
            arr[j * 3 + 2] += vel.z * delta;

            // Apply gravity
            vel.y -= 9.8 * delta;
          }
          posAttr.needsUpdate = true;
        }

        p.mesh.material.opacity = p.life;

        if (p.life <= 0) {
          scene.remove(p.mesh);
          activePart.splice(i, 1);
        }
      }

      // Animate glass shards (pecahan kaca)
      const activeShards = glassShardsRef.current;
      for (let si = activeShards.length - 1; si >= 0; si--) {
        const s = activeShards[si];
        s.life -= delta / s.maxLife;
        s.mesh.position.x += s.vx * delta;
        s.mesh.position.y += s.vy * delta;
        s.mesh.position.z += s.vz * delta;
        s.vy -= 9.8 * delta; // gravity
        s.mesh.rotation.x += s.rotX * delta;
        s.mesh.rotation.y += s.rotY * delta;
        s.mesh.rotation.z += s.rotZ * delta;
        (s.mesh.material as THREE.Material).opacity = Math.max(0, s.life);
        if (s.life <= 0 || s.mesh.position.y < -2) {
          scene.remove(s.mesh);
          activeShards.splice(si, 1);
        }
      }

      // Dynamic Airdrop Spawn Logic (Affected by Safe Zone)
      airdropSpawnTimerRef.current += delta;
      const currentRadius = safeZoneRadiusRef.current;
      const radiusPercent = (currentRadius - 10) / 100; // 0 (min 10) to 1 (max 110)
      
      // Semakin besar Safe Zone (radiusPercent -> 1), semakin cepat intervalnya
      // Interval: 4 detik (saat radius max) sampai 15 detik (saat radius min)
      const dynamicSpawnInterval = 15 - (radiusPercent * 11);
      
      // Semakin besar Safe Zone, semakin banyak jumlah airdrop maksimal di arena
      // Max Cap: 2 (saat min) sampai 8 (saat max)
      const dynamicMaxAirdrops = Math.floor(2 + radiusPercent * 6);

      if (airdropSpawnTimerRef.current >= dynamicSpawnInterval) {
        airdropSpawnTimerRef.current = 0;
        if (playersRef.current.size > 0 && airdropsRef.current.length < dynamicMaxAirdrops) {
          spawnRandomAirdrop();
        }
      }

      // Sync Airdrops falling
      airdropsRef.current.forEach((ad) => {
        if (ad.y > 0.5) {
          ad.y -= delta * 4; // fall rate
          const mesh = airdropMeshesRef.current.get(ad.id);
          if (mesh) {
            mesh.position.y = ad.y;
            // Flare stays grounded
            const flare = mesh.getObjectByName('flare');
            if (flare) flare.position.y = -ad.y + 0.05;
          }
        }
      });

      // 🧊 Update Obstacles (Falling & HP management)
      for (let oi = obstaclesRef.current.length - 1; oi >= 0; oi--) {
        const obs = obstaclesRef.current[oi];
        const data = obs.userData;
        if (!data) continue;
        
        // Handle falling
        if (data.isFalling && obs.position.y > data.baseY) {
          obs.position.y -= delta * 15; // fall speed
          if (obs.position.y <= data.baseY) {
            obs.position.y = data.baseY;
            data.isFalling = false;
            // Impact effect when hitting ground
            createSpawnExplosion(obs.position.x, 0.1, obs.position.z, data.color || '#ffffff', 8);
          }
        }
        
        // Handle destruction if HP is empty
        if (data.hp !== undefined && data.hp <= 0) {
          createImpactExplosion(obs.position.x, obs.position.z, data.color || '#ffffff', '#ffffff', 1.2);
          scene.remove(obs);
          obstaclesRef.current.splice(oi, 1);
        } else if (data.hp !== undefined && data.maxHp !== undefined) {
          // Dynamic color shifting based on HP percentage
          const hpPercent = (data.hp / data.maxHp) * 100;
          let newColor = 0x06B6D4; // Cyan (<= 20%)
          if (hpPercent > 80) newColor = 0xEF4444; // Red
          else if (hpPercent > 60) newColor = 0xF59E0B; // Gold
          else if (hpPercent > 40) newColor = 0x8B5CF6; // Purple
          else if (hpPercent > 20) newColor = 0x3B82F6; // Blue

          if (data.color !== newColor) {
            data.color = newColor;
            obs.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat) {
                  mat.color.setHex(newColor);
                  mat.emissive.setHex(newColor);
                }
              }
            });
          }
        }
      }

      // Build player list for boss/minion processing
      const listPlayers = Array.from(playersRef.current.values()) as Player[];
      const alivePlayers = listPlayers.filter(p => p.status === 'alive');

      // 1. Jika player sisa 1, buat dia full HP agar tidak stag
      if (alivePlayers.length === 1) {
        const lastPlayer = alivePlayers[0];
        if (lastPlayer.hp < lastPlayer.maxHp) {
          lastPlayer.hp = lastPlayer.maxHp;
        }
      }

      // 2. Jika tidak ada player hidup, auto restart
      if (listPlayers.length > 0 && alivePlayers.length === 0 && now - lastResetTimeRef.current > 8000) {
        const refObj = (ref as any)?.current;
        if (refObj && refObj.resetGame) {
          console.log('[Arena] Auto-restarting: no players alive');
          refObj.resetGame();
        }
      }

      // ============ BOSS BEHAVIOR ============
      const boss = bossRef.current;
      if (boss && boss.alive && bossMeshRef.current) {
        // Boss movement - patrol toward random target
        const bTargetX = boss.targetX || 0;
        const bTargetZ = boss.targetZ || 0;
        const bdx = bTargetX - boss.x;
        const bdz = bTargetZ - boss.z;
        const bdist = Math.sqrt(bdx*bdx + bdz*bdz);
        if (bdist < 2 || bdist === 0) {
          // Pick new patrol target
          const ang2 = Math.random() * Math.PI * 2;
          const dist2 = 5 + Math.random() * 10;
          boss.targetX = Math.cos(ang2) * dist2;
          boss.targetZ = Math.sin(ang2) * dist2;
        } else {
          boss.x += (bdx / bdist) * 2 * delta;
          boss.z += (bdz / bdist) * 2 * delta;
        }

        // --- NEW: Collision with physical Obstacles for Boss ---
        obstaclesRef.current.forEach(obs => {
          const dx = boss.x - obs.position.x;
          const dz = boss.z - obs.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const collisionRange = boss.size * 1.5 + 0.5; // Radius tabrakan boss lebih besar
          
          if (dist < collisionRange) {
            // Push boss back slightly
            boss.x += (dx / dist) * 0.3;
            boss.z += (dz / dist) * 0.3;
            boss.targetX = undefined; // trigger path recalculation
            
            // Damage obstacle (Boss is powerful, damages obstacles on touch)
            if (obs.userData && obs.userData.hp !== undefined) {
              const bossDmg = 50 * (boss.phase || 1);
              obs.userData.hp -= bossDmg;
            }
          }
        });

        // Boss attack
        const nowSec = now / 1000;
        const bossMesh = bossMeshRef.current;
        // Spin boss mesh
        bossMesh.rotation.y += delta * 2;
        bossMesh.position.set(boss.x, 0, boss.z);

        // Regular melee attack & PHYSICAL COLLISION
        if (nowSec - boss.lastAttackTime > 0.1) { // Check collision more frequently than attack
          listPlayers.forEach((target: any) => {
            if (target.status === 'dead') return;
            const dx2 = target.x - boss.x;
            const dz2 = target.z - boss.z;
            const dist2 = Math.sqrt(dx2*dx2 + dz2*dz2);
            const collisionDist = boss.size * 2.2;
            
            if (dist2 < collisionDist) {
              // --- 1. Physical Push (Anti-Tembus) ---
              const nx = dx2 / (dist2 || 1);
              const nz = dz2 / (dist2 || 1);
              const pushForce = 0.5 + (boss.phase * 0.2); // Boss pushes harder in later phases
              
              target.x += nx * pushForce;
              target.z += nz * pushForce;
              target.targetX = undefined; // recalculate path
              
              // Boss also gets slightly blocked/pushed back
              boss.x -= nx * 0.05;
              boss.z -= nz * 0.05;

              // --- 2. Regular melee damage (throttle to 1.5s) ---
              if (nowSec - boss.lastAttackTime > 1.5) {
                const meleeDmg = boss.phase >= 3 ? 5 : boss.phase >= 2 ? 4 : 3;
                damagePlayer(target, meleeDmg, boss.name);
                boss.lastAttackTime = nowSec; // Only reset timer if damage actually happened
              }
            }
          });
        }

        // Special attack every 4 seconds
        if (nowSec - boss.lastSpecialAttack > 4) {
          boss.lastSpecialAttack = nowSec;
          switch (boss.attackPattern) {
            case 'laser_beam': executeLaserBeam(boss, listPlayers); break;
            case 'ground_pound': executeGroundPound(boss, listPlayers); break;
            case 'summon_minion': executeSummonMinion(boss, listPlayers); break;
            case 'vortex_spin': executeVortexSpin(boss, listPlayers); break;
            case 'missile_barrage': executeMissileBarrage(boss, listPlayers); break;
          }
          // Phase-up every 3 special attacks
          if (boss.phase < 3 && Math.random() < 0.2) {
            boss.phase += 1;
            
            createSpawnExplosion(boss.x, 0, boss.z, boss.color, 20);
          }
        }

        // ============ PLAYERS DAMAGE BOSS ============
        if (boss.shield > 0) {
          boss.shield -= delta * 5;
          if (boss.shield < 0) boss.shield = 0;
        }
        listPlayers.forEach((attacker: any) => {
          if (attacker.status === 'dead' || attacker.attackCooldown > 0) return;
          const adx = attacker.x - boss.x;
          const adz = attacker.z - boss.z;
          const aDist = Math.sqrt(adx*adx + adz*adz);
          const attackRange = boss.size * 2.5 + 0.5;
          if (aDist < attackRange) {
            // Calculate player damage to boss
            let pDmg = 6;
            if (attacker.weapon === 'sword') pDmg = 12;
            if (attacker.weapon === 'battle_hammer') pDmg = 18;
            if (attacker.weapon === 'golden_lance') pDmg = 22;
            if (attacker.weapon === 'glowing_laser') pDmg = 8;
            pDmg = Math.floor(pDmg * attacker.size);
            // Phase bonus: boss takes less damage in higher phases
            if (boss.phase >= 3) pDmg = Math.floor(pDmg * 0.6);
            else if (boss.phase >= 2) pDmg = Math.floor(pDmg * 0.8);
            // Actually damage the boss
            boss.hp = Math.max(0, boss.hp - pDmg);
            // Track boss damage dealt by this player
            attacker.bossDamageDealt = (attacker.bossDamageDealt || 0) + pDmg;
            // Visual feedback
            
            createSpawnExplosion(boss.x, 0.5, boss.z, boss.color, 2);
            // Cooldown for player's attack on boss
            attacker.attackCooldown = 0.6;
            // Boss death
            if (boss.hp <= 0) {
              boss.alive = false;
              // Find MVP (top damage dealer among alive players)
              let mvpPlayer: any = null;
              let mvpDamage = 0;
              listPlayers.forEach((pl: any) => {
                const plDmg = pl.bossDamageDealt || 0;
                if (plDmg > mvpDamage && pl.status === 'alive') {
                  mvpDamage = plDmg;
                  mvpPlayer = pl;
                }
              });
              // Remove old MVP visuals
              if (mvpPlayerIdRef.current) {
                removeMvpVisuals(mvpPlayerIdRef.current);
                mvpPlayerIdRef.current = null;
              }
              // Award XP to all players who damaged the boss
              const totalBossDmg = boss.maxHp + 200; // shield included
              listPlayers.forEach((pl: any) => {
                const plDmg = pl.bossDamageDealt || 0;
                if (plDmg > 0 && pl.status === 'alive') {
                  const bossXp = Math.floor((plDmg / totalBossDmg) * 500) + 50;
                  awardPlayerXp(pl, bossXp);
                  
                }
              });
              // MVP bonus for top damage dealer
              if (mvpPlayer) {
                const mvpXp = 300;
                awardPlayerXp(mvpPlayer, mvpXp);
                mvpPlayer.hp = mvpPlayer.maxHp; // Full heal
                mvpPlayer.shield = Math.min(100, mvpPlayer.shield + 80); // Massive shield boost
                
                createSpawnExplosion(mvpPlayer.x, 0, mvpPlayer.z, '#FFD700', 25);
                // Apply persistent golden crown + halo aura
                mvpPlayerIdRef.current = mvpPlayer.id;
                addMvpVisuals(mvpPlayer.id);
                // Notify parent about boss MVP
                if (onBossMvpDecided) {
                  onBossMvpDecided({ username: mvpPlayer.username, damage: mvpDamage });
                }
              }
              // Remove boss mesh
              if (bossMeshRef.current) {
                scene.remove(bossMeshRef.current);
                bossMeshRef.current = null;
              }
              // Remove all minions
              minionsRef.current.forEach(m => {
                const dm = minionMeshesRef.current.get(m.id);
                if (dm) scene.remove(dm);
                const dr = minionMeshesRef.current.get(m.id + '_ring');
                if (dr) scene.remove(dr);
              });
              minionMeshesRef.current.clear();
              minionsRef.current = [];
              // Big celebration explosion
              createSpawnExplosion(boss.x, 0, boss.z, '#FFD700', 40);
              // Drop airdrops as rewards
              for (let di = 0; di < 3; di++) {
                setTimeout(() => {
                  spawnRandomAirdrop();
                }, di * 300);
              }
              onLiveFeedMessage({
                id: Math.random().toString(),
                type: 'system',
                text: mvpPlayer 
                  ? '🎉 BOSS ' + boss.name + ' TELAH DIKALAHKAN! 👑 MVP: @' + mvpPlayer.username + ' (+' + mvpDamage + ' damage) — Semua pemain yang memberikan damage mendapat XP besar!'
                  : '🎉 BOSS ' + boss.name + ' TELAH DIKALAHKAN! Semua pemain yang memberikan damage mendapat XP besar!',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              });
              bossRef.current = null;
            }
          }
        });

        // Update boss health UI periodically
        bossRef.current = boss;
      }

      // ============ BATTLE POINTS SYSTEM ============
      // Ensure enough battle points for convergence (max 75% of alive players)
      ensureBattlePoints();
      
      // Animate all active battle point glows
      battlePointsRef.current.forEach(bp => {
        if (!bp.active || !bp.ringMesh) return;
        bp.ringMesh.material.opacity = 0.4 + Math.sin(now * 0.006) * 0.3;
        bp.ringMesh.scale.setScalar(1 + Math.sin(now * 0.004) * 0.2);
        // Auto-expire battle points after 6 seconds to keep them fresh
        if ((now - bp.spawnTime) > 6000) {
          deactivateBattlePoint(bp);
        }
      });
      
      // Periodic BP leader XP reward (every ~8 seconds)
      if (Math.floor(now / 8000) > Math.floor((now - 16.667) / 8000)) {
        let topBpPlayer: Player | null = null;
        let maxBpTime = 0;
        playersRef.current.forEach(pl => {
          if (pl.status === 'alive' && pl.bpTime > maxBpTime) {
            maxBpTime = pl.bpTime;
            topBpPlayer = pl;
          }
        });
        if (topBpPlayer && maxBpTime >= 3) {
          const bpXp = Math.floor(maxBpTime * 2) + 15;
          awardPlayerXp(topBpPlayer, bpXp);
          
        }
        playersRef.current.forEach(pl => { pl.bpTime = 0; });
      }

      // ============ MINION BEHAVIOR ============
      const minionList = minionsRef.current;
      for (let mi = minionList.length - 1; mi >= 0; mi--) {
        const m = minionList[mi];
        // Find closest alive player
        let nearestP: any = null;
        let nearDist = Infinity;
        listPlayers.forEach((target: any) => {
          if (target.status === 'dead') return;
          const dx3 = target.x - m.x;
          const dz3 = target.z - m.z;
          const d3 = dx3*dx3 + dz3*dz3;
          if (d3 < nearDist) {
            nearDist = d3;
            nearestP = target;
          }
        });
        if (!nearestP) continue;
        // Chase nearest player
        const mdx = nearestP.x - m.x;
        const mdz = nearestP.z - m.z;
        const mdist = Math.sqrt(mdx*mdx + mdz*mdz);
        if (mdist > 1.5) {
          m.x += (mdx / mdist) * m.speed * delta;
          m.z += (mdz / mdist) * m.speed * delta;
        }
        // Update mesh
        const mMesh = minionMeshesRef.current.get(m.id);
        if (mMesh) {
          mMesh.position.set(m.x, 0.3, m.z);
          mMesh.rotation.y += delta * 5;
        }
        const rMesh = minionMeshesRef.current.get(m.id + '_ring');
        if (rMesh) rMesh.position.set(m.x, 0.6, m.z);
        // Attack player if close
        if (mdist < 1.5 && (now / 1000) - m.lastAttackTime > 1.5) {
          // Reduced damage from 8 to 2
          damagePlayer(nearestP, 2, 'ENEMY');
          
          createSpawnExplosion(nearestP.x, 0, nearestP.z, '#F59E0B', 4);
          m.lastAttackTime = now / 1000;

          // Apply knockback to player to push them away from minion
          applyKnockback(nearestP, m.x, m.z, 1.2);

          // Push the minion away from player slightly so they don't stay glued
          const pushForce = 2.5;
          m.x -= (mdx / mdist) * pushForce;
          m.z -= (mdz / mdist) * pushForce;
        }
        // Minion death from damage
        if (m.hp <= 0) {
          const deadMesh = minionMeshesRef.current.get(m.id);
          if (deadMesh) scene.remove(deadMesh);
          const deadRing = minionMeshesRef.current.get(m.id + '_ring');
          if (deadRing) scene.remove(deadRing);
          createSpawnExplosion(m.x, 0, m.z, '#F59E0B', 8);
          minionMeshesRef.current.delete(m.id);
          minionMeshesRef.current.delete(m.id + '_ring');
          minionList.splice(mi, 1);
        }
      }

      // Update and animate Players

      const curLabels: typeof floatingLabels = [];

      // Track velocities for parry system — compute movement speed from frame to frame
      listPlayers.forEach((p) => {
        if (p.status === 'dead') {
          playerVelocitiesRef.current.delete(p.id);
          return;
        }

        // Compute velocity from previous frame position delta
        const oldPos = playerVelocitiesRef.current.get(p.id);
        if (oldPos && delta > 0) {
          oldPos.vx = (p.x - oldPos.prevX) / delta;
          oldPos.vz = (p.z - oldPos.prevZ) / delta;
        } else {
          playerVelocitiesRef.current.set(p.id, { vx: 0, vz: 0, prevX: p.x, prevZ: p.z });
        }
        // Save current position as 'previous' for next frame's velocity calc
        const vel = playerVelocitiesRef.current.get(p.id)!;
        vel.prevX = p.x;
        vel.prevZ = p.z;

        // Safe zone tick timer damage
        const distanceFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);
        if (distanceFromCenter > safeZoneRadiusRef.current) {
          p.damageCooldown -= delta;
          if (p.damageCooldown <= 0) {
            damagePlayer(p, 8, 'SAFE_ZONE');
            p.damageCooldown = 0.8; // trigger poison dmg ticks
          }
        }

        // Falling update
        if (p.y > 0.1) {
          p.y = Math.max(0, p.y - delta * 15);
        }

        // Cooldown ticks
        if (p.attackCooldown > 0) p.attackCooldown -= delta;

        // Giga mode timer countdown
        if (p.isGiga && p.gigaTimer && p.gigaTimer > 0) {
          p.gigaTimer -= delta;
          if (p.gigaTimer <= 0) {
            p.isGiga = false;
            // Restore scale mesh size
            const mesh = playerMeshesRef.current.get(p.id);
            if (mesh) mesh.scale.setScalar(p.size);
            addFloatingCombatText('⚠️ GIGA MODE SELESAI!', p.x, p.y + 1, p.z, '#ef4444');
          }
        }

        // Orbital Orbs Power-up tick & logic
        let hasOrbitalOrbs = false;
        if (p.activePowerUps) {
          const nowMs = Date.now();
          p.activePowerUps = p.activePowerUps.filter(pu => {
            const age = (nowMs - pu.startTime) / 1000;
            return age < pu.duration;
          });
          hasOrbitalOrbs = p.activePowerUps.some(pu => pu.type === 'orbital_orbs');
        }

        const pMesh = playerMeshesRef.current.get(p.id);
        if (pMesh) {
          let orbsContainer = pMesh.getObjectByName('orbitalOrbsContainer');
          if (hasOrbitalOrbs) {
            if (!orbsContainer) {
              orbsContainer = new THREE.Group();
              orbsContainer.name = 'orbitalOrbsContainer';
              orbsContainer.position.set(0, 0.4, 0); // hover height
              pMesh.add(orbsContainer);

              // Add 3 glowing mini orbs spinning at a radius of 2.2
              const colors = [0xff00ff, 0x00ffff, 0xffff00]; // magenta, cyan, yellow
              for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const orbGroup = new THREE.Group();
                orbGroup.name = `orbGroup_${i}`;
                orbGroup.position.set(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2);

                const orbGeo = new THREE.SphereGeometry(0.25, 8, 8);
                const orbMat = new THREE.MeshBasicMaterial({ color: colors[i] });
                const orbMesh = new THREE.Mesh(orbGeo, orbMat);
                orbGroup.add(orbMesh);

                const pl = new THREE.PointLight(colors[i], 3, 6);
                orbGroup.add(pl);

                orbsContainer.add(orbGroup);
              }
            }

            // Spin the orbs container rapidly
            orbsContainer.rotation.y += delta * 6;

            // Emit glowing trail particles
            if (Math.random() < 0.2) {
              orbsContainer.children.forEach((orbChild, idx) => {
                const worldPos = new THREE.Vector3();
                orbChild.getWorldPosition(worldPos);
                createSpawnExplosion(worldPos.x, worldPos.y, worldPos.z, idx === 0 ? '#ff00ff' : idx === 1 ? '#00ffff' : '#ffff00', 1);
              });
            }

            // Damage nearby players
            listPlayers.forEach(other => {
              if (other.id === p.id || other.status === 'dead') return;
              const distToOther = Math.sqrt(Math.pow(p.x - other.x, 2) + Math.pow(p.z - other.z, 2));
              if (distToOther < 3.2) {
                const throttleKey = `orb_hit_${p.id}_${other.id}`;
                if (!(p as any)[throttleKey] || (now - (p as any)[throttleKey] > 800)) {
                  (p as any)[throttleKey] = now;
                  damagePlayer(other, 12, `${p.username} (Orb Shield)`);
                  createSpawnExplosion(other.x, other.y, other.z, '#a855f7', 8);
                }
              }
            });

            // Damage boss
            const boss = bossRef.current;
            if (boss && boss.alive) {
              const distToBoss = Math.sqrt(Math.pow(p.x - boss.x, 2) + Math.pow(p.z - boss.z, 2));
              if (distToBoss < boss.size + 2.5) {
                const throttleKey = `orb_hit_${p.id}_boss`;
                if (!(p as any)[throttleKey] || (now - (p as any)[throttleKey] > 800)) {
                  (p as any)[throttleKey] = now;
                  boss.hp = Math.max(0, boss.hp - 20);
                  p.bossDamageDealt = (p.bossDamageDealt || 0) + 20;
                  createSpawnExplosion(boss.x, 0.5, boss.z, '#a855f7', 8);
                }
              }
            }

            // Damage minions
            minionsRef.current.forEach(m => {
              const distToMinion = Math.sqrt(Math.pow(p.x - m.x, 2) + Math.pow(p.z - m.z, 2));
              if (distToMinion < 2.5) {
                const throttleKey = `orb_hit_${p.id}_minion_${m.id}`;
                if (!(p as any)[throttleKey] || (now - (p as any)[throttleKey] > 800)) {
                  (p as any)[throttleKey] = now;
                  m.hp -= 15;
                  createSpawnExplosion(m.x, 0.3, m.z, '#a855f7', 6);
                }
              }
            });

          } else {
            if (orbsContainer) {
              pMesh.remove(orbsContainer);
            }
          }
        }

        // Revenge targeting timer countdown
        if (p.targetPlayerId && p.targetTimer && p.targetTimer > 0) {
          p.targetTimer -= delta;
          if (p.targetTimer <= 0) {
            p.targetPlayerId = undefined;
          }
        }

        // Mental regen — slow recovery over time (3 points/sec, capped at max)
        if (p.mental < p.maxMental) {
          p.mental = Math.min(p.maxMental, p.mental + 3 * delta);
        }

        // Battle Point HP/Shield regen + BP time tracking
        let nearBp = false;
        let bpDist = 999;
        battlePointsRef.current.forEach(bp => {
          if (!bp.active) return;
          const d = Math.sqrt(Math.pow(bp.x - p.x, 2) + Math.pow(bp.z - p.z, 2));
          if (d < bpDist) bpDist = d;
          if (d < 4.0) nearBp = true;
        });
        if (nearBp) {
          // Track cumulative time at battle point
          p.bpTime += delta;
          
          // Heal HP: 3/sec when very close (<2), 1.5/sec at edge (4)
          const healRate = 1.5 + 1.5 * (1 - bpDist / 4.0);
            if (p.hp < p.maxHp) {
              const oldHp = p.hp;
              p.hp = Math.min(p.maxHp, p.hp + healRate * delta);
              // Show heal text only on tick boundaries
              if (Math.floor(oldHp / 5) !== Math.floor(p.hp / 5)) {
                
              }
            }
            // Regen shield: 1/sec when very close, 0.5/sec at edge
            if (p.shield < 100) {
              const oldShield = p.shield;
              p.shield = Math.min(100, p.shield + healRate * 0.4 * delta);
              if (Math.floor(oldShield / 10) !== Math.floor(p.shield / 10)) {
                
              }
            }
        }

        // BOT DECISION FINDER logic
        let bestTargetX = p.targetX ?? p.x;
        let bestTargetZ = p.targetZ ?? p.z;
        let foundMission = false;

        // 0. Revenge targeting check (takes highest priority)
        if (p.targetPlayerId) {
          const targetPlayer = playersRef.current.get(p.targetPlayerId) as Player | undefined;
          if (targetPlayer && targetPlayer.status === 'alive') {
            bestTargetX = targetPlayer.x;
            bestTargetZ = targetPlayer.z;
            foundMission = true;
            
            // Attacking while targeting
            const verifyDist = Math.sqrt(Math.pow(p.x - targetPlayer.x, 2) + Math.pow(p.z - targetPlayer.z, 2));
            if (verifyDist < 4.0 && p.attackCooldown <= 0) {
              executeAttack(p, targetPlayer);
            }
            if (Math.random() < 0.15) {
              createSpawnExplosion(p.x, p.y, p.z, '#ef4444', 1); // red trailing sparks
            }
            
            p.targetX = bestTargetX;
            p.targetZ = bestTargetZ;
          } else {
            p.targetPlayerId = undefined;
          }
        }

        // If not moving or target reached, and no revenge mission active
        const targetX = p.targetX ?? p.x;
        const targetZ = p.targetZ ?? p.z;
        const targetDistSq = Math.pow(targetX - p.x, 2) + Math.pow(targetZ - p.z, 2);

        if (!foundMission && (targetDistSq < 1.2 || p.targetX === undefined)) {
          // Choose mission
          let bestTargetX = 0;
          let bestTargetZ = 0;
          let foundMission = false;

          // 1. Chase closest falling airdrop box
          if (airdropsRef.current.length > 0) {
            let closeAdDist = Infinity;
            let targetAdIdx = -1;
            airdropsRef.current.forEach((ad, idx) => {
              const d = Math.pow(ad.x - p.x, 2) + Math.pow(ad.z - p.z, 2);
              if (d < closeAdDist) {
                closeAdDist = d;
                targetAdIdx = idx;
              }
            });

            if (targetAdIdx !== -1) {
              const ad = airdropsRef.current[targetAdIdx];
              bestTargetX = ad.x;
              bestTargetZ = ad.z;
              foundMission = true;

              // If close enough AND near ground, claim it!
              if (closeAdDist < 1.8 && ad.y <= 0.5) {
                awardPlayerXp(p, 80); // Award XP for getting the drop
                if (ad.type === 'health_crate') {
                  p.hp = Math.min(p.maxHp, p.hp + 50);
                  createHealParticle(p.x, p.z, '#10B981');
                } else if (ad.type === 'shield_crate') {
                  p.shield = Math.min(100, p.shield + 60);
                  createHealParticle(p.x, p.z, '#3b82f6');
                } else if (ad.type === 'bomb_prank') {
                  // Bomb Prank Zonk! Deducts 30 HP (keeps at least 1 HP to not insta-kill), applies strong physical push back, and shows floating text.
                  p.hp = Math.max(1, p.hp - 30);
                  
                  // Apply physical push back away from the box center
                  const vel = playerVelocitiesRef.current.get(p.id);
                  if (vel) {
                    const angle = Math.random() * Math.PI * 2;
                    vel.vx += Math.cos(angle) * 22; // strong kickback velocity
                    vel.vz += Math.sin(angle) * 22;
                  }
                  
                  // Spawn red explosion particle dust
                  createSpawnExplosion(p.x, p.y, p.z, '#ef4444', 20);
                  addFloatingCombatText('💥 ZONK: BOM! (-30 HP)', p.x, p.y + 1.5, p.z, '#ef4444');
                } else if (ad.type === 'orbital_orbs') {
                  // Apply active power-up for 75 seconds
                  const powerUp: ActivePowerUp = {
                    type: 'orbital_orbs',
                    startTime: Date.now(),
                    duration: 75
                  };
                  p.activePowerUps = p.activePowerUps || [];
                  p.activePowerUps.push(powerUp);

                  // Purple particle burst
                  createSpawnExplosion(p.x, p.y, p.z, '#a855f7', 20);
                  addFloatingCombatText('🔮 SPECIAL: ORB SHIELD! (75 Detik)', p.x, p.y + 1.8, p.z, '#a855f7');
                } else if (ad.type === 'gold_crate') {
                  // Gold Jackpot! Award extra XP and bonus points
                  awardPlayerXp(p, 150);
                  p.score += 100;
                  
                  // Gold particle burst
                  createSpawnExplosion(p.x, p.y, p.z, '#eab308', 18);
                  addFloatingCombatText('⭐ GOLD JACKPOT! (+100 Poin)', p.x, p.y + 1.5, p.z, '#eab308');
                } else if (ad.type === 'music_crate') {
                  // Music Crate -> Trigger onMusicAirdropTriggered to send webspy request
                  awardPlayerXp(p, 100);
                  createSpawnExplosion(p.x, p.y, p.z, '#ec4899', 18);
                  addFloatingCombatText('🎵 MUSIC REQUESTED!', p.x, p.y + 1.5, p.z, '#ec4899');
                  if (onMusicAirdropTriggered) onMusicAirdropTriggered();
                } else {
                  // weapon update
                  const weapons: WeaponType[] = ['sword', 'glowing_laser', 'battle_hammer', 'golden_lance'];
                  p.weapon = weapons[Math.floor(Math.random() * weapons.length)];
                  updateWeaponMesh(p);
                }

                // Remove airdrop
                const mesh = airdropMeshesRef.current.get(ad.id);
                if (mesh) scene.remove(mesh);
                airdropsRef.current.splice(targetAdIdx, 1);
                airdropMeshesRef.current.delete(ad.id);
                p.targetX = undefined;
                foundMission = false;
              }
            }
          }

          // 2. If no airdrop, head toward nearest active battle point
          let nearestBpX = 0, nearestBpZ = 0, nearestBpDist = Infinity;
          if (!foundMission) {
            battlePointsRef.current.forEach(bp => {
              if (!bp.active) return;
              const d = Math.sqrt(Math.pow(bp.x - p.x, 2) + Math.pow(bp.z - p.z, 2));
              if (d < nearestBpDist) {
                nearestBpDist = d;
                nearestBpX = bp.x;
                nearestBpZ = bp.z;
              }
            });
            if (nearestBpDist < Infinity && nearestBpDist > 1.5) {
              bestTargetX = nearestBpX;
              bestTargetZ = nearestBpZ;
              foundMission = true;
            } else {
              // Already at battle point — look for enemies nearby
            }
          }

          // 3. Otherwise seek closest alive enemy
          if (!foundMission) {
            let closeEnemyDist = Infinity;
            let closestEnemy: Player | null = null;
            
            listPlayers.forEach((other) => {
              if (other.id === p.id || other.status === 'dead') return;
              const d = Math.pow(other.x - p.x, 2) + Math.pow(other.z - p.z, 2);
              if (d < closeEnemyDist) {
                closeEnemyDist = d;
                closestEnemy = other;
              }
            });

            if (closestEnemy) {
              const enemy = closestEnemy as Player;
              bestTargetX = enemy.x;
              bestTargetZ = enemy.z;
              foundMission = true;

              // Attack trigger space
              if (closeEnemyDist < 4.0 && p.attackCooldown <= 0) {
                executeAttack(p, enemy);
              }
            }
          }

          // 4. Fallback to center zone
          if (!foundMission) {
            bestTargetX = (Math.random() - 0.5) * (safeZoneRadiusRef.current * 0.5);
            bestTargetZ = (Math.random() - 0.5) * (safeZoneRadiusRef.current * 0.5);
          }
          // Store targets with safety bounds inside safeZone circle
          const distCenter = Math.sqrt(bestTargetX * bestTargetX + bestTargetZ * bestTargetZ);
          if (distCenter > safeZoneRadiusRef.current) {
            const ratio = safeZoneRadiusRef.current / distCenter;
            bestTargetX *= ratio * 0.9;
            bestTargetZ *= ratio * 0.9;
          }

          p.targetX = bestTargetX;
          p.targetZ = bestTargetZ;
        }

        // Apply position motion
        if (p.targetX !== undefined && p.targetZ !== undefined) {
          const dx = p.targetX - p.x;
          const dz = p.targetZ - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist > 0.1) {
            const movementSpeed = p.weapon === 'glowing_laser' ? 5.5 : 4.0;
            let moveX = dx / dist;
            let moveZ = dz / dist;

            // If raining, apply a slippery drift inertia
            if (currentWeatherRef.current === 'hujan') {
              const oldVel = playerVelocitiesRef.current.get(p.id);
              if (oldVel) {
                const oldSpeed = Math.sqrt(oldVel.vx * oldVel.vx + oldVel.vz * oldVel.vz);
                if (oldSpeed > 0.1) {
                  // Mix 30% target direction with 70% previous drift momentum
                  moveX = moveX * 0.3 + (oldVel.vx / oldSpeed) * 0.7;
                  moveZ = moveZ * 0.3 + (oldVel.vz / oldSpeed) * 0.7;
                }
              }
            }

            p.x += moveX * movementSpeed * delta;
            p.z += moveZ * movementSpeed * delta;

            // Rotate mesh to face direction
            const mesh = playerMeshesRef.current.get(p.id);
            if (mesh) {
              const angle = Math.atan2(dx, dz);
              mesh.rotation.y = angle;
            }
          }
        }

        // Continually update player 3D mesh rendering position & animations
        const mesh = playerMeshesRef.current.get(p.id);
        if (mesh) {
          mesh.position.set(p.x, p.y, p.z);

          // Update scale dynamically for Giga-mode Gifter top
          const targetScale = p.isGiga ? 2.5 : (p.size || 1.0);
          mesh.scale.setScalar(targetScale);

          // Giga mode rainbow sparks particles glow
          if (p.isGiga && Math.random() < 0.25) {
            const rainbowColors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#5856d6'];
            const rColor = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
            createHealParticle(p.x, p.z, rColor);
          }

          // Spin the hover-field disk
          const hoverRing = mesh.getObjectByName('hoverRing');
          if (hoverRing) {
            hoverRing.rotation.z += delta * 6;
          }

          // Spin the main top body extremely fast
          const spinningBody = mesh.getObjectByName('spinningBody');
          if (spinningBody) {
            spinningBody.rotation.y += delta * 18;
          }

          // Orbit the companion drone around the head
          const companion = mesh.getObjectByName('companion');
          if (companion) {
            companion.rotation.y += delta * 3;
            const droneContainer = companion.children[0];
            if (droneContainer) {
              droneContainer.position.y = Math.sin(Date.now() * 0.005) * 0.12 * p.size;
            }
          }

          // MVP crown + halo animation
          if (p.isMvp) {
            const crown = mesh.getObjectByName('mvpCrown') as THREE.Group;
            if (crown) {
              crown.rotation.y += delta * 4; // Spin crown
              crown.position.y = Math.sin(Date.now() * 0.004) * 0.06 * p.size; // Hover bob
            }
            const halo = mesh.getObjectByName('mvpHalo') as THREE.Group;
            if (halo) {
              halo.rotation.y += delta * 2; // Slow rotate
              halo.rotation.x = Math.PI / 2 + Math.sin(Date.now() * 0.003) * 0.05; // Tilt wobble
              // Pulse opacity on children
              halo.children.forEach(c => {
                const mat = (c as THREE.Mesh).material as THREE.Material;
                if (mat) {
                  mat.opacity = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
                }
              });
            }
            const stars = mesh.getObjectByName('mvpStars') as THREE.Group;
            if (stars) {
              stars.rotation.y += delta * 6; // Fast orbit
              stars.rotation.x += delta * 0.5; // Slight wobble
            }
          }
        }

        // Collide with physical Obstacles
        obstaclesRef.current.forEach(obs => {
          const dx = p.x - obs.position.x;
          const dz = p.z - obs.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const collisionRadius = 1.8;
          
          if (dist < collisionRadius) {
            // Push back dynamically based on overlap to prevent clipping/tunneling
            const overlap = collisionRadius - dist;
            const nx = dx / (dist || 1);
            const nz = dz / (dist || 1);
            
            p.x += nx * (overlap + 0.1); // Add small buffer
            p.z += nz * (overlap + 0.1);
            p.targetX = undefined; // trigger path recalculation

            // Reduce HP on collision (damage: 5 HP, cooldown: 1.0s)
            const obsId = obs.uuid || 'generic_obs';
            const throttleKey = `obs_hit_${obsId}`;
            if (!(p as any)[throttleKey] || (now - (p as any)[throttleKey] > 1000)) {
              (p as any)[throttleKey] = now;
              damagePlayer(p, 5, 'OBSTACLE');
              
              // Reduce Obstacle HP
              if (obs.userData && obs.userData.hp !== undefined) {
                const hasOrbitalOrbs = p.activePowerUps?.some(pu => pu.type === 'orbital_orbs');
                if (hasOrbitalOrbs) {
                  obs.userData.hp = 0; // Instant destroy by Orb Shield
                } else {
                  const pPower = p.size * (p.isGiga ? 2.5 : 1);
                  const dmgToObs = Math.floor(25 * pPower);
                  obs.userData.hp -= dmgToObs;
                }
                
                // Visual feedback for obstacle hit
                createSpawnExplosion(obs.position.x, obs.position.y + 0.5, obs.position.z, obs.userData.color || '#ffffff', 5);
              }

              createSpawnExplosion(p.x, p.y + 0.3, p.z, '#ef4444', 6);
            }
          }
        });

        // ===== DRAMATIC PLAYER-TO-PLAYER COLLISION (GANGSING BENTURAN) =====
        // Check collision with other alive players — real spinning top clash!
        listPlayers.forEach((other) => {
          if (other.id === p.id || other.status === 'dead') return;
          const dx = p.x - other.x;
          const dz = p.z - other.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const minDist = (p.size + other.size) * 1.1; // collision radius based on size
          if (dist < minDist && dist > 0.01) {
            // Normalized push direction
            const nx = dx / dist;
            const nz = dz / dist;
            // Overlap amount
            const overlap = minDist - dist;
            // Get velocities first for momentum-based knockback
            const pVel = playerVelocitiesRef.current.get(p.id);
            const oVel = playerVelocitiesRef.current.get(other.id);
            const relVx = (pVel ? pVel.vx : 0) - (oVel ? oVel.vx : 0);
            const relVz = (pVel ? pVel.vz : 0) - (oVel ? oVel.vz : 0);
            const relativeSpeed = Math.sqrt(relVx * relVx + relVz * relVz);
            // Bounce force — momentum-based (velocity matters more than overlap)
            const momentumForce = Math.min(5, 0.5 + relativeSpeed * 0.3);
            const force = Math.max(overlap * 0.5, momentumForce);
            const effectivePSize = p.isGiga ? (p.size * 5) : p.size;
            const effectiveOSize = other.isGiga ? (other.size * 5) : other.size;
            const totalMass = effectivePSize + effectiveOSize;
            const pMass = effectiveOSize / totalMass;
            const oMass = effectivePSize / totalMass;
            // Push both apart proportional to their sizes (bigger pushes less)
            p.x += nx * force * pMass;
            p.z += nz * force * pMass;
            other.x -= nx * force * oMass;
            other.z -= nz * force * oMass;
            // Reset pathfinding targets for both (dramatic course change)
            p.targetX = undefined;
            other.targetX = undefined;
            // If collision happened near a battle point, deactivate that point
            battlePointsRef.current.forEach(bp => {
              if (!bp.active) return;
              const bpDist = Math.sqrt(
                Math.pow(bp.x - ((p.x + other.x) / 2), 2) + 
                Math.pow(bp.z - ((p.z + other.z) / 2), 2)
              );
              if (bpDist < 3.0 && overlap > 0.2) {
                deactivateBattlePoint(bp);
              }
            });
            const avgSize = (p.size + other.size) / 2;

            // Check for PERFECT PARRY — high-speed clash!
            const parryKey = p.id < other.id ? p.id + '_' + other.id : other.id + '_' + p.id;
            const parryCooldown = parryCooldownRef.current.get(parryKey) || 0;
            const isParry = relativeSpeed > 4.0 && overlap > 0.25 && Date.now() > parryCooldown;

            // Calculate proximity to battle point — nearest player gets damage reduction
            let pBpBonus = 1.0; // default: no bonus
            let oBpBonus = 1.0;
            // Find nearest battle points for proximity bonuses
            let nearestDistP = Infinity, nearestDistO = Infinity;
            battlePointsRef.current.forEach(bp => {
              if (!bp.active) return;
              const dP = Math.sqrt(Math.pow(bp.x - p.x, 2) + Math.pow(bp.z - p.z, 2));
              const dO = Math.sqrt(Math.pow(bp.x - other.x, 2) + Math.pow(bp.z - other.z, 2));
              if (dP < nearestDistP) nearestDistP = dP;
              if (dO < nearestDistO) nearestDistO = dO;
            });
            if (nearestDistP < Infinity || nearestDistO < Infinity) {
              // Closer to battle point = less damage taken (up to 50% reduction)
              if (nearestDistP < nearestDistO) {
                pBpBonus = 0.5 + 0.5 * (nearestDistP / (nearestDistO || 1));
              } else if (nearestDistO < nearestDistP) {
                oBpBonus = 0.5 + 0.5 * (nearestDistO / (nearestDistP || 1));
              }
              // Cap the bonus
              pBpBonus = Math.max(0.5, Math.min(1.0, pBpBonus));
              oBpBonus = Math.max(0.5, Math.min(1.0, oBpBonus));
            }

            if (overlap > 0.2 && relativeSpeed > 0.01) {
              const midX = (p.x + other.x) / 2;
              const midZ = (p.z + other.z) / 2;

              if (isParry) {
                // ===== ⚔️ PERFECT PARRY! ⚔️ =====
                // Set cooldown to prevent spam (1.5s per player pair)
                parryCooldownRef.current.set(parryKey, Date.now() + 1500);

                // Speed-based mental damage: faster player loses less, slower loses more
                const pVelMag = pVel ? Math.sqrt(pVel.vx * pVel.vx + pVel.vz * pVel.vz) : 0;
                const oVelMag = oVel ? Math.sqrt(oVel.vx * oVel.vx + oVel.vz * oVel.vz) : 0;
                const totalMag = pVelMag + oVelMag || 1;
                const speedRatio = Math.min(1.0, relativeSpeed / 10.0);
                const baseDmg = 6;
                const bonusDmg = Math.floor(speedRatio * 12);
                const pMentalDmg = Math.floor((baseDmg + bonusDmg * (oVelMag / totalMag)) * pBpBonus);
                const oMentalDmg = Math.floor((baseDmg + bonusDmg * (pVelMag / totalMag)) * oBpBonus);
                const mentalCrit = p.mental <= 0 || other.mental <= 0;
                p.mental = Math.max(0, p.mental - pMentalDmg);
                other.mental = Math.max(0, other.mental - oMentalDmg);

                // Set parry attack bonus: next attack = 2x damage
                p.parryAttackBonus = true;
                other.parryAttackBonus = true;

                // Double knockback — momentum-based (relative speed drives the force)
                const pMassKnock = other.size / (p.size + other.size || 1);
                const oMassKnock = p.size / (p.size + other.size || 1);
                applyKnockback(p, other.x, other.z, momentumForce * oMassKnock * 2);
                applyKnockback(other, p.x, p.z, momentumForce * pMassKnock * 2);

                // Epic visual effects
                createImpactExplosion(midX, midZ, p.color, other.color, 2.0);
                createGlassShatter(midX, midZ, p.color, '#FFD700', 14);
                createGlassShatter(midX, midZ, other.color, '#FFFFFF', 8);
                triggerScreenShake(2);

                // Special parry sound
                playParryClashSound();

                // Mental break: if a player had 0 mental before this collision, they shatter!
                if (mentalCrit) {
                  // The player with 0 mental breaks on this impact
                  if (p.mental <= 0 && p.status !== 'dead') {
                    createGlassShatter(p.x, p.z, '#EF4444', '#FFFFFF', 10);
                    p.status = 'dead';
                    const pMesh = playerMeshesRef.current.get(p.id);
                    if (pMesh && mainSceneRef.current) mainSceneRef.current.remove(pMesh);
                  }
                  if (other.mental <= 0) {
                    createGlassShatter(other.x, other.z, '#EF4444', '#FFFFFF', 10);
                    other.status = 'dead';
                    const oMesh = playerMeshesRef.current.get(other.id);
                    if (oMesh && mainSceneRef.current) mainSceneRef.current.remove(oMesh);
                  }
                }
              } else {
                // Normal collision — speed-based mental drain (faster = less dmg for aggressor)
                const pVelMagN = pVel ? Math.sqrt(pVel.vx * pVel.vx + pVel.vz * pVel.vz) : 0;
                const oVelMagN = oVel ? Math.sqrt(oVel.vx * oVel.vx + oVel.vz * oVel.vz) : 0;
                const totalMagN = pVelMagN + oVelMagN || 1;
                const speedRatioN = Math.min(1.0, relativeSpeed / 10.0);
                const pBump = Math.floor((1 + speedRatioN * 4 * (oVelMagN / totalMagN)) * pBpBonus);
                const oBump = Math.floor((1 + speedRatioN * 4 * (pVelMagN / totalMagN)) * oBpBonus);
                if (p.mental > 0) {
                  p.mental = Math.max(0, p.mental - pBump);
                } else {
                  // Mental already 0 — small chance to break on hard bump
                  if (overlap > 0.35 && Math.random() < 0.15) {
                    createGlassShatter(p.x, p.z, '#EF4444', '#FFFFFF', 8);
                    p.status = 'dead';
                    const pMesh = playerMeshesRef.current.get(p.id);
                    if (pMesh && mainSceneRef.current) mainSceneRef.current.remove(pMesh);
                  }
                }
                if (other.mental > 0) {
                  other.mental = Math.max(0, other.mental - oBump);
                } else {
                  if (overlap > 0.35 && Math.random() < 0.15) {
                    createGlassShatter(other.x, other.z, '#EF4444', '#FFFFFF', 8);
                    other.status = 'dead';
                    const oMesh = playerMeshesRef.current.get(other.id);
                    if (oMesh && mainSceneRef.current) mainSceneRef.current.remove(oMesh);
                  }
                }
                // Normal collision effects
                createImpactExplosion(midX, midZ, p.color, other.color, Math.min(1.2, 0.3 + overlap * 2));
                triggerScreenShake(Math.min(2.5, 0.5 + overlap * 2));

                // Collision sound based on impact speed (not just size)
                if (relativeSpeed < 1.5) playClashLightSound();
                else if (relativeSpeed < 4.0) playClashMediumSound();
                else playClashHeavySound();

                // Extra glass shatter on very hard impact
                if (overlap > 0.35) {
                  createGlassShatter(midX, midZ, p.color, '#FFFFFF', 6);
                  
                } else if (Math.random() < 0.3) {
                  
                }
              }
            }
          }
        });

        // 7. Render dynamic high-DPI HTML projection overlay labels (perfect look & ultra readable text)
        if (camera && renderer) {
          const pos = new THREE.Vector3(p.x, p.y + 1.8, p.z);
          pos.project(camera);
          
          const widthHalf = (canvasRef.current?.clientWidth || 360) / 2;
          const heightHalf = (canvasRef.current?.clientHeight || 640) / 2;

          const screenX = (pos.x * widthHalf) + widthHalf;
          const screenY = -(pos.y * heightHalf) + heightHalf;

          // Only overlay if is within camera view
          const isBehindCamera = pos.z > 1.0;

          if (!isBehindCamera) {
            // Check if comment message bubble is still active (display comments for 30s inline)
            const showBubble = p.lastActionText && p.lastActionTime && (Date.now() - p.lastActionTime < 30000);

            curLabels.push({
              id: p.id,
              name: p.username,
              hp: p.hp,
              maxHp: p.maxHp,
              shield: p.shield,
              mental: p.mental,
              maxMental: p.maxMental,
              kills: p.kills,
              xp: p.xp,
              level: p.level,
              x: screenX,
              y: screenY,
              textBubble: showBubble ? p.lastActionText : undefined,
              color: p.color,
              size: p.size
            });
          }
        }
      });

      // Update projected arrays
      setFloatingLabels(curLabels);

      // Manage combat feedback floating numbers age
      setFloatingText(prev => prev
        .map(t => ({ ...t, y: t.y - 1.2, age: t.age + delta }))
        .filter(t => t.age < 1.5)
      );

      // Camera dynamic tracing zoom/pan system! (Focuses on top warriors automatically)
      const survivors = listPlayers.filter(p => p.status === 'alive');
      if (survivors.length > 0) {
        let avgX = 0;
        let avgZ = 0;
        survivors.forEach(s => {
          avgX += s.x;
          avgZ += s.z;
        });
        avgX /= survivors.length;
        avgZ /= survivors.length;

        // Smooth camera damp
        const camTargetY = 30 + Math.min(15, survivors.length * 0.5);
        // Apply screen shake offset
        const shake = cameraShakeRef.current;
        if (shake.intensity > 0.02) {
          shake.offsetX = (Math.random() - 0.5) * shake.intensity;
          shake.offsetZ = (Math.random() - 0.5) * shake.intensity;
          // Even faster decay from 0.85 to 0.75 for minimalist feel
          shake.intensity *= 0.75; 
          if (shake.intensity < 0.02) {
            shake.intensity = 0;
            shake.offsetX = 0;
            shake.offsetZ = 0;
          }
        } else {
          shake.offsetX *= 0.9;
          shake.offsetZ *= 0.9;
        }
        camera.position.x += (avgX - camera.position.x + shake.offsetX) * 0.04;
        camera.position.z += (avgZ + 25 - camera.position.z + shake.offsetZ) * 0.04;
        camera.lookAt(new THREE.Vector3(avgX + shake.offsetX * 0.5, 0, avgZ + shake.offsetZ * 0.5));
      }

      renderer.render(scene, camera);
    };

    animeFrameId = requestAnimationFrame(animate);

    // Stone Rain timer - every 60 seconds (1 minute)
    const stoneRainTimer = setInterval(() => {
      triggerStoneRain();
    }, 60000);

    // Auto-spawn Bot Maintainer - every 60 seconds
    const botMaintainerTimer = setInterval(() => {
      const alivePlayers = (Array.from(playersRef.current.values()) as Player[]).filter(p => p.status === 'alive');
      if (alivePlayers.length < 10) {
        const needed = 10 - alivePlayers.length;
        console.log(`[Arena] Populasi rendah (${alivePlayers.length}/10), spawning ${needed} bot tambahan.`);
        for (let i = 0; i < needed; i++) {
          setTimeout(() => {
            spawnSingleNpcBot();
          }, i * 1500); // Stagger spawn slightly
        }
      }
    }, 60000);

    // Auto update top list leaderboard in side panel
    const lbdTimer = setInterval(() => {
      const list = Array.from(playersRef.current.values());
      onLeaderboardUpdate(list);
    }, 1000);

    // Boss spawn timer - spawn boss every 60 seconds if none alive
    const bossSpawnTimer = setInterval(() => {
      if (!bossRef.current || !bossRef.current.alive) {
        spawnBoss();
      }
    }, 60000);
    // Also try to spawn boss after 30 seconds initially
    setTimeout(() => {
      if (!bossRef.current || !bossRef.current.alive) {
        spawnBoss();
      }
    }, 30000);

    // Dynamic scale adjustment on window screen resize
    const handleResize = () => {
      if (!canvasRef.current || !renderer || !camera) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Start initial default barrier layout
    setTimeout(() => {
      (ref as any).current.resetGame();
    }, 500);

    // Cleanup Resources on unmount
    return () => {
      cancelAnimationFrame(animeFrameId);
      clearInterval(stoneRainTimer);
      clearInterval(botMaintainerTimer);
      clearInterval(lbdTimer);
      clearInterval(bossSpawnTimer);
      window.removeEventListener('resize', handleResize);
      // Boss cleanup
      if (bossMeshRef.current) { scene.remove(bossMeshRef.current); bossMeshRef.current = null; }
      minionsRef.current.forEach(m => {
        const mesh = minionMeshesRef.current.get(m.id);
        if (mesh) scene.remove(mesh);
        const rMesh2 = minionMeshesRef.current.get(m.id + '_ring');
        if (rMesh2) scene.remove(rMesh2);
      });
      minionMeshesRef.current.clear();
      minionsRef.current = [];
      if (movingPointLightRef.current) { scene.remove(movingPointLightRef.current); movingPointLightRef.current = null; }
      if (movingLightOrbRef.current) { scene.remove(movingLightOrbRef.current); movingLightOrbRef.current = null; }
      if (renderer) renderer.dispose();
    };
  }, []);

  // Execute an exciting custom lunge swing attack!
  const executeAttack = (p: Player, target: Player) => {
    // Rotation towards target
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const angle = Math.atan2(dx, dz);

    const mesh = playerMeshesRef.current.get(p.id);
    if (mesh) {
      // 3D Jump Attack animation lunge
      mesh.rotation.y = angle;
      const originalY = p.y;
      
      // Animate swing lunge forward & hit detection
      let stepTime = 0;
      const maxDuration = 0.25; // fast 250ms jump
      
      const animateMeleeHit = () => {
        stepTime += 0.04;
        if (stepTime < maxDuration) {
          const progress = stepTime / maxDuration;
          const jumpHeight = Math.sin(progress * Math.PI) * 2.2;
          mesh.position.y = originalY + jumpHeight;
          
          // Lunge weapon rotate visual rotate action
          const weaponGroup = mesh.getObjectByName('weaponGroup');
          if (weaponGroup) {
            weaponGroup.rotation.x = -Math.PI * progress * 1.5;
          }
          requestAnimationFrame(animateMeleeHit);
        } else {
          mesh.position.y = originalY;
          const weaponGroup = mesh.getObjectByName('weaponGroup');
          if (weaponGroup) weaponGroup.rotation.x = 0;
          
          // Hit resolution!
          if (target.status === 'alive') {
            const verifyDist = Math.sqrt(Math.pow(p.x - target.x, 2) + Math.pow(p.z - target.z, 2));
            if (verifyDist < 4.5 * p.size) {
              let dmg = 15;
              if (p.weapon === 'sword') dmg = 28;
              if (p.weapon === 'battle_hammer') {
                dmg = 35;
                createSpawnExplosion(target.x, 0, target.z, '#F59E0B', 8); // ground shake shockwave
              }
              if (p.weapon === 'golden_lance') dmg = 45;

              // Parry attack bonus: 2x damage on next attack after a perfect parry
              const parryBoost = p.parryAttackBonus ? 2.0 : 1.0;
              if (p.parryAttackBonus) {
                p.parryAttackBonus = false; // consume the bonus
              }

              // Giga mode bonus damage multiplier
              const gigaBoost = p.isGiga ? 2.5 : 1.0;

              damagePlayer(target, Math.floor(dmg * p.size * parryBoost * gigaBoost), p.username);
            }
          }
        }
      };
      
      animateMeleeHit();
    }

    // Weapon projectile animations if laser shooter
    if (p.weapon === 'glowing_laser') {
      shootLaserProjectile(p, angle);
      p.attackCooldown = 1.0; // laser shoot speed
    } else {
      p.attackCooldown = 0.8; // melee speed
    }
  };

  return (
    <div id="battle_arena_container" ref={containerRef} className="relative w-full h-full overflow-hidden select-none select-none">
      <canvas id="battle_arena_canvas" ref={canvasRef} className="w-full h-full block touch-none" />

      {/* Floating 3D projection overlay names + health bars */}
      <div id="labels_overlay" className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {floatingLabels.map((label) => (
          <div
            key={label.id}
            id={`label_${label.id}`}
            style={{
              transform: `translate3d(-50%, -100%, 0)`,
              left: `${label.x}px`,
              top: `${label.y}px`
            }}
            className="absolute flex flex-col items-center select-none"
          >
            {/* Shouting Dialogue Speech Bubble */}
            {label.textBubble && (
              <div id={`bubble_${label.id}`} className="mb-2 bg-white/95 px-3 py-1.5 rounded-2xl shadow-xl shadow-indigo-950/20 border-2 border-indigo-500/30 text-indigo-950 font-bold text-xs max-w-[150px] break-words text-center leading-tight animate-bounce">
                {label.textBubble}
                <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white" />
              </div>
            )}

            {/* Avatar Miniature Logo */}
            <div className="flex gap-1 items-center bg-slate-900/90 py-1 px-2.5 rounded-full border border-white/20 shadow-md">
              <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: label.color }} />
              <span className="text-[11px] font-black tracking-tight font-sans drop-shadow-md" style={{ color: label.color }}>
                {label.name}
              </span>
            </div>

            {/* Simple Health + Shield bar */}
            <div className="w-20 h-1 bg-slate-800/60 rounded-full mt-1 overflow-hidden flex">
              {label.shield > 0 && (
                <div
                  style={{ width: `${(label.shield / 100) * 100}%` }}
                  className="h-full bg-cyan-400/80 rounded-full"
                />
              )}
              <div
                style={{ width: `${(label.hp / label.maxHp) * 100}%` }}
                className="h-full bg-red-500/80 rounded-full"
              />
            </div>
          </div>
        ))}

        {/* Floating animated 3D hits damage numbers */}
        {floatingText.map((text) => (
          <div
            key={text.id}
            id={`ft_${text.id}`}
            style={{
              left: `${text.x}px`,
              top: `${text.y}px`,
              color: text.color
            }}
            className="absolute text-sm font-black font-mono tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse pointer-events-none"
          >
            {text.text}
          </div>
        ))}

        {/* Tap floating animated hearts */}
        {tapHearts.map((heart) => (
          <div
            key={heart.id}
            id={`heart_${heart.id}`}
            style={{
              left: `calc(${heart.x}% + ${heart.offset}px)`,
              top: `${heart.y}%`
            }}
            className="absolute pointer-events-none select-none text-2xl font-sans drop-shadow-md animate-[fadeUp_1s_ease-out_forwards]"
          >
            💖
          </div>
        ))}
      </div>

    </div>
  );
});

BattleArena3D.displayName = 'BattleArena3D';
