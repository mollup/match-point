import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Edit2,
  Gamepad2,
  Globe,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "../auth-context";
import { api, type UserProfile } from "../api";
import "../styles/player-profile.css";

type PageState = "loading" | "error" | "empty" | "view" | "edit";

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser, ready } = useAuth();
  const navigate = useNavigate();

  const profileId = id ?? authUser?.id;
  const isOwnProfile = !!authUser && authUser.id === profileId;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editGames, setEditGames] = useState<string[]>([]);
  const [editGameInput, setEditGameInput] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    setPageState("loading");
    setFetchError(null);
    try {
      const data = await api.getUser(profileId);
      setProfile(data);
      setPageState(data.games.length === 0 ? "empty" : "view");
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load profile");
      setPageState("error");
    }
  }, [profileId]);

  useEffect(() => {
    if (!ready) return;
    if (!profileId) {
      const returnTo = encodeURIComponent("/players");
      navigate(`/login?next=${returnTo}`, { replace: true });
      return;
    }
    loadProfile();
  }, [ready, profileId, loadProfile, navigate]);

  function openEdit() {
    if (!profile) return;
    setEditDisplayName(profile.displayName);
    setEditRegion(profile.region ?? "");
    setEditGames([...profile.games]);
    setEditGameInput("");
    setEditError(null);
    setPageState("edit");
  }

  function cancelEdit() {
    setPageState(profile?.games.length === 0 ? "empty" : "view");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editGames.length === 0) {
      setEditError("Add at least one game.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const updated = await api.patchUser(profileId!, {
        displayName: editDisplayName,
        region: editRegion,
        games: editGames,
      });
      setProfile(updated);
      setPageState("view");
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setEditLoading(false);
    }
  }

  function addGame() {
    const trimmed = editGameInput.trim();
    if (!trimmed || editGames.includes(trimmed)) return;
    setEditGames([...editGames, trimmed]);
    setEditGameInput("");
  }

  function removeGame(game: string) {
    setEditGames(editGames.filter((g) => g !== game));
  }

  if (!ready) return null;

  return (
    <div className="pp-page">
      {/* ── Success toast ── */}
      {successToast && (
        <div className="pp-toast" role="status" aria-live="polite">
          <CheckCircle size={18} />
          Profile updated successfully!
          <button
            className="pp-toast-close"
            onClick={() => setSuccessToast(false)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {pageState === "loading" && (
        <div>
          <div className="pp-skeleton-header">
            <div className="pp-skeleton-avatar skel" />
            <div className="pp-skeleton-info">
              <div className="skel pp-skel-name" />
              <div className="skel pp-skel-meta" />
              <div className="skel pp-skel-meta" style={{ width: "40%" }} />
            </div>
            <div className="pp-skeleton-btns">
              <div className="skel pp-skel-btn" />
              <div className="skel pp-skel-btn" />
            </div>
          </div>
          <div className="pp-skeleton-body">
            <div className="skel pp-skel-section-title" />
            <div className="pp-skel-tags">
              <div className="skel pp-skel-tag" />
              <div className="skel pp-skel-tag" style={{ width: 80 }} />
              <div className="skel pp-skel-tag" style={{ width: 60 }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {pageState === "error" && (
        <div className="pp-error-state">
          <div className="pp-error-illustration">
            <AlertCircle size={96} strokeWidth={1} />
          </div>
          <div className="pp-error-content">
            <span className="pp-error-badge">ERROR</span>
            <h2>Oops! Something went wrong while loading your profile.</h2>
            <p>
              {fetchError ?? "Our servers hit a snag. This is usually temporary."}
            </p>
            <div className="pp-error-actions">
              <button className="pp-btn-primary" onClick={loadProfile}>
                <RefreshCw size={16} />
                Retry Loading
              </button>
              <Link to="/dashboard" className="pp-btn-ghost">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {pageState === "empty" && (
        <div className="pp-empty-state">
          <div className="pp-empty-main">
            <span className="pp-new-badge">NEW PROFILE</span>
            <h1 className="pp-welcome-title">
              Welcome to the{" "}
              <span className="pp-welcome-accent">Circuit.</span>
            </h1>
            <p className="pp-welcome-sub">
              Your legacy starts here. Complete your profile to find matches, join
              tournaments, and climb the global rankings.
            </p>
            <div className="pp-empty-icon-wrap">
              <Gamepad2 size={72} strokeWidth={1} className="pp-empty-gamepad" />
            </div>
            <h3 className="pp-empty-games-title">No games added</h3>
            <p className="pp-empty-games-sub">
              Your trophy room looks a bit quiet. Add the games you compete in.
            </p>
            {isOwnProfile && (
              <button className="pp-btn-primary pp-get-started" onClick={openEdit}>
                <Plus size={18} />
                Get Started
              </button>
            )}
          </div>

          {isOwnProfile && (
            <div className="pp-empty-sidebar">
              <div className="pp-hint-card">
                <Globe size={22} className="pp-hint-icon" />
                <div>
                  <h4>Update your region</h4>
                  <p>
                    MatchPoint uses your region to find local community tournaments.
                  </p>
                  <button className="pp-hint-link" onClick={openEdit}>
                    SET LOCATION →
                  </button>
                </div>
              </div>
              <div className="pp-hint-card">
                <Plus size={22} className="pp-hint-icon" />
                <div>
                  <h4>Add your first game</h4>
                  <p>
                    Whether it's FPS, MOBA, or Fighting games, get your profile
                    started.
                  </p>
                  <button className="pp-hint-link" onClick={openEdit}>
                    ADD GAME →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main view & edit ── */}
      {(pageState === "view" || pageState === "edit") && profile && (
        <>
          {/* Profile header */}
          <div className="pp-header-card">
            <div className="pp-avatar" aria-hidden="true">
              <span className="pp-avatar-initials">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="pp-header-info">
              <h1 className="pp-display-name">{profile.displayName}</h1>
              {profile.username && (
                <span className="pp-username">@{profile.username}</span>
              )}
              <div className="pp-header-meta">
                {profile.region && (
                  <span className="pp-meta-item">
                    <Globe size={14} />
                    {profile.region}
                  </span>
                )}
                <span className="pp-meta-item">
                  <Calendar size={14} />
                  Joined {formatJoinDate(profile.createdAt)}
                </span>
              </div>
            </div>
            {isOwnProfile && pageState === "view" && (
              <div className="pp-header-actions">
                <button className="pp-btn-outline" onClick={openEdit}>
                  <Edit2 size={15} />
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* Main view */}
          {pageState === "view" && (
            <div className="pp-body">
              <div className="pp-games-section">
                <div className="pp-section-header">
                  <h2>Games I Play</h2>
                  {isOwnProfile && (
                    <button className="pp-add-game-link" onClick={openEdit}>
                      + Add New Game
                    </button>
                  )}
                </div>
                <div className="pp-game-tags">
                  {profile.games.map((game) => (
                    <span key={game} className="pp-game-tag">
                      {game}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Edit form */}
          {pageState === "edit" && isOwnProfile && (
            <div className="pp-edit-card">
              <h2 className="pp-edit-title">Edit Profile</h2>
              {editError && (
                <div className="pp-edit-error" role="alert">
                  {editError}
                </div>
              )}
              <form onSubmit={saveEdit} className="pp-edit-form">
                <div className="pp-field">
                  <label htmlFor="pp-displayName">Display name</label>
                  <input
                    id="pp-displayName"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="pp-field">
                  <label htmlFor="pp-region">Region</label>
                  <input
                    id="pp-region"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. North America"
                  />
                </div>
                <div className="pp-field">
                  <label htmlFor="pp-game-input">Games</label>
                  <div className="pp-games-input-row">
                    <input
                      id="pp-game-input"
                      value={editGameInput}
                      onChange={(e) => setEditGameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGame();
                        }
                      }}
                      placeholder="Type a game and press Enter or Add"
                      maxLength={120}
                    />
                    <button
                      type="button"
                      className="pp-btn-outline pp-add-btn"
                      onClick={addGame}
                    >
                      Add
                    </button>
                  </div>
                  <div className="pp-edit-game-tags" aria-live="polite">
                    {editGames.map((game) => (
                      <span key={game} className="pp-edit-game-tag">
                        {game}
                        <button
                          type="button"
                          aria-label={`Remove ${game}`}
                          onClick={() => removeGame(game)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pp-edit-actions">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="pp-btn-primary"
                  >
                    {editLoading ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="pp-btn-ghost"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatJoinDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
