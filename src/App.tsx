import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { ReservationsPage } from "@/components/reservations/reservations-page";
import { GuestsPage } from "@/components/guests/guests-page";
import { RoomsPage } from "@/components/rooms/rooms-page";
import { MaintenancePage } from "@/components/maintenance/maintenance-page";

export type PageId =
  | "dashboard"
  | "reservations"
  | "guests"
  | "rooms"
  | "maintenance";

function PageRenderer({ page }: { page: PageId }) {
  switch (page) {
    case "reservations":
      return <ReservationsPage />;
    case "guests":
      return <GuestsPage />;
    case "rooms":
      return <RoomsPage />;
    case "maintenance":
      return <MaintenancePage />;
    default:
      return <DashboardPage />;
  }
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("dashboard");

  return (
    <SidebarProvider>
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <SidebarInset>
        <PageRenderer page={currentPage} />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
