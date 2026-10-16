import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { JokesManager } from "@/features/admin/components/jokes-manager";
import { listJokes } from "@/lib/db/jokes";

export const metadata = { title: fa.admin.jokes };

export default async function AdminJokesPage() {
  await requireAdmin();
  const jokes = await listJokes();

  return (
    <div>
      <AdminPageHeader title={fa.admin.jokes} backHref="/admin" />
      <JokesManager jokes={jokes} />
    </div>
  );
}
