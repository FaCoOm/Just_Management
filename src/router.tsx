import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

const rootRoute = createRootRoute({
  component: function RootLayout() {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
      </SidebarProvider>
    );
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("@/components/dashboard/dashboard-page"),
    "DashboardPage"
  ),
});

const reservationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reservations",
  component: lazyRouteComponent(
    () => import("@/components/reservations/reservations-page"),
    "ReservationsPage"
  ),
});

const checkInOutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/check-in-out",
  component: lazyRouteComponent(
    () => import("@/components/check-in-out/check-in-out-page"),
    "CheckInOutPage"
  ),
});

const guestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guests",
  component: lazyRouteComponent(
    () => import("@/components/guests/guests-page"),
    "GuestsPage"
  ),
});

const vipGuestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guests/vip",
  component: lazyRouteComponent(
    () => import("@/components/guests/vip-guests-page"),
    "VipGuestsPage"
  ),
});

const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms",
  component: lazyRouteComponent(
    () => import("@/components/rooms/rooms-page"),
    "RoomsPage"
  ),
});

const roomTypesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms/types",
  component: lazyRouteComponent(
    () => import("@/components/rooms/room-types-page"),
    "RoomTypesPage"
  ),
});

const availabilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms/availability",
  component: lazyRouteComponent(
    () => import("@/components/rooms/availability-page"),
    "AvailabilityPage"
  ),
});

const housekeepingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/housekeeping",
  component: lazyRouteComponent(
    () => import("@/components/housekeeping/housekeeping-page"),
    "HousekeepingPage"
  ),
});

const diningEventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dining-events",
  component: lazyRouteComponent(
    () => import("@/components/dining-events/dining-events-page"),
    "DiningEventsPage"
  ),
});

const rateManagerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rate-manager",
  component: lazyRouteComponent(
    () => import("@/components/revenue/rate-manager-page"),
    "RateManagerPage"
  ),
});

const billingInvoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  component: lazyRouteComponent(
    () => import("@/components/revenue/billing-invoices-page"),
    "BillingInvoicesPage"
  ),
});

const channelDistributionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/channels",
  component: lazyRouteComponent(
    () => import("@/components/revenue/channel-distribution-page"),
    "ChannelDistributionPage"
  ),
});

const staffRolesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/staff",
  component: lazyRouteComponent(
    () => import("@/components/admin/staff-roles-page"),
    "StaffRolesPage"
  ),
});

const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maintenance",
  component: lazyRouteComponent(
    () => import("@/components/maintenance/maintenance-page"),
    "MaintenancePage"
  ),
});

const securityAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/security",
  component: lazyRouteComponent(
    () => import("@/components/admin/security-access-page"),
    "SecurityAccessPage"
  ),
});

const taxComplianceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tax-export",
  component: lazyRouteComponent(
    () => import("@/components/tax-export/tax-export-page"),
    "TaxExportPage"
  ),
});

const integrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/integrations",
  component: lazyRouteComponent(
    () => import("@/pages/settings/integrations-page"),
    "IntegrationsPage"
  ),
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  reservationsRoute,
  checkInOutRoute,
  guestsRoute,
  vipGuestsRoute,
  roomsRoute,
  roomTypesRoute,
  availabilityRoute,
  housekeepingRoute,
  diningEventsRoute,
  rateManagerRoute,
  billingInvoicesRoute,
  channelDistributionRoute,
  staffRolesRoute,
  maintenanceRoute,
  securityAccessRoute,
  taxComplianceRoute,
  integrationsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
