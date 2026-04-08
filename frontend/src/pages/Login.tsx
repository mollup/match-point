import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth-context";

export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function Login() {
  const { login, user, ready } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const nextPath = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email, password);
      nav(nextPath, { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>Log in</h1>
      {err && <div className="error-banner">{err}</div>}
      <form onSubmit={onSubmit}>
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1.25rem" }}>
        No account?{" "}
        <Link to={`/register?next=${encodeURIComponent(nextPath)}`}>Register</Link>
      </p>
    </div>
  );
}
