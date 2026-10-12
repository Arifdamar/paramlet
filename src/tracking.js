// Query parameters that only exist to track where a visit came from. Removing
// them does not change what the page shows.

const TRACKING_KEYS = new Set([
  // Google
  "gclid", "gclsrc", "gbraid", "wbraid", "dclid", "gad_source", "gad_campaignid", "srsltid", "_gl",
  // Meta
  "fbclid", "igshid",
  // Microsoft
  "msclkid",
  // Yandex
  "yclid",
  // X, TikTok, LinkedIn, Reddit
  "twclid", "ttclid", "li_fat_id", "rdt_cid",
  // Mailchimp
  "mc_cid", "mc_eid",
  // HubSpot
  "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsctatracking",
  // Marketo
  "mkt_tok",
  // Adobe
  "s_cid",
  // Olytics, Vero, Rakuten
  "oly_anon_id", "oly_enc_id", "vero_id", "vero_conv", "ranmid", "raneaid", "ransiteid",
]);

/** Whether a parameter key is a known tracking parameter (`utm_*` included). */
export function isTrackingKey(key) {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_KEYS.has(lower);
}
