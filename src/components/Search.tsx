import { useEffect, useRef, useState } from 'react';

/**
 * Site search (Phase 2, D24). Pagefind indexes the article text after `astro build`
 * and serves a small index from /pagefind/; this loads it on first use and searches as
 * you type. In `astro dev` there is no index, so it says how to try it.
 */

interface PagefindResult {
  url: string;
  excerpt: string;
  meta: { title?: string };
}
interface Pagefind {
  init: () => Promise<void>;
  debouncedSearch: (
    q: string,
    opts?: object,
    ms?: number,
  ) => Promise<{ results: { id: string; data: () => Promise<PagefindResult> }[] } | null>;
}

const INDEX_URL = '/pagefind/pagefind.js';
const MAX_RESULTS = 10;

let loading: Promise<Pagefind | null> | null = null;
function loadPagefind() {
  loading ??= import(/* @vite-ignore */ INDEX_URL)
    .then(async (pf: Pagefind) => {
      await pf.init();
      return pf;
    })
    .catch(() => null);
  return loading;
}

type State =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'done'; query: string; results: PagefindResult[] }
  | { kind: 'unavailable' };

export default function Search() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let stale = false;
    loadPagefind().then(async (pf) => {
      if (stale) return;
      if (!pf) return setState({ kind: 'unavailable' });
      setState({ kind: 'searching' });
      const search = await pf.debouncedSearch(q, {}, 200);
      if (!search || stale) return;
      const results = await Promise.all(search.results.slice(0, MAX_RESULTS).map((r) => r.data()));
      if (!stale) setState({ kind: 'done', query: q, results });
    });
    return () => {
      stale = true;
    };
  }, [query]);

  const shown = query.trim() ? state : ({ kind: 'idle' } as State);

  return (
    <div className="ig-search">
      <form className="ig-search__bar" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="ig-search-q">Search for posts containing:</label>
        <input
          id="ig-search-q"
          ref={input}
          type="search"
          value={query}
          autoComplete="off"
          placeholder="e.g. memes, interview, lofi"
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="ig-search__results" aria-live="polite">
        {shown.kind === 'searching' && <p>Searching…</p>}
        {shown.kind === 'unavailable' && (
          <p>Search runs on the built site (npm run build, then npm run preview).</p>
        )}
        {shown.kind === 'done' &&
          (shown.results.length ? (
            <>
              <p className="ig-search__count">
                {shown.results.length === MAX_RESULTS ? 'Top ' : ''}
                {shown.results.length} {shown.results.length === 1 ? 'post' : 'posts'} found
              </p>
              <ul className="ig-filelist">
                {shown.results.map((r) => (
                  <li key={r.url}>
                    <a href={r.url}>
                      <span className="ig-filelist__title">{r.meta.title ?? r.url}</span>
                      {/* Pagefind escapes the text and wraps matches in <mark>. */}
                      <span
                        className="ig-filelist__summary"
                        dangerouslySetInnerHTML={{ __html: r.excerpt }}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>No posts match &ldquo;{shown.query}&rdquo;.</p>
          ))}
      </div>
    </div>
  );
}
