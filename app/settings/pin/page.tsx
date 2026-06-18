import { PinSetupForm } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { getPinDeviceTokenHash, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function PinSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const user = await requireUser();
  const { setup } = await searchParams;
  const setupRequired = setup === "required";
  const tokenHash = await getPinDeviceTokenHash();
  const deviceResult = tokenHash
    ? await query<{ id: string; last_used_at: Date | string | null }>(
        `SELECT id, last_used_at
         FROM pin_login_devices
         WHERE user_id = $1
           AND device_token_hash = $2
           AND expires_at > now()
         LIMIT 1`,
        [user.id, tokenHash]
      )
    : { rows: [] };
  const enabled = Boolean(deviceResult.rows[0]);

  return (
    <AppFrame>
      <PageHeader title="PIN Reset" />
      <section className="panel">
        <PinSetupForm enabled={enabled} redirectTo={setupRequired ? "/main-page" : undefined} />
      </section>
    </AppFrame>
  );
}
