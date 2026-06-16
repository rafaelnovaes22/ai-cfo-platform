import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lumen/auth/AuthContext.tsx";
import { AnalysisProvider } from "./lumen/data/useAnalyses.ts";
import { ActionPlanProvider } from "./lumen/data/useActionItems.ts";
import Router from "./Router.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <AuthProvider>
          <AnalysisProvider>
            <ActionPlanProvider>
              <Router />
            </ActionPlanProvider>
          </AnalysisProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
