import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "@/auth/RequireRole";
import { LoginPage } from "@/auth/LoginPage";
import { AppLayout } from "@/components/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ServiceOrdersPage } from "@/pages/ServiceOrdersPage";
import { NewOrderPage } from "@/pages/NewOrderPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { CustomerFormPage } from "@/pages/CustomerFormPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { PortalLoginPage } from "@/features/portal/PortalLoginPage";
import { PortalLayout } from "@/features/portal/PortalLayout";
import { PortalHomePage } from "@/pages/portal/PortalHomePage";
import { PortalVehiclePage } from "@/pages/portal/PortalVehiclePage";
import { PortalOrderPage } from "@/pages/portal/PortalOrderPage";
import { PortalInvoicesPage } from "@/pages/portal/PortalInvoicesPage";
import { PortalInvoicePage } from "@/pages/portal/PortalInvoicePage";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />

      {/* Admin group — requires role="admin" */}
      <Route element={<RequireRole role="admin" loginPath="/login" />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<ServiceOrdersPage />} />
          <Route path="/orders/new" element={<NewOrderPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Portal group — requires role="customer" */}
      <Route element={<RequireRole role="customer" loginPath="/portal/login" />}>
        <Route element={<PortalLayout />}>
          <Route path="/portal" element={<PortalHomePage />} />
          <Route path="/portal/vehicles/:id" element={<PortalVehiclePage />} />
          <Route path="/portal/orders/:id" element={<PortalOrderPage />} />
          <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
          <Route path="/portal/invoices/:id" element={<PortalInvoicePage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
