import { useCallback, useEffect, useState } from 'react';
import { dropHref } from '../lib/drop';
import { hasStoredSession, supabase, supabaseEnabled } from '../lib/supabase';

/**
 * The moderation page (D37): the latest comments, reported ones still showing first,
 * with Hide and Ban. Only works for accounts marked as moderators in the database; the
 * database checks that on every action, so this page being public gives nothing away.
 */

interface Row {
  id: string;
  target: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  hidden: boolean;
  user_id: string;
  display_name: string;
  banned: boolean;
  reports: number;
}

type State = 'loading' | 'signed-out' | 'not-moderator' | 'error' | Row[];

function targetHref(target: string) {
  const [kind, id] = target.split(':');
  return kind === 'drop' ? dropHref({ id }) : `/posts/${id}/`;
}

async function fetchQueue(): Promise<State> {
  if (!supabaseEnabled || !hasStoredSession()) return 'signed-out';
  try {
    const sb = await supabase();
    const { data: auth } = await sb.auth.getSession();
    if (!auth.session || auth.session.user.is_anonymous) return 'signed-out';
    const { data: moderator } = await sb.rpc('is_moderator');
    if (moderator !== true) return 'not-moderator';
    const { data, error } = await sb.rpc('moderation_comments');
    if (error) throw error;
    return (data as Row[]).map((r) => ({ ...r, reports: Number(r.reports) }));
  } catch (err) {
    console.warn('mod: load failed', err);
    return 'error';
  }
}

export default function ModQueue() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => fetchQueue().then(setState), []);
  useEffect(() => {
    let live = true;
    fetchQueue().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  async function act(key: string, fn: string, args: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key);
    setError(undefined);
    const sb = await supabase();
    const { error } = await sb.rpc(fn, args);
    setBusy(undefined);
    if (error) return setError(`That didn't work: ${error.message}`);
    await load();
  }

  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'signed-out')
    return (
      <p>
        Sign in first: open any drop, and use <strong>Sign in</strong> under its comments. Then come
        back here.
      </p>
    );
  if (state === 'not-moderator')
    return <p>This account isn&rsquo;t a moderator. Ask Neil to make it one.</p>;
  if (state === 'error')
    return (
      <p>
        Couldn&rsquo;t load the comments.{' '}
        <button type="button" className="ig-btn" onClick={load}>
          Try again
        </button>
      </p>
    );

  return (
    <>
      <p className="ig-mod__meta" role="status">
        {error ??
          `${state.length} latest comments. Reported ones that are still showing come first.`}
      </p>
      {state.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul className="ig-mod">
          {state.map((r) => (
            <li
              key={r.id}
              className="ig-mod__item"
              data-hidden={r.hidden || undefined}
              data-reported={(r.reports > 0 && !r.hidden) || undefined}
            >
              <p className="ig-mod__meta">
                <strong>{r.display_name}</strong>
                {r.banned && <span>Banned</span>}
                <time dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
                <a href={`${targetHref(r.target)}#comments`}>
                  {r.parent_id ? 'Reply on' : 'On'} {r.target}
                </a>
                {r.reports > 0 && (
                  <span>
                    {r.reports} {r.reports === 1 ? 'report' : 'reports'}
                  </span>
                )}
                {r.hidden && <span>Hidden</span>}
              </p>
              <p className="ig-mod__body">{r.body}</p>
              <div className="ig-mod__acts">
                <button
                  type="button"
                  className="ig-btn"
                  disabled={busy !== undefined}
                  onClick={() =>
                    act(`hide-${r.id}`, 'moderate_comment', { p_comment: r.id, p_hide: !r.hidden })
                  }
                >
                  {r.hidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  type="button"
                  className="ig-btn"
                  disabled={busy !== undefined}
                  onClick={() =>
                    act(
                      `ban-${r.user_id}`,
                      'set_banned',
                      { p_user: r.user_id, p_banned: !r.banned },
                      r.banned
                        ? `Unban ${r.display_name}? Their old comments stay hidden.`
                        : `Ban ${r.display_name}? They can't comment again, and all their comments are hidden.`,
                    )
                  }
                >
                  {r.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
