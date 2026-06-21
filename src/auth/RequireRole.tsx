import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import { useRole } from "./useRole";

export function RequireRole({ role, loginPath }: { role: "admin" | "customer"; loginPath: string }) {
  const { t } = useTranslation();
  const { session, loading: authLoading } = useAuth();
  const { role: actual, loading: roleLoading } = useRole();

  if (authLoading) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  if (!session) return <Navigate to={loginPath} replace />;
  if (roleLoading) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  // Orphan / unauthorized user — treat the same as unauthenticated.
  if (actual === "none") return <Navigate to={loginPath} replace />;
  if (actual && actual !== role) return <Navigate to={actual === "admin" ? "/" : "/portal"} replace />;
  if (!actual) return <div className="p-6 text-sm opacity-70">{t("common.loading")}</div>;
  return <Outlet />;
}
