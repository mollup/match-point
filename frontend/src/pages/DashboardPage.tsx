import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, CalendarDays, Plus, SearchX, UserPlus, Wallet } from "lucide-react";
import { api, type TournamentSummary } from "../api";
import { useAuth } from "../auth-context";

export function formatDateRange(): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TournamentSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listTournaments();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const list = items ?? [];
    const totalEntrants = list.reduce((s, t) => s + t.entrantCount, 0);
    const liveEvents = list.length;
    return {
      totalEntrants,
      liveEvents,
      /** Decorative demo id for revenue card (matches reference tone) */
      matchId: list[0]?.id?.slice(0, 8) ?? "492-u",
    };
  }, [items]);

  const dateLabel = formatDateRange();

  if (err) {
    return (
      <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b" }}>
        {err}
      </div>
    );
  }

  if (!items) {
    return <p style={{ color: "var(--dash-muted)" }}>Loading dashboard…</p>;
  }

  const preview = items.slice(0, 4);

  return (
    <>
      <div className="dashboard-page-head">
        <div>
          <p className="dashboard-kicker">Executive overview</p>
          <h1 className="dashboard-title">Dashboard</h1>
        </div>
        <div className="dashboard-date-pill">
          <CalendarDays size={16} />
          {dateLabel}
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Total Active Players</div>
          <div className="dashboard-stat-value blue">
            {stats.totalEntrants.toLocaleString("en-US")}
          </div>
          <div className="dashboard-stat-delta">
            <ArrowUp size={14} />
            Registrations across events
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Live Events</div>
          <div className="dashboard-stat-value" style={{ color: "#0f172a" }}>
            {String(stats.liveEvents).padStart(2, "0")}
          </div>
          <div className="dashboard-progress">
            <div className="dashboard-progress-bar" />
          </div>
          <div className="dashboard-stat-label" style={{ marginTop: 4, marginBottom: 0 }}>
            Capacity at 65%
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Revenue</div>
          <div className="dashboard-stat-value" style={{ color: "#0f172a" }}>
            $12.4k
          </div>
          <div className="dashboard-stat-label" style={{ marginTop: 8, marginBottom: 0 }}>
            MATCH ID: {stats.matchId}
          </div>
        </div>
      </div>

      <div>
        <div className="dashboard-section-head">
          <h2 className="dashboard-section-title">Current Tournaments</h2>
          <Link to="/tournament" className="dashboard-link">
            View All
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">
              <SearchX size={56} strokeWidth={1.25} />
            </div>
            <h3>No tournaments found</h3>
            <p>
              Your tournament engine is ready. Create your first one to get started and manage brackets, scores, and
              players.
            </p>
            {user?.role === "organizer" ? (
              <Link to="/tournament?create=1" className="dashboard-btn-primary" style={{ display: "inline-flex" }}>
                <Plus size={18} />
                Create Your first Tournament
              </Link>
            ) : (
              <p style={{ color: "var(--dash-muted)", fontSize: "0.9rem", margin: 0 }}>
                Ask an organizer to publish an event, or register an organizer account.
              </p>
            )}
          </div>
        ) : (
          <div>
            {preview.map((t) => (
              <div key={t.id} className="dashboard-tournament-row">
                <Link to={`/t/${t.id}`} style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--dash-muted)", marginTop: 2 }}>
                    {t.game} · {t.entrantCount} entr{t.entrantCount === 1 ? "ant" : "ants"}
                  </div>
                </Link>
                <Link to={`/t/${t.id}`} className="dashboard-link" style={{ fontSize: "0.8rem" }}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-bottom">
        <div>
          <h3 className="dashboard-logs-title">Recent System Logs</h3>
          <div className="dashboard-log-item">
            <div className="dashboard-log-icon">
              <UserPlus size={20} />
            </div>
            <div className="dashboard-log-body">
              <div className="dashboard-log-title">New Player Registration</div>
              <div className="dashboard-log-sub">John Doe joined &lsquo;Winter Open&rsquo;</div>
            </div>
            <span className="dashboard-log-time">2M AGO</span>
          </div>
          <div className="dashboard-log-item">
            <div className="dashboard-log-icon">
              <Wallet size={20} />
            </div>
            <div className="dashboard-log-body">
              <div className="dashboard-log-title">Payout Completed</div>
              <div className="dashboard-log-sub">Tournament ID #882 archived</div>
            </div>
            <span className="dashboard-log-time">1H AGO</span>
          </div>
        </div>

        <div className="dashboard-premium">
          <span className="dashboard-premium-badge">PREMIUM FEATURE</span>
          <h3>Unlock Advanced Bracket Logic</h3>
          <p>Double elimination, round robins, and custom Swiss systems are now available.</p>
          <button type="button">Upgrade Now</button>
        </div>
      </div>
    </>
  );
}
