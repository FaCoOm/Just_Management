import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardPage />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
