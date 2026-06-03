import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function NotificationsPage() {
  await requireUser();

  return (
    <AppFrame>
      <header className="masthead">
        <h1>Notifications</h1>
      </header>
      <section className="panel">
        <h2>Welcome to Notifications</h2>
        <p>This page will hold your notifications.</p>
        <div className="button-row">
          <a className="button secondary" href="/main-page">
            Back to Main Page
          </a>
        </div>
      </section>
    </AppFrame>
  );
}
