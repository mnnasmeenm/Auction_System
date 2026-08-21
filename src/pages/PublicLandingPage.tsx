import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getPublicTournaments } from "../services/publicScoring";
import { getTournamentBrandingUrl } from "../services/tournamentBranding";

import type { Tournament } from "../types/database";

import "./PublicScores.css";

export default function PublicLandingPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getPublicTournaments()
      .then(setTournaments)
      .catch((error) => setErrorMessage(
        error instanceof Error ? error.message : "Public tournaments could not be loaded."
      ))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="public-score-page public-landing-page">
      <header className="public-main-header">
        <div className="public-brand-mark">AT</div>
        <div>
          <span>ATH-THARIQ MATCH CENTRE</span>
          <h1>Live cricket, fixtures and results</h1>
          <p>Select a public tournament to see ongoing, upcoming and recently completed matches.</p>
        </div>
        <Link to="/login">Administrator login</Link>
      </header>

      {loading && <section className="public-message">Loading tournaments…</section>}
      {errorMessage && <section className="public-message public-error">{errorMessage}</section>}

      {!loading && !errorMessage && (
        <section className="public-tournament-grid">
          {tournaments.length === 0 ? (
            <div className="public-message">No tournament has been published yet.</div>
          ) : tournaments.map((tournament) => {
            const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
            const tournamentLogo = getTournamentBrandingUrl(tournament.tournament_logo_path);

            return (
              <Link
                className="public-tournament-card"
                key={tournament.id}
                to={`/t/${tournament.public_slug}`}
              >
                <div className="public-tournament-logos">
                  {societyLogo && <img src={societyLogo} alt="" />}
                  {tournamentLogo && <img src={tournamentLogo} alt="" />}
                </div>
                <span>{tournament.society_name}</span>
                <h2>{tournament.tournament_name}</h2>
                <p>Fixtures · Live score · Results · Full scorecards</p>
                <strong>Open tournament →</strong>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
