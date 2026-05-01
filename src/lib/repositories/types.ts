/**
 * Repository types for Track A / Track B abstraction.
 * Define interfaces here; implement for Supabase (Track A) and future backend (Track B).
 */

import type {
  Property,
  Room,
  GuestRequest,
  MaintenanceIssue,
  Reservation,
  ReservationStatus,
} from "@/types/database";

// Base repository interface all implementations must satisfy
export interface Repository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
}

// Property repository
export interface PropertyRepository extends Repository<Property> {}

// Room repository
export interface RoomRepository extends Repository<Room> {
  getByPropertyId(propertyId: string): Promise<Room[]>;
}

// Reservation repository
export interface ReservationRepository extends Repository<Reservation> {
  getByPropertyId(propertyId: string): Promise<Reservation[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  getByStatus(statuses: ReservationStatus[]): Promise<Reservation[]>;
}

// Guest request repository
export interface GuestRequestRepository extends Repository<GuestRequest> {
  getByPropertyId(propertyId: string): Promise<GuestRequest[]>;
}

// Maintenance issue repository
export interface MaintenanceRepository extends Repository<MaintenanceIssue> {
  getByPropertyId(propertyId: string): Promise<MaintenanceIssue[]>;
  getOpenIssues(): Promise<MaintenanceIssue[]>;
}

// Repository factory - Track A uses Supabase, Track B will use REST API
export interface RepositoryFactory {
  properties: PropertyRepository;
  rooms: RoomRepository;
  reservations: ReservationRepository;
  guestRequests: GuestRequestRepository;
  maintenance: MaintenanceRepository;
}