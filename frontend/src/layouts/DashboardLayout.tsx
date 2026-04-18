import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { api, type MatchCallNotificationDTO } from "../api";
import { useAuth } from "../auth-context";
import "../styles/bracket-view-page.css";
import "../styles/dashboard.css";

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `dashboard-nav-link${isActive ? " active" : ""}`}>
      <Icon strokeWidth={2} />
      {label}
    </NavLink>
  );
}

function TournamentsNavLink() {
  const loc = useLocation();
  const active =
    loc.pathname.startsWith("/tournament") || /\/t\/[^/]+\/bracket\/?$/.test(loc.pathname);
  return (
    <Link to="/tournament" className={`dashboard-nav-link${active ? " active" : ""}`}>
      <Trophy strokeWidth={2} size={20} />
      Tournaments
    </Link>
  );
}

export function DashboardLayout({ children }: { children?: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [currentEventTitle, setCurrentEventTitle] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [matchNotifs, setMatchNotifs] = useState<MatchCallNotificationDTO[]>([]);
  const notifyWrapRef = useRef<HTMLDivElement | null>(null);

  const isPublicBracketRoute = /\/t\/[^/]+\/bracket\/?$/.test(location.pathname);
  const isTournamentRoute = location.pathname.startsWith("/tournament");
  const isTournamentVisual = isTournamentRoute || isPublicBracketRoute;
  let searchPlaceholder = "Search tournaments, players...";
  if (isTournamentRoute) searchPlaceholder = "Search events...";
  else if (isPublicBracketRoute) searchPlaceholder = "Search tournaments...";
  const rootClass = `dashboard-root${isTournamentVisual ? " tournament-route" : ""}`;

  useEffect(() => {
    if (ready && !user && !isPublicBracketRoute) {
      const returnTo = `${location.pathname}${location.search}` || "/dashboard";
      nav(`/login?next=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [ready, user, nav, location.pathname, location.search, isPublicBracketRoute]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia("(max-width: 900px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  if (!ready) {
    return (
      <div className={rootClass} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--dash-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!user && !isPublicBracketRoute) {
    return (
      <div className={rootClass} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--dash-muted)" }}>Loading…</p>
      </div>
    );
  }

  const isGuest = !user && isPublicBracketRoute;

  const refreshMatchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const items = await api.getMatchCallNotifications(user.id);
      setMatchNotifs(items);
    } catch {
      /* non-blocking */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshMatchNotifications();
    const t = window.setInterval(() => void refreshMatchNotifications(), 45_000);
    return () => window.clearInterval(t);
  }, [user, refreshMatchNotifications]);

  useEffect(() => {
    if (!notifyOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = notifyWrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setNotifyOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifyOpen]);

  const initials = isGuest
    ? "?"
    : user!.displayName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

  const roleLabel = isGuest ? "Viewer" : user!.role === "organizer" ? "Admin Account" : "Player Account";

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={rootClass}>
      <div className="dashboard-shell">
        {sidebarOpen ? (
          <button
            type="button"
            className="dashboard-sidebar-backdrop"
            aria-label="Close menu"
            onClick={closeSidebar}
          />
        ) : null}
        <aside
          className={`dashboard-sidebar${sidebarOpen ? " dashboard-sidebar--open" : ""}`}
          id="dashboard-sidebar"
        >
          <div className="dashboard-logo">
            <button
              type="button"
              className="dashboard-sidebar-dismiss"
              onClick={closeSidebar}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
            <div className="dashboard-logo-mark">
              <Trophy size={22} strokeWidth={2} />
            </div>
            <div className="dashboard-logo-text">
              <span className="dashboard-logo-title">MatchPoint</span>
              <span className="dashboard-logo-sub">Tournament Engine</span>
            </div>
          </div>
          <nav className="dashboard-nav" onClick={closeSidebar}>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <TournamentsNavLink />
            <NavItem to="/players" icon={Users} label="Players" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </nav>
          {isPublicBracketRoute ? (
            <div className="bv-pro-sidebar">
              <strong>Pro plan</strong>
              Manage unlimited brackets and live scoring.
            </div>
          ) : null}
          {isTournamentVisual ? (
            <div className="dashboard-current-event">
              <div className="dashboard-current-event-label">Current Event</div>
              <div className="dashboard-current-event-name">{currentEventTitle ?? "Winter Cup 2024"}</div>
            </div>
          ) : null}
          <div className="dashboard-user">
            {isGuest ? (
              <div className="dashboard-user-avatar">{initials}</div>
            ) : (
              <Link
                to={`/players/${user!.id}`}
                className="dashboard-user-avatar dashboard-user-avatar-link"
                aria-label="Open my profile"
                onClick={closeSidebar}
              >
                {initials}
              </Link>
            )}
            <div>
              <div className="dashboard-user-name">{isGuest ? "Guest" : user!.displayName}</div>
              <div className="dashboard-user-role">{roleLabel}</div>
              {isGuest ? (
                <Link
                  to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                  style={{
                    marginTop: 6,
                    display: "inline-block",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#2d3e98",
                  }}
                >
                  Log in
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    marginTop: 6,
                    border: "none",
                    background: "none",
                    padding: 0,
                    fontSize: "0.75rem",
                    color: "#64748b",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Log out
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <button
              type="button"
              className="dashboard-nav-toggle"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="dashboard-sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} strokeWidth={2} />
            </button>
            <div className="dashboard-search">
              <Search size={18} color="#94a3b8" />
              <input type="search" placeholder={searchPlaceholder} readOnly aria-label="Search" />
            </div>
            <div className="dashboard-notify-wrap" ref={notifyWrapRef}>
              <button
                type="button"
                className="dashboard-icon-btn"
                aria-label="Match notifications"
                aria-expanded={notifyOpen}
                onClick={() => {
                  setNotifyOpen((o) => !o);
                  void refreshMatchNotifications();
                }}
              >
                <Bell size={20} />
                {!isGuest && matchNotifs.length > 0 ? <span className="dashboard-notify-dot" /> : null}
              </button>
              {notifyOpen && !isGuest ? (
                <div className="dashboard-notify-panel" role="dialog" aria-label="Match call notifications">
                  <div className="dashboard-notify-panel-head">Your match is ready</div>
                  {matchNotifs.length === 0 ? (
                    <p className="dashboard-notify-empty">No open match calls.</p>
                  ) : (
                    <ul className="dashboard-notify-list">
                      {matchNotifs.map((n) => (
                        <li key={n.id} className="dashboard-notify-item">
                          <div className="dashboard-notify-item-body">
                            <strong>
                              Round {n.round} vs {n.opponentDisplayName}
                            </strong>
                            {n.stationLabel ? (
                              <span className="dashboard-notify-station">{n.stationLabel}</span>
                            ) : null}
                            <span className="dashboard-notify-time">
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="dashboard-notify-item-actions">
                            <Link
                              to={`/t/${n.tournamentId}/bracket`}
                              className="dashboard-notify-link"
                              onClick={() => setNotifyOpen(false)}
                            >
                              Open bracket
                            </Link>
                            <button
                              type="button"
                              className="dashboard-notify-dismiss"
                              onClick={async () => {
                                try {
                                  await api.ackMatchCallNotification(n.id);
                                  await refreshMatchNotifications();
                                } catch {
                                  /* ignore */
                                }
                              }}
                            >
                              Got it
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            {!isGuest && user?.role === "organizer" ? (
              <Link to="/tournament?create=1" className="dashboard-btn-primary">
                <Plus size={18} />
                Create Tournament
              </Link>
            ) : null}
          </header>

          <div className="dashboard-content">
            {children ?? <Outlet context={{ setCurrentEventTitle }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
