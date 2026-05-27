import { Gift } from '../types';

export const TIKTOK_GIFTS: Gift[] = [
  {
    id: 'gift_rose',
    name: 'Rose',
    label: 'Mawar',
    cost: 1,
    emoji: '🌹',
    color: '#FF4B72',
    effectDescription: 'Drops +30 HP healing serum near viewer avatar.'
  },
  {
    id: 'gift_heart',
    name: 'Finger Heart',
    label: 'Cubit Cinta',
    cost: 5,
    emoji: '🫰',
    color: '#FF6EA7',
    effectDescription: 'Provides instantly +50 Shield to the user avatar.'
  },
  {
    id: 'gift_icecream',
    name: 'Ice Cream',
    label: 'Es Krim',
    cost: 10,
    emoji: '🍦',
    color: '#6EE7B7',
    effectDescription: 'Summons defensive shield barrier obstacle.'
  },
  {
    id: 'gift_tiktok',
    name: 'TikTok',
    label: 'TikTok Logo',
    cost: 25,
    emoji: '🎵',
    color: '#25F4EE',
    effectDescription: 'Equips 3D Glowing Laser Sword with high melee pierce.'
  },
  {
    id: 'gift_donut',
    name: 'Donut',
    label: 'Donat',
    cost: 30,
    emoji: '🍩',
    color: '#FBBF24',
    effectDescription: 'Spawns temporary speed serum on user, making them super fast!'
  },
  {
    id: 'gift_box',
    name: 'Crate Drop',
    label: 'Airdrop Box',
    cost: 99,
    emoji: '🎁',
    color: '#FB7185',
    effectDescription: 'Drops a Golden Lance weapon crate from sky for viewer.'
  },
  {
    id: 'gift_diamond',
    name: 'Diamond',
    label: 'Berlian',
    cost: 299,
    emoji: '💎',
    color: '#3B82F6',
    effectDescription: 'Summons dynamic orbital strike that damages surrounding foes!'
  },
  {
    id: 'gift_universe',
    name: 'Universe',
    label: 'Alam Semesta',
    cost: 34999,
    emoji: '🌌',
    color: '#8B5CF6',
    effectDescription: 'Viewer grows 3x BIGGER, gains 250 Max HP and a Golden Weapon!'
  }
];
