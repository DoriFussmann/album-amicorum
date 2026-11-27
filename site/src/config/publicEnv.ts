/**
 * Public, build-time settings read from the environment (Vercel → Settings →
 * Environment Variables, or site/.env locally). Empty values keep the
 * feature off. Never put secrets here: PUBLIC_ values ship in the HTML.
 */

/** Google Analytics 4 measurement ID ("G-XXXXXXXXXX"). */
export const ANALYTICS_ID = String(import.meta.env.PUBLIC_ANALYTICS_ID ?? "")
  .trim()
  .replace(/[^A-Za-z0-9-]/g, "");

/** Google Search Console HTML-tag verification token. */
export const SEARCH_CONSOLE_VERIFICATION = String(import.meta.env.PUBLIC_SEARCH_CONSOLE_VERIFICATION ?? "").trim();

const clean = (v: unknown) => String(v ?? "").trim().replace(/[^A-Za-z0-9_\-]/g, "");

/** Google Ads tag ID ("AW-123456789"). Empty keeps Google Ads tracking off. */
export const GOOGLE_ADS_ID = clean(import.meta.env.PUBLIC_GOOGLE_ADS_ID);

/** Google Ads conversion labels (the part after "AW-…/"). Empty skips that conversion. */
export const GOOGLE_ADS_LABELS = {
  purchase: clean(import.meta.env.PUBLIC_GOOGLE_ADS_PURCHASE_LABEL),
  add_to_cart: clean(import.meta.env.PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL),
  begin_checkout: clean(import.meta.env.PUBLIC_GOOGLE_ADS_BEGIN_CHECKOUT_LABEL),
  amazon_click: clean(import.meta.env.PUBLIC_GOOGLE_ADS_AMAZON_CLICK_LABEL),
};
