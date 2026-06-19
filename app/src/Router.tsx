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
import { SubscriberGate } from "./lumen/auth/SubscriberGate.tsx";
import { AnalysisProvider } from "./lumen/data/useAnalyses.ts";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import nprogress from "nprogress";
import CashFlow from "./lumen/pages/CashFlow.tsx";
import Credit from "./lumen/pages/Credit.tsx";
import UserConfig from "./lumen/pages/UserConfig.tsx";
import NotificationsConfig from "./lumen/pages/NotificationsConfig.tsx";
import WhatsappAuth from "./lumen/pages/WhatsappAuth.tsx";

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
        path="/whatsapp/auth"
        element={
          <ProtectedRoute>
            <WhatsappAuth />
          </ProtectedRoute>
        }
      />
      {/* Shell aberto a qualquer logado. O grátis (lead/student) entra e usa o fluxo
          de caixa; as páginas de análise (geradas com IA) ficam travadas com teaser. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Home de análise: grátis é redirecionado para o caixa. */}
        <Route path="/" element={<SubscriberGate redirectTo="/caixa"><Dashboard /></SubscriberGate>} />
        <Route path="/dashboard" element={<SubscriberGate redirectTo="/caixa"><Dashboard /></SubscriberGate>} />
        {/* Análise (IA) — teaser bloqueado para o grátis. */}
        <Route path="/dre" element={<SubscriberGate feature="DRE facilitado"><DRE /></SubscriberGate>} />
        <Route path="/plano" element={<SubscriberGate feature="Plano de ação"><Plan /></SubscriberGate>} />
        <Route path="/lancamentos" element={<SubscriberGate feature="Lançamentos classificados"><Transactions /></SubscriberGate>} />
        <Route path="/credito" element={<SubscriberGate feature="Crédito"><Credit /></SubscriberGate>} />
        {/* Aberto ao grátis. */}
        <Route path="/importar" element={<Import />} />
        <Route path="/caixa" element={<CashFlow />} />
        <Route path="/config/usuario" element={<UserConfig />} />
        <Route path="/config/notificacoes" element={<NotificationsConfig />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default Router;
