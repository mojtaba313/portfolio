"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";

import { fa } from "@/content/fa";
import type { AdminActionState } from "@/features/admin/lib/validation";
import {
  AdminField,
  AdminFormError,
  ADMIN_INPUT_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from "@/features/admin/components/ui";
import { AdminSubmitButton } from "@/features/admin/components/buttons";
import { CoverUploader } from "@/features/admin/components/cover-uploader";
import type { SkillNode } from "@/lib/db/projects";

/**
 * Project create/edit form.
 *
 * One component for both pages: `action` is the bound server action
 * (`createProjectAction`, or `updateProjectAction` bound to the id), and
 * `defaults` carries the row being edited — or blanks for a new one. Skill
 * links are checkboxes plus weight inputs; the action replaces the edge set
 * wholesale, exactly like the seed does.
 */
export type ProjectFormDefaults = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  problem: string;
  solution: string;
  client: string;
  liveUrl: string;
  repoUrl: string;
  coverImage: string;
  completedAt: string;
  displayOrder: number;
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  links: { skillId: string; weight: number }[];
};

export const EMPTY_PROJECT: ProjectFormDefaults = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  problem: "",
  solution: "",
  client: "",
  liveUrl: "",
  repoUrl: "",
  coverImage: "",
  completedAt: "",
  displayOrder: 0,
  featured: false,
  status: "DRAFT",
  links: [],
};

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const STATUS_LABEL: Record<string, string> = {
  DRAFT: fa.admin.draft,
  PUBLISHED: fa.admin.published,
  ARCHIVED: fa.admin.archived,
};

export function ProjectForm({
  action,
  defaults,
  skills,
  submitLabel,
  projectId,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  defaults: ProjectFormDefaults;
  /** Present when editing, so the cover field can link to the media picker. */
  projectId?: string;
  skills: Pick<SkillNode, "id" | "name" | "category">[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const coverFieldRef = useRef<HTMLInputElement>(null);
  const linked = new Map(defaults.links.map((l) => [l.skillId, l.weight]));

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="عنوان">
          <input
            name="title"
            required
            defaultValue={defaults.title}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>
        <AdminField label="شناسه (slug)" hint="حروف کوچک انگلیسی، فقط برای آدرس صفحه">
          <input
            name="slug"
            required
            dir="ltr"
            defaultValue={defaults.slug}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>
      </div>

      <AdminField label="خلاصه">
        <textarea
          name="summary"
          required
          rows={2}
          defaultValue={defaults.summary}
          className={ADMIN_TEXTAREA_CLASS}
        />
      </AdminField>

      <AdminField label="توضیح کامل">
        <textarea
          name="description"
          rows={6}
          defaultValue={defaults.description}
          className={ADMIN_TEXTAREA_CLASS}
        />
      </AdminField>

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="مسئله">
          <textarea
            name="problem"
            rows={3}
            defaultValue={defaults.problem}
            className={ADMIN_TEXTAREA_CLASS}
          />
        </AdminField>
        <AdminField label="راه‌حل">
          <textarea
            name="solution"
            rows={3}
            defaultValue={defaults.solution}
            className={ADMIN_TEXTAREA_CLASS}
          />
        </AdminField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="کارفرما">
          <input
            name="client"
            defaultValue={defaults.client}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>
        <AdminField label="تاریخ انجام">
          <input
            name="completedAt"
            type="date"
            defaultValue={defaults.completedAt}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="نشانی سایت">
          <input
            name="liveUrl"
            dir="ltr"
            defaultValue={defaults.liveUrl}
            placeholder="https://…"
            className={`${ADMIN_INPUT_CLASS} font-mono text-sm`}
          />
        </AdminField>
        <AdminField label="نشانی کد">
          <input
            name="repoUrl"
            dir="ltr"
            defaultValue={defaults.repoUrl}
            placeholder="https://…"
            className={`${ADMIN_INPUT_CLASS} font-mono text-sm`}
          />
        </AdminField>
      </div>

      <AdminField
        label="کاور"
        hint="مسیر /public یا نشانی اینترنتی — یا همین‌جا آپلود کن"
      >
        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={coverFieldRef}
            name="coverImage"
            dir="ltr"
            defaultValue={defaults.coverImage}
            className={`${ADMIN_INPUT_CLASS} min-w-48 flex-1 font-mono text-sm`}
          />
          {/* Uploads directly from this form; the URL lands in the field
              above, so the normal save still commits the change. */}
          <CoverUploader fieldRef={coverFieldRef} />
          {/*
            Saving a cover by hand means pasting a URL; the library does the
            upload and hands the URL back. Only shown when editing, since a new
            project has no id to pick for yet.
          */}
          {projectId && (
            <Link
              href={`/admin/media?project=${projectId}`}
              className="text-muted-foreground hover:text-foreground hover:border-primary/50 flex h-11 items-center rounded-xl border border-border/70 px-4 text-sm transition-colors"
            >
              {fa.admin.mediaPickFromLibrary}
            </Link>
          )}
        </div>
      </AdminField>

      <div className="grid gap-6 sm:grid-cols-3">
        <AdminField label={fa.admin.status}>
          <select name="status" defaultValue={defaults.status} className={ADMIN_INPUT_CLASS}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="ترتیب">
          <input
            name="displayOrder"
            type="number"
            dir="ltr"
            defaultValue={defaults.displayOrder}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>
        <div className="flex items-end pb-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={defaults.featured}
              className="size-4 accent-cyan-400"
            />
            {fa.admin.featured}
          </label>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-2xl border border-border/70 p-4">
        <legend className="px-2 text-sm font-medium">مهارت‌ها و وزن</legend>
        {skills.length === 0 ? (
          <p className="text-muted-foreground text-sm">{fa.admin.emptySkills}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {skills.map((skill) => {
              const weight = linked.get(skill.id);
              return (
                <li
                  key={skill.id}
                  className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    id={`skill-${skill.id}`}
                    name={`skill:${skill.id}`}
                    defaultChecked={weight !== undefined}
                    className="size-4 shrink-0 accent-cyan-400"
                  />
                  <label
                    htmlFor={`skill-${skill.id}`}
                    className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                    dir="ltr"
                  >
                    {skill.name}
                  </label>
                  <input
                    name={`weight:${skill.id}`}
                    type="number"
                    min={1}
                    max={10}
                    dir="ltr"
                    defaultValue={weight ?? 1}
                    aria-label={`وزن ${skill.name}`}
                    className="border-border/50 bg-white/[0.03] h-8 w-14 rounded-lg border px-1 text-center font-mono text-xs outline-none"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <AdminFormError message={state?.error} />
      <div className={pending ? "opacity-70" : undefined}>
        <AdminSubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
