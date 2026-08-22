import {
  lazy,
  Suspense
} from "react";

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

import AuctionSummaryPage from
  "./pages/AuctionSummaryPage";

import HistoryPage from
  "./pages/HistoryPage";

import LoginPage from
  "./pages/LoginPage";

import ManagerAccountsPage from
  "./pages/ManagerAccountsPage";

import ManagerChangePasswordPage from
  "./pages/ManagerChangePasswordPage";

import ManagerDashboardPage from
  "./pages/ManagerDashboardPage";

import ManagerPlayersPage from
  "./pages/ManagerPlayersPage";

import PlayersPage from
  "./pages/PlayersPage";

import PointsTablePage from
  "./pages/PointsTablePage";

import QualificationAdvisorPage from
  "./pages/QualificationAdvisorPage";

import ProjectorPage from
  "./pages/ProjectorPage";

import PublicLandingPage from
  "./pages/PublicLandingPage";

import PublicMatchPage from
  "./pages/PublicMatchPage";

import PublicTournamentPage from
  "./pages/PublicTournamentPage";

import SafetyPage from
  "./pages/SafetyPage";

import SchedulePage from
  "./pages/SchedulePage";

import ScoreControlPage from
  "./pages/ScoreControlPage";

import SettingsPage from
  "./pages/SettingsPage";

import TeamPosterPage from
  "./pages/TeamPosterPage";

import TeamsPage from
  "./pages/TeamsPage";

import TournamentDashboardPage from
  "./pages/TournamentDashboardPage";

import TournamentSelectionPage from
  "./pages/TournamentSelectionPage";
import RegisteredPlayersPosterPage from
  "./pages/RegisteredPlayersPosterPage";
const BackgroundRemoverPage = lazy(
  () =>
    import(
      "./pages/BackgroundRemoverPage"
    )
);

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
            element={<PublicLandingPage />}
          />

          <Route
            path="/account"
            element={<HomeRedirect />}
          />

          <Route
            path="/t/:publicSlug"
            element={<PublicTournamentPage />}
          />

          <Route
            path="/t/:publicSlug/match/:matchId"
            element={<PublicMatchPage />}
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
              path="/admin/team-poster"
              element={
                <TeamPosterPage mode="admin" />
              }
            />
            <Route
              path="/admin/registered-players-poster"
              element={
                <RegisteredPlayersPosterPage />
              }
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
              path="/auction-summary"
              element={
                <AuctionSummaryPage />
              }
            />

            <Route
              path="/admin/settings"
              element={<SettingsPage />}
            />

            <Route
              path="/admin/safety"
              element={<SafetyPage />}
            />

            <Route
              path="/admin/schedule"
              element={<SchedulePage />}
            />

            <Route
              path="/admin/scoring"
              element={<ScoreControlPage />}
            />

            <Route
              path="/admin/points-table"
              element={<PointsTablePage />}
            />

            <Route
              path="/admin/qualification"
              element={<QualificationAdvisorPage />}
            />

            <Route
              path="/admin/background-remover"
              element={
                <Suspense
                  fallback={
                    <div className="screen-message">
                      Loading local background
                      remover…
                    </div>
                  }
                >
                  <BackgroundRemoverPage />
                </Suspense>
              }
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
            path="/manager/change-password"
            element={
              <ManagerRoute
                passwordChangePage
              >
                <ManagerChangePasswordPage />
              </ManagerRoute>
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
            path="/manager/team-poster"
            element={
              <ManagerRoute>
                <TeamPosterPage
                  mode="manager"
                />
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
