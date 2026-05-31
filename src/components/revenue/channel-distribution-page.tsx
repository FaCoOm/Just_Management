import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Link2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface Channel {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  external_accounts: ExternalAccount[];
}

interface ExternalAccount {
  id: string;
  channel_id: string;
  account_key: string;
  display_name: string;
  status: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function ChannelDistributionSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export function ChannelDistributionPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.VITE_TRACK_B_API_URL ?? "http://localhost:3001";
    fetch(`${base}/api/channels`)
      .then((r) => r.json())
      .then((data) => { setChannels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalChannels = channels.length;
  const activeChannels = channels.filter((c) => c.status === "active").length;
  const totalAccounts = channels.reduce((sum, c) => sum + c.external_accounts.length, 0);
  const activeAccounts = channels.reduce((sum, c) => sum + c.external_accounts.filter((a) => a.status === "active").length, 0);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <ChannelDistributionHeader />
        <ChannelDistributionSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="channel-distribution-page">
      <ChannelDistributionHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Channels</CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1"><Globe className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="channels-count">{totalChannels}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Active Channels</CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="active-channels">{activeChannels}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Accounts</CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4"><Link2 className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="total-accounts">{totalAccounts}</span></CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Active Accounts</CardTitle>
                <div className="rounded-md bg-harbor/10 p-1.5 text-harbor"><ExternalLink className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent><span className="text-2xl font-bold tracking-tight" data-testid="active-accounts">{activeAccounts}</span></CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {channels.map((channel) => (
              <Card key={channel.id} data-testid={`channel-card-${channel.slug}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">{channel.display_name}</CardTitle>
                      <Badge variant="outline" className={`text-[10px] ${channel.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}>
                        {channel.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{channel.external_accounts.length} account(s)</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {channel.external_accounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No accounts configured</p>
                  ) : (
                    <div className="space-y-2">
                      {channel.external_accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2" data-testid={`account-row-${account.account_key}`}>
                          <div>
                            <p className="text-xs font-medium">{account.display_name}</p>
                            <p className="text-[10px] text-muted-foreground">{account.account_key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {account.last_sync_error ? (
                              <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                                <AlertCircle className="h-2.5 w-2.5 mr-1" /> Error
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={`text-[9px] ${account.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}>
                                {account.status === "active" ? <><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Connected</> : account.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {channels.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Globe className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No distribution channels configured</p>
                <p className="text-xs text-muted-foreground mt-1">Connect your OTA accounts to start syncing</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelDistributionHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Channel Distribution</h2>
          <p className="text-xs text-muted-foreground">OTA channels, accounts, and sync status</p>
        </div>
      </div>
    </header>
  );
}
