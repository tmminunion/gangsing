import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Player, WeaponType, Airdrop } from '../types';

interface BattleArena3DProps {
  onLeaderboardUpdate: (players: Player[]) => void;
  onLiveFeedMessage: (msg: { id: string; type: 'gift' | 'comment' | 'kill' | 'system' | 'join'; text: string; time: string }) => void;
  currentLikes: number;
  onAddKillScore: (username: string) => void;
  onWinnerDecided?: (winner: { username: string; color: string; kills: number }) => void;
}

export interface BattleArenaRef {
  addPlayer: (username: string, isPremium?: boolean) => void;
  triggerComment: (username: string, text: string) => void;
  triggerGift: (username: string, giftName: string, amount: number) => void;
  triggerTap: (x: number, y: number) => void;
  resetGame: () => void;
}

export const BattleArena3D = forwardRef<BattleArenaRef, BattleArena3DProps>(({
  onLeaderboardUpdate,
  onLiveFeedMessage,
  currentLikes,
  onAddKillScore,
  onWinnerDecided
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // References to keep game state fast & avoid React re-render lags
  const playersRef = useRef<Map<string, Player>>(new Map());
  const airdropsRef = useRef<Airdrop[]>([]);
  const obstaclesRef = useRef<THREE.Mesh[]>([]);
  const projectileRef = useRef<{ id: string; mesh: THREE.Mesh; targetX: number; targetZ: number; speed: number; damage: number; owner: string }[]>([]);
  const particlesRef = useRef<{ mesh: THREE.Points; life: number; velocity: THREE.Vector3[] }[]>([]);

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
  const safeZoneRingMeshRef = useRef<THREE.LineLoop | null>(null);
  const safeZonePulseMeshRef = useRef<THREE.Mesh | null>(null);
  const arenaFloorMeshRef = useRef<THREE.Mesh | null>(null);
  const airdropMeshesRef = useRef<Map<string, THREE.Group>>(new Map());

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

  // 1. Core Functions exposed to Parent
  useImperativeHandle(ref, () => ({
    addPlayer: (username: string, isPremium = false, forceTeam?: 'arsenal' | 'psg') => {
      const id = username.toLowerCase();
      if (playersRef.current.has(id)) {
        // Revive or heal if already exists
        const p = playersRef.current.get(id);
        if (p) {
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
              text: `@${username} bangkit kembali dan terjun ke arena!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            createSpawnExplosion(p.x, 0, p.z, p.color);
          } else {
            // Heal if already alive
            p.hp = Math.min(p.maxHp, p.hp + 40);
            p.shield = Math.min(100, p.shield + 20);
            p.lastActionText = "GABUNG / PULIH";
            p.lastActionTime = Date.now();
            addFloatingCombatText("+40 HP", p.x, p.y + 2, p.z, '#10B981');
          }
        }
        return;
      }

      // Generate new player in Group 1 (Arsenal - red) or Group 2 (PSG - blue)
      const team: 'arsenal' | 'psg' = forceTeam || (playersRef.current.size % 2 === 0 ? 'arsenal' : 'psg');
      const teamColor = team === 'arsenal' ? '#EF4444' : '#2563EB';
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * (safeZoneRadiusRef.current * 0.7);
      
      const newPlayer: Player = {
        id,
        username,
        avatarSeed: getRandomSeed(),
        hp: isPremium ? 150 : 100,
        maxHp: isPremium ? 150 : 100,
        shield: isPremium ? 80 : 25,
        kills: 0,
        score: 0,
        size: isPremium ? 1.4 : 1.0,
        weapon: isPremium ? 'sword' : 'fist',
        color: teamColor,
        team,
        status: 'alive',
        xp: 0,
        level: 1,
        x: Math.cos(ang) * dist,
        y: 12, // Land dropping from sky
        z: Math.sin(ang) * dist,
        damageCooldown: 0,
        attackCooldown: 0
      };

      playersRef.current.set(id, newPlayer);

      // Create 3D Mesh
      if (mainSceneRef.current) {
        const playerGroup = createPlayerMesh(newPlayer);
        mainSceneRef.current.add(playerGroup);
        playerMeshesRef.current.set(id, playerGroup);
        
        // Spawn effect
        createSpawnExplosion(newPlayer.x, 0, newPlayer.z, teamColor);
      }

      const teamLabel = team === 'arsenal' ? 'Arsenal 🔴' : 'PSG 🔵';
      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'join',
        text: `@${username} bergabung dalam faksi ${teamLabel}!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    },

    triggerComment: (username: string, text: string) => {
      const id = username.toLowerCase();
      
      // Determine designated team from chat commentary
      let forceTeam: 'arsenal' | 'psg' | undefined = undefined;
      const cmd = text.toLowerCase();
      if (cmd.includes('arsenal') || cmd.includes('1') || cmd.includes('merah') || cmd.includes('red') || cmd.includes('gunner') || cmd.includes('serang merah')) {
        forceTeam = 'arsenal';
      } else if (cmd.includes('psg') || cmd.includes('2') || cmd.includes('biru') || cmd.includes('blue') || cmd.includes('paris') || cmd.includes('gabung team biru')) {
        forceTeam = 'psg';
      }

      // Make them join if not in match
      if (!playersRef.current.has(id)) {
        (ref as any).current.addPlayer(username, false, forceTeam);
      } else {
        // If already exists and wrote opposing team command explicitly, let them switch teams!
        const p = playersRef.current.get(id);
        if (p && p.status === 'alive' && forceTeam && p.team !== forceTeam) {
          p.team = forceTeam;
          p.color = forceTeam === 'arsenal' ? '#EF4444' : '#2563EB';
          p.lastActionText = `PINDAH TIM ${forceTeam.toUpperCase()}!`;
          p.lastActionTime = Date.now();
          
          // Re-create player 3D appearance so team logos and decals render perfectly
          const oldMesh = playerMeshesRef.current.get(id);
          if (oldMesh && mainSceneRef.current) {
            mainSceneRef.current.remove(oldMesh);
          }
          const newMesh = createPlayerMesh(p);
          if (mainSceneRef.current) {
            mainSceneRef.current.add(newMesh);
            playerMeshesRef.current.set(id, newMesh);
          }
          onLiveFeedMessage({
            id: Math.random().toString(),
            type: 'system',
            text: `@${username} membelot ke faksi ${forceTeam === 'arsenal' ? 'Arsenal' : 'PSG'}!`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        }
      }

      const p = playersRef.current.get(id);
      if (p && p.status === 'alive') {
        p.lastActionText = text.substring(0, 30);
        p.lastActionTime = Date.now();

        // Shouting text can trigger minor command attacks!
        const cmdText = text.toLowerCase();
        if (cmdText.includes('serang') || cmdText.includes('attack') || cmdText.includes('hantam')) {
          p.attackCooldown = 0; // immediate trigger attack seek
        } else if (cmdText.includes('lompat') || cmdText.includes('jump')) {
          if (p.y <= 0.2) p.y = 5; // vertical leap jump
        }

        awardPlayerXp(p, 10);
      }
    },

    triggerGift: (username: string, giftName: string, amount: number) => {
      const id = username.toLowerCase();
      if (!playersRef.current.has(id)) {
        const assignedTeam = playersRef.current.size % 2 === 0 ? 'arsenal' : 'psg';
        (ref as any).current.addPlayer(username, true, assignedTeam);
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
          addFloatingCombatText(`HEAL +${35 * amount}`, p.x, p.y + 1, p.z, '#EF4444');
          createHealParticle(p.x, p.z, '#FF4B72');
        } 
        else if (lowerGift.includes('heart') || lowerGift.includes('cinta')) {
          p.shield = Math.min(100, p.shield + 50 * amount);
          p.lastActionText = `SENTUHAN CINTA 🫰 (+Shield)`;
          p.lastActionTime = Date.now();
          addFloatingCombatText(`SHIELD +${50 * amount}`, p.x, p.y + 1, p.z, '#3B82F6');
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

        awardPlayerXp(p, giftXp);
      }
    },

    triggerTap: (clientX: number, clientY: number) => {
      // Create hearts floating from a specific coordinate
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const xPercent = ((clientX - rect.left) / rect.width) * 100;
      const yPercent = ((clientY - rect.top) / rect.height) * 100;

      // Spawn random floating emoji heart
      const teamColor = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
      addTapHeart(xPercent, yPercent, teamColor);

      // Increment random player's hyper mode or drop dynamic aid crate if likes pile up!
      if (Math.random() < 0.2) {
        spawnRandomAirdrop();
      }
    },

    resetGame: () => {
      // Clear game and rebuild
      safeZoneRadiusRef.current = 40;
      setSafeZoneRadius(40);
      
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

      // Spawn 4 classic starting warrior bots (Arsenal vs PSG) to populate battle immediately
      const startingBots = [
        { name: 'Saka_Gunner', team: 'arsenal' as const },
        { name: 'Odegaard_Pro', team: 'arsenal' as const },
        { name: 'Mbappe_Jet_X', team: 'psg' as const },
        { name: 'Dembele_Speed', team: 'psg' as const }
      ];
      startingBots.forEach((bot, index) => {
        setTimeout(() => {
          if (playersRef.current.size < 8) {
            const id = bot.name.toLowerCase();
            if (!playersRef.current.has(id)) {
              const teamColor = bot.team === 'arsenal' ? '#EF4444' : '#2563EB';
              const ang = Math.random() * Math.PI * 2;
              const dist = Math.random() * 25;
              const p: Player = {
                id,
                username: bot.name,
                avatarSeed: getRandomSeed(),
                hp: 100,
                maxHp: 100,
                shield: 50,
                kills: 0,
                score: 0,
                size: 1.0,
                weapon: 'fist',
                color: teamColor,
                team: bot.team,
                status: 'alive',
                xp: 0,
                level: 1,
                x: Math.cos(ang) * dist,
                y: 10,
                z: Math.sin(ang) * dist,
                damageCooldown: 0,
                attackCooldown: 0
              };
              playersRef.current.set(id, p);
              if (mainSceneRef.current) {
                const mesh = createPlayerMesh(p);
                mainSceneRef.current.add(mesh);
                playerMeshesRef.current.set(id, mesh);
                createSpawnExplosion(p.x, 0, p.z, teamColor);
              }
            }
          }
        }, index * 600);
      });
    }
  }));

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

    // 2. High-contrast gradient based on team (Arsenal RED vs PSG BLUE)
    const isArsenal = p.team === 'arsenal';
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
    const c1 = isArsenal ? '#ef4444' : '#3b82f6';
    const c2 = isArsenal ? '#7f1d1d' : '#1e3a8a';
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, c2);

    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Modern digital grid lines
    ctx.strokeStyle = isArsenal ? '#fecdd3' : '#bfdbfe';
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
    ctx.strokeStyle = isArsenal ? '#ef4444' : '#3b82f6';
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

    // 6. Transparent username label badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(24, 88, 80, 20, 5);
    } else {
      ctx.rect(24, 88, 80, 20);
    }
    ctx.fill();

    ctx.strokeStyle = isArsenal ? '#fca5a5' : '#93c5fd';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11px Inter, sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayLabel = p.username.slice(0, 9).toUpperCase();
    ctx.fillText(displayLabel, 64, 98);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // 2. Mesh Creators
  const createPlayerMesh = (p: Player) => {
    const group = new THREE.Group();
    group.position.set(p.x, p.y, p.z);

    const isArsenal = p.team === 'arsenal';

    // Premium gangsing (spinning top) colored layers
    const bodyColor = isArsenal ? '#EF4444' : '#1D4ED8';     // Team primary color (Red vs Blue)
    const jewelColor = isArsenal ? '#F59E0B' : '#00F3FF';    // Glowing center core energy (Gold vs Cyan)
    const ringColor = isArsenal ? '#F59E0B' : '#E2E8F0';     // Gold trim vs Silver trim
    const glowColor = isArsenal ? '#F59E0B' : '#3B82F6';     // Glowing aura color

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
  const spawnObstacleAt = (x: number, z: number) => {
    if (!mainSceneRef.current) return;

    // Glowing hex crystal pillar
    const geo = new THREE.CylinderGeometry(0.8, 1.2, 3 + Math.random() * 4, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      emissive: 0x1e293b,
      roughness: 0.4
    });
    const obs = new THREE.Mesh(geo, mat);
    obs.position.set(x, 1.5, z);
    obs.castShadow = true;
    obs.receiveShadow = true;
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

    const types: ('health_crate' | 'shield_crate' | 'weapon_crate')[] = ['health_crate', 'shield_crate', 'weapon_crate'];
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
    let boxColor = 0x10b981; // health
    if (chosenType === 'shield_crate') boxColor = 0x3b82f6;
    if (chosenType === 'weapon_crate') boxColor = 0xf59e0b;

    const boxMat = new THREE.MeshStandardMaterial({
      color: boxColor,
      metalness: 0.8,
      roughness: 0.2
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
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

    mainSceneRef.current.add(group);
    airdropMeshesRef.current.set(id, group);

    onLiveFeedMessage({
      id: Math.random().toString(),
      type: 'system',
      text: `Airdrop ${chosenType === 'health_crate' ? 'Heal' : chosenType === 'shield_crate' ? 'Shield' : 'Weapon Weapon'} jatuh dari helikopter!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
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
      p.size = Math.min(2.5, 1.0 + (p.level - 1) * 0.15); // Grow standard size factor
      leveledUp = true;
      nextXpNeeded = p.level * 100;
    }

    if (amount > 0) {
      addFloatingCombatText(`+${amount} XP`, p.x, p.y + 1.8, p.z, '#10B981');
    }

    if (leveledUp) {
      addFloatingCombatText(`⭐ LEVEL UP Lvl ${p.level}!`, p.x, p.y + 2.5, p.z, '#F59E0B');
      
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
      }
    }
  };

  // 3. Gameplay Logic Operations
  const damagePlayer = (target: Player, damage: number, attackerName: string) => {
    if (target.status === 'dead') return;
    
    // Friendly Fire Protection (Arsenal cannot damage Arsenal, PSG cannot damage PSG)
    if (attackerName && attackerName !== 'SAFE_ZONE') {
      const attacker = playersRef.current.get(attackerName.toLowerCase());
      if (attacker && attacker.team === target.team) {
        return; // Teammates protect each other
      }
    }
    
    // Shield blocks first
    if (target.shield > 0) {
      if (target.shield >= damage) {
        target.shield -= damage;
        addFloatingCombatText(`-${damage} SHIELD`, target.x, target.y + 1, target.z, '#3B82F6');
      } else {
        const excess = damage - target.shield;
        target.shield = 0;
        target.hp = Math.max(0, target.hp - excess);
        addFloatingCombatText(`-${excess} HP`, target.x, target.y + 1, target.z, '#EF4444');
      }
    } else {
      target.hp = Math.max(0, target.hp - damage);
      addFloatingCombatText(`-${damage} HP`, target.x, target.y + 1, target.z, '#EF4444');
    }

    // Award hit XP to the attacker
    if (attackerName && attackerName !== 'SAFE_ZONE') {
      const attacker = playersRef.current.get(attackerName.toLowerCase());
      if (attacker && attacker.id !== target.id) {
        const gXp = Math.min(60, Math.floor(damage * 1.5));
        awardPlayerXp(attacker, gXp);
      }
    }

    // Hit reaction
    createSpawnExplosion(target.x, target.y, target.z, '#EF4444', 5);

    if (target.hp <= 0) {
      target.status = 'dead';
      // Trigger death system event
      onLiveFeedMessage({
        id: Math.random().toString(),
        type: 'kill',
        text: `💀 @${target.username} dikirim kembali ke lobi oleh @${attackerName}!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // Award killer point
      onAddKillScore(attackerName);
      
      const killer = (Array.from(playersRef.current.values()) as Player[]).find(p => p.username === attackerName);
      if (killer) {
        killer.kills += 1;
        killer.hp = Math.min(killer.maxHp, killer.hp + 25); // health siphon on kill!
        killer.size = Math.min(2.5, killer.size + 0.1); // grow slightly on kill
        addFloatingCombatText(`SIPHON +25 HP`, killer.x, killer.y + 1, killer.z, '#10B981');
        awardPlayerXp(killer, 120); // Extra kill XP burst
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
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mainRendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x0c1122, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x8B5CF6, 2.5);
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

    // Subtle blue spotlight to center
    const spotlight = new THREE.SpotLight(0x25f4ee, 5, 50, Math.PI / 4, 0.5, 1);
    spotlight.position.set(0, 25, 0);
    spotlight.target.position.set(0, 0, 0);
    scene.add(spotlight);

    // 5. Grid/Floor styling
    const arenaRadius = 40;
    const floorGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius + 1, 1, 32);
    // Dark matte slate cyber grid
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
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

      // Contracts safe zone radius gradually
      if (safeZoneRadiusRef.current > 6) {
        // shrinks slowly over time
        safeZoneRadiusRef.current -= delta * 0.16;
        setSafeZoneRadius(safeZoneRadiusRef.current);
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

      // Update and animate Players
      const listPlayers = Array.from(playersRef.current.values()) as Player[];
      const curLabels: typeof floatingLabels = [];

      listPlayers.forEach((p) => {
        if (p.status === 'dead') return;

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

        // BOT DECISION FINDER logic
        // If not moving or target reached, select closest enemy or airdrop
        const targetX = p.targetX ?? p.x;
        const targetZ = p.targetZ ?? p.z;
        const targetDistSq = Math.pow(targetX - p.x, 2) + Math.pow(targetZ - p.z, 2);

        if (targetDistSq < 1 || p.targetX === undefined) {
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

              // If close enough, claim it!
              if (closeAdDist < 1.8) {
                awardPlayerXp(p, 80); // Award XP for getting the drop
                if (ad.type === 'health_crate') {
                  p.hp = Math.min(p.maxHp, p.hp + 50);
                  addFloatingCombatText('+50 HP', p.x, p.y + 2, p.z, '#10B981');
                  createHealParticle(p.x, p.z, '#10B981');
                } else if (ad.type === 'shield_crate') {
                  p.shield = Math.min(100, p.shield + 60);
                  addFloatingCombatText('+60 Shield', p.x, p.y + 2, p.z, '#3B82F6');
                } else {
                  // weapon update
                  const weapons: WeaponType[] = ['sword', 'glowing_laser', 'battle_hammer', 'golden_lance'];
                  p.weapon = weapons[Math.floor(Math.random() * weapons.length)];
                  addFloatingCombatText(`WEAPON UP!`, p.x, p.y + 2, p.z, '#F59E0B');
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

          // 2. Otherwise seek closest alive enemy
          if (!foundMission) {
            let closeEnemyDist = Infinity;
            let closestEnemy: Player | null = null;
            
            listPlayers.forEach((other) => {
              if (other.id === p.id || other.status === 'dead' || other.team === p.team) return;
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

          // 3. Fallback to center zone
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
            p.x += (dx / dist) * movementSpeed * delta;
            p.z += (dz / dist) * movementSpeed * delta;

            // Rotate mesh to face direction
            const mesh = playerMeshesRef.current.get(p.id);
            if (mesh) {
              // Face direction
              const angle = Math.atan2(dx, dz);
              mesh.rotation.y = angle;
            }
          }
        }

        // Continually update player 3D mesh rendering position & animations
        const mesh = playerMeshesRef.current.get(p.id);
        if (mesh) {
          mesh.position.set(p.x, p.y, p.z);

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
        }

        // Collide with physical Obstacles
        obstaclesRef.current.forEach(obs => {
          const dx = p.x - obs.position.x;
          const dz = p.z - obs.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 1.8) {
            // Push back
            p.x += (dx / dist) * 0.35;
            p.z += (dz / dist) * 0.35;
            p.targetX = undefined; // trigger path recalculation
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
            // Check if comment message bubble is still active (display comments for 3.5s inline)
            const showBubble = p.lastActionText && p.lastActionTime && (Date.now() - p.lastActionTime < 3500);

            curLabels.push({
              id: p.id,
              name: p.username,
              hp: p.hp,
              maxHp: p.maxHp,
              shield: p.shield,
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
        camera.position.x += (avgX - camera.position.x) * 0.04;
        camera.position.z += (avgZ + 25 - camera.position.z) * 0.04;
        camera.lookAt(new THREE.Vector3(avgX, 0, avgZ));
      }

      renderer.render(scene, camera);
    };

    animeFrameId = requestAnimationFrame(animate);

    // Initial load airdrop drop timer
    const dropTimer = setInterval(() => {
      if (playersRef.current.size > 0 && airdropsRef.current.length < 3) {
        spawnRandomAirdrop();
      }
    }, 12000);

    // Auto update top list leaderboard in side panel
    const lbdTimer = setInterval(() => {
      const list = Array.from(playersRef.current.values());
      onLeaderboardUpdate(list);
    }, 1000);

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
      clearInterval(dropTimer);
      clearInterval(lbdTimer);
      window.removeEventListener('resize', handleResize);
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

              damagePlayer(target, Math.floor(dmg * p.size), p.username);
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
            className="absolute flex flex-col items-center transition-all duration-75 select-none"
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
              <span className="text-white text-[11px] font-black tracking-tight font-sans drop-shadow-md">
                {label.name} <span className="text-emerald-400">🔥{label.kills}</span>
              </span>
              <span className="text-[9px] bg-yellow-500/20 text-yellow-300 font-extrabold px-1.5 py-[1px] rounded border border-yellow-500/30">
                Lvl.{label.level}
              </span>
            </div>

            {/* Double Shield + Health Progress indicators */}
            <div className="w-20 bg-slate-950/80 rounded-full h-2.5 mt-1 border border-white/10 p-[1px] flex gap-[1px]">
              {label.shield > 0 && (
                <div
                  style={{ width: `${(label.shield / 100) * 100}%` }}
                  className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                />
              )}
              <div
                style={{ width: `${(label.hp / label.maxHp) * 100}%` }}
                className="h-full bg-red-500 rounded-full transition-all duration-300"
              />
            </div>

            {/* XP PROGRESS BAR TRACKER */}
            <div className="w-20 bg-slate-950/60 rounded-full h-[3px] mt-0.5 overflow-hidden p-[0.5px]">
              <div 
                style={{ width: `${Math.min(100, (label.xp / (label.level * 100)) * 100)}%` }} 
                className="h-full bg-emerald-400 rounded-full transition-all duration-300"
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

      {/* Cybernetic HUD elements: Likes, Shrinking Ring status label */}
      <div id="ring_alert_overlay" className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-rose-500/90 border border-thin border-rose-400/30 text-white font-bold text-xs py-1 px-4 rounded-full shadow-lg shadow-rose-950/20 backdrop-blur-md flex items-center gap-2 pointer-events-none select-none uppercase tracking-wider animate-pulse">
        <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
        Safe Zone: {Math.max(0, Math.floor(safeZoneRadius))}m
      </div>
    </div>
  );
});

BattleArena3D.displayName = 'BattleArena3D';
