import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ConnectIntegrationButton } from "@/components/integrations/ConnectIntegrationButton";
import { useIntegrationStatus } from "@/hooks/use-integration-status";
import { useConnections, useDisconnect } from "@/hooks/use-one-connections";
import { type IngestSummaryResponse, usePipelineStatus } from "@/hooks/use-pipeline-status";

const sourceAccounts = ["airbnb-main", "airbnb-ruby", "airbnb-manuka22"];
const pipelineModes = ["folder-watch", "email", "built-in", "google-sheets"];

function StatusBadge({ state }: { state: string }) {
  const variant =
    state === "ready"
      ? "default"
      : state === "planned"
        ? "secondary"
        : state === "missing_path"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{state}</Badge>;
}

function SummaryPanel({ summary }: { summary: IngestSummaryResponse | null }) {
  if (!summary) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <div><span className="text-muted-foreground">Processed</span><div className="font-semibold">{summary.processed}</div></div>
        <div><span className="text-muted-foreground">Created</span><div className="font-semibold">{summary.created}</div></div>
        <div><span className="text-muted-foreground">Updated</span><div className="font-semibold">{summary.updated}</div></div>
        <div><span className="text-muted-foreground">Skipped</span><div className="font-semibold">{summary.skipped}</div></div>
        <div><span className="text-muted-foreground">Dead letters</span><div className="font-semibold">{summary.deadLetters}</div></div>
        <div><span className="text-muted-foreground">Dry run</span><div className="font-semibold">{String(summary.dryRun)}</div></div>
      </div>
      {summary.errors.length > 0 && (
        <div className="mt-3 space-y-1 text-destructive">
          {summary.errors.map((error, index) => <div key={index}>{error.code}: {error.message}</div>)}
        </div>
      )}
    </div>
  );
}

async function submitForm(url: string, formData: FormData): Promise<IngestSummaryResponse> {
  const response = await fetch(url, { method: "POST", body: formData });
  return response.json() as Promise<IngestSummaryResponse>;
}

async function runPipeline(payload: Record<string, unknown>): Promise<IngestSummaryResponse> {
  const response = await fetch("/api/ingest/pipeline/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<IngestSummaryResponse>;
}

function getDisconnectErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Disconnect failed. Try again.";
}

