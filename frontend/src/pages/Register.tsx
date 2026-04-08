import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth-context";

export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function Register() {
  const { register, user, ready } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const nextPath = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"player" | "organizer">("player");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) nav(nextPath, { replace: true });
  }, [ready, user, nav, nextPath]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await register({ email, password, displayName, role });
      nav(nextPath, { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>Create account</h1>
      <p className="muted">Organizers can post events; players can sign up for brackets.</p>
      {err && <div className="error-banner">{err}</div>}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password (min 8)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as "player" | "organizer")}>
            <option value="player">Player</option>
            <option value="organizer">Tournament organizer</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1.25rem" }}>
        Already have an account?{" "}
        <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>Log in</Link>
      </p>
    </div>
  );
}
