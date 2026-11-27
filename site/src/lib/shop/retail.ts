/**
 * Per-edition retail identifiers, keyed by book slug.
 * Source: Amazon Seller Central (all seven listings active, US only, merchant fulfilled)
 * and the Bowker ISBN registration (Album Amicorum, First Edition 2026).
 */

/** ISBN-13 per edition. Also used as the GTIN in schema and the Merchant feed. */
export const ISBN: Record<string, string> = {
  flowers: "9798997498702",
  animals: "9798997498719",
  mermaids: "9798997498726",
  dinosaurs: "9798997498733",
  space: "9798997498740",
  fairies: "9798997498757",
  forest: "9798997498764",
};

/** Amazon ASIN per edition (amazon.com, US only). */
export const AMAZON_ASIN: Record<string, string> = {
  flowers: "B0HT1XRWSS",
  animals: "B0HT4LKJ1F",
  mermaids: "B0HT1VBBC1",
  dinosaurs: "B0HT4Y9YNX",
  space: "B0HT4RKWZM",
  fairies: "B0HT52PYD3",
  forest: "B0HT54PK1Z",
};

/** The edition's amazon.com product page, or undefined if it is not listed there. */
export function amazonUrl(slug: string): string | undefined {
  const asin = AMAZON_ASIN[slug];
  return asin ? `https://www.amazon.com/dp/${asin}` : undefined;
}
