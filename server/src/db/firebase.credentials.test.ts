import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetApps, mockInitializeApp, mockCert, mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockGetApps: vi.fn(() => [] as unknown[]),
  mockInitializeApp: vi.fn(),
  mockCert: vi.fn((json: any) => ({ credentialFor: json.client_email })),
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => ""),
}));

vi.mock("node:fs", () => ({ existsSync: mockExistsSync, readFileSync: mockReadFileSync }));
vi.mock("firebase-admin/app", () => ({
  getApps: mockGetApps,
  initializeApp: mockInitializeApp,
  cert: mockCert,
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: vi.fn(() => ({})) }));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({})) }));
// The real module reads a .env off disk, which would make the outcome of these
// tests depend on whoever's machine they run on.
vi.mock("dotenv/config", () => ({}));

const CREDENTIAL_VARS = [
  "GOOGLE_APPLICATION_CREDENTIALS",
  "FIREBASE_SERVICE_ACCOUNT_PATH",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_PROJECT_ID",
];

const saved: Record<string, string | undefined> = {};

/** A service account JSON with the two fields the loader insists on. */
const VALID_ACCOUNT = JSON.stringify({
  client_email: "svc@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----",
  project_id: "from-json",
});

/**
 * Import the module fresh.
 *
 * Everything interesting in `firebase.ts` runs once at import time, so each
 * case has to start from an unloaded module rather than calling a function.
 */
async function loadFirebase() {
  vi.resetModules();
  return import("./firebase");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApps.mockReturnValue([]);
  mockExistsSync.mockReturnValue(false);
  for (const key of CREDENTIAL_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of CREDENTIAL_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("credential discovery", () => {
  it("reads inline JSON out of GOOGLE_APPLICATION_CREDENTIALS", async () => {
    // The variable normally holds a path. Cloud Run and friends often paste the
    // whole document in instead, which is why a leading brace is treated as JSON.
    process.env.GOOGLE_APPLICATION_CREDENTIALS = VALID_ACCOUNT;
    await loadFirebase();
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credentialFor: "svc@example.iam.gserviceaccount.com" },
      projectId: "from-json",
    });
  });

  it("treats a non-brace GOOGLE_APPLICATION_CREDENTIALS as a file path", async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/abs/key.json";
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(VALID_ACCOUNT);
    await loadFirebase();
    expect(mockReadFileSync).toHaveBeenCalledWith("/abs/key.json", "utf8");
    expect(mockInitializeApp).toHaveBeenCalled();
  });

  it("resolves a relative credentials path against the working directory", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "secrets/key.json";
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(VALID_ACCOUNT);
    await loadFirebase();
    const [readPath] = mockReadFileSync.mock.calls[0] as unknown as [string];
    expect(readPath).toContain("secrets");
    expect(readPath).not.toBe("secrets/key.json");
  });

  it("lets a whitespace-only path shadow the inline JSON variable", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "   ";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = VALID_ACCOUNT;
    await loadFirebase();
    // Pinning current behaviour rather than endorsing it. A blank
    // FIREBASE_SERVICE_ACCOUNT_PATH is truthy, so the chain enters the file
    // branch, resolves the path to null, and returns null from there -- the
    // inline JSON below it is never reached, and startup lands on application
    // default credentials with no complaint. Worth a separate fix; changing it
    // here would be an unrelated behaviour change in a CI-repair PR.
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockInitializeApp).toHaveBeenCalledWith();
  });

  it("picks up serviceAccount.json sitting next to the module", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(VALID_ACCOUNT);
    await loadFirebase();
    const [readPath] = mockReadFileSync.mock.calls[0] as unknown as [string];
    expect(readPath).toContain("serviceAccount.json");
  });

  it("prefers the project id from the environment when the JSON omits one", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "a@b.c",
      private_key: "k",
    });
    process.env.FIREBASE_PROJECT_ID = "from-env";
    await loadFirebase();
    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "from-env" }),
    );
  });

  it("initialises with a bare project id when there are no credentials", async () => {
    process.env.FIREBASE_PROJECT_ID = "only-project";
    await loadFirebase();
    expect(mockInitializeApp).toHaveBeenCalledWith({ projectId: "only-project" });
  });

  it("falls back to application default credentials with nothing configured", async () => {
    await loadFirebase();
    expect(mockInitializeApp).toHaveBeenCalledWith();
  });

  it("does not initialise twice when an app already exists", async () => {
    mockGetApps.mockReturnValue([{ name: "[DEFAULT]" }]);
    await loadFirebase();
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });
});

describe("credential errors", () => {
  it("names the missing file rather than failing inside readFileSync", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "/abs/missing.json";
    mockExistsSync.mockReturnValue(false);
    await expect(loadFirebase()).rejects.toThrow(
      "Firebase credentials file not found: /abs/missing.json",
    );
  });

  it("reports where unparseable JSON came from", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{not json";
    // The source label is the whole point of the wrapper: three different
    // variables can supply this document, and the raw SyntaxError names none.
    await expect(loadFirebase()).rejects.toThrow(
      /Invalid Firebase service account JSON from FIREBASE_SERVICE_ACCOUNT_JSON/,
    );
  });

  it("rejects a JSON document that is missing private_key", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "a@b.c" });
    await expect(loadFirebase()).rejects.toThrow(/missing client_email or private_key/);
  });

  it("rejects a JSON document that is missing client_email", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ private_key: "k" });
    await expect(loadFirebase()).rejects.toThrow(/missing client_email or private_key/);
  });
});
