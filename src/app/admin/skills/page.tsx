import Link from "next/link";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { deleteSkillAction } from "@/features/admin/actions-skills";
import { AdminDeleteButton } from "@/features/admin/components/buttons";
import { listAllSkills } from "@/lib/db/projects";

/** Every skill with its category, proficiency and usage signal. */
export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [skills, params] = await Promise.all([
    listAllSkills(),
    searchParams,
  ]);

  return (
    <div>
      <AdminPageHeader
        title={fa.admin.skills}
        backHref="/admin"
        action={
          <Link
            href="/admin/skills/new"
            className="bg-primary text-primary-foreground h-10 rounded-xl px-5 text-sm font-semibold"
          >
            {fa.admin.new}
          </Link>
        }
      />

      {params.error === "linked" && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          این مهارت در پروژه‌ای استفاده شده است — اول آن را از پروژه‌ها جدا کنید.
        </p>
      )}

      {skills.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.emptySkills}</p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: skill.color ?? "#737373" }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium" dir="ltr">
                  {skill.name}
                </p>
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  {skill.category} · {skill.proficiency}/5
                </p>
              </div>
              <Link
                href={`/admin/skills/${skill.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center rounded-xl border border-border/70 px-5 text-sm transition-colors"
              >
                {fa.admin.edit}
              </Link>
              <form action={deleteSkillAction.bind(null, skill.id)}>
                <AdminDeleteButton />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
