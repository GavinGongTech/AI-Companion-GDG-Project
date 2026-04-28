import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firebase-admin/app to prevent initFirebaseAdmin() from running ────
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => [{ name: "mock" }]),
}));

// ── Mock firebase-admin/auth (db/firebase.js calls getAuth() at module level)
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "uid-1", email: "test@example.com" }),
  })),
}));

// ── Build reusable Firestore mock stubs ────────────────────────────────────
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();

// smgRef mock: get/set/update on the concept document
const mockSmgDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
};

// Gamification stats doc ref — needs .set() that returns a thenable
const mockGamStatsRef = {
  set: vi.fn().mockResolvedValue(undefined),
};

// Tracks the last smg doc id requested so we can assert collection paths
let _lastSmgDocId = null;
let _lastSmgCollectionPath = null;

const mockSmgCollection = vi.fn(() => ({
  doc: vi.fn((id) => {
    _lastSmgDocId = id;
    return mockSmgDocRef;
  }),
  where: vi.fn(() => ({
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: mockGet,
      })),
    })),
    limit: vi.fn(() => ({
      get: mockGet,
    })),
    get: mockGet,
  })),
  orderBy: vi.fn(() => ({
    limit: vi.fn(() => ({
      get: mockGet,
    })),
  })),
  get: mockGet,
}));

const mockGamificationCollection = vi.fn(() => ({
  doc: vi.fn(() => mockGamStatsRef),
}));

// users/{uid} document — provides .collection() routing
const mockUserDoc = vi.fn(() => ({
  collection: vi.fn((name) => {
    _lastSmgCollectionPath = name;
    if (name === "smg") return mockSmgCollection();
    if (name === "gamification") return mockGamificationCollection();
    return { doc: vi.fn(() => ({ get: mockGet, set: mockSet })) };
  }),
}));

const mockDb = {
  collection: vi.fn((name) => ({
    doc: name === "users" ? mockUserDoc : vi.fn(() => ({ get: mockGet })),
  })),
};

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => "MOCK_TS"),
    vector: vi.fn((v) => v),
    increment: vi.fn((n) => ({ _increment: n })),
  },
}));

// ── Import the module under test AFTER mocks are established ──────────────
const { sm2, toQuality, recordInteraction, getWeakestConcepts, getDrillQueue } =
  await import("./misconception");

// ── Helpers ────────────────────────────────────────────────────────────────
function makeSmgDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      accuracyRate: 0.5,
      correctCount: 5,
      incorrectCount: 5,
      interactionCount: 10,
      easeFactor: 2.5,
      reviewIntervalDays: 6,
      errorTypeMap: {},
      lastErrorAt: null,
      courseId: null,
      ...overrides,
    }),
  };
}

