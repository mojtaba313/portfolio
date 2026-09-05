/**
 * Persian (fa-IR) UI strings.
 *
 * The site is Persian-only for now, so there is no i18n routing, no locale
 * negotiation, and no message-loading machinery. This module exists purely so
 * that components read their copy from one place instead of hardcoding it
 * inline. If an English pass ever happens, the shape here is what gets a
 * sibling `en.ts` — the components themselves shouldn't need to change.
 *
 * Deliberately NOT included here: anything the terminal prints. Terminal
 * output is always English by design and lives with the commands themselves.
 */

export const site = {
  /** Author's display name, used in metadata and the hero. */
  name: "مجتبی",
  /** Short role label. Kept separate from `name` so the hero can compose them. */
  role: "توسعه‌دهنده فول‌استک",
  /** One-line positioning statement for metadata and the hero subtitle. */
  tagline: "طراحی و ساخت وب‌اپلیکیشن‌های سریع با Next.js، Node.js و TypeScript",
  /**
   * Canonical origin. Used for `metadataBase` so Open Graph and canonical URLs
   * resolve absolutely. Override per-environment via NEXT_PUBLIC_SITE_URL.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const fa = {
  meta: {
    /** Used as-is on the home page. */
    title: `${site.name} — ${site.role}`,
    /**
     * Template for child routes: Next substitutes the page's own title for %s.
     */
    titleTemplate: `%s — ${site.name}`,
    description: site.tagline,
  },

  nav: {
    /** Skip-to-content target for keyboard users. */
    skipToContent: "پرش به محتوای اصلی",
    home: "خانه",
    projects: "پروژه‌ها",
    skills: "مهارت‌ها",
    contact: "تماس",
  },

  theme: {
    /** Accessible label for the theme toggle button. */
    toggle: "تغییر پوسته",
    light: "روشن",
    dark: "تاریک",
    system: "سیستم",
  },

  terminal: {
    /**
     * Chrome around the terminal is Persian; the content inside is English.
     * These labels sit on the RTL side of that boundary.
     */
    open: "باز کردن ترمینال",
    close: "بستن ترمینال",
    title: "ترمینال",
    resizeHandle: "تغییر اندازه ترمینال",
    /** Hint shown to users who haven't discovered the shortcut. */
    shortcutHint: "برای باز و بسته کردن، Ctrl و ` را با هم بزنید",
  },

  /**
   * Home page sections.
   */
  home: {
    heroCtaProjects: "دیدن پروژه‌ها",
    heroCtaContact: "تماس با من",
    heroTerminalHint: "برای باز کردن ترمینال، Ctrl و ` را بزنید",
    projectsTitle: "پروژه‌ها",
    projectsSubtitle: "چند نمونه از کارهایی که ساخته‌ام.",
    projectsEmpty: "هنوز پروژه‌ای منتشر نشده است.",
    skillsTitle: "گراف مهارت‌ها",
    skillsSubtitle:
      "نقشهٔ تعاملی مهارت‌ها و پروژه‌هایی که در آن‌ها به کار رفته‌اند.",
    githubTitle: "فعالیت گیت‌هاب",
    githubSubtitle: "آمار مخازن و مشارکت‌ها، به‌روزرسانی‌شده به‌صورت زمان‌بندی‌شده.",
    contactTitle: "تماس",
    contactSubtitle: "برای همکاری یا پیشنهاد شغلی پیام بدهید.",
    comingSoon: "این بخش در مرحلهٔ بعدی ساخته می‌شود.",
  },

  project: {
    /** Verb-led so it reads naturally next to a project title. */
    viewLive: "مشاهدهٔ سایت",
    viewRepo: "کد منبع",
    backToProjects: "بازگشت به پروژه‌ها",
    client: "کارفرما",
    completedAt: "تاریخ انجام",
    skillsUsed: "فناوری‌های به‌کاررفته",
    featured: "شاخص",
    notFoundTitle: "پروژه پیدا نشد",
    notFoundBody: "این نشانی به هیچ پروژهٔ منتشرشده‌ای مربوط نیست.",
  },

  common: {
    loading: "در حال بارگذاری…",
    error: "خطایی رخ داد",
    retry: "تلاش دوباره",
    /** Shown by the route error boundary — deliberately non-technical. */
    errorTitle: "مشکلی پیش آمد",
    errorBody:
      "این بخش موقتاً در دسترس نیست. چند لحظه بعد دوباره تلاش کنید یا به صفحهٔ اصلی برگردید.",
    backHome: "بازگشت به صفحهٔ اصلی",
  },
} as const;
