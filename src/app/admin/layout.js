
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/admin-auth";
import AdminShell from "./AdminShell";

export default function AdminLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#14233B]" />
            <p className="text-sm font-medium text-slate-500">
              Vérification des accès...
            </p>
          </div>
        </div>
      }
    >
      <ProtectedAdmin>{children}</ProtectedAdmin>
    </Suspense>
  );
}

async function ProtectedAdmin({ children }) {
  await connection();

  const session = await getPlatformAdmin();

  if (!session) {
    redirect("/login");
  }

  const userLabel =
    session.user.phone ||
    session.user.email ||
    "Administrateur";

  return (
    <AdminShell
      userLabel={userLabel}
      adminRole={session.admin.role}
    >
      {children}
    </AdminShell>
  );
}
