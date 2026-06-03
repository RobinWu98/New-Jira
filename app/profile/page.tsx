import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <AppFrame>
      <header className="masthead">
        <h1>User Profile</h1>
      </header>
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
        </div>
        <div className="button-row">
          {user.role === "admin" ? (
            <a className="button" href="/admin/users">
              Manage Users
            </a>
          ) : null}
          <a className="button secondary" href="/main-page">
            Back to Main Page
          </a>
        </div>
      </section>
    </AppFrame>
  );
}
