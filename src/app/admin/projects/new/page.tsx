import { fa } from "@/content/fa";

import { ProjectEditor } from "@/features/admin/components/project-editor";

export const metadata = { title: `${fa.admin.new} — ${fa.admin.projects}` };

export default async function NewProjectPage() {
  return <ProjectEditor id={null} />;
}
