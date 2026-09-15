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
    github: "گیت‌هاب",
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
    /** Latin eyebrow above the headline. Never translated — it is a signature. */
    heroEyebrow: "MOJTABA",
    /** Headline, one entry per revealed line. Confident, no marketing noise. */
    heroHeadline: [
      "چیزی میسازم",
      "که فقط کار نکنه",
      "لذتشو ببری",
    ],
    /** Latin stack line under the supporting text. */
    heroStack: "Next.js · React · TypeScript · Node.js",
    heroScroll: "اسکرول",
    /** Believable editor content for the hero visual — real stack, minimal. */
    heroCodeFile: "experience.ts",
    heroCode: [
      "const experience = {",
      '  frontend: ["React", "Next.js"],',
      '  motion: ["GSAP", "Motion"],',
      '  language: "TypeScript",',
      "};",
    ],
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
    backToProjects: "بازگشت به پروژهها",
    client: "کارفرما",
    completedAt: "تاریخ انجام",
    skillsUsed: "فناوریهای بهکاررفته",
    featured: "شاخص",
    notFoundTitle: "پروژه پیدا نشد",
    notFoundBody: "این نشانی به هیچ پروژهٔ منتشرشدهای مربوط نیست.",
  },

  /**
   * Home-page "project journey". The Persian copy is editorial voice here, not
   * labels — it sets the tone of the showcase, so it lives with the rest of the
   * reader-facing strings rather than inside the component.
   */
  journey: {
    eyebrow: "PROJECTS",
    /** Section heading — "Selected" in white, "Projects" in accent. */
    titleLead: "Selected",
    titleAccent: "Projects",
    titleTail: "",
    problem: "Problem",
    solution: "Solution",
    stack: "Stack",
    /** Rendered under the counter, e.g. "01 / 03". */
    counterSeparator: "/",
    /** Hint that a project has a dedicated page. */
    openProject: "مشاهده پروژه",
    /** Scroll hint shown at the bottom-left of the stage. */
    scrollHint: "اسکرول کنید",
    empty: "هنوز پروژهای برای نمایش وجود ندارد.",
  },

  contact: {
    name: "نام",
    email: "ایمیل",
    subject: "موضوع",
    message: "پیام",
    submit: "ارسال پیام",
    sending: "در حال ارسال…",
    success: "پیام شما ارسال شد. به‌زودی پاسخ می‌دهم.",
  },

  skills: {
    /** Rendered above the canvas as the interaction hint. */
    hint: "روی یک مهارت بزنید تا پروژه‌های مرتبط برجسته شود؛ روی یک پروژه بزنید تا صفحه‌اش باز شود.",
    legendSkill: "مهارت",
    legendProject: "پروژه",
    loading: "در حال آماده‌سازی گراف…",
    empty: "هنوز داده‌ای برای نمایش گراف وجود ندارد.",
    /** Status line under the canvas when a skill is selected. */
    selectedSkill: (name: string, count: string) =>
      `${name} در ${count} پروژه به کار رفته است`,
    selectedProject: (title: string) => `${title} — برای باز شدن بزنید`,
    /** aria-label for the canvas as a whole. */
    canvasLabel: (skills: string, projects: string) =>
      `گراف تعاملی مهارت‌ها: ${skills} مهارت و ${projects} پروژه`,
    /** Keyboard instructions, appended to the canvas label. */
    canvasKeys:
      "با کلیدهای جهت‌دار بین گره‌ها حرکت کنید، با Enter باز کنید، با Escape رها کنید.",
  },

  github: {
    stars: "ستاره",
    forks: "فورک",
    repos: "مخزن عمومی",
    followers: "دنبال‌کننده",
    topRepos: "پرستاره‌ترین مخزن‌ها",
    recentActivity: "آخرین فعالیت",
    /** Interpolated rather than concatenated so the sentence stays natural. */
    contributionsTotal: (count: string) => `${count} مشارکت در یک سال گذشته`,
    heatmapLabel: (count: string) =>
      `نمودار مشارکت‌های یک سال گذشته، در کل ${count} مشارکت`,
    legendLess: "کمتر",
    legendMore: "بیشتر",
    updatedAt: (relative: string) => `به‌روزرسانی ${relative}`,
    /** Shown when the cache is older than the staleness threshold. */
    staleNote: "داده‌ها به‌تازگی به‌روز نشده‌اند؛ آخرین مقدار موجود نشان داده می‌شود.",
    /** Shown when the job has never completed successfully. */
    empty: "آمار گیت‌هاب هنوز در دسترس نیست.",
    viewProfile: "دیدن نمایهٔ گیت‌هاب",
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
