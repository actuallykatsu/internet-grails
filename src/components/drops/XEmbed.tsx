import { useEffect, useRef } from 'react';

/**
 * X's official embed: the fallback for drops we have no copy of (D25). Until X's script
 * loads, and for visitors who block it, it's a plain link to the post. The script loads
 * once, and only when an embed scrolls near the screen.
 */

interface Twttr {
  widgets: { load: (el?: Element) => Promise<unknown> };
}
declare global {
  interface Window {
    twttr?: Twttr;
  }
}

const WIDGETS_URL = 'https://platform.twitter.com/widgets.js';
let loading: Promise<Twttr | null> | null = null;

function loadWidgets(): Promise<Twttr | null> {
  loading ??= new Promise((resolve) => {
    if (window.twttr?.widgets) return resolve(window.twttr);
    const script = document.createElement('script');
    script.src = WIDGETS_URL;
    script.async = true;
    script.onload = () => resolve(window.twttr ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return loading;
}

export default function XEmbed({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        loadWidgets().then((twttr) => twttr?.widgets.load(el));
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="ig-xembed" ref={box}>
      <blockquote className="twitter-tweet" data-dnt="true" data-conversation="none">
        <a href={url}>View this post on X</a>
      </blockquote>
    </div>
  );
}
