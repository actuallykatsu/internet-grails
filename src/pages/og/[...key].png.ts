import type { APIRoute, GetStaticPaths } from 'astro';
import { getShareCards, type ShareCard } from '../../lib/shareCards';
import { renderShareImage } from '../../lib/shareImage';

/** A share image per page (D29), e.g. /og/posts/welcome.png. Built at build time. */
export const getStaticPaths = (async () => {
  const cards = await getShareCards();
  return cards.map((card) => ({ params: { key: card.key }, props: { card } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ card: ShareCard }> = async ({ props }) => {
  const png = await renderShareImage(props.card);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
