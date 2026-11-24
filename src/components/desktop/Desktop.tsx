import { useCallback, useState, type ReactNode } from 'react';
import Window from './Window';
import PixelIcon from '../icons/PixelIcon';
import Taskbar, { PLAYER_START_ITEM, type StartItem } from './Taskbar';
import { openPlayer } from '../../lib/player';
import { useWindowManager, type WinSpec } from './useWindowManager';
import { POLICIES, SECTIONS, SITE } from '../../lib/site';
import ContactForm from '../ContactForm';
import Search from '../Search';
import type { PostSummary } from '../../lib/posts';
import { tickerItems } from '../../lib/ticker';
import DropFeed from '../drops/DropFeed';
import type { Drop } from '../../lib/drop';

interface Props {
  posts: PostSummary[];
  /** The latest drops for the Memes and Videos windows (D25). */
  drops?: Drop[];
  /** Static wordmark passed in from Astro. */
  children?: ReactNode;
}

const EXTRA_ICONS = [
  { id: 'contact', label: 'Contact', icon: 'contact' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'about', label: 'About', icon: 'about' },
  { id: 'player', label: 'Grail Player', icon: 'player' },
] as const;

/** Desktop icons that aren't windows of their own. */
const LAUNCHERS: Record<string, () => void> = { player: openPlayer };

const ICONS = [...SECTIONS.map(({ id, label, icon }) => ({ id, label, icon })), ...EXTRA_ICONS];

const START_ITEMS: StartItem[] = [
  ...ICONS.filter(({ id }) => !LAUNCHERS[id]).map(({ id, label, icon }) => ({
    label,
    icon,
    windowId: id,
  })),
  PLAYER_START_ITEM,
  { label: "Today's Grails", icon: 'news', href: '/today/' },
  { label: 'Trend roundup mockup', icon: 'mockup', href: '/mockups/trend-roundup' },
  { label: 'Mobile mockup', icon: 'mockup', href: '/mockups/mobile' },
];

function postsFor(sectionId: string, posts: PostSummary[]) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  if (section.types === 'all') return posts;
  return posts.filter((p) => (section.types as readonly string[]).includes(p.type));
}

function SectionWindowBody({ posts, drops }: { posts: PostSummary[]; drops?: Drop[] }) {
  if (drops) {
    return (
      <div className="ig-section-drops">
        <DropFeed drops={drops} />
        <p>
          <a href="/today/">See everything in Today&rsquo;s Grails →</a>
        </p>
        {posts.length > 0 && (
          <>
            <h3>Posts</h3>
            <PostList posts={posts} />
          </>
        )}
      </div>
    );
  }
  if (!posts.length) return <p>Nothing here yet. Check back tomorrow.</p>;
  return <PostList posts={posts} />;
}

function PostList({ posts }: { posts: PostSummary[] }) {
  return (
    <ul className="ig-filelist">
      {posts.map((p) => (
        <li key={p.slug}>
          <a href={`/posts/${p.slug}/`}>
            <span className="ig-filelist__title">{p.title}</span>
            <span className="ig-filelist__meta">
              {p.typeLabel} · {p.date}
            </span>
            <span className="ig-filelist__summary">{p.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ContactBody() {
  return (
    <div className="ig-contact-card">
      <h2>{SITE.name}</h2>
      <p>Business &amp; press inquiries</p>
      <dl>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </dd>
        <dt>X</dt>
        <dd>
          <a href={SITE.x.url}>{SITE.x.handle}</a>
        </dd>
        <dt>TikTok</dt>
        <dd>{SITE.tiktok ? <a href={SITE.tiktok.url}>{SITE.tiktok.handle}</a> : 'Coming soon'}</dd>
      </dl>
      <h3>Send a message</h3>
      <ContactForm compact />
      <p>
        <a href="/contact/">Open the full Contact page →</a>
      </p>
    </div>
  );
}

function AboutBody() {
  return (
    <div>
      <p>
        <strong>{SITE.name}</strong> is a daily hub for internet culture: memes, music, trends and
        news, served on a desktop that never left 1999.
      </p>
      <p>
        <a href="/about/">Read the full About page →</a>
      </p>
      <p>
        {POLICIES.pages.map(({ href, label }, i) => (
          <span key={href}>
            {i > 0 && ' · '}
            <a href={href}>{label}</a>
          </span>
        ))}
      </p>
    </div>
  );
}

function dropsFor(sectionId: string, drops: Drop[]) {
  const kind = SECTIONS.find((s) => s.id === sectionId)?.drops;
  return kind ? drops.filter((d) => d.kind === kind) : undefined;
}

export default function Desktop({ posts, drops = [], children }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const resolve = useCallback((id: string): WinSpec | undefined => {
    const icon = ICONS.find((i) => i.id === id);
    if (!icon) return undefined;
    if (id === 'contact') return { id, title: 'Contact', w: 460, h: 640 };
    if (id === 'about') return { id, title: 'About', w: 420, h: 260 };
    if (id === 'search') return { id, title: 'Find: All Posts', w: 520, h: 480 };
    if (SECTIONS.find((s) => s.id === id)?.drops) {
      return { id, title: `C:\\Grails\\${icon.label}`, w: 620, h: 600 };
    }
    return { id, title: `C:\\Grails\\${icon.label}`, w: 560, h: 440 };
  }, []);

  const wm = useWindowManager(resolve);
  const launch = (id: string) => (LAUNCHERS[id] ? LAUNCHERS[id]() : wm.open(id));

  const renderBody = (id: string) => {
    if (id === 'contact') return <ContactBody />;
    if (id === 'about') return <AboutBody />;
    if (id === 'search') return <Search />;
    return <SectionWindowBody posts={postsFor(id, posts)} drops={dropsFor(id, drops)} />;
  };

  return (
    <div className="ig-desktop">
      <div className="ig-desktop__wordmark" aria-hidden="true">
        {children}
      </div>
      <ul className="ig-icons" aria-label="Desktop">
        {ICONS.map((icon) => (
          <li key={icon.id}>
            <button
              type="button"
              className="ig-icon"
              aria-pressed={selected === icon.id}
              onClick={(e) => {
                setSelected(icon.id);
                // Single tap opens on touch; mouse uses double-click like the real thing.
                if ((e.nativeEvent as PointerEvent).pointerType === 'touch') launch(icon.id);
              }}
              onDoubleClick={() => launch(icon.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  launch(icon.id);
                }
              }}
            >
              <span className="ig-icon__img">
                <PixelIcon name={icon.icon} size={32} />
              </span>
              <span className="ig-icon__label">{icon.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {wm.wins.map((win, i) => (
        <Window
          key={win.id}
          win={win}
          z={10 + i}
          active={wm.activeId === win.id}
          onFocus={() => wm.focus(win.id)}
          onClose={() => wm.close(win.id)}
          onMinimize={() => wm.minimize(win.id)}
          onToggleMax={() => wm.toggleMax(win.id)}
          onMove={(x, y) => wm.moveTo(win.id, x, y)}
        >
          {renderBody(win.id)}
        </Window>
      ))}

      <Taskbar
        ticker={tickerItems(posts, drops)}
        startItems={START_ITEMS}
        windows={wm.wins.map((w) => ({ id: w.id, title: w.title, active: wm.activeId === w.id }))}
        onStartItem={(item) => item.windowId && wm.open(item.windowId)}
        onWindowButton={wm.taskbarToggle}
      />
    </div>
  );
}
