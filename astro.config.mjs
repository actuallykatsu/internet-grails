// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://internetgrails.com',
  integrations: [react(), sitemap()],
  prefetch: true,
  // The dev toolbar floats over the bottom of the page, where the taskbar and the
  // mobile mini player live, so it's off.
  devToolbar: { enabled: false },
});
