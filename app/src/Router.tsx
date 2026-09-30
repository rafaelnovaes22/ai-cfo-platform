import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./aicfo/layout/AppLayout.tsx";
import Hub from "./aicfo/pages/Hub.tsx";
import Dashboard from "./aicfo/pages/Dashboard.tsx";
import DRE from "./aicfo/pages/DRE.tsx";
import Plan from "./aicfo/pages/Plan.tsx";
import Import from "./aicfo/pages/Import.tsx";
import Transactions from "./aicfo/pages/Transactions.tsx";
import Auth from "./aicfo/pages/Auth.tsx";
import ResetPassword from "./aicfo/pages/ResetPassword.tsx";
import { AuthProvider } from "./aicfo/auth/AuthContext.tsx";
import { ProtectedRoute } from "./aicfo/auth/ProtectedRoute.tsx";
import { SubscriberGate } from "./aicfo/auth/SubscriberGate.tsx";
import { AnalysisProvider } from "./aicfo/data/useAnalyses.ts";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import nprogress from "nprogress";
import CashFlow from "./aicfo/pages/CashFlow.tsx";
import Credit from "./aicfo/pages/Credit.tsx";
import UserConfig from "./aicfo/pages/UserConfig.tsx";
import NotificationsConfig from "./aicfo/pages/NotificationsConfig.tsx";
import WhatsappAuth from "./aicfo/pages/WhatsappAuth.tsx";

const queryClient = new QueryClient();

const Router = () => {
  const location = useLocation();

  useEffect(() => {
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
          de caixa; as páginas de análise ficam embaçadas com upsell na frente. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Visão Geral: restaurada — renderiza normal para qualquer logado. */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Análise — teaser bloqueado (fundo embaçado + mensagem) para o grátis. */}
        <Route path="/dre" element={<SubscriberGate feature="DRE facilitado"><DRE /></SubscriberGate>} />
        <Route path="/plano" element={<SubscriberGate feature="Plano de ação"><Plan /></SubscriberGate>} />
        <Route path="/lancamentos" element={<SubscriberGate feature="Lançamentos classificados"><Transactions /></SubscriberGate>} />
        {/* Crédito: disponível (com badge "Em Breve") — não é teaser de plano. */}
        <Route path="/credito" element={<Credit />} />
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
