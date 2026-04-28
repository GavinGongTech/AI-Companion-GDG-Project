import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { AuthContext } from "../lib/auth";
import * as api from "../lib/api";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// Mock API
vi.mock("../lib/api", () => ({
  fetchGraph: vi.fn(),
  fetchDrillQueue: vi.fn(),
  fetchRecentEvents: vi.fn(),
  fetchGamification: vi.fn(),
  ingestTextContent: vi.fn(),
  uploadIngestFile: vi.fn(),
}));

// Mock Cytoscape
vi.mock("cytoscape", () => ({
  default: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

const mockUser = { displayName: "Test User", uid: "123" };

describe("Dashboard Comprehensive", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    (api.fetchGraph as any).mockResolvedValue({ nodes: [] });
    (api.fetchDrillQueue as any).mockResolvedValue({ queue: [] });
    (api.fetchRecentEvents as any).mockResolvedValue({ events: [], count: 0 });
    (api.fetchGamification as any).mockResolvedValue({ xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [] });
  });

  it("shows loading state then data", async () => {
    (api.fetchGraph as any).mockResolvedValue({
      nodes: [{ conceptNode: "test_node", accuracyRate: 0.5, interactionCount: 10 }]
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockUser as any}>
          <Dashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading dashboard/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeDefined();
      expect(screen.getByText(/50%/i)).toBeDefined(); // Avg accuracy
    });
  });

  it("handles tab switching and text ingestion", async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockUser as any}>
          <Dashboard initialData={{ nodes: [], drill: [], events: [], gamification: { xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [] } }} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const textTab = screen.getByText(/Paste Text/i);
    fireEvent.click(textTab);

    const courseInput = screen.getByPlaceholderText(/Course name/i);
    fireEvent.change(courseInput, { target: { value: "Math 101" } });

    const textarea = screen.getByPlaceholderText(/Paste course notes/i);
    fireEvent.change(textarea, { target: { value: "Calculus is fun" } });

    const ingestBtn = screen.getByRole("button", { name: /^Ingest$/ });
    (api.ingestTextContent as any).mockResolvedValue({ ok: true });

    await act(async () => {
      fireEvent.click(ingestBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Ingested successfully/i)).toBeDefined();
    });
  });

  it("handles file ingestion errors", async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockUser as any}>
          <Dashboard initialData={{ nodes: [], drill: [], events: [], gamification: { xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [] } }} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const courseInput = screen.getByPlaceholderText(/Course name/i);
    fireEvent.change(courseInput, { target: { value: "Math 101" } });

    // File tab is default
    const fileEl = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileEl).toBeDefined();
    
    // Mock File
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.change(fileEl, { target: { files: [file] } });

    const ingestBtn = screen.getByRole("button", { name: /^Ingest$/ });
    (api.uploadIngestFile as any).mockRejectedValue(new Error("Upload failed"));

    await act(async () => {
      fireEvent.click(ingestBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeDefined();
    });
  });

  it("handles different bar colors and date formats", async () => {
    const initialData = {
      nodes: [
        { conceptNode: "low", accuracyRate: 0.1, interactionCount: 1 },
        { conceptNode: "med", accuracyRate: 0.5, interactionCount: 1 },
        { conceptNode: "high", accuracyRate: 0.9, interactionCount: 1 },
      ],
      drill: [
        { conceptNode: "low", accuracyRate: 0.1, urgency: 1 },
      ],
      events: [
        { eventId: "e1", eventType: "test", createdAt: new Date("2023-01-01T12:00:00Z") },
        { eventId: "e2", eventType: "test2", createdAt: { _seconds: 1672574400 } }, // Firestore style
      ],
      gamification: { xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 5, achievements: [] }
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockUser as any}>
          <Dashboard initialData={initialData as any} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText(/10%/i)).toBeDefined();
    expect(screen.getByText((content) => content.includes("5") && content.includes("🔥"))).toBeDefined();
    expect(screen.getByText(/Day Streak/i)).toBeDefined();
  });

  it("handles fetch errors and empty data gracefully", async () => {
    (api.fetchGraph as any).mockRejectedValue(new Error("fail"));
    (api.fetchDrillQueue as any).mockRejectedValue(new Error("fail"));
    (api.fetchRecentEvents as any).mockRejectedValue(new Error("fail"));
    (api.fetchGamification as any).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockUser as any}>
          <Dashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No concepts yet/i)).toBeDefined();
      expect(screen.getByText(/No items in drill queue/i)).toBeDefined();
      expect(screen.getByText(/No activity yet/i)).toBeDefined();
    });
  });
});
