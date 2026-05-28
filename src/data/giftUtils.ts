import { Gift } from '../types';
import { TIKTOK_GIFTS, TIKTOK_GIFT_ID_MAP } from './gifts';

/**
 * Find a gift by name with comprehensive alias matching.
 * Falls back gracefully if no match is found.
 *
 * Matching priority:
 * 1. Exact name match (case-insensitive)
 * 2. Alias match (case-insensitive)
 * 3. Partial name/alias match (one includes the other)
 * 4. Fallback with TikTok's original gift name preserved
 */
export function findGiftByName(giftName: string): Gift {
  if (!giftName) {
    return createFallbackGift('Gift');
  }

  const lowerName = giftName.toLowerCase().trim();

  // 1. Exact match
  const exact = TIKTOK_GIFTS.find(
    (g) =>
      g.name.toLowerCase() === lowerName ||
      (g.aliases && g.aliases.some((a) => a.toLowerCase() === lowerName))
  );
  if (exact) return exact;

  // 2. Partial/substring match (more forgiving)
  const partial = TIKTOK_GIFTS.find(
    (g) =>
      g.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(g.name.toLowerCase()) ||
      (g.aliases &&
        g.aliases.some(
          (a) =>
            a.toLowerCase().includes(lowerName) ||
            lowerName.includes(a.toLowerCase())
        ))
  );
  if (partial) return partial;

  // 3. Try to match individual words in the name
  const words = lowerName.split(/[\s_-]+/).filter(Boolean);
  const wordMatch = TIKTOK_GIFTS.find((g) => {
    const giftLower = g.name.toLowerCase();
    return words.some(
      (w) =>
        w.length > 2 &&
        (giftLower.includes(w) ||
          (g.aliases && g.aliases.some((a) => a.toLowerCase().includes(w))))
    );
  });
  if (wordMatch) return wordMatch;

  // No match — return a fallback with the original name preserved
  return createFallbackGift(giftName);
}

/**
 * Find a gift by TikTok gift ID.
 * Useful when the relay server sends giftId alongside gift name.
 */
export function findGiftById(giftId: number): Gift | undefined {
  const internalId = TIKTOK_GIFT_ID_MAP[giftId];
  if (!internalId) return undefined;
  return TIKTOK_GIFTS.find((g) => g.id === internalId);
}

/**
 * Find gift using both ID (preferred) and name (fallback).
 */
export function findGift(giftId?: number, giftName?: string): Gift {
  if (giftId !== undefined) {
    const byId = findGiftById(giftId);
    if (byId) return byId;
  }
  if (giftName) {
    return findGiftByName(giftName);
  }
  return createFallbackGift('Gift');
}

/**
 * Create a fallback gift object preserving the original TikTok name.
 */
function createFallbackGift(originalName: string): Gift {
  return {
    id: 'gift_unknown',
    name: originalName,
    label: originalName,
    cost: 1,
    emoji: '🎁',
    color: '#a855f7',
    effectDescription: 'Hadiah dari TikTok',
  };
}

/**
 * Categorize a gift effect for display/UI purposes.
 */
export function getGiftCategoryColor(category?: string): string {
  switch (category) {
    case 'heal':
      return '#10B981'; // green
    case 'shield':
      return '#3B82F6'; // blue
    case 'weapon':
      return '#F59E0B'; // amber
    case 'speed':
      return '#06B6D4'; // cyan
    case 'attack':
      return '#EF4444'; // red
    case 'buff':
      return '#8B5CF6'; // violet
    case 'massive':
      return '#EC4899'; // pink
    default:
      return '#a855f7'; // purple
  }
}
