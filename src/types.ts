export interface Player {
  id: string;
  username: string;
  avatarSeed: string; // Used to generate unique face SVGs dynamically
  hp: number;
  maxHp: number;
  shield: number;
  mental: number;
  maxMental: number;
  kills: number;
  score: number;
  size: number;
  weapon: WeaponType;    color: string;
  status: 'alive' | 'dead';
  xp: number;
  level: number;
  x: number;
  y: number; // vertical height for jumps/falling
  z: number;
  targetX?: number;
  targetZ?: number;
  lastActionText?: string;
  lastActionTime?: number;
  damageCooldown: number; // avoid taking constant damage
  attackCooldown: number;
  /** Total damage dealt to boss monsters */
  bossDamageDealt: number;
  /** Total power-ups collected from airdrops */
  powerUpsCollected: number;
  /** Active timed power-ups on this player */
  activePowerUps: ActivePowerUp[];
  /** Whether this player is the current MVP (top boss damage dealer) */
  isMvp?: boolean;
  /** Next attack deals 2x damage after a perfect parry/clash */
  parryAttackBonus?: boolean;
  /** Cumulative time spent near battle point (seconds) */
  bpTime: number;
  /** Targeting revenge system */
  targetPlayerId?: string;
  targetTimer?: number;
  /** Giga Gifter scale modifier */
  isGiga?: boolean;
  gigaTimer?: number;
}

export type WeaponType = 'fist' | 'sword' | 'glowing_laser' | 'battle_hammer' | 'golden_lance';

/** Types of enhanced power-up airdrops */
export type PowerUpType = 'speed_boost' | 'invincible_shield' | 'fire_aura' | 'nuke' | 'vampire_lifesteal' | 'orbital_orbs';

export type AirdropType = 'health_crate' | 'shield_crate' | 'weapon_crate' | 'bomb_prank' | 'gold_crate' | 'music_crate' | PowerUpType;

/** An active timed power-up on a player */
export interface ActivePowerUp {
  type: PowerUpType;
  /** When the power-up was activated (timestamp) */
  startTime: number;
  /** Duration in seconds */
  duration: number;
}

/** Unique attack pattern for each boss type */
export type BossAttackPattern = 'laser_beam' | 'ground_pound' | 'summon_minion' | 'vortex_spin' | 'missile_barrage';

/** Minion spawned by TITAN boss */
export interface Minion {
  id: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  size: number;
  color: string;
  speed: number;
  /** Current movement target */
  targetX: number;
  targetZ: number;
  /** Timestamp of last attack */
  lastAttackTime: number;
}

/** Boss monster data */
export interface Boss {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  x: number;
  z: number;
  y: number;
  size: number;
  phase: number; // 1, 2, 3 — gets harder
  color: string;
  alive: boolean;
  /** Time when boss was spawned */
  spawnTime: number;
  /** Last attack timestamp for cooldown */
  lastAttackTime: number;
  /** Movement target */
  targetX: number;
  targetZ: number;
  /** Unique attack pattern for this boss type */
  attackPattern: BossAttackPattern;
  /** Timestamp of special ability usage */
  lastSpecialAttack: number;
  /** Direction the laser is sweeping (for laser_beam pattern) */
  laserAngle?: number;
  /** Vortex active duration remaining (for vortex_spin pattern) */
  vortexTimer?: number;
  /** Number of summons remaining (for summon_minion pattern) */
  summonCount?: number;
}

/** Random event types */
export type GameEventType =
  | 'fire_rain'
  | 'heal_wave'
  | 'ghost_mode'
  | 'double_damage'
  | 'speed_round'
  | 'nuke_drop';

/** A random game event */
export interface GameEvent {
  id: string;
  type: GameEventType;
  /** Duration in seconds (0 for instant) */
  duration: number;
  /** When the event started (timestamp) */
  startTime: number;
  /** Whether the event is still active */
  active: boolean;
  /** Custom string description */
  label: string;
  emoji: string;
}

export interface Gift {
  id: string;
  name: string;
  label: string;
  cost: number;
  emoji: string;
  color: string;
  effectDescription: string;
  /** Alternative names for matching (English, Indonesian, etc.) */
  aliases?: string[];
  /** Known TikTok gift IDs for direct matching */
  tiktokGiftIds?: number[];
  /** Category for grouping */
  category?: 'heal' | 'shield' | 'weapon' | 'speed' | 'attack' | 'buff' | 'massive';
}

export interface GiftEvent {
  id: string;
  username: string;
  giftName: string;
  amount: number;
  timestamp: string;
  avatarSeed: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  badge?: 'gifter' | 'moderator' | 'subscriber' | 'viewer';
  avatarSeed: string;
}

export interface TapEvent {
  id: string;
  username: string;
  x: number; // percentage from left
  y: number; // percentage from top
  color: string;
}

export interface Airdrop {
  id: string;
  x: number;
  z: number;
  type: AirdropType;
  size: number;
  y: number; // fall from sky
}

export interface GameSettings {
  roundDuration: number; // in seconds
  safeZoneShrinkSpeed: number; // speed at which ring contracts
  autoSpawnBotsCommentRate: number; // comments per minute
  autoSpawnBotsGiftRate: number; // gifts per minute
  gravity: number;
  arenaRadius: number;
}

/** Game mode: Battle Royale (PvP) or Boss Raid (co-op vs boss) */
export type GameMode = 'battle_royale' | 'boss_raid';

/** Current state of a Boss Raid co-op match */
export interface RaidState {
  wave: number;
  maxWaves: number;
  phase: number;
  isActive: boolean;
  /** Total damage dealt to current boss */
  totalDamageDealt: number;
}

export interface MatchHistoryEntry {
  id: string;
  winnerName: string;
  winnerColor: string;
  kills: number;
  timestamp: string;
  /** Name of the boss MVP (top boss damage dealer) for this match */
  bossMvpName?: string;
}
