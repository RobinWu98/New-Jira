import { redirect } from "next/navigation";
import { CompleteInvitedRegistrationForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { hashToken } from "@/lib/crypto";
import { query } from "@/lib/db";

type CompleteRegistrationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

type InviteRow = {
  name: string | null;
  email: string;
};

export default async function CompleteRegistrationPage({ searchParams }: CompleteRegistrationPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/main-page");
  }

  const token = (await searchParams).token ?? "";
  const result = token
    ? await query<InviteRow>(
        `SELECT users.name, users.email::text AS email
         FROM user_registration_invites
         JOIN users ON users.id = user_registration_invites.user_id
         WHERE user_registration_invites.invite_token_hash = $1
           AND user_registration_invites.admin_verified_at IS NOT NULL
           AND user_registration_invites.completed_at IS NULL
           AND user_registration_invites.expires_at > now()
         LIMIT 1`,
        [hashToken(token)]
      )
    : { rows: [] };
  const invite = result.rows[0];

  return (
    <main className="page">
      <div className="shell">
        <PageHeader title="Complete Registration" />
        <section className="panel">
          {invite ? (
            <>
              <h2>{invite.name || "New User"}</h2>
              <div className="notice">Finish account setup for {invite.email}.</div>
              <CompleteInvitedRegistrationForm token={token} />
            </>
          ) : (
            <>
              <h2>Link Expired</h2>
              <div className="notice error">This registration link is invalid or expired.</div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
