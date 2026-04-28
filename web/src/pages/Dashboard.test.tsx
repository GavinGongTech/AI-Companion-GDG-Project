import { renderToStaticMarkup } from "react-dom/server";
import type { User } from "firebase/auth";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { AuthContext } from "../lib/auth";
import Dashboard, { type DashboardInitialData } from "./Dashboard";

const mockUser = {
  displayName: "Ada Lovelace",
} as User;

const initialData: DashboardInitialData = {
  nodes: [
    {
      conceptNode: "chain_rule",
      accuracyRate: 0.42,
      interactionCount: 6,
    },
    {
      conceptNode: "product_rule",
      accuracyRate: 0.88,
      interactionCount: 3,
    },
  ],
  drill: [
    {
      conceptNode: "chain_rule",
      accuracyRate: 0.42,
      urgency: 4,
    },
  ],
  events: [
    {
      eventId: "evt-1",
      eventType: "auth_login",
      content: "Dashboard access",
    },
  ],
  gamification: { xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [] },
};

describe("Dashboard authenticated flow", () => {
  it("renders the dashboard shell and core sections for an authenticated user", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthContext.Provider value={mockUser}>
          <Routes>
            <Route element={<Layout />}>
              <Route
                path="/dashboard"
                element={<Dashboard initialData={initialData} />}
              />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(markup).toContain("Study Flow");
    expect(markup).toContain("Dashboard — Ada Lovelace");
    expect(markup).toContain("Sign out");
    expect(markup).toContain("Ingest Materials");
    expect(markup).toContain("Concept Network");
    expect(markup).toContain("Drill Queue");
    expect(markup).toContain("Recent Activity");
    expect(markup).toContain("Built for students");
  });
});
