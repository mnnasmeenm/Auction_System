import { useRef } from "react";
import { toPng } from "html-to-image";
import type { Player } from "../../types/database";
import { getPlayerPhotoUrl } from "../../services/playerPhotos";
import { getTournamentBrandingUrl } from "../../services/tournamentBranding";

interface PlayerCardProps {
  player: Player;
  societyName: string;
  tournamentName: string;
  societyLogoPath: string | null;
  tournamentLogoPath: string | null;
  onEdit: (player: Player) => void;
  onDelete: (player: Player) => void;
}

function initials(name: string) {
  return name
    .replaceAll(".", "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PlayerCard({
  player,
  societyName,
  tournamentName,
  societyLogoPath,
  tournamentLogoPath,
  onEdit,
  onDelete
}: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const photoUrl = getPlayerPhotoUrl(player.photo_path);
  const societyLogoUrl = getTournamentBrandingUrl(societyLogoPath);
  const tournamentLogoUrl = getTournamentBrandingUrl(tournamentLogoPath);

  async function downloadCard() {
    if (!cardRef.current) return;

    const image = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#07142f"
    });

    const link = document.createElement("a");
    link.download = `${player.full_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-player-card.png`;
    link.href = image;
    link.click();
  }

  return (
    <article className="player-card-shell">
      <div className="social-player-card" ref={cardRef}>
        <div className="player-card-glow" />

        <header className="social-player-brand">
          <div className="social-player-brand-copy">
            <span>{societyName}</span>
            <strong>{tournamentName}</strong>
          </div>

          <div className="social-player-brand-logos">
            {societyLogoUrl && (
              <img src={societyLogoUrl} alt={`${societyName} logo`} />
            )}
            {tournamentLogoUrl && (
              <img src={tournamentLogoUrl} alt={`${tournamentName} logo`} />
            )}
          </div>
        </header>

        <div className="social-player-photo">
          <b>
            {player.player_number ? `#${player.player_number}` : "PLAYER"}
          </b>

          {photoUrl ? (
            <img src={photoUrl} alt={player.full_name} />
          ) : (
            <span>{initials(player.full_name)}</span>
          )}
        </div>

        <div className="social-player-copy">
          <small>{player.category?.name ?? "Uncategorized"}</small>
          <h3>{player.full_name}</h3>
          {player.nickname && <p>“{player.nickname}”</p>}

          <div className="social-player-skills">
            <div>
              <span>BATTING</span>
              <strong>{player.batting_style ?? "Not specified"}</strong>
            </div>
            <div>
              <span>BOWLING</span>
              <strong>{player.bowling_style ?? "Not specified"}</strong>
            </div>
            <div>
              <span>POSITION</span>
              <strong>{player.preferred_position ?? "Utility player"}</strong>
            </div>
          </div>

          <div className="social-player-value">
            <span>BASE VALUE</span>
            <strong>{player.base_price.toLocaleString()} LKR</strong>
          </div>
        </div>
      </div>

      <div className="player-card-actions">
        <button type="button" onClick={downloadCard}>Download card</button>
        <button type="button" onClick={() => onEdit(player)}>Edit</button>
        <button
          type="button"
          className="delete-player-button"
          onClick={() => onDelete(player)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}