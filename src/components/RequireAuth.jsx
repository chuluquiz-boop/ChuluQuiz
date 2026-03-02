import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const sessionToken = localStorage.getItem("session_token");
  const legacyQuizToken = localStorage.getItem("quiz_token");
  if (!sessionToken && !legacyQuizToken) return <Navigate to="/login" replace />;
  return children;
}