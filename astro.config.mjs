// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // The address the site is built for. The preview deploy sets SITE_URL to
  // https://preview.internetgrails.com (D30); any address other than the real one marks
  // every page noindex (see Base.astro).
  site: process.env.SITE_URL || 'https://internetgrails.com',
  // The moderation page (D37) stays out of the sitemap.
  integrations: [
    react(),
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/mod/') }),
  ],
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
      // Supabase (D36): the project URL and its publishable key. Both are public; the
      // database's row-level security is what protects the data. Without them, the
      // "Grail it" buttons are hidden.
      PUBLIC_SUPABASE_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        url: true,
      }),
      PUBLIC_SUPABASE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
});
