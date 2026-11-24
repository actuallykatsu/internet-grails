// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://internetgrails.com',
  integrations: [react(), sitemap()],
  prefetch: true,
  // The dev toolbar floats over the bottom of the page, where the taskbar and the
  // mobile mini player live, so it's off.
  devToolbar: { enabled: false },
  // Contact form service (D21). Both are public: they end up in the page anyway.
  env: {
    schema: {
      PUBLIC_CONTACT_ENDPOINT: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        url: true,
      }),
      PUBLIC_CONTACT_ACCESS_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
});
