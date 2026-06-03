import { AdminCreateUserModal } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "user";
  category: string | null;
  created_at: Date;
};

export default async function AdminUsersPage() {
  await requireAdmin();

  const result = await query<UserRow>(
    `SELECT id, name, email::text AS email, role, category, created_at
     FROM users
     ORDER BY created_at DESC`
  );

  return (
    <AppFrame shellClassName="admin-shell">
      <header className="masthead">
        <h1>User Management</h1>
      </header>
      <section className="panel admin-users-panel">
        <div className="section-toolbar">
          <h2>Current Users</h2>
          <AdminCreateUserModal />
        </div>
        <div className="users-table" role="table" aria-label="Current users">
          <div className="users-table-row users-table-head" role="row">
            <strong role="columnheader">Name</strong>
            <strong role="columnheader">Email</strong>
            <strong role="columnheader">Department</strong>
            <strong role="columnheader">Level</strong>
          </div>
          {result.rows.map((user) => (
            <div className="users-table-row" role="row" key={user.id}>
              <span role="cell">{user.name || "No name"}</span>
              <span role="cell">{user.email}</span>
              <span role="cell">{user.category || "Unassigned"}</span>
              <span role="cell">{user.role}</span>
            </div>
          ))}
        </div>
        <div className="button-row">
          <a className="button secondary" href="/profile">
            Back to Profile
          </a>
        </div>
      </section>
    </AppFrame>
  );
}
