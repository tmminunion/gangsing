export interface Player {
  id: string;
  username: string;
  avatarSeed: string; // Used to generate unique face SVGs dynamically
  hp: number;
  maxHp: number;
  shield: number;
  kills: number;
  score: number;
  size: number;
  weapon: WeaponType;
  color: string;
  team: 'arsenal' | 'psg';
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
}

export type WeaponType = 'fist' | 'sword' | 'glowing_laser' | 'battle_hammer' | 'golden_lance';

export interface Gift {
  id: string;
  name: string;
  label: string;
  cost: number;
  emoji: string;
  color: string;
  effectDescription: string;
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
  type: 'health_crate' | 'shield_crate' | 'weapon_crate';
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

export interface MatchHistoryEntry {
  id: string;
  winnerName: string;
  winnerColor: string;
  kills: number;
  timestamp: string;
}

