import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Home } from "./Home";
import { MemoryRouter } from "react-router-dom";
import React from "react";

describe("Home Page", () => {
  it("renders correctly", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Study Flow/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Get the extension/i)).toBeDefined();
    expect(screen.getByText(/How Study Flow compares/i)).toBeDefined();
  });
});
