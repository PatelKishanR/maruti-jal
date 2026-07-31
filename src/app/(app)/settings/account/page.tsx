import { getTranslations, getFormatter } from "next-intl/server";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import type { UserDto } from "@/lib/dto/user.dto";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { PreferencesForm } from "./preferences-form";
import { ChangePasswordDialog } from "./change-password-dialog";

export const runtime = "nodejs";

/** Spec: .claude/design/MODULES/00-auth.md §6 */
export default async function AccountPage() {
  // The layout already gated auth; this fetches through the API like every
  // other screen, forwarding the request cookies.
  const user = await api.get<UserDto>(apiRoutes.account.me);
  const t = await getTranslations("account");
  const format = await getFormatter();

  return (
    <div className="max-w-[720px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card className="mb-6 p-6">
        <h2 className="mb-4 border-b border-border pb-3 text-h4 font-semibold text-foreground">
          {t("sections.profile")}
        </h2>

        <ProfileForm initialName={user.name} initialEmail={user.email} />

        <dl className="mt-6 divide-y divide-border border-t border-border">
          <ReadOnlyRow label={t("roleLabel")} value={user.role} />
          <ReadOnlyRow
            label={t("lastSignInLabel")}
            value={
              user.lastLoginAt
                ? format.dateTime(new Date(user.lastLoginAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
        </dl>
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="mb-4 border-b border-border pb-3 text-h4 font-semibold text-foreground">
          {t("sections.preferences")}
        </h2>
        <PreferencesForm />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 border-b border-border pb-3 text-h4 font-semibold text-foreground">
          {t("sections.security")}
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-foreground">{t("passwordLabel")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {user.passwordChangedAt
                ? t("passwordLastChanged", {
                    date: format.dateTime(new Date(user.passwordChangedAt), {
                      dateStyle: "medium",
                    }),
                  })
                : t("passwordNeverChanged")}
            </p>
          </div>
          <ChangePasswordDialog />
        </div>
      </Card>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-10 items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
