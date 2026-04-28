import { describe, it, expect, vi } from "vitest";

// Mock firebase-admin/app
const { mockGetApps, mockInitializeApp } = vi.hoisted(() => ({
  mockGetApps: vi.fn(() => []),
  mockInitializeApp: vi.fn()
}));

vi.mock("firebase-admin/app", () => ({
  getApps: mockGetApps,
  initializeApp: mockInitializeApp,
  cert: vi.fn()
}));

// Mock firebase-admin/firestore
const { mockGetFirestore } = vi.hoisted(() => ({
  mockGetFirestore: vi.fn(() => ({ collection: vi.fn() }))
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { serverTimestamp: vi.fn() }
}));

// Mock firebase-admin/auth
const { mockGetAuth } = vi.hoisted(() => ({
  mockGetAuth: vi.fn(() => ({ verifyIdToken: vi.fn() }))
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: mockGetAuth
}));

import { db, auth } from "./firebase";

describe("Firebase Database Helper", () => {
  it("initializes firebase app and exports db/auth", () => {
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
    expect(mockInitializeApp).toHaveBeenCalled();
  });
});
