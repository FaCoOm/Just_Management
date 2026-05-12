import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { ReservationsPage } from "@/components/reservations/reservations-page";
import { GuestsPage } from "@/components/guests/guests-page";
import { RoomsPage } from "@/components/rooms/rooms-page";
import { MaintenancePage } from "@/components/maintenance/maintenance-page";

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
  component: DashboardPage,
});

const reservationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reservations",
  component: ReservationsPage,
});

const guestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guests",
  component: GuestsPage,
});

const roomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms",
  component: RoomsPage,
});

const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maintenance",
  component: MaintenancePage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  reservationsRoute,
  guestsRoute,
  roomsRoute,
  maintenanceRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