export function IntegrationsPage() {
  const integrationStatus = useIntegrationStatus();
  const status = usePipelineStatus();
  const connections = useConnections();
  const disconnect = useDisconnect();
  const [uploadSummary, setUploadSummary] = useState<IngestSummaryResponse | null>(null);
  const [runSummary, setRunSummary] = useState<IngestSummaryResponse | null>(null);
  const [uploadKind, setUploadKind] = useState("listings");
  const [uploadSourceAccount, setUploadSourceAccount] = useState("airbnb-main");
  const [uploadDryRun, setUploadDryRun] = useState(true);
  const [runMode, setRunMode] = useState("built-in");
  const [runTargetKind, setRunTargetKind] = useState("listings");
  const [runSourceAccount, setRunSourceAccount] = useState("airbnb-main");
  const [runDryRun, setRunDryRun] = useState(true);
  const [connectionKey, setConnectionKey] = useState("");

  const providerState = integrationStatus.isLoading
    ? "checking"
    : integrationStatus.error
      ? "unavailable"
      : (integrationStatus.data?.status ?? "unavailable");
  const providerBadgeVariant =
    providerState === "connected"
      ? "default"
      : providerState === "checking"
        ? "outline"
        : "destructive";
  const providerGuidance =
    providerState === "connected"
      ? "withone is ready. Use connect actions to add or refresh Google services, then use saved connection keys below for operator-run flows."
      : providerState === "disconnected"
        ? "No active withone session detected. Use one of the connect actions below, complete OAuth in withone, then confirm the saved connection appears before running email or Google Sheets ingestion."
        : providerState === "checking"
          ? "Checking provider health now. Saved connections remain listed below while status refresh completes."
          : "Provider health is unavailable. Check API reachability for /api/integrations/status, then refresh this page before troubleshooting saved connections.";
  const modeNeedsConnectionKey = runMode === "email" || runMode === "google-sheets";
  const disconnectingKey = disconnect.isPending ? disconnect.variables : null;

  const onUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("dryRun", String(uploadDryRun));
    formData.set("sourceAccount", uploadSourceAccount);
    const summary = await submitForm(`/api/ingest/${uploadKind}`, formData);
    setUploadSummary(summary);
  };

  const onRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const summary = await runPipeline({
      mode: runMode,
      targetKind: runTargetKind,
      sourceAccount: runSourceAccount,
      dryRun: runDryRun,
      connectionKey: connectionKey || undefined,
    });
    setRunSummary(summary);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-brass/10 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-brass">Administration</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground">Integrations & Ingestion</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Connect Google services through withone, inspect pipeline readiness, upload CSV files, and run ingestion sources from one operator surface.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Status</CardTitle>
            <CardDescription>Safe connector readiness view. Secrets, private keys, and tokens are never exposed.</CardDescription>
          </CardHeader>
          <CardContent>
            {status.isLoading ? <p>Loading...</p> : status.error ? <p className="text-destructive">Failed to load pipeline status.</p> : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr><th className="p-3">Connector</th><th className="p-3">State</th><th className="p-3">Enabled</th><th className="p-3">Detail</th></tr>
                  </thead>
                  <tbody>
                    {status.data?.connectors.map((connector) => (
                      <tr key={connector.mode} className="border-t">
                        <td className="p-3 font-medium">{connector.mode}</td>
                        <td className="p-3"><StatusBadge state={connector.state} /></td>
                        <td className="p-3">{connector.enabled ? "yes" : "no"}</td>
                        <td className="p-3 text-muted-foreground">{connector.detail}{connector.path ? ` (${connector.path})` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>withone Connections</CardTitle>
              <CardDescription>OAuth connections stored in One Vault and persisted by connection key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Provider Health</div>
                    <div className="text-muted-foreground">withone</div>
                  </div>
                  <Badge variant={providerBadgeVariant}>{providerState}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{providerGuidance}</p>
                {integrationStatus.data?.error ? (
                  <p className="mt-2 text-xs text-destructive">{integrationStatus.data.error}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <ConnectIntegrationButton platform="google-sheets" />
                <ConnectIntegrationButton platform="google-drive" />
                <ConnectIntegrationButton platform="gmail" />
              </div>
              <div className="space-y-2">
                {disconnect.isError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {getDisconnectErrorMessage(disconnect.error)}
                  </div>
                ) : null}
                {(connections.data ?? []).map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-medium">{connection.display_name ?? connection.platform}</div>
                      <div className="text-muted-foreground">{connection.platform} / {connection.status}</div>
                      {connection.last_error ? <div className="mt-1 text-xs text-destructive">{connection.last_error}</div> : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disconnect.isPending}
                      onClick={() => {
                        disconnect.reset();
                        disconnect.mutate(connection.connection_key);
                      }}
                    >
                      {disconnectingKey === connection.connection_key ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                ))}
                {connections.data?.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm">
                    <div className="font-medium">No saved connections yet</div>
                    <p className="mt-1 text-muted-foreground">
                      Start with one of the connect actions above. After withone approval completes, return here and verify the saved connection key before running email or Google Sheets ingestion.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Saved connection keys support operator-run email and Google Sheets ingestion without exposing provider secrets in this dashboard.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual CSV Upload</CardTitle>
              <CardDescription>Upload listings or reservations CSV files. Dry run is enabled by default.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onUpload}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Label>Kind<NativeSelect value={uploadKind} onChange={(e) => setUploadKind(e.target.value)}><option value="listings">listings</option><option value="reservations">reservations</option></NativeSelect></Label>
                  <Label>Source account<NativeSelect value={uploadSourceAccount} onChange={(e) => setUploadSourceAccount(e.target.value)}>{sourceAccounts.map((a) => <option key={a} value={a}>{a}</option>)}</NativeSelect></Label>
                </div>
                <Label>CSV/XLSX file<Input name="file" type="file" accept=".csv,.xlsx,.xls" required /></Label>
                <div className="flex items-center gap-3"><Switch checked={uploadDryRun} onCheckedChange={setUploadDryRun} /><span className="text-sm">Dry run</span></div>
                <Button type="submit">Upload</Button>
              </form>
              <div className="mt-4"><SummaryPanel summary={uploadSummary} /></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manual Pipeline Run</CardTitle>
            <CardDescription>Trigger folder, email, built-in, or Google Sheets ingestion with the same dry-run summary contract.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-5" onSubmit={onRun}>
              <Label>Mode<NativeSelect value={runMode} onChange={(e) => setRunMode(e.target.value)}>{pipelineModes.map((m) => <option key={m} value={m}>{m}</option>)}</NativeSelect></Label>
              <Label>Target<NativeSelect value={runTargetKind} onChange={(e) => setRunTargetKind(e.target.value)}><option value="listings">listings</option><option value="reservations">reservations</option></NativeSelect></Label>
              <Label>Source account<NativeSelect value={runSourceAccount} onChange={(e) => setRunSourceAccount(e.target.value)}>{sourceAccounts.map((a) => <option key={a} value={a}>{a}</option>)}</NativeSelect></Label>
              <Label>
                Connection key
                <Input value={connectionKey} onChange={(e) => setConnectionKey(e.target.value)} placeholder="required for email/sheets" />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Required for <code>email</code> and <code>google-sheets</code>. Leave blank for <code>folder-watch</code> and <code>built-in</code> runs.
                </span>
              </Label>
              <div className="flex items-end gap-3"><Switch checked={runDryRun} onCheckedChange={setRunDryRun} /><span className="pb-2 text-sm">Dry run</span></div>
              <div className="md:col-span-5"><Button type="submit">Run Pipeline</Button></div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              {modeNeedsConnectionKey
                ? "Current mode requires saved connection key from withone connections above."
                : "Current mode does not use connection key; pipeline runs with local folder or built-in source configuration."}
            </p>
            <div className="mt-4"><SummaryPanel summary={runSummary} /></div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
