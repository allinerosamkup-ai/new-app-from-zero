import { Navigate, useLocation } from "react-router-dom";

export function HarmonyPage() {
  const location = useLocation();
  const target = location.pathname.startsWith("/dev/") ? "/dev/insights" : "/insights";
  return <Navigate to={target} replace />;
}
