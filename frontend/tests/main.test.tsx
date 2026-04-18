/**
 * Tests for frontend/src/main.tsx
 *
 * The entry module runs on import (createRoot + render). Tests use dynamic import
 * after mocks, with vi.resetModules() so the bootstrap can run more than once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";

const renderSpy = vi.fn();
const createRootSpy = vi.fn(() => ({ render: renderSpy }));

vi.mock("../src/index.css", () => ({}));

vi.mock("../src/App", () => ({
  default: function AppStub() {
    return null;
  },
}));

vi.mock("react-dom/client", () => ({
  createRoot: (...args: unknown[]) => createRootSpy(...args),
}));

async function importMain() {
  await import("../src/main.tsx");
}

describe("main.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    createRootSpy.mockClear();
    renderSpy.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls createRoot with #root and renders StrictMode around App", async () => {
    await importMain();

    const rootEl = document.getElementById("root");
    expect(createRootSpy).toHaveBeenCalledTimes(1);
    expect(createRootSpy).toHaveBeenCalledWith(rootEl);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const element = renderSpy.mock.calls[0][0];
    expect(element.type).toBe(StrictMode);
    expect(element.props.children.type.name).toBe("AppStub");
  });
});
