import { useState, type FormEvent } from 'react';
import { PUBLIC_CONTACT_ACCESS_KEY, PUBLIC_CONTACT_ENDPOINT } from 'astro:env/client';
import { SITE } from '../lib/site';

/**
 * The contact form (D21). The site is static, so it posts to a hosted forms service
 * that emails marketing@. Set PUBLIC_CONTACT_ENDPOINT (and PUBLIC_CONTACT_ACCESS_KEY if
 * the service uses one) at build time. Without an endpoint it falls back to opening the
 * visitor's email app with the message filled in.
 *
 * Before React hydrates, it's a plain HTML form that posts straight to the service.
 */

type Status = 'idle' | 'sending' | 'sent' | 'error';

const SUBJECT = `${SITE.name} website: new message`;

export default function ContactForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>('idle');
  const [sentTo, setSentTo] = useState('');
  const endpoint = PUBLIC_CONTACT_ENDPOINT;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // Honeypot: people never see this field, so anything in it is a bot. Pretend it worked.
    if (data.website) {
      setStatus('sent');
      return;
    }
    delete data.website;

    if (!endpoint) {
      const body = `${data.message}\n\nFrom: ${data.name} <${data.email}>`;
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...data,
          // Different services read different subject fields; send both.
          subject: SUBJECT,
          _subject: SUBJECT,
          from_name: `${SITE.name} website`,
          ...(PUBLIC_CONTACT_ACCESS_KEY ? { access_key: PUBLIC_CONTACT_ACCESS_KEY } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!res.ok || json.success === false) throw new Error(`HTTP ${res.status}`);
      setSentTo(data.email);
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="ig-form__done" role="status">
        <p>
          <strong>Message sent.</strong> Thanks for reaching out.
          {sentTo && <> We&rsquo;ll reply to {sentTo}.</>}
        </p>
        <button className="ig-btn" type="button" onClick={() => setStatus('idle')}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="ig-form"
      data-compact={compact || undefined}
      data-mode={endpoint ? 'service' : 'email'}
      action={endpoint ?? `mailto:${SITE.email}`}
      method="post"
      onSubmit={onSubmit}
    >
      <label>
        Name <input name="name" autoComplete="name" required maxLength={100} />
      </label>
      <label>
        Email <input name="email" type="email" autoComplete="email" required maxLength={200} />
      </label>
      <label>
        Message <textarea name="message" rows={compact ? 4 : 6} required maxLength={5000} />
      </label>
      <label className="ig-form__trap" aria-hidden="true">
        Leave this empty <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="ig-btn" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send'}
      </button>
      <p className="ig-form__note" aria-live="polite">
        {status === 'error' ? (
          <>
            That didn&rsquo;t go through. Your message is still here; try again, or email{' '}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </>
        ) : endpoint ? (
          <>Goes straight to {SITE.email}.</>
        ) : (
          <>Opens your email app, addressed to {SITE.email}.</>
        )}
      </p>
    </form>
  );
}
