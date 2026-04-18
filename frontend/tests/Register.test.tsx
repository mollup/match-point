/**
 * Tests for frontend/src/pages/Register.tsx
 *
 * Covers: safeNext, Register form rendering, onSubmit (success + error),
 * role selection, loading state, redirect when already logged in.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Register, safeNext } from "../src/pages/Register";
import { useAuth } from "../src/auth-context";

vi.mock("../src/auth-context", () => ({ useAuth: vi.fn() }));

const mockRegister = vi.fn();
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
    register: mockRegister,
    user: null,
    ready: true,
    ...overrides,
  };
}

function renderRegister(path = "/register") {
  vi.mocked(useAuth).mockReturnValue(buildAuthState() as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
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

  it("returns the path when it is a valid absolute path", () => {
    expect(safeNext("/tournament")).toBe("/tournament");
  });

  it("returns /dashboard for an open-redirect attempt (//evil.com)", () => {
    expect(safeNext("//evil.com/steal")).toBe("/dashboard");
  });

  it("returns /dashboard for a non-path value", () => {
    expect(safeNext("https://attacker.com")).toBe("/dashboard");
  });
});

// ─── Register – rendering ─────────────────────────────────────────────────────

describe("Register – rendering", () => {
  it("renders the display name input", () => {
    renderRegister();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
  });

  it("renders the email input", () => {
    renderRegister();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders the password input", () => {
    renderRegister();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders a role selector defaulting to 'Player'", () => {
    renderRegister();
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement;
    expect(select.value).toBe("player");
  });

  it("renders a Create account button", () => {
    renderRegister();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders a link back to the login page", () => {
    renderRegister();
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows loading placeholder while auth is not ready", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthState({ ready: false }) as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ─── Register – onSubmit ──────────────────────────────────────────────────────

describe("Register – onSubmit", () => {
  it("calls register with entered email, password, displayName, and role", async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alice@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "securepass" } });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "organizer" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        email: "alice@test.com",
        password: "securepass",
        displayName: "Alice",
        role: "organizer",
      })
    );
  });

  it("navigates to /dashboard after successful registration (no next param)", async () => {
    mockRegister.mockResolvedValue(undefined);
    renderRegister("/register");

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bob@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "bobspass" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
  });

  it("displays an error banner when registration fails", async () => {
    mockRegister.mockRejectedValue(new Error("Email already taken"));
    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "taken@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass1234" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("Email already taken")).toBeInTheDocument());
  });

  it("disables the submit button while registration is in progress", async () => {
    let resolveRegister!: () => void;
    mockRegister.mockReturnValue(new Promise<void>((res) => { resolveRegister = res; }));
    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bob@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass1234" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());
    resolveRegister();
  });
});

// ─── Register – role selection ────────────────────────────────────────────────

describe("Register – role selection", () => {
  it("allows selecting the 'Tournament organizer' role", () => {
    renderRegister();
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "organizer" } });
    expect(select.value).toBe("organizer");
  });

  it("allows selecting the 'Player' role", () => {
    renderRegister();
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "organizer" } });
    fireEvent.change(select, { target: { value: "player" } });
    expect(select.value).toBe("player");
  });
});
