import { ProfileEditModal } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { canManageUsers, requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <AppFrame>
      <PageHeader title="User Profile" />
      <section className="panel">
        <h2>{user.name || user.email}</h2>
        <div className="table-like compact">
          <div>
            <strong>Name</strong>
            <span>{user.name || "Not set"}</span>
          </div>
          <div>
            <strong>Email</strong>
            <span>{user.email}</span>
          </div>
          <div>
            <strong>Role</strong>
            <span>{user.role}</span>
          </div>
          <div>
            <strong>Department</strong>
            <span>{user.category || "Unassigned"}</span>
          </div>
        </div>
        <div className="button-row">
          <ProfileEditModal user={user} />
          {canManageUsers(user) ? (
            <a className="button" href="/admin/users">
              Manage Users
            </a>
          ) : null}
        </div>
      </section>
    </AppFrame>
  );
}
