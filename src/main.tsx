import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { DirectionProvider } from "@/providers/DirectionProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ModelImagesProvider } from "@/features/vehicles/ModelImagesContext";
import { ActiveBranchProvider } from "@/features/branches/ActiveBranchContext";
import App from "@/App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <DirectionProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <ActiveBranchProvider>
                <ModelImagesProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </ModelImagesProvider>
              </ActiveBranchProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </I18nextProvider>
  </React.StrictMode>
);
