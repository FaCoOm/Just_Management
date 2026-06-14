import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaxExportPage } from "../components/tax-export/tax-export-page";
import { SidebarProvider } from "../components/ui/sidebar";

// Mock matchMedia
globalThis.matchMedia = globalThis.matchMedia || function() {
  return {
    matches: false,
    media: "",
    onchange: null,
    addListener: function() {},
    removeListener: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return false; }
  };
};

describe("TaxExportPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should render loading state on initialization and populate preview data and settings", async () => {
    // Arrange
    const mockSettings = {
      default_buyer_label: "Khách lẻ không lấy hóa đơn",
      default_payment_method: "Chuyển khoản",
      default_unit: "Đêm",
      default_vat_rate: 8,
      service_name_template: "Dịch vụ thuê phòng ({check_in} - {check_out})",
      schedule_enabled: false,
      schedule_time: "18:00",
      schedule_timezone: "Asia/Ho_Chi_Minh",
      sheet_id: "sheet-123-abc",
      sheet_tab: "Sheet1",
      template_columns: { invoice_number: "A", invoice_date: "B" },
    };

    const mockJobs = [
      {
        id: "job-1",
        checkout_date: "2026-06-08",
        status: "completed",
        total_items: 2,
        exported_count: 1,
        failed_count: 0,
        review_count: 1,
        triggered_by: "manual",
        created_at: "2026-06-08T10:00:00.000Z",
        completed_at: "2026-06-08T10:01:00.000Z",
        items: [
          { id: "item-1", status: "needs_review", guest_name: "John Doe", invoice_number: "1", total_amount: 100 },
        ],
      },
    ];

    const mockPreview = {
      checkoutDate: "2026-06-08",
      items: [
        {
          invoice_number: "1",
          invoice_date: "08/06/2026",
          buyer_label: "Khách lẻ không lấy hóa đơn",
          payment_method: "Chuyển khoản",
          service_description: "Dịch vụ thuê phòng (08/06/2026 - 09/06/2026)",
          unit: "Đêm",
          quantity: 1,
          unit_price: 150000,
          total_amount: 150000,
          vat_rate: 8,
          vat_amount: 12000,
          guest_name: "Jane Smith",
          property_name: "Mujo Saigon",
          check_in_date: "2026-06-08",
          check_out_date: "2026-06-09",
          reservation_id: "res-1",
          confirmation_code: "HM-XYZ123ABC",
          status: "exported",
          needs_review_reason: null,
        },
      ],
    };

    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes("/api/tax-export/settings")) {
        if (init?.method === "PUT") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockSettings, ...JSON.parse(init.body) }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSettings),
        });
      }
      if (url.includes("/api/tax-export/jobs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockJobs),
        });
      }
      if (url.includes("/api/tax-export/preview")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPreview),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SidebarProvider>
        <TaxExportPage />
      </SidebarProvider>
    );

    // Assert
    expect(screen.getByTestId("tax-export-page")).toBeInTheDocument();

    // Wait for settings and previews to load
    await waitFor(() => {
      expect(screen.getByTestId("checkout-count")).toHaveTextContent("1");
      expect(screen.getByTestId("ready-count")).toHaveTextContent("1");
      expect(screen.getByTestId("review-count")).toHaveTextContent("0");
    });

    // Check mapping fields and inputs are displayed correctly
    const sheetIdInput = screen.getByTestId("sheet-id-input");
    expect(sheetIdInput).toHaveValue("sheet-123-abc");

    // Click setting Switch
    const switchEl = screen.getByTestId("schedule-enabled-switch");
    fireEvent.click(switchEl);

    // Click Save Settings button
    const saveBtn = screen.getByTestId("save-tax-export-settings-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Tax export settings saved.")).toBeInTheDocument();
    });
  });
});
