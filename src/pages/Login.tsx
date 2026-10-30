import { Navigate } from "react-router-dom";

/** /bejelentkezes leads to the editor (Dashboard) gate, which asks for login itself. */
export default function Login() {
  return <Navigate to="/dashboard" replace />;
}
