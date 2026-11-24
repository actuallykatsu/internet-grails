import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';

/**
 * The one Supabase connection the site shares: "Grail it" likes (D36) and comments (D37).
 * The library is big, so it loads only when it's needed: a visitor grails, comments,
 * already has a sign-in kept in the browser, or arrives from an email sign-in link.
 */

export const SUPABASE_URL = PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
export const SUPABASE_KEY = PUBLIC_SUPABASE_KEY;

/** False when the build has no Supabase project: grails and comments are hidden. */
export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_KEY);

/**
 * Where the sign-in is kept (localStorage). Named before comments existed; kept so
 * visitors who already grailed stay signed in.
 */
export const AUTH_STORAGE_KEY = 'ig-grails-auth';

let client: Promise<SupabaseClient> | undefined;
export function supabase() {
  return (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // Email sign-in links come back with the session in the address (#access_token=...).
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    }),
  ));
}

/** Is a sign-in (anonymous or a member's) kept in this browser? */
export function hasStoredSession() {
  try {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}

/** Did the visitor just arrive from an email sign-in link (or a failed one)? */
export function authInUrl() {
  return /[#&](access_token|error_description)=/.test(location.hash);
}

/** Headers for plain reads that don't need the library. */
export const readHeaders = () => ({ apikey: SUPABASE_KEY!, 'Content-Type': 'application/json' });
