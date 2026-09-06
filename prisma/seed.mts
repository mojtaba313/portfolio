import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

/**
 * Development seed.
 *
 * Idempotent: every write is an upsert keyed on a slug, so running it twice
 * leaves the same rows rather than duplicating them. That matters because
 * `prisma migrate dev` runs this automatically after applying a migration.
 *
 * This file does NOT import `@/lib/db/prisma`. That singleton caches onto
 * globalThis for Next's dev server and never closes its pool, which would leave
 * this script hanging instead of exiting. A seed is a short-lived process and
 * owns its own client.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Skills, grouped by category to keep the list readable. */
const SKILLS: Prisma.SkillCreateInput[] = [
  // Languages
  { slug: "typescript", name: "TypeScript", category: "LANGUAGE", proficiency: 5, color: "#3178c6", displayOrder: 1, description: "زبان اصلی من در فرانت‌اند و بک‌اند." },
  { slug: "javascript", name: "JavaScript", category: "LANGUAGE", proficiency: 5, color: "#f7df1e", displayOrder: 2 },
  { slug: "sql", name: "SQL", category: "LANGUAGE", proficiency: 4, color: "#e38c00", displayOrder: 3 },

  // Frontend
  { slug: "react", name: "React", category: "FRONTEND", proficiency: 5, color: "#61dafb", displayOrder: 1 },
  { slug: "nextjs", name: "Next.js", category: "FRONTEND", proficiency: 5, color: null, displayOrder: 2, description: "App Router، سرور کامپوننت‌ها و رندر جریانی." },
  { slug: "tailwindcss", name: "Tailwind CSS", category: "FRONTEND", proficiency: 5, color: "#38bdf8", displayOrder: 3 },
  { slug: "motion", name: "Motion", category: "FRONTEND", proficiency: 4, color: "#ff4d94", displayOrder: 4 },
  { slug: "gsap", name: "GSAP", category: "FRONTEND", proficiency: 4, color: "#88ce02", displayOrder: 5 },
  { slug: "threejs", name: "Three.js", category: "FRONTEND", proficiency: 3, color: null, displayOrder: 6 },
  { slug: "d3", name: "D3.js", category: "FRONTEND", proficiency: 4, color: "#f9a03c", displayOrder: 7 },

  // Backend
  { slug: "nodejs", name: "Node.js", category: "BACKEND", proficiency: 5, color: "#5fa04e", displayOrder: 1 },
  { slug: "rest-api", name: "REST API", category: "BACKEND", proficiency: 5, color: "#6b7280", displayOrder: 2 },
  { slug: "graphql", name: "GraphQL", category: "BACKEND", proficiency: 3, color: "#e10098", displayOrder: 3 },
  { slug: "zod", name: "Zod", category: "BACKEND", proficiency: 5, color: "#3068b7", displayOrder: 4 },

  // Database
  { slug: "postgresql", name: "PostgreSQL", category: "DATABASE", proficiency: 4, color: "#4169e1", displayOrder: 1 },
  { slug: "prisma", name: "Prisma", category: "DATABASE", proficiency: 5, color: "#5a67d8", displayOrder: 2 },
  { slug: "redis", name: "Redis", category: "DATABASE", proficiency: 3, color: "#dc382d", displayOrder: 3 },

  // DevOps
  { slug: "linux", name: "Linux / Ubuntu", category: "DEVOPS", proficiency: 4, color: "#e95420", displayOrder: 1 },
  { slug: "nginx", name: "Nginx", category: "DEVOPS", proficiency: 4, color: "#009639", displayOrder: 2 },
  { slug: "docker", name: "Docker", category: "DEVOPS", proficiency: 4, color: "#2496ed", displayOrder: 3 },
  { slug: "github-actions", name: "GitHub Actions", category: "DEVOPS", proficiency: 4, color: "#2088ff", displayOrder: 4 },

  // Tooling
  { slug: "git", name: "Git", category: "TOOLING", proficiency: 5, color: "#f05033", displayOrder: 1 },
  { slug: "vitest", name: "Vitest", category: "TOOLING", proficiency: 4, color: "#6da741", displayOrder: 2 },
  { slug: "playwright", name: "Playwright", category: "TOOLING", proficiency: 3, color: "#2ead33", displayOrder: 3 },
];

/**
 * Projects, with their skill edges by slug.
 *
 * Placeholder content in the right shape: the point of the seed is to give the
 * graph, the listing and the detail page realistic data to render before the
 * real case studies are written. Replace the copy, keep the structure.
 */
