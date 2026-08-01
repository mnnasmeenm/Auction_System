import {
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useParams
} from "react-router-dom";

import type {
  Tournament
} from "../types/database";

import {
  getTournament
} from "../services/tournaments";

import "./TournamentPages.css";

interface DashboardSection {
  title: string;
  description: string;
  symbol: string;
  path: string;
  openInNewWindow?: boolean;
  disabled?: boolean;
}

export default function TournamentDashboardPage() {
  const navigate = useNavigate();

  const { tournamentId = "" } =
    useParams();

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }

    loadTournament();
  }, [tournamentId]);

  async function loadTournament() {
    setLoading(true);
    setErrorMessage("");

    try {
      const record =
        await getTournament(tournamentId);

      setTournament(record);
    } catch (error) {
      console.error(
        "Tournament loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tournament could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const sections: DashboardSection[] = [
    {
      title: "Teams",
      description:
        "Create teams, upload logos and manage budgets.",
      symbol: "TM",
      path:
        `/admin/teams?tournament=${tournamentId}`
    },
    {
      title: "Players",
      description:
        "Register players, upload photos and manage categories.",
      symbol: "PL",
      path:
        `/admin/players?tournament=${tournamentId}`
    },
    {
      title: "Auction control",
      description:
        "Select players and record live team allocations.",
      symbol: "AC",
      path:
        `/admin/auction?tournament=${tournamentId}`
    },
    {
      title: "Projector",
      description:
        "Open the animated public presentation screen.",
      symbol: "PR",
      path:
        `/projector?tournament=${tournamentId}`,
      openInNewWindow: true
    },
    {
  title: "History",
  description:
    "Review sales and approved reversals.",
  symbol: "HI",
  path:
    `/admin/history?tournament=${tournamentId}`
},
    {
  title: "Settings",
  description:
    "Review tournament rules and configuration.",
  symbol: "ST",
  path:
    `/admin/settings?tournament=${tournamentId}`
},
{
  title: "Safety & backups",
  description:
    "Pause the auction, export records and review operator actions.",
  symbol: "SF",
  path:
    `/admin/safety?tournament=${tournamentId}`
},
{
  title: "Manager accounts",
  description:
    "Invite team managers and control their portal access.",
  symbol: "MG",
  path:
    `/admin/managers?tournament=${tournamentId}`
},
  ];

  function openSection(
    section: DashboardSection
  ) {
    if (section.disabled) {
      return;
    }

    if (section.openInNewWindow) {
      window.open(
        section.path,
        "aththariq-projector",
        "popup=yes,width=1440,height=900"
      );

      return;
    }

    navigate(section.path);
  }

  if (loading) {
    return (
      <main className="tournament-dashboard-page">
        <section className="tournament-empty">
          Loading tournament…
        </section>
      </main>
    );
  }

  if (errorMessage || !tournament) {
    return (
      <main className="tournament-dashboard-page">
        <section className="tournament-empty">
          <h1>Tournament could not be opened</h1>

          <p>
            {errorMessage ||
              "The tournament does not exist."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/tournaments")
            }
          >
            Return to tournaments
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="tournament-dashboard-page">
      <header className="dashboard-header">
        <button
          type="button"
          className="back-to-tournaments"
          onClick={() =>
            navigate("/admin/tournaments")
          }
        >
          ← All tournaments
        </button>

        <div className="dashboard-title-area">
          <div>
            <p className="page-label">
              TOURNAMENT CONTROL CENTRE
            </p>

            <h1>
              {tournament.tournament_name}
            </h1>

            <p>
              {tournament.society_name}
            </p>
          </div>

          <span
            className={`tournament-status status-${tournament.status}`}
          >
            {tournament.status}
          </span>
        </div>

        <div className="dashboard-summary">
          <div>
            <span>Starting points</span>

            <strong>
              {tournament.starting_budget
                .toLocaleString()}
            </strong>
          </div>

          <div>
            <span>Squad limit</span>

            <strong>
              {tournament.maximum_squad_size}
            </strong>
          </div>

          <div>
            <span>Revocation</span>

            <strong>
              {tournament.allow_sale_revocation
                ? "Allowed"
                : "Disabled"}
            </strong>
          </div>
        </div>
      </header>

      <section className="dashboard-section-heading">
        <h2>Manage tournament</h2>

        <p>
          Choose the section you want to manage.
        </p>
      </section>

      <section className="dashboard-grid">
        {sections.map((section) => (
          <button
            type="button"
            className="dashboard-section-card"
            key={section.title}
            disabled={section.disabled}
            onClick={() =>
              openSection(section)
            }
          >
            <span className="section-symbol">
              {section.symbol}
            </span>

            <div>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </div>

            <strong>
              {section.disabled
                ? "Coming next"
                : section.openInNewWindow
                  ? "Open display ↗"
                  : "Open →"}
            </strong>
          </button>
        ))}
      </section>
    </main>
  );
}