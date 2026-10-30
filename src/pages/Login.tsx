import { Navigate } from "react-router-dom";

/** A /bejelentkezes a szerkesztő felület (Dashboard) kapujára visz, ami maga kéri a belépést. */
export default function Login() {
  return <Navigate to="/dashboard" replace />;
}
