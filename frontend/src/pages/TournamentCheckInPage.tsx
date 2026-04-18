import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type EntrantRecord, type TournamentDetail } from "../api";
import { useAuth } from "../auth-context";

export function TournamentCheckInPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [entrants, setEntrants] = useState<EntrantRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const d = await api.getTournament(id);
    setDetail(d);
    setEntrants(d.entrants);
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

  useEffect(() => {
    if (ready && user && user.role !== "organizer") {
      nav(`/t/${id ?? ""}`, { replace: true });
    }
  }, [ready, user, nav, id]);

  async function toggle(entrant: EntrantRecord) {
    if (!id || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const updated = entrant.checkedIn
        ? await api.uncheckInEntrant(id, entrant.userId)
        : await api.checkInEntrant(id, entrant.userId);
      setEntrants((prev) =>
        prev.map((e) => (e.userId === updated.userId ? { ...e, checkedIn: updated.checkedIn } : e))
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmClose() {
    if (!id || busy) return;
    setErr(null);
    setBusy(true);
    try {
      await api.closeCheckIn(id);
      setShowConfirm(false);
      nav(`/t/${id}/bracket`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not close check-in");
    } finally {
      setBusy(false);
    }
  }

  if (err && !detail) return <div className="error-banner">{err}</div>;
  if (!detail) return <p className="muted">Loading…</p>;

  const checkedInCount = entrants.filter((e) => e.checkedIn).length;
  const closed = detail.checkInClosed;

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link to={`/t/${id}`}>← Back to tournament</Link>
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.35rem" }}>
        Check-In · {detail.name}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {checkedInCount} / {entrants.length} checked in
        {closed ? " · check-in closed" : ""}
      </p>

      {err && (
        <div className="error-banner" role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      {entrants.length === 0 ? (
        <p className="muted">Sign ups required before check-in.</p>
      ) : (
        <ol style={{ paddingLeft: 0, listStyle: "none", margin: "1rem 0" }}>
          {entrants.map((e) => (
            <li
              key={e.userId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.75rem",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span>
                {e.displayName}
                {closed && !e.checkedIn ? (
                  <span
                    style={{
                      marginLeft: "0.6rem",
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      background: "#fee2e2",
                      color: "#991b1b",
                    }}
                  >
                    Did Not Attend
                  </span>
                ) : null}
              </span>
              {closed ? (
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {e.checkedIn ? "Checked in" : "No-show"}
                </span>
              ) : (
                <button
                  type="button"
                  className={e.checkedIn ? "btn btn-ghost" : "btn btn-primary"}
                  onClick={() => toggle(e)}
                  disabled={busy}
                  aria-pressed={e.checkedIn}
                  aria-label={e.checkedIn ? `Undo check-in for ${e.displayName}` : `Check in ${e.displayName}`}
                >
                  {e.checkedIn ? "Undo" : "Check in"}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {!closed && (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowConfirm(true)}
            disabled={busy || checkedInCount === 0}
          >
            Close Check-In
          </button>
        </div>
      )}

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-checkin-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: "90%", padding: "1.25rem" }}
          >
            <h2 id="close-checkin-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>
              Close check-in?
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Once closed, no-shows will be excluded from the generated bracket.
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowConfirm(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmClose}
                disabled={busy}
              >
                {busy ? "Closing…" : "Yes, close check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
