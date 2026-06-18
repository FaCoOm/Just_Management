import { describe, expectTypeOf, it } from "vitest";
import type {
  DriveFolderStatus,
  GuestRequest,
  GuestRequestPriority,
  GuestRequestStatus,
  IdDocumentType,
  StayRegistration,
  Tenant,
  TenantStatus,
} from "../types/database";

describe("guests and tenants database types", () => {
  it("exports tenant and stay registration domain types", () => {
    expectTypeOf<Tenant>().toMatchTypeOf<{
      id: string;
      property_id: string;
      property?: { id: string };
      name: string;
      id_document_type: IdDocumentType;
      id_document_number: string;
      email?: string | null;
      phone?: string | null;
      nationality?: string | null;
      lease_start: string;
      lease_end: string;
      monthly_rent: number;
      deposit_amount?: number | null;
      emergency_contact_name?: string | null;
      emergency_contact_phone?: string | null;
      notes?: string | null;
      status: TenantStatus;
      is_vip?: boolean;
      created_at: string;
      updated_at: string;
    }>();

    expectTypeOf<StayRegistration>().toMatchTypeOf<{
      id: string;
      property_id: string;
      property?: { id: string };
      tenant_id?: string | null;
      tenant?: { id: string };
      room_id?: string | null;
      room?: { id: string };
      guest_name: string;
      guest_count: number;
      registration_date: string;
      registration_number?: string | null;
      drive_folder_id?: string | null;
      drive_folder_status: DriveFolderStatus;
      notes?: string | null;
      created_at: string;
      updated_at: string;
    }>();
  });

  it("keeps guest request lifecycle fields optional", () => {
    expectTypeOf<GuestRequest>().toMatchTypeOf<{
      id: string;
      guest_id: string;
      reservation_id: string | null;
      property_id: string | null;
      room_id: string;
      request_type: string;
      notes: string;
      is_completed: boolean;
      status?: GuestRequestStatus;
      priority?: GuestRequestPriority;
      assigned_to?: string | null;
      description?: string | null;
      created_at: string;
      updated_at?: string;
      completed_at?: string | null;
    }>();
  });

  it("exports lifecycle/status unions", () => {
    expectTypeOf<GuestRequestStatus>().toEqualTypeOf<"open" | "assigned" | "in_progress" | "fulfilled" | "closed" | "reopened">();
    expectTypeOf<GuestRequestPriority>().toEqualTypeOf<"low" | "medium" | "high" | "urgent">();
    expectTypeOf<DriveFolderStatus>().toEqualTypeOf<"pending" | "created" | "failed">();
    expectTypeOf<TenantStatus>().toEqualTypeOf<"active" | "inactive" | "archived">();
    expectTypeOf<IdDocumentType>().toEqualTypeOf<"passport" | "national_id" | "drivers_license" | "other">();
  });
});
