import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { Topbar } from "./Topbar.tsx";
import { SidebarProvider } from "./SidebarContext.tsx";

export default function AppLayout() {
  const { pathname } = useLocation();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-auto pb-16 bg-cream text-[#09080f] dark:bg-[#09080f] dark:text-white">
        <div className="-z-1 blur-3xl opacity-20 bg-[#5b24ff] w-full h-[200px] rounded-full fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-1 flex-1 flex flex-col min-w-0">
          <Sidebar />
          <Topbar />
          <main
            key={pathname}
            className="flex-1 px-8 md:px-20 pt-7 pb-14 w-full mx-auto"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