const PROJECTS: {
  project: Omit<Prisma.ProjectCreateInput, "skills">;
  /** [skill slug, weight] — weight is how central the skill was, 1–5. */
  skills: [string, number][];
}[] = [
  {
    project: {
      slug: "portfolio-site",
      title: "وب‌سایت شخصی و نمونه‌کارها",
      summary:
        "همین سایت: گراف تعاملی مهارت‌ها، ترمینال دستوری و پس‌زمینهٔ سه‌بعدی، با Next.js و پایگاه‌دادهٔ PostgreSQL.",
      description:
        "یک وب‌اپلیکیشن راست‌به‌چپ با Next.js ۱۶ که روی سرور اختصاصی اوبونتو میزبانی می‌شود. گراف مهارت‌ها با d3-force روی canvas رندر می‌شود، آمار گیت‌هاب با یک زمان‌بند در پایگاه‌داده کش می‌شود، و یک پنل ترمینال با معماری رجیستری دستورات به کاربر اجازه می‌دهد بخش‌های سایت را با دستور باز کند.",
      liveUrl: "https://example.com",
      repoUrl: "https://github.com/example/portfolio",
      status: "PUBLISHED",
      featured: true,
      completedAt: new Date("2026-09-01"),
      displayOrder: 1,
    },
    skills: [
      ["nextjs", 5],
      ["typescript", 5],
      ["tailwindcss", 4],
      ["prisma", 4],
      ["postgresql", 4],
      ["d3", 4],
      ["threejs", 3],
      ["motion", 3],
      ["gsap", 3],
      ["nginx", 2],
    ],
  },
  {
    project: {
      slug: "realtime-dashboard",
      title: "داشبورد تحلیلی هم‌زمان",
      summary:
        "داشبورد پایش داده با به‌روزرسانی زنده، صف پردازش پیام و نمودارهای سبک روی canvas.",
      description:
        "سرویسی برای پایش هم‌زمان رخدادها: داده از طریق WebSocket می‌رسد، در Redis صف می‌شود و پس از تجمیع در PostgreSQL ذخیره می‌شود. نمودارها برای حفظ کارایی روی canvas رندر می‌شوند.",
      status: "PUBLISHED",
      featured: true,
      completedAt: new Date("2026-04-15"),
      displayOrder: 2,
    },
    skills: [
      ["nodejs", 5],
      ["typescript", 5],
      ["redis", 4],
      ["postgresql", 4],
      ["react", 4],
      ["d3", 3],
      ["docker", 3],
    ],
  },
  {
    project: {
      slug: "headless-commerce-api",
      title: "API فروشگاهی هدلس",
      summary:
        "بک‌اند فروشگاهی با REST و GraphQL، اعتبارسنجی سراسری با Zod و آزمون‌های خودکار.",
      description:
        "یک API فروشگاهی مستقل از رابط کاربری: مدیریت سبد خرید، پرداخت و موجودی انبار. تمام ورودی‌ها با Zod اعتبارسنجی می‌شوند و مسیرهای حساس با Vitest پوشش داده شده‌اند.",
      client: "یک استارتاپ خرده‌فروشی",
      status: "PUBLISHED",
      featured: false,
      completedAt: new Date("2025-11-20"),
      displayOrder: 3,
    },
    skills: [
      ["nodejs", 5],
      ["graphql", 4],
      ["rest-api", 5],
      ["zod", 4],
      ["postgresql", 4],
      ["prisma", 4],
      ["vitest", 3],
      ["github-actions", 3],
    ],
  },
];

async function main() {
  console.log("Seeding skills…");

  /*
   * Sequential rather than Promise.all: these are upserts on a small fixed list,
   * and firing two dozen concurrent connections at a single-node Postgres to
   * save a few milliseconds is a bad trade. Order also stays deterministic,
   * which makes the log readable when something fails.
   */
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: skill,
      update: skill,
    });
  }
  console.log(`  ${SKILLS.length} skills`);

  console.log("Seeding projects…");
  for (const { project, skills } of PROJECTS) {
    const saved = await prisma.project.upsert({
      where: { slug: project.slug },
      create: project,
      update: project,
    });

    // Replace the edge set wholesale. Diffing would be more surgical, but the
    // join rows carry only a weight, so a delete-then-insert is simpler and
    // leaves no stale edges behind when a skill is dropped from the list.
    await prisma.projectSkill.deleteMany({ where: { projectId: saved.id } });

    for (const [skillSlug, weight] of skills) {
      const skill = await prisma.skill.findUnique({
        where: { slug: skillSlug },
        select: { id: true },
      });

      if (!skill) {
        // A typo in the edge list would otherwise vanish silently and show up
        // later as a project with fewer skills than intended.
        throw new Error(
          `Project "${project.slug}" references unknown skill "${skillSlug}".`,
        );
      }

      await prisma.projectSkill.create({
        data: { projectId: saved.id, skillId: skill.id, weight },
      });
    }
    console.log(`  ${project.slug} (${skills.length} skills)`);
  }

  const [skillCount, projectCount, edgeCount] = await Promise.all([
    prisma.skill.count(),
    prisma.project.count(),
    prisma.projectSkill.count(),
  ]);
  console.log(
    `\nDone: ${skillCount} skills, ${projectCount} projects, ${edgeCount} edges.`,
  );
}

try {
  await main();
} catch (error) {
  console.error("Seed failed:", error);
  // Non-zero exit so `migrate dev` and CI treat a failed seed as a failure.
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
