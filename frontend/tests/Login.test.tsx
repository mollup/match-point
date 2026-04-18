/**
 * Tests for frontend/src/pages/Login.tsx
 *
 * Covers: safeNext, form + Register link (next encoding), submit + navigate,
 * sanitizing malicious next on login, loading/disabled states, redirect when
 * already authenticated (with optional next).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Login, safeNext } from "../src/pages/Login";
import { useAuth } from "../src/auth-context";

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function buildAuthState(overrides: Record<string, unknown> = {}) {
  return {
    login: mockLogin,
    user: null,
    ready: true,
    ...overrides,
  };
}

function renderLogin(path = "/login") {
  vi.mocked(useAuth).mockReturnValue(buildAuthState() as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/profile" element={<div>profile</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── safeNext ─────────────────────────────────────────────────────────────────

describe("safeNext", () => {
  it("returns /dashboard when raw is null", () => {
    expect(safeNext(null)).toBe("/dashboard");
  });

  it("returns /dashboard when raw is an empty string", () => {
    expect(safeNext("")).toBe("/dashboard");
  });

  it("returns the path when it starts with a single /", () => {
    expect(safeNext("/profile")).toBe("/profile");
  });

  it("returns /dashboard when raw starts with // (open-redirect protection)", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
  });

  it("returns /dashboard when raw does not start with /", () => {
    expect(safeNext("http://evil.com")).toBe("/dashboard");
  });
});

// ─── Login – rendering ────────────────────────────────────────────────────────

describe("Login – rendering", () => {
  it("renders an email input field", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders a password input field", () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders a Sign in submit button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /register/i })).toBeInTheDocument();
  });

  it("points Register at /register with next=/dashboard when no next query is present", () => {
    renderLogin("/login");
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register?next=%2Fdashboard");
  });

  it("encodes the Register next param to match the login next param", () => {
    renderLogin("/login?next=%2Ft%2Fabc");
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register?next=%2Ft%2Fabc");
  });

  it("shows a loading placeholder while auth is not ready", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ ready: false }) as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ─── Login – onSubmit ─────────────────────────────────────────────────────────

describe("Login – onSubmit", () => {
  it("calls login with the entered email and password", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "mypassword" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("user@test.com", "mypassword"));
  });

  it("navigates to /dashboard after a successful login (no next param)", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin("/login");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
  });

  it("navigates to the next param path after a successful login", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin("/login?next=/profile");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/profile", { replace: true }));
  });

  it("navigates to /dashboard after login when next is an open-redirect attempt", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin("/login?next=//evil.com");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
  });

  it("displays an error banner when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bad@bad.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  });

  it("disables the submit button while login is in progress", async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(new Promise<void>((res) => { resolveLogin = res; }));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled());
    resolveLogin();
  });
});

// ─── Login – redirect when already authenticated ──────────────────────────────

describe("Login – redirect when already authenticated", () => {
  it("redirects to /dashboard immediately when user is already logged in", () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ user: mockUser, ready: true }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("redirects to the next param when already logged in", () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ user: mockUser, ready: true }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/login?next=/profile"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route path="/profile" element={<div>profile</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/profile", { replace: true });
  });

  it("does not render the login form when already authenticated", () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ user: mockUser, ready: true }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: /^log in$/i })).not.toBeInTheDocument();
  });
});
