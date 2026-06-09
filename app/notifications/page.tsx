import { AppFrame } from "@/components/AppFrame";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  project_id: string | null;
  task_id: string | null;
  subtask_id: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
  actor_name: string | null;
  actor_email: string | null;
  project_name: string | null;
};

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getNotificationHref(notification: NotificationRow) {
  if (notification.project_id) {
    return `/projects/${notification.project_id}`;
  }

  return "/notifications";
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const result = await query<NotificationRow>(
    `SELECT
       notifications.id,
       notifications.title,
       notifications.body,
       notifications.project_id,
       notifications.task_id,
       notifications.subtask_id,
       notifications.read_at,
       notifications.created_at,
       users.name AS actor_name,
       users.email::text AS actor_email,
       projects.name AS project_name
     FROM notifications
     LEFT JOIN users ON users.id = notifications.actor_id
     LEFT JOIN projects ON projects.id = notifications.project_id
     WHERE notifications.user_id = $1
     ORDER BY notifications.read_at IS NOT NULL ASC, notifications.created_at DESC
     LIMIT 80`,
    [user.id]
  );
  const notifications = result.rows;
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <AppFrame>
      <header className="masthead">
        <h1>Notifications</h1>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <h2>Inbox</h2>
          <div className="toolbar-actions">
            <span className="result-count">{unreadCount} unread</span>
            {unreadCount ? (
              <form action={markAllNotificationsReadAction}>
                <button className="button secondary" type="submit">
                  Mark all read
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {notifications.length ? (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article
                className={`notification-item${notification.read_at ? "" : " is-unread"}`}
                key={notification.id}
              >
                <a className="notification-content" href={getNotificationHref(notification)}>
                  <span className="notification-title">{notification.title}</span>
                  {notification.body ? <span className="notification-body">{notification.body}</span> : null}
                  <span className="notification-meta">
                    {[notification.project_name, formatDateTime(notification.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </a>
                {!notification.read_at ? (
                  <form action={markNotificationReadAction}>
                    <input name="notificationId" type="hidden" value={notification.id} />
                    <button className="button secondary" type="submit">
                      Mark read
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="notice">No notifications yet.</div>
        )}
      </section>
    </AppFrame>
  );
}
