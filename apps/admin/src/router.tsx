import { Navigate, Route, Routes } from "react-router";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { LoginPage } from "./pages/LoginPage";
import { PostsPage } from "./pages/PostsPage";
import { TeachersPage } from "./pages/TeachersPage";
import { UsersPage } from "./pages/UsersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
