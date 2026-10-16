/**
 * User-agent parsing for visit logs.
 *
 * Hand-rolled on purpose: the alternative is a ~100 kB dependency for what is
 * fundamentally four substring checks, and every byte here competes with the
 * hero's three.js payload. The output is deliberately coarse — browser family,
 * OS family, device class — because that is the level at which visit logs are
 * analysed; the raw UA string is stored alongside for anything finer.
 */

export type DeviceClass = "desktop" | "mobile" | "tablet";

export type ParsedUa = {
  browser: string | null;
  os: string | null;
  device: DeviceClass;
  isBot: boolean;
};

/**
 * Crawlers, monitors, and script UAs. Matched case-insensitively as substrings
 * against the whole UA — real browsers never contain these tokens, so a loose
 * match is safe, while a bot claiming Chrome ("Googlebot/2.1") still trips
 * "bot".
 */
const BOT_TOKENS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "headless",
  "preview",
  "lighthouse",
  "curl",
  "wget",
  "python-requests",
  "python-httpx",
  "scrapy",
  "monitor",
  "pingdom",
  "uptime",
  "feedfetcher",
  "phantom",
  "selenium",
  "axios",
  "node-fetch",
  "go-http-client",
  "okhttp",
  "libwww",
  "facebookexternalhit",
  "whatsapp",
  "telegram",
  "embedlink",
  "slackbot",
  "discordbot",
  "linkedinbot",
  "twitterbot",
  "pinterest",
  "redditbot",
  "applebot",
  "yandex",
  "baiduspider",
  "sogou",
  "duckduckbot",
  "ia_archiver",
] as const;

/**
 * Order matters in both tables: Edge and Opera both masquerade as Chrome, and
 * Chrome and Firefox both masquerade as Safari — so the impostors are tested
 * first. `headlesschrome` must precede plain `chrome/`: the word-boundary
 * assertion in `/\bchrome\//` does not fire inside "Headless**Chrome**"
 * (letters on both sides), which would let the Safari rule win instead.
 */
const BROWSERS: Array<[RegExp, string]> = [
  [/\bheadlesschrome/i, "Headless Chrome"],
  [/\bedg[ea]?\/|edge\//i, "Edge"],
  [/\bopr\/|\bopera\b/i, "Opera"],
  [/\bsamsungbrowser/i, "Samsung Internet"],
  [/\bchrome\/|\bcrios\/|\bchromium\//i, "Chrome"],
  [/\bfirefox\/|\bfxios\//i, "Firefox"],
  [/\bsafari\//i, "Safari"],
  [/\bcurl\//i, "curl"],
  [/\bwget\//i, "wget"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\bwindows\b/i, "Windows"],
  [/\bcros\b/i, "ChromeOS"],
  [/\bipad\b|\biphone\b|\bios\b/i, "iOS"],
  [/\bandroid\b/i, "Android"],
  [/\bmac os x\b|\bmacintosh\b/i, "macOS"],
  [/\blinux\b/i, "Linux"],
];

function detectDevice(ua: string): DeviceClass {
  if (/\bipad\b|\btablet\b|\bkindle\b|\bsilk\b/i.test(ua)) return "tablet";
  // Android without the "Mobile" token is a tablet by Google's own convention.
  if (/\bandroid\b/i.test(ua) && !/\bmobile\b/i.test(ua)) return "tablet";
  if (/\bmobi\b|\biphone\b|\bandroid\b|\bwindows phone\b/i.test(ua))
    return "mobile";
  return "desktop";
}

export function parseUserAgent(ua: string | null | undefined): ParsedUa {
  if (!ua || !ua.trim()) {
    return { browser: null, os: null, device: "desktop", isBot: false };
  }

  const isBot = BOT_TOKENS.some((token) => ua.toLowerCase().includes(token));

  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Other";

  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null;

  return {
    browser,
    os,
    device: isBot ? "desktop" : detectDevice(ua),
    isBot,
  };
}
