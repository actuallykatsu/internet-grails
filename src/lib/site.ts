/**
 * Single source of truth for the business identity.
 * Keep "Internet Grails" spelled identically everywhere (site, X, TikTok, email signature).
 */
export const SITE = {
  name: 'Internet Grails',
  url: 'https://internetgrails.com',
  tagline: 'Your daily hub for internet culture: memes, music, trends and news.',
  email: 'marketing@internetgrails.com',
  x: { handle: '@internetgrails', url: 'https://x.com/internetgrails' },
  // TODO: confirm the TikTok handle before the badge applications.
  tiktok: null as null | { handle: string; url: string },
  founded: '2026',
} as const;

/** Desktop sections: which post types each lists, and which kind of drop (D25) it shows. */
export const SECTIONS = [
  { id: 'memes', label: 'Memes', icon: 'memes', types: ['meme-gallery'], drops: 'meme' },
  { id: 'videos', label: 'Videos', icon: 'videos', types: [], drops: 'video' },
  { id: 'music', label: 'Music', icon: 'music', types: ['music-pick'], drops: null },
  { id: 'trends', label: 'Trends', icon: 'trends', types: ['trend-roundup'], drops: null },
  {
    id: 'news',
    label: 'News',
    icon: 'news',
    types: ['news', 'daily-roundup', 'interview'],
    drops: null,
  },
  { id: 'vault', label: 'The Vault', icon: 'vault', types: 'all', drops: null },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function organizationJsonLd() {
  const sameAs = [SITE.x.url, SITE.tiktok?.url].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    email: SITE.email,
    sameAs,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'Business & press inquiries',
        email: SITE.email,
      },
    ],
  };
}

/**
 * Which logo the site shows. 'globe' draws a real spinning globe behind the orbit
 * and letters; 'classic' is the flat trace of the artwork (the fallback).
 */
export const LOGO_VARIANT: 'globe' | 'classic' = 'globe';
