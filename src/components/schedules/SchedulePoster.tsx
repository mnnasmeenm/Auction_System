import { type CSSProperties, useRef, useState } from "react";

import { toPng } from "html-to-image";

import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

import type {
  Tournament,
  TournamentMatch,
  TournamentScheduleBreak
} from "../../types/database";

import "./SchedulePoster.css";

export type SchedulePosterItem =
  | { type: "match"; match: TournamentMatch }
  | { type: "break"; scheduleBreak: TournamentScheduleBreak };

interface SchedulePosterProps {
  tournament: Tournament;
  items: SchedulePosterItem[];
  pageNumber: number;
  totalPages: number;
}

function stageLabel(stage: TournamentMatch["stage"]) {
  return stage
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function teamName(match: TournamentMatch, side: "one" | "two") {
  return side === "one"
    ? match.team_one?.name ?? match.team_one_placeholder ?? "To be decided"
    : match.team_two?.name ?? match.team_two_placeholder ?? "To be decided";
}

function formatDateTime(value: string | null) {
  if (!value) return { date: "DATE TBA", time: "TIME TBA" };
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  };
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export default function SchedulePoster({
  tournament,
  items,
  pageNumber,
  totalPages
}: SchedulePosterProps) {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const societyLogo = getTournamentBrandingUrl(tournament.society_logo_path);
  const tournamentLogo = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );

  async function downloadPoster() {
    if (!posterRef.current || downloading) return;
    setDownloading(true);

    try {
      await document.fonts.ready;
      const images = Array.from(posterRef.current.querySelectorAll("img"));
      await Promise.all(
        images.map((image) => image.decode?.().catch(() => undefined))
      );

      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#061126"
      });
      const link = document.createElement("a");
      link.download = `${tournament.tournament_name}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") + `-schedule-${pageNumber}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="schedule-poster-showcase">
      <div ref={posterRef} className="schedule-poster">
        <div className="schedule-poster-grid" />
        <div className="schedule-poster-stripe" />

        <header className="schedule-poster-header">
          <div className="schedule-poster-logos">
            {societyLogo && <img src={societyLogo} alt="Society logo" />}
            {tournamentLogo && <img src={tournamentLogo} alt="Tournament logo" />}
          </div>
          <div>
            <small>{tournament.society_name}</small>
            <h2>{tournament.tournament_name}</h2>
            <p>OFFICIAL MATCH SCHEDULE</p>
          </div>
          <strong>PAGE {pageNumber}/{totalPages}</strong>
        </header>

        <div className="schedule-poster-fixtures">
          {items.map((item) => {
            if (item.type === "break") {
              const starts = formatDateTime(item.scheduleBreak.starts_at);
              const ends = formatDateTime(item.scheduleBreak.ends_at);

              return (
                <article
                  className="schedule-poster-break"
                  key={`break-${item.scheduleBreak.id}`}
                >
                  <span>EVENT BREAK</span>
                  <div>
                    <strong>{item.scheduleBreak.label}</strong>
                    <small>{starts.date}</small>
                  </div>
                  <b>{starts.time} — {ends.time}</b>
                </article>
              );
            }

            const match = item.match;
            const firstName = teamName(match, "one");
            const secondName = teamName(match, "two");
            const firstLogo = getTeamLogoUrl(match.team_one?.logo_path ?? null);
            const secondLogo = getTeamLogoUrl(match.team_two?.logo_path ?? null);
            const timing = formatDateTime(match.scheduled_at);

            return (
              <article
                className="schedule-poster-match"
                key={match.id}
                style={{
                  "--schedule-first-color": match.team_one?.team_color ?? "#2f72ff",
                  "--schedule-second-color": match.team_two?.team_color ?? "#ff7a18",
                  "--schedule-division-color": match.division?.division_color ?? "#ffd166"
                } as CSSProperties}
              >
                <div className="schedule-poster-match-meta">
                  <span>MATCH {match.match_number}</span>
                  <b>{stageLabel(match.stage)}</b>
                  <em>{match.division?.short_name ?? "OPEN"}</em>
                </div>

                <div className="schedule-poster-team schedule-poster-team-one">
                  <div>
                    {firstLogo
                      ? <img src={firstLogo} alt="" />
                      : <strong>{initials(firstName)}</strong>}
                  </div>
                  <span>{firstName}</span>
                </div>

                <div className="schedule-poster-time">
                  <strong>{timing.date}</strong>
                  <span>{timing.time}</span>
                  <small>{match.venue || "Venue TBA"}</small>
                </div>

                <div className="schedule-poster-team schedule-poster-team-two">
                  <div>
                    {secondLogo
                      ? <img src={secondLogo} alt="" />
                      : <strong>{initials(secondName)}</strong>}
                  </div>
                  <span>{secondName}</span>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="schedule-poster-footer">
          <span>{tournament.society_name}</span>
          <strong>Match conditions may be updated by the tournament administrator</strong>
        </footer>
      </div>

      <button
        type="button"
        className="schedule-poster-download"
        disabled={downloading}
        onClick={downloadPoster}
      >
        {downloading ? "Preparing image…" : `Download schedule page ${pageNumber}`}
      </button>
    </section>
  );
}
