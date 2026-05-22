import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./lumen/layout/AppLayout.tsx";
import Hub from "./lumen/pages/Hub.tsx";
import Dashboard from "./lumen/pages/Dashboard.tsx";
import DRE from "./lumen/pages/DRE.tsx";
import Plan from "./lumen/pages/Plan.tsx";
import Import from "./lumen/pages/Import.tsx";
import Transactions from "./lumen/pages/Transactions.tsx";
import Auth from "./lumen/pages/Auth.tsx";
import ResetPassword from "./lumen/pages/ResetPassword.tsx";
import { AuthProvider } from "./lumen/auth/AuthContext.tsx";
import { ProtectedRoute } from "./lumen/auth/ProtectedRoute.tsx";
import { AnalysisProvider } from "./lumen/data/useAnalyses.ts";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import nprogress from "nprogress";
import CashFlow from "./lumen/pages/CashFlow.tsx";
import Credit from "./lumen/pages/Credit.tsx";

const queryClient = new QueryClient();

const Router = () => {
  const location = useLocation();

  useEffect(() => {
    console.log("Route changed:", location.pathname);
    nprogress.start();
    nprogress.done();
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dre" element={<DRE />} />
        <Route path="/plano" element={<Plan />} />
        <Route path="/importar" element={<Import />} />
        <Route path="/lancamentos" element={<Transactions />} />
        <Route path="/caixa" element={<CashFlow />} />
        <Route path="/credito" element={<Credit />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default Router;
