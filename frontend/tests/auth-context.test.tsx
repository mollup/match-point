/**
 * Tests for frontend/src/auth-context.tsx
 *
 * Covers: AuthProvider hydration (restores/clears session), login, register,
 * logout, and the useAuth hook guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../src/auth-context";
import { api, setStoredToken } from "../src/api";

vi.mock("../src/api", () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    getUser: vi.fn(),
  },
  setStoredToken: vi.fn(),
}));

// A minimal consumer component to observe context state
function TestConsumer() {
  const { user, ready, login, register, logout } = useAuth();
  if (!ready) return <div data-testid="state">loading</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.displayName : "guest"}</div>
      <div data-testid="role">{user?.role ?? "none"}</div>
      <button onClick={() => void login("a@b.com", "pass")}>login</button>
      <button onClick={() => void register({ email: "a@b.com", password: "pass1234", displayName: "Alice", role: "player" })}>
        register
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function wrap(ui: React.ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.getUser).mockResolvedValue({ id: "1", displayName: "Alice", games: [], createdAt: "2025-01-01" });
});

// ─── AuthProvider hydration ───────────────────────────────────────────────────

describe("AuthProvider – hydration", () => {
  it("transitions from loading to ready with a guest user when localStorage is empty", async () => {
    wrap(<TestConsumer />);
    // The loading state may be brief; just assert the final ready state
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());
    expect(screen.getByTestId("user").textContent).toBe("guest");
  });

  it("restores the user from localStorage on mount", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    localStorage.setItem("mp_token", "stored-token");
    localStorage.setItem("mp_user", JSON.stringify(mockUser));

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Alice"));
  });

  it("revalidates the stored user against the backend on hydration", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    localStorage.setItem("mp_token", "stored-token");
    localStorage.setItem("mp_user", JSON.stringify(mockUser));

    wrap(<TestConsumer />);
    await waitFor(() => expect(vi.mocked(api.getUser)).toHaveBeenCalledWith("1"));
  });

  it("clears a stale session when the backend reports 'User not found'", async () => {
    const staleUser = { id: "stale-id", email: "gone@gone.com", displayName: "Gone", role: "player" as const };
    localStorage.setItem("mp_token", "old-tok");
    localStorage.setItem("mp_user", JSON.stringify(staleUser));
    vi.mocked(api.getUser).mockRejectedValue(new Error("User not found"));

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("guest"));
    expect(localStorage.getItem("mp_token")).toBeNull();
  });

  it("handles corrupt localStorage JSON gracefully and resets to guest", async () => {
    localStorage.setItem("mp_token", "tok");
    localStorage.setItem("mp_user", "not-valid-json{{{");

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("guest"));
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("AuthProvider – login", () => {
  it("updates the user in state after a successful login", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(api.login).mockResolvedValue({ token: "new-tok", user: mockUser });

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());

    await act(async () => { screen.getByText("login").click(); });
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Alice"));
  });

  it("persists the token to localStorage after login", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(api.login).mockResolvedValue({ token: "tok-abc", user: mockUser });

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());

    await act(async () => { screen.getByText("login").click(); });
    await waitFor(() => expect(localStorage.getItem("mp_token")).toBe("tok-abc"));
  });

  it("calls setStoredToken with the new token after login", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(api.login).mockResolvedValue({ token: "tok-set", user: mockUser });

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());

    await act(async () => { screen.getByText("login").click(); });
    await waitFor(() => expect(vi.mocked(setStoredToken)).toHaveBeenCalledWith("tok-set"));
  });
});

// ─── register ────────────────────────────────────────────────────────────────

describe("AuthProvider – register", () => {
  it("updates the user in state after a successful registration", async () => {
    const mockUser = { id: "2", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(api.register).mockResolvedValue({ token: "reg-tok", user: mockUser });

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());

    await act(async () => { screen.getByText("register").click(); });
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Alice"));
  });

  it("persists the token to localStorage after registration", async () => {
    const mockUser = { id: "2", email: "a@b.com", displayName: "Alice", role: "player" as const };
    vi.mocked(api.register).mockResolvedValue({ token: "reg-stored", user: mockUser });

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.queryByTestId("state")).toBeNull());

    await act(async () => { screen.getByText("register").click(); });
    await waitFor(() => expect(localStorage.getItem("mp_token")).toBe("reg-stored"));
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("AuthProvider – logout", () => {
  it("resets the user to guest on logout", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    localStorage.setItem("mp_token", "tok");
    localStorage.setItem("mp_user", JSON.stringify(mockUser));

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Alice"));

    await act(async () => { screen.getByText("logout").click(); });
    expect(screen.getByTestId("user").textContent).toBe("guest");
  });

  it("removes token and user from localStorage on logout", async () => {
    const mockUser = { id: "1", email: "a@b.com", displayName: "Alice", role: "player" as const };
    localStorage.setItem("mp_token", "tok");
    localStorage.setItem("mp_user", JSON.stringify(mockUser));

    wrap(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Alice"));

    await act(async () => { screen.getByText("logout").click(); });
    expect(localStorage.getItem("mp_token")).toBeNull();
    expect(localStorage.getItem("mp_user")).toBeNull();
  });
});

// ─── useAuth hook guard ───────────────────────────────────────────────────────

describe("useAuth", () => {
  it("throws an error when used outside of AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider");
    spy.mockRestore();
  });
});
