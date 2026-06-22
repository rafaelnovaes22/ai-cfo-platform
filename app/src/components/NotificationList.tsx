interface Notification {
  id: string;
  title: string;
  description: string;
  read: boolean;
  timestamp: string;
}

export default function NotificationList({
  notifications,
}: {
  notifications: Notification[];
}) {
  return (
    <div className="flex flex-col gap-2 bg-white dark:bg-[#1a1a40] p-2">
      {notifications.length > 0 ? (
        notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-2 rounded-md cursor-pointer ${
              notification.read
                ? "bg-gray-100 dark:bg-gray-700"
                : "bg-blue-100 dark:bg-blue-700"
            }`}
          >
            <h3 className="font-semibold">{notification.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {notification.description}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {new Date(notification.timestamp).toLocaleString()}
            </span>
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400">
          Sem notificações recentes
        </p>
      )}
    </div>
  );
}
