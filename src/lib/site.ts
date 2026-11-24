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

export const SECTIONS = [
  { id: 'memes', label: 'Memes', icon: '🖼️', types: ['meme-gallery'] },
  { id: 'music', label: 'Music', icon: '🎵', types: ['music-pick'] },
  { id: 'trends', label: 'Trends', icon: '📈', types: ['trend-roundup'] },
  { id: 'news', label: 'News', icon: '📰', types: ['news', 'daily-roundup', 'interview'] },
  { id: 'vault', label: 'The Vault', icon: '🗄️', types: 'all' },
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
