import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-6">…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
