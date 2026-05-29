import { useEffect, useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt, Download, Play, CalendarDays, FileSpreadsheet,
  AlertCircle, CheckCircle2, Clock, Eye, History, RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_TRACK_B_API_URL ?? "http://localhost:3001";

interface TaxExportItem {
  invoice_number: string;
  invoice_date: string;
  buyer_label: string;
  payment_method: string;
  service_description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  reservation_id: string;
  confirmation_code: string | null;
  status: string;
  needs_review_reason: string | null;
}

interface TaxExportJob {
  id: string;
  checkout_date: string;
  status: string;
  total_items: number;
  exported_count: number;
  failed_count: number;
  review_count: number;
  triggered_by: string;
  created_at: string;
  completed_at: string | null;
  items: Array<{
    id: string;
    status: string;
    guest_name: string;
    invoice_number: string;
    total_amount: number;
    needs_review_reason: string | null;
  }>;
}

interface TaxSettings {
  default_buyer_label: string;
  default_payment_method: string;
  default_unit: string;
  default_vat_rate: number;
  service_name_template: string;
}

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  exported: { label: "Exported", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800", icon: CheckCircle2 },
  needs_review: { label: "Needs Review", className: "bg-chart-4/10 text-chart-4 border-chart-4/20", icon: AlertCircle },
  pending: { label: "Pending", className: "bg-chart-1/10 text-chart-1 border-chart-1/20", icon: Clock },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground border-border", icon: Clock },
};

function TaxExportSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export function TaxExportPage() {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [previewItems, setPreviewItems] = useState<TaxExportItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [jobs, setJobs] = useState<TaxExportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  // Load settings and jobs on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/tax-export/settings`).then((r) => r.json()).then(setSettings).catch(console.error);
    loadJobs();
  }, []);

  // Load preview when date changes
  useEffect(() => {
    loadPreview();
  }, [selectedDate]);

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tax-export/preview?date=${selectedDate}`);
      const data = await res.json();
      setPreviewItems(data.items || []);
    } catch (e) {
      console.error("Preview failed:", e);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadJobs() {
    setJobsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tax-export/jobs`);
      const data = await res.json();
      setJobs(data || []);
    } catch (e) {
      console.error("Jobs failed:", e);
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleRunExport() {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/tax-export/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (data.jobId) {
        setActiveTab("history");
        await loadJobs();
        // Auto-download
        handleDownload(data.jobId);
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }

  function handleDownload(jobId?: string) {
    const url = jobId
      ? `${API_BASE}/api/tax-export/download?job_id=${jobId}`
      : `${API_BASE}/api/tax-export/download?date=${selectedDate}`;
    window.open(url, "_blank");
  }

  function handlePreviewDownload() {
    handleDownload();
  }

  const exportedCount = previewItems.filter((i) => i.status === "exported").length;
  const reviewCount = previewItems.filter((i) => i.status === "needs_review").length;
  const totalAmount = previewItems.reduce((sum, i) => sum + i.total_amount, 0);
  const totalVat = previewItems.reduce((sum, i) => sum + i.vat_amount, 0);

  return (
    <div className="flex h-full max-h-svh flex-col" data-testid="tax-export-page">
      <TaxExportHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        onRefresh={loadPreview}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Checkout Reservations
                </CardTitle>
                <div className="rounded-md bg-chart-1/10 p-1.5 text-chart-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="checkout-count">
                  {previewItems.length}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ready to Export
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="ready-count">
                  {exportedCount}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Needs Review
                </CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold tracking-tight" data-testid="review-count">
                  {reviewCount}
                </span>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Amount
                </CardTitle>
                <div className="rounded-md bg-chart-4/10 p-1.5 text-chart-4">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <span className="text-lg font-bold tracking-tight" data-testid="total-amount">
                    {formatVND(totalAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">VND</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  VAT: {formatVND(totalVat)} VND
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "preview" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("preview")}
              data-testid="tab-preview"
            >
              <Eye className="inline h-3.5 w-3.5 mr-1.5" />
              Preview Export
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "history" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("history")}
              data-testid="tab-history"
            >
              <History className="inline h-3.5 w-3.5 mr-1.5" />
              Export History
            </button>
          </div>

          {activeTab === "preview" && (
            <>
              {/* Action bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Same-Day Checkout Export
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Exports reservations checking out on {selectedDate}. Default format follows Vietnamese tax invoice template.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handlePreviewDownload}
                        disabled={previewItems.length === 0}
                        data-testid="download-preview-btn"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Preview
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs bg-harbor text-harbor-foreground hover:bg-harbor-deep"
                        onClick={handleRunExport}
                        disabled={previewItems.length === 0 || exporting}
                        data-testid="run-export-btn"
                      >
                        {exporting ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {exporting ? "Exporting..." : "Run Export"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Export Preview ({previewItems.length} items)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Template: Số thứ tự → Ngày → Buyer → Payment → Service → Unit → Qty → Price → Total → VAT
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {previewLoading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-10 rounded" />))}
                    </div>
                  ) : previewItems.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">
                        No checkouts on {selectedDate}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a different date or check your reservation data
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-t border-border">
                            <TableHead className="pl-4 text-xs">#</TableHead>
                            <TableHead className="text-xs">Guest</TableHead>
                            <TableHead className="text-xs">Property</TableHead>
                            <TableHead className="text-xs">Service</TableHead>
                            <TableHead className="text-xs text-right">Nights</TableHead>
                            <TableHead className="text-xs text-right">Unit Price</TableHead>
                            <TableHead className="text-xs text-right">Total</TableHead>
                            <TableHead className="text-xs text-right">VAT ({settings?.default_vat_rate ?? 8}%)</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewItems.map((item) => {
                            const config = statusConfig[item.status] ?? statusConfig.pending;
                            return (
                              <TableRow key={item.reservation_id} className="hover:bg-muted/40" data-testid={`preview-row-${item.invoice_number}`}>
                                <TableCell className="pl-4 py-2.5 text-xs font-mono">{item.invoice_number}</TableCell>
                                <TableCell className="py-2.5">
                                  <p className="text-xs font-medium">{item.guest_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.check_in_date} → {item.check_out_date}</p>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground">{item.property_name}</TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground max-w-48 truncate">{item.service_description}</TableCell>
                                <TableCell className="py-2.5 text-xs text-right tabular-nums">{item.quantity}</TableCell>
                                <TableCell className="py-2.5 text-xs text-right tabular-nums">
                                  {item.unit_price > 0 ? formatVND(item.unit_price) : <span className="text-chart-4">—</span>}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-right tabular-nums font-medium">
                                  {item.total_amount > 0 ? formatVND(item.total_amount) : "—"}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-right tabular-nums">{item.vat_amount > 0 ? formatVND(item.vat_amount) : "—"}</TableCell>
                                <TableCell className="py-2.5">
                                  <Badge variant="outline" className={`text-[9px] ${config.className}`}>
                                    {config.label}
                                  </Badge>
                                  {item.needs_review_reason && (
                                    <p className="text-[9px] text-chart-4 mt-0.5 max-w-24 truncate" title={item.needs_review_reason}>{item.needs_review_reason}</p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "history" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Export History</CardTitle>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={loadJobs} data-testid="refresh-history-btn">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-16 rounded-lg" />))}
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="py-12 text-center">
                    <History className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No exports run yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Run your first export from the Preview tab</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors"
                        data-testid={`job-row-${job.id}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium">
                              Checkout: {job.checkout_date.slice(0, 10)}
                            </p>
                            <Badge variant="outline" className={`text-[9px] ${job.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-chart-4/10 text-chart-4 border-chart-4/20"}`}>
                              {job.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{job.total_items} items</span>
                            <span>{job.exported_count} exported</span>
                            {job.review_count > 0 && <span className="text-chart-4">{job.review_count} review</span>}
                            <span>via {job.triggered_by}</span>
                            <span>{new Date(job.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleDownload(job.id)}
                          data-testid={`download-job-${job.id}`}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settings summary */}
          {settings && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Export Defaults</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Buyer Label</span>
                    <p className="font-medium mt-0.5">{settings.default_buyer_label}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment</span>
                    <p className="font-medium mt-0.5">{settings.default_payment_method}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit</span>
                    <p className="font-medium mt-0.5">{settings.default_unit}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">VAT Rate</span>
                    <p className="font-medium mt-0.5">{settings.default_vat_rate}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Service Template</span>
                    <p className="font-medium mt-0.5 truncate" title={settings.service_name_template}>{settings.service_name_template}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TaxExportHeader({ selectedDate, setSelectedDate, onRefresh }: {
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold">Tax & Compliance</h2>
          <p className="text-xs text-muted-foreground">Same-day checkout tax invoice export</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-8 w-40 text-xs"
          data-testid="date-picker"
        />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(getToday())} data-testid="today-btn">
          Today
        </Button>
      </div>
    </header>
  );
}
