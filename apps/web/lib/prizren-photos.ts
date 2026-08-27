/**
 * Curated local Prizren photographs.
 * Licenses and authors: public/images/prizren/CREDITS.md
 */

/** Monument-focused slides for the homepage hero (slower than auth). */
export const HOME_HERO_SLIDES = [
  '/images/prizren/fortress.jpg',
  '/images/prizren/stone-bridge-mosque.jpg',
  '/images/prizren/league.jpg',
  '/images/prizren/shadervan.jpg',
  '/images/prizren/sunset-mosque.jpg',
  '/images/prizren/cityscape.jpg',
  '/images/prizren/night.jpg',
] as const;

export const HOME_HERO_INTERVAL_MS = 4500;

export type HeritagePlace = {
  src: string;
  nameKey:
    | 'kalaja'
    | 'league'
    | 'stoneBridge'
    | 'sinanPasha'
    | 'shadervan'
    | 'tabakhane'
    | 'marash'
    | 'bistrica';
};

/**
 * Gallery cards. Only places with a verified, clearly licensed photo.
 * Neighborhoods without a public-domain / CC photo are omitted on purpose.
 */
export const HERITAGE_GALLERY: HeritagePlace[] = [
  { src: '/images/prizren/fortress.jpg', nameKey: 'kalaja' },
  { src: '/images/prizren/league.jpg', nameKey: 'league' },
  { src: '/images/prizren/stone-bridge-mosque.jpg', nameKey: 'stoneBridge' },
  { src: '/images/prizren/sunset-mosque.jpg', nameKey: 'sinanPasha' },
  { src: '/images/prizren/shadervan.jpg', nameKey: 'shadervan' },
  { src: '/images/prizren/tabakhane.jpg', nameKey: 'tabakhane' },
  { src: '/images/prizren/marash.jpg', nameKey: 'marash' },
  { src: '/images/prizren/bistrica.jpg', nameKey: 'bistrica' },
];
