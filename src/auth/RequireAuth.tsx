import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
