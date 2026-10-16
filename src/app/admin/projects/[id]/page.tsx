import { fa } from "@/content/fa";

import { ProjectEditor } from "@/features/admin/components/project-editor";

export const metadata = { title: `${fa.admin.edit} — ${fa.admin.projects}` };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProjectEditor id={(await params).id} />;
}
