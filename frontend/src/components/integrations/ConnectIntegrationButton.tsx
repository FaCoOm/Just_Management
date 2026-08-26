import { useOneAuth } from "@withone/auth";
import { Button } from "@/components/ui/button";
import { usePersistConnection } from "@/hooks/use-one-connections";

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

export function buildOneAuthHeaders(): Record<string, string> {
  return {};
}

export function ConnectIntegrationButton({ platform }: { platform: "google-sheets" | "google-drive" | "gmail" }) {
  const persist = usePersistConnection();
  const tokenUrl = import.meta.env.VITE_ONE_AUTH_TOKEN_URL as string | undefined;
  const { open } = useOneAuth({
    token: {
      url: absoluteTokenUrl(tokenUrl),
      headers: buildOneAuthHeaders(),
    },
    selectedConnection: platformLabels[platform],
    appTheme: "light",
    title: `Connect ${platformLabels[platform]}`,
    companyName: "Latte Lounge",
    authWindow: "popup",
    onSuccess: (connection: unknown) => {
      const record = connection as { key?: string; connectionKey?: string; platform?: string; title?: string; name?: string };
      const connectionKey = record.connectionKey ?? record.key;
      if (connectionKey) {
        persist.mutate({
          platform: record.platform ?? platform,
          connectionKey,
          displayName: record.title ?? record.name ?? platformLabels[platform],
        });
      }
    },
  });

  return (
    <Button type="button" onClick={open} disabled={persist.isPending}>
      {persist.isPending ? "Saving..." : `Connect ${platformLabels[platform]}`}
    </Button>
  );
}
