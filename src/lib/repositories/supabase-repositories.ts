/**
 * Supabase implementation of repository interfaces (Track A).
 * Replace with REST API calls for Track B.
 */

import { supabase } from "@/lib/supabase";
import type {
  PropertyRepository,
  RoomRepository,
  ReservationRepository,
  GuestRequestRepository,
  MaintenanceRepository,
  RepositoryFactory,
} from "./types";

// Property repository implementation
const propertyRepo: PropertyRepository = {
  async getAll() {
    const { data } = await supabase.from("properties").select("*").order("name");
    return data ?? [];
  },
  async getById(id) {
    const { data } = await supabase.from("properties").select("*").eq("id", id).single();
    return data;
  },
};

// Room repository implementation
const roomRepo: RoomRepository = {
  async getAll() {
    const { data } = await supabase.from("rooms").select("*");
    return data ?? [];
  },
  async getById(id) {
    const { data } = await supabase.from("rooms").select("*").eq("id", id).single();
    return data;
  },
  async getByPropertyId(propertyId) {
    const { data } = await supabase.from("rooms").select("*").eq("property_id", propertyId);
    return data ?? [];
  },
};

// Reservation repository implementation
const reservationRepo: ReservationRepository = {
  async getAll() {
    const { data } = await supabase.from("reservations").select("*").order("check_in_date");
    return data ?? [];
  },
  async getById(id) {
    const { data } = await supabase.from("reservations").select("*").eq("id", id).single();
    return data;
  },
  async getByPropertyId(propertyId) {
    const { data } = await supabase.from("reservations").select("*").eq("property_id", propertyId).order("check_in_date");
    return data ?? [];
  },
  async getByDateRange(startDate, endDate) {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .gte("check_in_date", startDate)
      .lte("check_out_date", endDate)
      .order("check_in_date");
    return data ?? [];
  },
  async getByStatus(statuses) {
    const { data } = await supabase.from("reservations").select("*").in("status", statuses).order("check_in_date");
    return data ?? [];
  },
};

// Guest request repository implementation
const guestRequestRepo: GuestRequestRepository = {
  async getAll() {
    const { data } = await supabase.from("guest_requests").select("*");
    return data ?? [];
  },
  async getById(id) {
    const { data } = await supabase.from("guest_requests").select("*").eq("id", id).single();
    return data;
  },
  async getByPropertyId(propertyId) {
    const { data } = await supabase.from("guest_requests").select("*").eq("property_id", propertyId);
    return data ?? [];
  },
};

// Maintenance repository implementation
const maintenanceRepo: MaintenanceRepository = {
  async getAll() {
    const { data } = await supabase.from("maintenance_issues").select("*").order("created_at", { ascending: false });
    return data ?? [];
  },
  async getById(id) {
    const { data } = await supabase.from("maintenance_issues").select("*").eq("id", id).single();
    return data;
  },
  async getByPropertyId(propertyId) {
    const { data } = await supabase.from("maintenance_issues").select("*").eq("property_id", propertyId).order("created_at", { ascending: false });
    return data ?? [];
  },
  async getOpenIssues() {
    const { data } = await supabase.from("maintenance_issues").select("*").neq("status", "Resolved").order("created_at", { ascending: false });
    return data ?? [];
  },
};

// Repository factory for Track A (Supabase)
export const createSupabaseRepositories = (): RepositoryFactory => ({
  properties: propertyRepo,
  rooms: roomRepo,
  reservations: reservationRepo,
  guestRequests: guestRequestRepo,
  maintenance: maintenanceRepo,
});