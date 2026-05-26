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

const guestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guests",
  component: lazyRouteComponent(
    () => import("@/components/guests/guests-page"),
    "GuestsPage"
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

const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maintenance",
  component: lazyRouteComponent(
    () => import("@/components/maintenance/maintenance-page"),
    "MaintenancePage"
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
  guestsRoute,
  roomsRoute,
  maintenanceRoute,
  integrationsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
