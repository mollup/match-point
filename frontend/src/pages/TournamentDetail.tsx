import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type TournamentDetail } from "../api";
import { useAuth } from "../auth-context";

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [hasPublishedBracket, setHasPublishedBracket] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Registration form state */
  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [gameSelection, setGameSelection] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    const d = await api.getTournament(id);
    setDetail(d);
    const b = await api.getTournamentBracket(id);
    setHasPublishedBracket(b !== null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Not found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /* Pre-fill form defaults when user/detail load */
  useEffect(() => {
    if (user && !displayName) setDisplayName(user.displayName);
    if (detail && !gameSelection) setGameSelection(detail.game);
  }, [user, detail, displayName, gameSelection]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !user) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await api.registerForTournament(id, { displayName, gameSelection });
      setMsg("You are registered for this event!");
      setShowForm(false);
      await load();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function onBracket() {
    if (!id || user?.role !== "organizer") return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await api.generateBracket(id);
      setHasPublishedBracket(true);
      setMsg("Bracket generated from current entrants.");
      nav(`/t/${id}/bracket`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate bracket");
    } finally {
      setBusy(false);
    }
  }

  if (err && !detail) return <div className="error-banner">{err}</div>;
  if (!detail) return <p className="muted">Loading…</p>;

  const already = user && detail.entrants.some((e) => e.userId === user.id);
  const isFull =
    detail.maxEntrants !== null && detail.entrantCount >= detail.maxEntrants;
  const isClosed = !detail.registrationOpen;
  const canRegister =
    ready && user?.role === "player" && !already && !isFull && !isClosed;
  const isOrg = user?.role === "organizer";

  const spotsLabel =
    detail.maxEntrants !== null
      ? `${detail.entrantCount} / ${detail.maxEntrants} spots filled`
      : `${detail.entrantCount} entr${detail.entrantCount === 1 ? "ant" : "ants"}`;

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/tournament">← Tournament</Link>
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.35rem" }}>
        {detail.name}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {detail.game} · {spotsLabel}
      </p>

      {msg && (
        <div className="success-banner" role="status" aria-live="polite">
          {msg}
        </div>
      )}
      {err && (
        <div className="error-banner" role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      {/* Registration closed / full banners */}
      {isClosed && (
        <div className="error-banner" role="status">
          Registration is closed for this tournament.
        </div>
      )}
      {!isClosed && isFull && (
        <div className="error-banner" role="status">
          Registration is full. No more spots are available.
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          margin: "1.25rem 0",
          alignItems: "center",
        }}
      >
        {hasPublishedBracket && (
          <Link
            to={`/t/${id}/bracket`}
            className="btn btn-primary"
            style={{ textDecoration: "none", display: "inline-flex" }}
          >
            View bracket
          </Link>
        )}
        {canRegister && !showForm && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            Sign up for this event
          </button>
        )}
        {ready && user?.role === "player" && already && (
          <span className="muted">✓ You are registered.</span>
        )}
        {ready && !user && (
          <span className="muted">
            <Link
              to={`/login?next=${encodeURIComponent(`/t/${id ?? ""}`)}`}
            >
              Log in
            </Link>{" "}
            as a player to sign up.
          </span>
        )}
        {isOrg && (
          <>
            <Link
              to={`/t/${id}/checkin`}
              className="btn btn-ghost"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              Check-in
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBracket}
              disabled={busy}
            >
              Generate bracket
            </button>
          </>
        )}
      </div>

      {/* Registration form */}
      {showForm && canRegister && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0, marginBottom: "0.75rem" }}>
            Register for {detail.name}
          </h2>
          <form onSubmit={onRegister}>
            <div className="field">
              <label htmlFor="reg-displayName">Display Name</label>
              <input
                id="reg-displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={120}
                aria-required="true"
              />
            </div>
            <div className="field">
              <label htmlFor="reg-gameSelection">Game</label>
              <input
                id="reg-gameSelection"
                type="text"
                value={gameSelection}
                onChange={(e) => setGameSelection(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? "Registering…" : "Confirm Registration"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowForm(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.65rem" }}>Entrants</h2>
      {detail.entrants.length === 0 ? (
        <p className="muted">No one has signed up yet.</p>
      ) : (
        <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
          {detail.entrants.map((e) => (
            <li key={e.userId} style={{ marginBottom: 4 }}>
              {e.displayName}
              {detail.checkInClosed && !e.checkedIn ? (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.7rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "999px",
                    background: "#fee2e2",
                    color: "#991b1b",
                    verticalAlign: "middle",
                  }}
                >
                  Did Not Attend
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}