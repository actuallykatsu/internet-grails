import { useEffect, useSyncExternalStore } from 'react';
import {
  SUPABASE_URL as API,
  hasStoredSession as hasSession,
  readHeaders,
  supabase,
  supabaseEnabled,
} from './supabase';

/**
 * "Grail it" likes (D36), stored in Supabase (see supabase/migrations/). Totals come
 * from one small request per page, batched across every button on it. The Supabase
 * library only loads when a visitor grails something, or already has, and the first
 * grail signs them in anonymously, so a like belongs to a visitor without an account.
 */

/** False when the build has no Supabase project: the buttons are hidden. */
export const grailsEnabled = supabaseEnabled;

export type GrailTarget = `drop:${string}` | `post:${string}`;

interface State {
  count?: number;
  mine: boolean;
  busy: boolean;
  error?: string;
}

const states = new Map<string, State>();
const listeners = new Set<() => void>();
const requested = new Set<string>();
let queued = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const get = (t: string): State => states.get(t) ?? { mine: false, busy: false };
function set(t: string, patch: Partial<State>) {
  states.set(t, { ...get(t), ...patch });
  listeners.forEach((l) => l());
}

async function loadCounts(targets: string[]) {
  const res = await fetch(`${API}/rest/v1/rpc/grail_counts`, {
    method: 'POST',
    headers: readHeaders(),
    body: JSON.stringify({ targets }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { target: string; count: number }[];
  const counts = new Map(rows.map((r) => [r.target, Number(r.count)]));
  // Leave a total alone if the visitor already changed it while this was loading.
  for (const t of targets) if (get(t).count === undefined) set(t, { count: counts.get(t) ?? 0 });
}

async function loadMine(targets: string[]) {
  if (!hasSession()) return;
  const sb = await supabase();
  const { data: auth } = await sb.auth.getSession();
  if (!auth.session) return;
  const { data, error } = await sb.from('grails').select('target').in('target', targets);
  if (error) throw error;
  for (const { target } of data as { target: string }[]) set(target, { mine: true });
}

function flush() {
  flushTimer = undefined;
  const targets = [...queued];
  queued = new Set();
  for (let i = 0; i < targets.length; i += 200) {
    const batch = targets.slice(i, i + 200);
    // A failed load just leaves the buttons without numbers; grailing still works.
    loadCounts(batch).catch((err) => console.warn('grails: counts failed', err));
    loadMine(batch).catch((err) => console.warn('grails: own grails failed', err));
  }
}

function request(target: string) {
  if (!grailsEnabled || requested.has(target)) return;
  requested.add(target);
  queued.add(target);
  flushTimer ??= setTimeout(flush, 20);
}

async function toggle(target: GrailTarget) {
  const before = get(target);
  if (before.busy) return;
  const mine = !before.mine;
  const count = before.count === undefined ? undefined : before.count + (mine ? 1 : -1);
  set(target, { mine, count, busy: true, error: undefined });
  try {
    const sb = await supabase();
    const { data: auth } = await sb.auth.getSession();
    let userId = auth.session?.user.id;
    if (!userId) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      userId = data.user?.id;
    }
    const { error } = mine
      ? await sb.from('grails').insert({ target })
      : await sb.from('grails').delete().eq('target', target).eq('user_id', userId!);
    // Already grailed in another tab: that's the state we wanted.
    if (error && error.code !== '23505') throw error;
    set(target, { busy: false });
  } catch (err) {
    const message = (err as { message?: string }).message ?? '';
    set(target, {
      mine: before.mine,
      count: before.count,
      busy: false,
      error: /slow down|rate limit|too many/i.test(message)
        ? 'Slow down a little'
        : "Couldn't save. Try again.",
    });
    window.setTimeout(() => set(target, { error: undefined }), 4000);
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** A target's total, whether this visitor grailed it, and a toggle. */
export function useGrail(target: GrailTarget) {
  useEffect(() => request(target), [target]);
  const state = useSyncExternalStore(
    subscribe,
    () => states.get(target),
    () => undefined,
  );
  return { ...(state ?? { mine: false, busy: false }), toggle: () => toggle(target) };
}
