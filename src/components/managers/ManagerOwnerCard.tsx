import { type CSSProperties, useRef } from "react";
import { toPng } from "html-to-image";
import type { ManagerPortalData } from "../../services/managerPortal";
import { getManagerPhotoUrl } from "../../services/managerPhotos";
import { getTeamLogoUrl } from "../../services/teams";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";
import "./ManagerOwnerCard.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ManagerOwnerCard({
  portal
}: {
  portal: ManagerPortalData;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const { manager, team, tournament } = portal;
  const managerPhotoUrl = getManagerPhotoUrl(manager.manager_photo_path);
  const logoUrl = getTeamLogoUrl(team.logo_path);
  const societyLogoUrl = getTournamentBrandingUrl(
    tournament.society_logo_path
  );
  const tournamentLogoUrl = getTournamentBrandingUrl(
    tournament.tournament_logo_path
  );

  async function downloadCard() {
    if (!cardRef.current) return;

    const image = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#07142f"
    });

    const link = document.createElement("a");
    link.download = `${team.short_name}-team-owner.png`;
    link.href = image;
    link.click();
  }

  return (
    <section className="manager-owner-showcase">
      <article
        ref={cardRef}
        className="manager-owner-card"
        style={{ "--team-color": team.team_color } as CSSProperties}
      >
        <div className="owner-card-orbit owner-orbit-one" />
        <div className="owner-card-orbit owner-orbit-two" />

        <div className="owner-card-branding">
          <div className="owner-card-brand-logos">
            {societyLogoUrl && (
              <img
                src={societyLogoUrl}
                alt={`${tournament.society_name} logo`}
              />
            )}

            {tournamentLogoUrl && (
              <img
                src={tournamentLogoUrl}
                alt={`${tournament.tournament_name} logo`}
              />
            )}
          </div>

          <div>
            <small>{tournament.society_name}</small>
            <strong>{tournament.tournament_name}</strong>
          </div>
        </div>

        <div className="owner-card-photo-frame">
          {managerPhotoUrl ? (
            <img
              src={managerPhotoUrl}
              alt={manager.full_name ?? "Team owner"}
            />
          ) : (
            <span>{initials(manager.full_name ?? "Team Owner")}</span>
          )}
        </div>

        <div className="owner-card-copy">
          <p>MEET THE TEAM OWNER</p>
          <h1>{manager.full_name ?? "Team Manager"}</h1>

          <div className="owner-card-team">
            {logoUrl ? (
              <img src={logoUrl} alt={team.name} />
            ) : (
              <span>{team.short_name}</span>
            )}
            <strong>{team.name}</strong>
          </div>
        </div>

        <div className="owner-card-season">OFFICIAL TEAM</div>
      </article>

      <button
        type="button"
        className="owner-card-download"
        onClick={downloadCard}
      >
        Download social card
      </button>
    </section>
  );
}