// ── Pure function tests: sm2() ─────────────────────────────────────────────
describe("sm2()", () => {
  it("resets interval to 1 when quality < 3 (incorrect)", () => {
    const { interval, easeFactor } = sm2(6, 2.5, 2);
    expect(interval).toBe(1);
    // easeFactor drops below 2.5 but must not go below 1.3
    expect(easeFactor).toBeLessThan(2.5);
    expect(easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("returns interval=1 for first correct attempt (prevInterval=0)", () => {
    const { interval } = sm2(0, 2.5, 4);
    expect(interval).toBe(1);
  });

  it("returns interval=6 for second correct attempt (prevInterval=1)", () => {
    const { interval } = sm2(1, 2.5, 4);
    expect(interval).toBe(6);
  });

  it("multiplies interval by easeFactor on subsequent correct attempts", () => {
    const { interval } = sm2(6, 2.5, 4);
    // quality=4: new easeFactor = 2.5 + (0.1 - 1*(0.08+1*0.02)) = 2.5 + (0.1 - 0.10) = 2.5
    expect(interval).toBe(Math.round(6 * 2.5));
  });

  it("floors easeFactor at 1.3 regardless of many failures", () => {
    // Many failures drive easeFactor down — never below 1.3
    let ef = 2.5;
    let iv = 1;
    for (let i = 0; i < 20; i++) {
      ({ interval: iv, easeFactor: ef } = sm2(iv, ef, 0));
    }
    expect(ef).toBe(1.3);
  });

  it("caps interval at 365 days", () => {
    const { interval } = sm2(300, 2.5, 5);
    expect(interval).toBeLessThanOrEqual(365);
  });

  it("increases easeFactor for a perfect answer (quality=5)", () => {
    const { easeFactor } = sm2(6, 2.5, 5);
    expect(easeFactor).toBeGreaterThan(2.5);
  });
});

// ── Pure function tests: toQuality() ──────────────────────────────────────
describe("toQuality()", () => {
  it("returns quality 0 when incorrect and classifier confidence > 0.8", () => {
    expect(toQuality(false, "conceptual_misunderstanding", 0.9)).toBe(0);
  });

  it("returns quality 1 when incorrect and confidence 0.5–0.8", () => {
    expect(toQuality(false, "knowledge_gap", 0.6)).toBe(1);
  });

  it("returns quality 2 when incorrect and confidence <= 0.5", () => {
    expect(toQuality(false, "knowledge_gap", 0.4)).toBe(2);
  });

  it("returns quality 5 when correct and errorType is 'none'", () => {
    expect(toQuality(true, "none", 0.95)).toBe(5);
  });

  it("returns quality 3 when correct with non-none error and high confidence", () => {
    expect(toQuality(true, "conceptual_misunderstanding", 0.8)).toBe(3);
  });

  it("returns quality 4 when correct with non-none error and lower confidence", () => {
    expect(toQuality(true, "knowledge_gap", 0.5)).toBe(4);
  });

  it("returns quality 3 for explain mode (isCorrect=undefined)", () => {
    expect(toQuality(undefined, "none", 0.9)).toBe(3);
  });
});

// ── recordInteraction() ────────────────────────────────────────────────────
describe("recordInteraction()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure gamStats.set always returns a thenable to survive .catch() calls
    mockGamStatsRef.set.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockSet.mockResolvedValue(undefined);
  });

  it("creates a new SMG document on the first correct interaction", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await recordInteraction("uid-1", "derivatives_chain_rule", {
      errorType: "none",
      confidence: 0.9,
      isCorrect: true,
    });

    expect(mockSet).toHaveBeenCalledTimes(1);
    const written = mockSet.mock.calls[0][0];
    expect(written.accuracyRate).toBe(1);
    expect(written.correctCount).toBe(1);
    expect(written.incorrectCount).toBe(0);
    expect(written.interactionCount).toBe(1);
    expect(written.errorTypeMap).toEqual({});
    expect(written.reviewIntervalDays).toBeGreaterThanOrEqual(1);
    expect(written.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("creates a new SMG document on the first incorrect interaction", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await recordInteraction("uid-1", "integrals_by_parts", {
      errorType: "knowledge_gap",
      confidence: 0.85,
      isCorrect: false,
    });

    expect(mockSet).toHaveBeenCalledTimes(1);
    const written = mockSet.mock.calls[0][0];
    expect(written.accuracyRate).toBe(0);
    expect(written.correctCount).toBe(0);
    expect(written.incorrectCount).toBe(1);
    expect(written.errorTypeMap).toEqual({ knowledge_gap: 1 });
    // Failed answer resets SM-2 interval to 1
    expect(written.reviewIntervalDays).toBe(1);
    expect(written.lastErrorAt).toBe("MOCK_TS");
  });

  it("updates accuracy upward when an existing concept gets a correct answer", async () => {
    // Existing doc: 5 correct out of 10 total (50% accuracy)
    mockGet.mockResolvedValueOnce(makeSmgDoc({
      correctCount: 5,
      incorrectCount: 5,
      interactionCount: 10,
      accuracyRate: 0.5,
    }));

    await recordInteraction("uid-1", "derivatives_chain_rule", {
      errorType: "none",
      confidence: 0.95,
      isCorrect: true,
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updated = mockUpdate.mock.calls[0][0];
    // 6 correct / 11 total ≈ 0.545
    expect(updated.correctCount).toBe(6);
    expect(updated.incorrectCount).toBe(5);
    expect(updated.accuracyRate).toBeCloseTo(6 / 11, 5);
    expect(updated.interactionCount).toBe(11);
  });

  it("drops accuracy when an existing concept gets an incorrect answer", async () => {
    mockGet.mockResolvedValueOnce(makeSmgDoc({
      correctCount: 8,
      incorrectCount: 2,
      interactionCount: 10,
      accuracyRate: 0.8,
      easeFactor: 2.5,
      reviewIntervalDays: 6,
    }));

    await recordInteraction("uid-1", "limits_epsilon_delta", {
      errorType: "conceptual_misunderstanding",
      confidence: 0.9,
      isCorrect: false,
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updated = mockUpdate.mock.calls[0][0];
    // 8 correct / 11 total ≈ 0.727
    expect(updated.correctCount).toBe(8);
    expect(updated.incorrectCount).toBe(3);
    expect(updated.accuracyRate).toBeCloseTo(8 / 11, 5);
    // SM-2 ease factor must decrease on incorrect
    expect(updated.easeFactor).toBeLessThan(2.5);
    // Interval resets to 1 on failure (quality < 3)
    expect(updated.reviewIntervalDays).toBe(1);
    expect(updated.lastErrorAt).toBe("MOCK_TS");
    // Error type tracked in the map
    expect(updated.errorTypeMap.conceptual_misunderstanding).toBe(1);
  });

  it("preserves existing errorTypeMap entries and increments new ones", async () => {
    mockGet.mockResolvedValueOnce(makeSmgDoc({
      errorTypeMap: { knowledge_gap: 3 },
    }));

    await recordInteraction("uid-1", "derivatives_chain_rule", {
      errorType: "knowledge_gap",
      confidence: 0.7,
      isCorrect: false,
    });

    const updated = mockUpdate.mock.calls[0][0];
    expect(updated.errorTypeMap.knowledge_gap).toBe(4);
  });

  it("does not increment errorTypeMap when errorType is 'none'", async () => {
    mockGet.mockResolvedValueOnce(makeSmgDoc({ errorTypeMap: {} }));

    await recordInteraction("uid-1", "derivatives_chain_rule", {
      errorType: "none",
      confidence: 1,
      isCorrect: true,
    });

    const updated = mockUpdate.mock.calls[0][0];
    expect(updated.errorTypeMap).toEqual({});
  });

  it("handles explain mode (isCorrect=undefined) on a new concept", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await recordInteraction("uid-1", "fourier_series", {
      errorType: "none",
      confidence: 0.8,
      isCorrect: undefined,
    });

    const written = mockSet.mock.calls[0][0];
    // No correct/incorrect counted for explain-mode
    expect(written.correctCount).toBe(0);
    expect(written.incorrectCount).toBe(0);
    // accuracyRate is 0 when isCorrect is undefined (no answer given)
    expect(written.accuracyRate).toBe(0);
  });

  it("applies courseId from params when persisting a new concept", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await recordInteraction("uid-1", "matrix_eigenvalues", {
      errorType: "none",
      confidence: 1,
      isCorrect: true,
      courseId: "linear-algebra-101",
    });

    const written = mockSet.mock.calls[0][0];
    expect(written.courseId).toBe("linear-algebra-101");
  });

  it("falls back to existing courseId in doc when none is passed", async () => {
    mockGet.mockResolvedValueOnce(makeSmgDoc({ courseId: "existing-course" }));

    await recordInteraction("uid-1", "derivatives_chain_rule", {
      errorType: "none",
      confidence: 1,
      isCorrect: true,
      courseId: undefined,
    });

    const updated = mockUpdate.mock.calls[0][0];
    expect(updated.courseId).toBe("existing-course");
  });
});

// ── getWeakestConcepts() ───────────────────────────────────────────────────
describe("getWeakestConcepts()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGamStatsRef.set.mockResolvedValue(undefined);
  });

  it("returns due-for-review concepts when nextReviewDate query is non-empty", async () => {
    const docA = { id: "derivatives_chain_rule", data: () => ({ accuracyRate: 0.3, interactionCount: 5 }) };
    const docB = { id: "integrals_by_parts", data: () => ({ accuracyRate: 0.6, interactionCount: 8 }) };

    // nextReviewDate query returns results
    mockGet.mockResolvedValueOnce({ empty: false, docs: [docA, docB] });

    const result = await getWeakestConcepts("uid-1", 10);

    expect(result).toHaveLength(2);
    expect(result[0].conceptNode).toBe("derivatives_chain_rule");
    expect(result[0].accuracyRate).toBe(0.3);
    expect(result[1].conceptNode).toBe("integrals_by_parts");
  });

  it("falls back to accuracyRate-ordered query when no concepts are due", async () => {
    const docA = { id: "limits_epsilon_delta", data: () => ({ accuracyRate: 0.2 }) };

    // Primary query empty → fallback fires
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Fallback query result
    mockGet.mockResolvedValueOnce({ empty: false, docs: [docA] });

    const result = await getWeakestConcepts("uid-1", 10);

    expect(result).toHaveLength(1);
    expect(result[0].conceptNode).toBe("limits_epsilon_delta");
    expect(result[0].accuracyRate).toBe(0.2);
  });

  it("returns empty array when both queries return no documents", async () => {
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockGet.mockResolvedValueOnce({ empty: false, docs: [] });

    const result = await getWeakestConcepts("uid-1", 10);
    expect(result).toHaveLength(0);
  });
});

