import Link from "next/link";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { countUnreadMessages } from "@/lib/db/contact";
import { listJokes } from "@/lib/db/jokes";
import { getGraphData, getPublishedProjects } from "@/lib/db/projects";
import { visitStats } from "@/lib/db/visits";

export const metadata = { title: fa.admin.dashboard };

/**
 * Owner overview: one card per managed area with a live count. Every number
 * here comes from the same repository functions the public site reads, so
 * the dashboard can never disagree with what visitors see.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const [projects, graph, jokes, unread, visits] = await Promise.all([
    getPublishedProjects(),
    getGraphData(),
    listJokes(),
    countUnreadMessages(),
    visitStats({}),
  ]);

  const cards = [
    {
      href: "/admin/projects",
      label: fa.admin.projects,
      count: projects.length.toLocaleString("fa-IR"),
    },
    {
      href: "/admin/skills",
      label: fa.admin.skills,
      count: graph.skills.length.toLocaleString("fa-IR"),
    },
    {
      href: "/admin/jokes",
      label: fa.admin.jokes,
      count: jokes.length.toLocaleString("fa-IR"),
    },
    {
      href: "/admin/messages",
      label: fa.admin.messages,
      count: unread.toLocaleString("fa-IR"),
      badge: unread > 0,
    },
    {
      href: "/admin/visits",
      label: fa.admin.visits,
      count: visits.sessions.toLocaleString("fa-IR"),
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{fa.admin.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-border/70 bg-white/[0.02] p-6 transition-colors hover:border-primary/50"
          >
            <p className="text-muted-foreground text-sm">{card.label}</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-bold tabular-nums">
              {card.count}
              {"badge" in card && card.badge && (
                <span className="bg-primary size-2.5 rounded-full shadow-[0_0_12px_var(--primary)]" />
              )}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
