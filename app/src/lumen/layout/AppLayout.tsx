import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { Topbar } from "./Topbar.tsx";
import { SidebarProvider } from "./SidebarContext.tsx";

export default function AppLayout() {
  const { pathname } = useLocation();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-auto pb-16 bg-cream text-[#09080f] dark:bg-[#09080f] dark:text-white">
        <div className="relative z-1 flex-1 flex flex-col min-w-0">
          <Sidebar />
          <Topbar />
          <main
            key={pathname}
            className="flex-1 px-8 md:px-20 pt-7 pb-14 w-full mx-auto relative"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
