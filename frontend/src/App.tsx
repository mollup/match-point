import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./auth-context";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { NewTournament } from "./pages/NewTournament";
import { TournamentDetailPage } from "./pages/TournamentDetail";
import { TournamentHubPage } from "./pages/TournamentHubPage";
import { TournamentBracketPage } from "./pages/TournamentBracketPage";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/t/:id"
            element={
              <Layout>
                <TournamentDetailPage />
              </Layout>
            }
          />

          <Route
            path="/login"
            element={
              <Layout>
                <Login />
              </Layout>
            }
          />
          <Route
            path="/register"
            element={
              <Layout>
                <Register />
              </Layout>
            }
          />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/t/:id/bracket" element={<TournamentBracketPage />} />
            <Route path="/tournament" element={<TournamentHubPage />} />
            <Route path="/tournaments" element={<Navigate to="/tournament" replace />} />
            <Route path="/players" element={<PlayerProfilePage />} />
            <Route path="/players/:id" element={<PlayerProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/new" element={<NewTournament />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
