import { useOneAuth } from "@withone/auth";
import { Button } from "@/components/ui/button";
import { useAuthGrant, usePersistConnection } from "@/hooks/use-one-connections";

const DEFAULT_TOKEN_URL = "/api/one/auth-token";

const platformLabels: Record<string, string> = {
  "google-sheets": "Google Sheets",
  "google-drive": "Google Drive",
  gmail: "Gmail",
};

function absoluteTokenUrl(configuredUrl: string | undefined): string {
  const candidate = configuredUrl ?? DEFAULT_TOKEN_URL;
  return new URL(candidate, window.location.origin).toString();
}

export function buildOneAuthHeaders(grant: string | undefined): Record<string, string> {
  if (!grant) return {};
  return { "x-one-grant": grant };
}

export function ConnectIntegrationButton({
  platform,
  authenticated,
}: {
  platform: "google-sheets" | "google-drive" | "gmail";
  authenticated: boolean;
}) {
  const persist = usePersistConnection();
  const tokenUrl = import.meta.env.VITE_ONE_AUTH_TOKEN_URL as string | undefined;
  const grantQuery = useAuthGrant(authenticated);
  const grant = grantQuery.data?.grant;
  const { open } = useOneAuth({
    token: {
      url: absoluteTokenUrl(tokenUrl),
      headers: buildOneAuthHeaders(grant),
    },
    selectedConnection: platformLabels[platform],
    appTheme: "light",
    title: `Connect ${platformLabels[platform]}`,
    companyName: "Latte Lounge",
    authWindow: "popup",
    onSuccess: (connection: unknown) => {
      const record = connection as { key?: string; platform?: string; title?: string; name?: string };
      if (record.key) {
        persist.mutate({
          platform: record.platform ?? platform,
          connectionKey: record.key,
          displayName: record.title ?? record.name ?? platformLabels[platform],
        });
      }
    },
  });

  const disabled = persist.isPending || !grant;
  const label = !grant && grantQuery.isFetching ? "Preparing..." : persist.isPending ? "Saving..." : `Connect ${platformLabels[platform]}`;

  return (
    <Button type="button" onClick={open} disabled={disabled}>
      {label}
    </Button>
  );
}
