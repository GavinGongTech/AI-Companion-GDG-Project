import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { Login } from "./Login";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";
import * as firebaseAuth from "firebase/auth";

// Mock firebase
vi.mock("../lib/firebase", () => ({
  auth: {
    currentUser: null,
  },
  hasFirebaseConfig: true,
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  trackClientEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("../lib/extensionBridge", () => ({
  getExtensionIdFromSearch: vi.fn(() => null),
  sendAuthToExtension: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Login Page", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText(/Welcome back/i)).toBeDefined();
  });

  it("handles email/password submission", async () => {
    (firebaseAuth.signInWithEmailAndPassword as any).mockResolvedValue({ user: { uid: "123" } });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/you@university.edu/i);
    const passInput = screen.getByPlaceholderText(/••••••••/);
    const submitBtn = screen.getByRole("button", { name: "Continue" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passInput, { target: { value: "password" } });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalled();
      expect(screen.getByText(/Dashboard Page/i)).toBeDefined();
    });
  });

  it("handles google sign in", async () => {
    (firebaseAuth.signInWithPopup as any).mockResolvedValue({ user: { uid: "123" } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const googleBtn = screen.getByText(/Continue with Google/i);
    await act(async () => {
      fireEvent.click(googleBtn);
    });

    await waitFor(() => {
      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
    });
  });

  it("shows error on failure", async () => {
    (firebaseAuth.signInWithEmailAndPassword as any).mockRejectedValue(new Error("Login failed"));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole("button", { name: "Continue" });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Login failed/i)).toBeDefined();
    });
  });
});
