/**
 * Repository types for the Track B REST/Prisma abstraction.
 */

import type {
  Property,
  Room,
  GuestRequest,
  MaintenanceIssue,
  OccupancySeriesPoint,
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
  getByCheckInDate(date: string): Promise<Reservation[]>;
  getByCheckOutDate(date: string): Promise<Reservation[]>;
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

export interface StatsRepository {
  getOccupancy(
    days: number,
    endDate: string,
    propertyId?: string
  ): Promise<OccupancySeriesPoint[]>;
}

// Repository factory - Track B uses the REST API backend
export interface RepositoryFactory {
  properties: PropertyRepository;
  rooms: RoomRepository;
  reservations: ReservationRepository;
  guestRequests: GuestRequestRepository;
  maintenance: MaintenanceRepository;
  stats: StatsRepository;
}
