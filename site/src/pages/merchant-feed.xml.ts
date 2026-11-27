import { getCollection } from "astro:content";
import { SITE_URL } from "../config/site";
import { bookOgImageSrc } from "../lib/shop/bookAssets";
import { isListedTheme, offerPrice, sortThemes } from "../lib/shop/themes";
import { SHIPPING_FLAT_RATE } from "../lib/shop/cart";
import { ISBN } from "../lib/shop/retail";

/**
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 * Fetched by Merchant Center on a schedule; built from the books collection.
 */
export const prerender = true;

/** Singular edition names used in product titles. */
const EDITION: Record<string, string> = {
  flowers: "Flower",
  animals: "Animal",
  mermaids: "Mermaid",
  dinosaurs: "Dinosaur",
  space: "Space",
  fairies: "Fairy",
  forest: "Forest",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

export async function GET() {
  const books = sortThemes((await getCollection("books")).filter(isListedTheme));
  const items: string[] = [];

  for (const book of books) {
    const { data } = book;
    const edition = EDITION[data.slug] ?? data.title;
    const title = `My Friends Book: ${edition} Edition – Friendship Book for Kids, Hardcover`;
    const description =
      `A keepsake friend book for ages 5–12. Up to 30 friends each fill in their own two pages with ` +
      `memories, favorite things, drawings and a message. ${data.tagline} 64-page square hardcover, ` +
      `30 × 30 cm (11.8 in), with ${edition.toLowerCase()}-themed illustrations. First Edition, 2026.`;
    const image = abs(await bookOgImageSrc(data.cover));
    const extra: string[] = [];
    for (const p of (data.gallery ?? []).slice(0, 10)) {
      if (p === data.cover) continue;
      extra.push(abs(await bookOgImageSrc(p)));
    }
    const gtin = ISBN[data.slug];

    items.push(`    <item>
      <g:id>${esc(data.slug)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(description)}</g:description>
      <g:link>${esc(`${SITE_URL}/friend-book/${data.slug}/`)}</g:link>
      <g:image_link>${esc(image)}</g:image_link>
${extra.map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n")}
      <g:availability>in_stock</g:availability>
      <g:price>${offerPrice(data.price)} USD</g:price>
      <g:brand>Album Amicorum</g:brand>
${gtin ? `      <g:gtin>${gtin}</g:gtin>` : "      <g:identifier_exists>no</g:identifier_exists>"}
      <g:condition>new</g:condition>
      <g:google_product_category>784</g:google_product_category>
      <g:product_type>Books &gt; Children's Books &gt; Friend Books</g:product_type>
      <g:age_group>kids</g:age_group>
      <g:shipping>
        <g:country>US</g:country>
        <g:price>${SHIPPING_FLAT_RATE.toFixed(2)} USD</g:price>
      </g:shipping>
    </item>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Album Amicorum – My Friends Book</title>
    <link>${SITE_URL}</link>
    <description>Friend books for kids, seven illustrated editions.</description>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
