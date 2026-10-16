import { fa } from "@/content/fa";

import { LoginForm } from "@/features/admin/components/login-form";

export const metadata = { title: fa.admin.loginTitle };

/** Public by design — the proxy lets this one route through. */
export default function AdminLoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-8 text-center text-2xl font-bold tracking-tight">
        {fa.admin.loginTitle}
      </h1>
      <div className="rounded-3xl border border-border/70 bg-white/[0.02] p-6 sm:p-8">
        <LoginForm />
      </div>
    </div>
  );
}
