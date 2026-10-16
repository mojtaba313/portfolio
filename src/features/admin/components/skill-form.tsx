"use client";

import { useActionState } from "react";

import type { AdminActionState } from "@/features/admin/lib/validation";
import {
  AdminField,
  AdminFormError,
  ADMIN_INPUT_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from "@/features/admin/components/ui";
import { AdminSubmitButton } from "@/features/admin/components/buttons";

const CATEGORIES = [
  "LANGUAGE",
  "FRONTEND",
  "BACKEND",
  "DATABASE",
  "DEVOPS",
  "TOOLING",
] as const;

export type SkillFormDefaults = {
  name: string;
  slug: string;
  category: (typeof CATEGORIES)[number];
  proficiency: number;
  color: string;
  description: string;
  displayOrder: number;
};

export const EMPTY_SKILL: SkillFormDefaults = {
  name: "",
  slug: "",
  category: "FRONTEND",
  proficiency: 3,
  color: "",
  description: "",
  displayOrder: 0,
};

export function SkillForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  defaults: SkillFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <AdminField label="نام">
          <input
            name="name"
            required
            dir="ltr"
            defaultValue={defaults.name}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>
        <AdminField label="شناسه (slug)" hint="حروف کوچک انگلیسی">
          <input
            name="slug"
            required
            dir="ltr"
            defaultValue={defaults.slug}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <AdminField label="دسته">
          <select
            name="category"
            dir="ltr"
            defaultValue={defaults.category}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="تسلط (۱ تا ۵)">
          <input
            name="proficiency"
            type="number"
            min={1}
            max={5}
            dir="ltr"
            defaultValue={defaults.proficiency}
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
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
      </div>

      <AdminField label="رنگ" hint="HEX مثل #3178c6 — خالی یعنی رنگ دسته">
        <input
          name="color"
          dir="ltr"
          defaultValue={defaults.color}
          placeholder="#…"
          className={`${ADMIN_INPUT_CLASS} font-mono`}
        />
      </AdminField>

      <AdminField label="توضیح">
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults.description}
          className={ADMIN_TEXTAREA_CLASS}
        />
      </AdminField>

      <AdminFormError message={state?.error} />
      <div className={pending ? "opacity-70" : undefined}>
        <AdminSubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
