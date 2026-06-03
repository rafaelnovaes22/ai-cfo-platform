import { useState } from "react";
import NotificationList from "./NotificationList";
import { Bell } from "lucide-react";

export default function NotificationButton() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex overflow-hidden cursor-pointer items-center mx-2 gap-4 py-2 rounded-full"
      >
        <Bell strokeWidth={1.5} className="w-6 h-6 dark:text-white" />
        <span className="sr-only pointer-events-none">
          Toggle notifications
        </span>
        {open && (
          <span className="absolute pointer-events-none transition-all duration-300 z-1 top-0 h-full w-full bg-[#3D24A0]/10 dark:bg-[#245fff]/10 rounded-full"></span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-card dark:bg-[#1a1a40] rounded-md shadow-md py-1 z-30">
          <NotificationList notifications={notifications} />
        </div>
      )}
    </div>
  );
}
