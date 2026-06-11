import { AdminCreateUserModal } from "@/components/AuthForms";
import { AdminUsersTable } from "@/components/AdminUsersAntTable";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { type UserRole, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  category: string | null;
  created_at: Date;
};

export default async function AdminUsersPage() {
  await requireAdmin();

  const result = await query<UserRow>(
    `SELECT id, name, email::text AS email, role, category, created_at
     FROM users
     WHERE archived_at IS NULL
     ORDER BY created_at DESC`
  );

  return (
    <AppFrame shellClassName="admin-shell">
      <PageHeader title="User Management" />
      <section className="panel admin-users-panel">
        <div className="section-toolbar">
          <h2>Current Users</h2>
          <AdminCreateUserModal />
        </div>
        <AdminUsersTable users={result.rows} />
      </section>
    </AppFrame>
  );
}
