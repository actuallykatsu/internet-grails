import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  authInUrl,
  hasStoredSession,
  readHeaders,
  supabase,
  supabaseEnabled,
} from '../lib/supabase';

/**
 * Comments (D37), drawn as an old instant-messenger chat window. Anyone can read them.
 * Writing needs an account: an email sign-in link, then a screen name. Replies go one
 * level deep. Anyone can report a comment; moderators work through /mod/.
 */

export type CommentTarget = `drop:${string}` | `post:${string}`;

interface Comment {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  author: { display_name: string } | null;
}

type Who =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'anon'; userId: string }
  | { kind: 'member'; userId: string; email?: string; name?: string | null; moderator: boolean };

const COLUMNS = 'id,parent_id,body,created_at,user_id,author:profiles(display_name)';
const NAME_RULES = '2 to 24 letters, numbers, spaces, dots, dashes or underscores.';

export default function Comments({ target }: { target: CommentTarget }) {
  if (!supabaseEnabled) return null;
  return <Chat target={target} />;
}

function Chat({ target }: { target: CommentTarget }) {
  const [comments, setComments] = useState<Comment[] | 'error'>();
  const [who, setWho] = useState<Who>({ kind: 'loading' });
  const [notice, setNotice] = useState<string>();
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Comment>();
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The list: a plain request, so reading never loads the Supabase library.
  const load = useCallback(() => fetchComments(target).then(setComments), [target]);
  useEffect(() => {
    let live = true;
    fetchComments(target).then((list) => live && setComments(list));
    return () => {
      live = false;
    };
  }, [target]);

  const learn = useCallback(async (sb: SupabaseClient, session: Session | null) => {
    const user = session?.user;
    if (!user) return setWho({ kind: 'guest' });
    if (user.is_anonymous) return setWho({ kind: 'anon', userId: user.id });
    const [{ data }, { data: moderator }] = await Promise.all([
      sb.from('profiles').select('display_name').eq('id', user.id),
      sb.rpc('is_moderator'),
    ]);
    const rows = (data ?? []) as { display_name: string }[];
    setWho({
      kind: 'member',
      userId: user.id,
      email: user.email,
      name: rows[0]?.display_name ?? null,
      moderator: moderator === true,
    });
  }, []);

  // Who's here. Only loads the library if there's a sign-in to read or one arriving
  // from an email link.
  useEffect(() => {
    const arriving = authInUrl();
    if (!arriving && !hasStoredSession()) {
      queueMicrotask(() => setWho({ kind: 'guest' }));
      return;
    }
    const failed = new URLSearchParams(location.hash.slice(1)).get('error_description');
    let unsubscribe: (() => void) | undefined;
    supabase().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      await learn(sb, data.session);
      const sub = sb.auth.onAuthStateChange((event, session) => {
        if (event !== 'INITIAL_SESSION') setTimeout(() => learn(sb, session));
      });
      unsubscribe = () => sub.data.subscription.unsubscribe();
      if (arriving) {
        if (failed) setNotice(`That sign-in link didn't work (${failed}). Send a new one.`);
        if (location.href.includes('#'))
          history.replaceState(null, '', location.pathname + location.search);
        root.current?.scrollIntoView({ block: 'start' });
      }
    });
    return () => unsubscribe?.();
  }, [learn]);

  const { tops, replies } = useMemo(() => {
    const list = Array.isArray(comments) ? comments : [];
    const byId = new Map(list.map((c) => [c.id, c]));
    const tops = list.filter((c) => !c.parent_id);
    const replies = new Map<string, Comment[]>(tops.map((c) => [c.id, []]));
    for (const c of list) {
      if (!c.parent_id) continue;
      // Replies hang off the top comment, one level deep (the database files them that way
      // too). A reply whose comment was hidden or deleted isn't shown.
      const parent = byId.get(c.parent_id);
      replies.get(parent?.parent_id ?? c.parent_id)?.push(c);
    }
    return { tops, replies };
  }, [comments]);
  const count = Array.isArray(comments) ? tops.length + [...replies.values()].flat().length : 0;

  const myId = who.kind === 'member' || who.kind === 'anon' ? who.userId : undefined;
  const canWrite = who.kind === 'member' && !!who.name;

  function startReply(c: Comment) {
    setReplyTo(c);
    box.current?.focus();
  }

  async function report(c: Comment) {
    if (!confirm('Report this comment to the moderators?')) return;
    try {
      const sb = await supabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw error;
      }
      const { error } = await sb.from('comment_reports').insert({ comment_id: c.id });
      if (error && error.code !== '23505') throw error;
      setReported((r) => new Set(r).add(c.id));
    } catch (err) {
      console.warn('comments: report failed', err);
      setNotice("Couldn't send the report. Try again.");
    }
  }

  async function remove(c: Comment) {
    if (!confirm('Delete your comment? Replies to it go too.')) return;
    const sb = await supabase();
    const { error } = await sb.from('comments').delete().eq('id', c.id);
    if (error) return setNotice("Couldn't delete it. Try again.");
    setComments((list) =>
      Array.isArray(list) ? list.filter((x) => x.id !== c.id && x.parent_id !== c.id) : list,
    );
  }

  async function signOut() {
    const sb = await supabase();
    await sb.auth.signOut();
    setWho({ kind: 'guest' });
  }

  const message = (c: Comment, isReply: boolean) => {
    const mine = c.user_id === myId;
    return (
      <li
        key={c.id}
        id={`comment-${c.id}`}
        className="ig-chat__msg"
        data-reply={isReply || undefined}
      >
        <p>
          <span className="ig-chat__name" data-own={mine || undefined}>
            {c.author?.display_name ?? 'Someone'}
          </span>{' '}
          <time className="ig-chat__time" dateTime={c.created_at}>
            ({stamp(c.created_at)})
          </time>
          <span className="ig-chat__colon">:</span> <span className="ig-chat__body">{c.body}</span>
        </p>
        <div className="ig-chat__acts">
          {canWrite && (
            <button type="button" onClick={() => startReply(c)}>
              Reply
            </button>
          )}
          {mine ? (
            <button type="button" onClick={() => remove(c)}>
              Delete
            </button>
          ) : reported.has(c.id) ? (
            <span>Reported</span>
          ) : (
            <button type="button" onClick={() => report(c)}>
              Report
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section
      ref={root}
      id="comments"
      className="ig-window ig-chat"
      data-active="true"
      aria-labelledby="comments-title"
    >
      <div className="ig-titlebar">
        <h2 className="ig-titlebar__title" id="comments-title">
          Comments{count ? ` (${count})` : ''}
        </h2>
      </div>
      <div className="ig-chat__log" role="log" aria-live="polite">
        {comments === undefined ? (
          <p className="ig-chat__empty">Loading comments…</p>
        ) : comments === 'error' ? (
          <p className="ig-chat__empty">
            Couldn&rsquo;t load comments.{' '}
            <button type="button" className="ig-chat__link" onClick={load}>
              Try again
            </button>
          </p>
        ) : tops.length === 0 ? (
          <p className="ig-chat__empty">No comments yet. Say something.</p>
        ) : (
          <ol className="ig-chat__list">
            {tops.map((c) => (
              <li key={c.id} className="ig-chat__thread">
                <ol className="ig-chat__list">
                  {message(c, false)}
                  {(replies.get(c.id) ?? []).map((r) => message(r, true))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="ig-chat__compose">
        {notice && (
          <p className="ig-chat__notice" role="status">
            {notice}{' '}
            <button type="button" className="ig-chat__link" onClick={() => setNotice(undefined)}>
              OK
            </button>
          </p>
        )}
        {who.kind === 'loading' ? null : who.kind === 'member' && who.name === null ? (
          <NameForm onDone={(name) => setWho({ ...who, name })} onSignOut={signOut} />
        ) : who.kind === 'member' && who.name ? (
          <Composer
            target={target}
            name={who.name}
            moderator={who.moderator}
            replyTo={replyTo}
            box={box}
            onCancelReply={() => setReplyTo(undefined)}
            onPosted={(c) => {
              setReplyTo(undefined);
              setComments((list) => [...(Array.isArray(list) ? list : []), c]);
            }}
            onSignOut={signOut}
          />
        ) : (
          <SignIn anonymous={who.kind === 'anon'} />
        )}
      </div>
    </section>
  );
}

function SignIn({ anonymous }: { anonymous: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState<string>();

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    if (!email) return;
    setState('sending');
    setError(undefined);
    try {
      const sb = await supabase();
      const redirect = location.origin + location.pathname;
      let error: { code?: string; message: string; status?: number } | null = null;
      let done = false;
      if (anonymous) {
        // Turn the anonymous sign-in into an account, so the visitor's grails come along.
        ({ error } = await sb.auth.updateUser({ email }, { emailRedirectTo: redirect }));
        done = !error;
        // That email already has an account: sign in to it instead.
        if (error && (error.code === 'email_exists' || /already/i.test(error.message)))
          error = null;
      }
      if (!done && !error)
        ({ error } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirect, shouldCreateUser: true },
        }));
      if (error) throw error;
      setSentTo(email);
      setState('sent');
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      console.warn('comments: sign-in link failed', err);
      setError(
        e.status === 429 || /rate limit/i.test(e.message ?? '')
          ? 'Too many sign-in emails right now. Try again in a little while.'
          : /invalid/i.test(e.message ?? '')
            ? "That email address doesn't look right."
            : "Couldn't send the link. Try again.",
      );
      setState('idle');
    }
  }

  if (state === 'sent')
    return (
      <p className="ig-chat__note" role="status">
        <strong>Check your email.</strong> We sent a sign-in link to {sentTo}. Open it on this
        device and you&rsquo;ll come back here, signed in.{' '}
        <button type="button" className="ig-chat__link" onClick={() => setState('idle')}>
          Use another email
        </button>
      </p>
    );

  if (!open)
    return (
      <div className="ig-chat__bar">
        <span>Sign in to join the chat.</span>
        <button type="button" className="ig-btn" onClick={() => setOpen(true)}>
          Sign in
        </button>
      </div>
    );

  return (
    <form className="ig-chat__form" onSubmit={send}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={200} autoFocus />
      </label>
      <button className="ig-btn" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
      <p className="ig-chat__note" aria-live="polite">
        {error ?? (
          <>
            No password: we email you a link. Your email stays private. See the{' '}
            <a href="/guidelines/">community guidelines</a>.
          </>
        )}
      </p>
    </form>
  );
}

function NameForm({
  onDone,
  onSignOut,
}: {
  onDone: (name: string) => void;
  onSignOut: () => void;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('name') ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!/^[A-Za-z0-9_.-]+( [A-Za-z0-9_.-]+)*$/.test(name) || name.length < 2 || name.length > 24)
      return setError(`Screen names are ${NAME_RULES}`);
    setBusy(true);
    setError(undefined);
    const sb = await supabase();
    const { error } = await sb.from('profiles').insert({ display_name: name });
    setBusy(false);
    if (!error) return onDone(name);
    setError(
      error.code === '23505'
        ? 'That name is taken. Try another.'
        : error.code === '23514'
          ? `Screen names are ${NAME_RULES}`
          : "Couldn't save it. Try again.",
    );
  }

  return (
    <form className="ig-chat__form" onSubmit={save}>
      <label>
        Pick a screen name
        <input
          name="name"
          required
          minLength={2}
          maxLength={24}
          autoComplete="nickname"
          autoFocus
        />
      </label>
      <button className="ig-btn" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <p className="ig-chat__note" aria-live="polite">
        {error ?? <>It shows next to your comments. {NAME_RULES}</>}{' '}
        <button type="button" className="ig-chat__link" onClick={onSignOut}>
          Sign out
        </button>
      </p>
    </form>
  );
}

function Composer(props: {
  target: CommentTarget;
  name: string;
  moderator: boolean;
  replyTo?: Comment;
  box: RefObject<HTMLTextAreaElement | null>;
  onCancelReply: () => void;
  onPosted: (c: Comment) => void;
  onSignOut: () => void;
}) {
  const { target, name, moderator, replyTo, box } = props;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function post(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(undefined);
    const sb = await supabase();
    const { data, error } = await sb
      .from('comments')
      .insert({ target, body, parent_id: replyTo?.id ?? null })
      .select('id,parent_id,body,created_at,user_id');
    setBusy(false);
    const row = (data as Omit<Comment, 'author'>[] | null)?.[0];
    if (error || !row) {
      return setError(
        error?.code === 'P0001'
          ? error.message
          : error?.code === '42501'
            ? "You can't comment right now."
            : "Couldn't send. Try again.",
      );
    }
    setText('');
    props.onPosted({ ...row, author: { display_name: name } });
  }

  return (
    <form className="ig-chat__form" onSubmit={post}>
      {replyTo && (
        <p className="ig-chat__replying">
          Replying to <strong>{replyTo.author?.display_name ?? 'Someone'}</strong>{' '}
          <button type="button" className="ig-chat__link" onClick={props.onCancelReply}>
            Cancel
          </button>
        </p>
      )}
      <label className="sr-only" htmlFor="ig-chat-text">
        {replyTo ? 'Your reply' : 'Your comment'}
      </label>
      <div className="ig-chat__send">
        <textarea
          id="ig-chat-text"
          ref={box}
          rows={2}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, as in the old chat apps; Shift+Enter starts a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) void post(e);
          }}
        />
        <button className="ig-btn" type="submit" disabled={busy || !text.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
      <p className="ig-chat__note" aria-live="polite">
        {error ?? (
          <>
            Signed in as <strong>{name}</strong>.{' '}
            <button type="button" className="ig-chat__link" onClick={props.onSignOut}>
              Sign out
            </button>
            {moderator && (
              <>
                {' · '}
                <a href="/mod/">Moderation</a>
              </>
            )}
          </>
        )}
      </p>
    </form>
  );
}

async function fetchComments(target: CommentTarget): Promise<Comment[] | 'error'> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/comments?select=${COLUMNS}&target=eq.${encodeURIComponent(target)}&order=created_at.asc&limit=500`;
    const res = await fetch(url, { headers: readHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Comment[];
  } catch (err) {
    console.warn('comments: load failed', err);
    return 'error';
  }
}

/** "3:42 PM" today, "Nov 3, 3:42 PM" this year, "Nov 3, 2025" before. */
function stamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (d.getFullYear() === now.getFullYear())
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
