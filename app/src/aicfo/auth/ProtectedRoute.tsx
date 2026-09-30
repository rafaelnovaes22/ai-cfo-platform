import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.tsx";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-[#0b0918]">
        <div className="text-[13px] text-[#96ff7e]">Carregando…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