// ── getDrillQueue() ────────────────────────────────────────────────────────
describe("getDrillQueue()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGamStatsRef.set.mockResolvedValue(undefined);
  });

  function makeDoc(id: string, { accuracyRate, daysOverdue }: { accuracyRate: number; daysOverdue: number }) {
    const reviewDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
    return {
      id,
      data: () => ({
        accuracyRate,
        interactionCount: 5,
        nextReviewDate: reviewDate, // plain Date — covers the `|| data.nextReviewDate` path
      }),
    };
  }

  it("returns concepts sorted by urgency descending", async () => {
    // high urgency: 5 days overdue, 0% accuracy → urgency = 5*2 + (1-0)*5 = 15
    // medium urgency: 2 days overdue, 0.5 accuracy → urgency = 2*2 + (1-0.5)*5 = 6.5
    // low urgency: 0 days overdue, 0.8 accuracy → urgency = 0 + (1-0.8)*5 = 1
    const highDoc = makeDoc("derivatives_chain_rule", { accuracyRate: 0, daysOverdue: 5 });
    const medDoc = makeDoc("integrals_by_parts", { accuracyRate: 0.5, daysOverdue: 2 });
    const lowDoc = makeDoc("limits_continuity", { accuracyRate: 0.8, daysOverdue: 0 });

    // getDrillQueue fetches all with one query (the lookahead where clause)
    mockGet.mockResolvedValueOnce({ docs: [medDoc, lowDoc, highDoc] });

    const result = await getDrillQueue("uid-1", 20);

    expect(result[0].conceptNode).toBe("derivatives_chain_rule");
    expect(result[1].conceptNode).toBe("integrals_by_parts");
    expect(result[2].conceptNode).toBe("limits_continuity");
  });

  it("computes urgency correctly using the documented formula", async () => {
    // overdueDays * 2 + (1 - accuracyRate) * 5
    const doc = makeDoc("matrix_eigenvalues", { accuracyRate: 0.4, daysOverdue: 3 });
    mockGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await getDrillQueue("uid-1", 20);

    // 3*2 + (1-0.4)*5 = 6 + 3 = 9
    expect(result[0].urgency).toBeCloseTo(9, 1);
  });

  it("respects the limit parameter and returns at most limit items", async () => {
    const docs = Array.from({ length: 15 }, (_, i) =>
      makeDoc(`concept_${i}`, { accuracyRate: 0.5, daysOverdue: i })
    );
    mockGet.mockResolvedValueOnce({ docs });

    const result = await getDrillQueue("uid-1", 5);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns empty array when no concepts are queued", async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    const result = await getDrillQueue("uid-1", 20);
    expect(result).toHaveLength(0);
  });

  it("handles Firestore Timestamp shape via .toDate() on nextReviewDate", async () => {
    const reviewDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const doc = {
      id: "derivatives_power_rule",
      data: () => ({
        accuracyRate: 0.6,
        interactionCount: 3,
        nextReviewDate: { toDate: () => reviewDate }, // Firestore Timestamp shape
      }),
    };
    mockGet.mockResolvedValueOnce({ docs: [doc] });

    const result = await getDrillQueue("uid-1", 20);

    expect(result).toHaveLength(1);
    expect(result[0].nextReviewDate).toBe(reviewDate);
    // 2 days overdue, 0.4 accuracy → urgency = 2*2 + (1-0.6)*5 = 4 + 2 = 6
    expect(result[0].urgency).toBeCloseTo(6, 1);
  });
});
