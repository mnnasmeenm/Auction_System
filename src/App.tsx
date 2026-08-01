import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import AdminRoute from
  "./components/auth/AdminRoute";

import ManagerRoute from
  "./components/auth/ManagerRoute";

import AdminLayout from
  "./components/layout/AdminLayout";

import {
  AuthProvider,
  useAuth
} from "./context/AuthContext";

import AdminTournamentSetupPage from
  "./pages/AdminTournamentSetupPage";

import AuctionPage from
  "./pages/AuctionPage";

import HistoryPage from
  "./pages/HistoryPage";

import LoginPage from
  "./pages/LoginPage";

import ManagerAccountsPage from
  "./pages/ManagerAccountsPage";

import ManagerDashboardPage from
  "./pages/ManagerDashboardPage";

import ManagerPlayersPage from
  "./pages/ManagerPlayersPage";

import PlayersPage from
  "./pages/PlayersPage";

import ProjectorPage from
  "./pages/ProjectorPage";

import SafetyPage from
  "./pages/SafetyPage";

import SettingsPage from
  "./pages/SettingsPage";

import TeamsPage from
  "./pages/TeamsPage";

import TournamentDashboardPage from
  "./pages/TournamentDashboardPage";

import TournamentSelectionPage from
  "./pages/TournamentSelectionPage";

function HomeRedirect() {
  const {
    user,
    role,
    loading
  } = useAuth();

  if (loading) {
    return (
      <div className="screen-message">
        Loading account…
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (role === "manager") {
    return (
      <Navigate
        to="/manager"
        replace
      />
    );
  }

  if (role === "admin") {
    return (
      <Navigate
        to="/admin/tournaments"
        replace
      />
    );
  }

  return (
    <main className="access-denied">
      <h1>
        Account role required
      </h1>

      <p>
        Your account does not have an
        assigned system role.
      </p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={<HomeRedirect />}
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route
              path="/admin/tournaments"
              element={
                <TournamentSelectionPage />
              }
            />

            <Route
              path="/admin/tournaments/:tournamentId"
              element={
                <TournamentDashboardPage />
              }
            />

            <Route
              path="/admin/setup"
              element={
                <AdminTournamentSetupPage />
              }
            />

            <Route
              path="/admin/teams"
              element={<TeamsPage />}
            />

            <Route
              path="/admin/players"
              element={<PlayersPage />}
            />

            <Route
              path="/admin/managers"
              element={
                <ManagerAccountsPage />
              }
            />

            <Route
              path="/admin/auction"
              element={<AuctionPage />}
            />

            <Route
              path="/admin/history"
              element={<HistoryPage />}
            />

            <Route
              path="/admin/settings"
              element={<SettingsPage />}
            />

            <Route
              path="/admin/safety"
              element={<SafetyPage />}
            />
          </Route>

          <Route
            path="/projector"
            element={
              <AdminRoute>
                <ProjectorPage />
              </AdminRoute>
            }
          />

          <Route
            path="/manager"
            element={
              <ManagerRoute>
                <ManagerDashboardPage />
              </ManagerRoute>
            }
          />

          <Route
            path="/manager/players"
            element={
              <ManagerRoute>
                <ManagerPlayersPage />
              </ManagerRoute>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}