export default function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl py-6 px-6 bg-white dark:bg-[#0b0918] border border-[#e5e5e5] shadow-card dark:shadow-none dark:border-[#171132] animate-fade-up delay-1 ${className}`}
    >
      {children}
    </div>
  );
}
