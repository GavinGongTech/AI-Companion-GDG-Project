import { describe, it, expect, vi, beforeEach } from "vitest";
import { sm2, toQuality, recordInteraction, getWeakestConcepts, getGraph, getDrillQueue } from "./misconception";

const { mockDb, mockFieldValue } = vi.hoisted(() => {
  const mock = {
    collection: vi.fn(),
    doc: vi.fn(),
    where: vi.fn(),
    get: vi.fn(),
    set: vi.fn().mockReturnValue({ catch: vi.fn() }),
    update: vi.fn().mockResolvedValue(true),
    orderBy: vi.fn(),
    limit: vi.fn(),
    runTransaction: vi.fn().mockReturnValue({ catch: vi.fn() }),
  };

  mock.collection.mockReturnValue(mock);
  mock.doc.mockReturnValue(mock);
  mock.where.mockReturnValue(mock);
  mock.orderBy.mockReturnValue(mock);
  mock.limit.mockReturnValue(mock);

  return {
    mockDb: mock,
    mockFieldValue: {
      serverTimestamp: vi.fn(() => "mock-ts"),
      increment: vi.fn((n) => ({ type: "increment", value: n })),
    },
  };
});

vi.mock("../db/firebase", () => ({ db: mockDb }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: mockFieldValue }));

describe("misconception service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue({ catch: vi.fn() });
    mockDb.runTransaction.mockReturnValue({ catch: vi.fn() });
  });

  describe("sm2", () => {
    it("handles all branches", () => {
      expect(sm2(0, 2.5, 4).interval).toBe(1);
      expect(sm2(1, 2.5, 4).interval).toBe(6);
      expect(sm2(6, 2.5, 4).interval).toBe(15);
      expect(sm2(30, 2.5, 0).interval).toBe(1);
      expect(sm2(365, 2.5, 5).interval).toBe(365);
    });
  });

  describe("toQuality", () => {
    it("handles confidence thresholds and default", () => {
      expect(toQuality(false, "err", 0.9)).toBe(0);
      expect(toQuality(false, "err", 0.6)).toBe(1);
      expect(toQuality(false, "err", 0.3)).toBe(2);
      expect(toQuality(true, "err", 0.8)).toBe(3);
      expect(toQuality(true, "err", 0.5)).toBe(4);
      expect(toQuality(true, "none", 0.5)).toBe(5);
      expect(toQuality(undefined, "none", 0.5)).toBe(3);
    });
  });

  describe("recordInteraction", () => {
    it("updates maxAccuracy when higher than current", async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ interactionCount: 0, correctCount: 0 }),
      });
      mockDb.runTransaction.mockImplementation(async (cb) => {
        const mockTxn = {
          get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ maxAccuracy: 0.1 }) }),
          set: vi.fn(),
        };
        await cb(mockTxn);
        expect(mockTxn.set).toHaveBeenCalled();
        return { catch: vi.fn() };
      });

      await recordInteraction("uid1", "node1", { errorType: "none", confidence: 0.9, isCorrect: true });
    });

    it("does not update maxAccuracy when lower than current", async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ interactionCount: 0, correctCount: 0 }),
      });
      mockDb.runTransaction.mockImplementation(async (cb) => {
        const mockTxn = {
          get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ maxAccuracy: 0.95 }) }),
          set: vi.fn(),
        };
        await cb(mockTxn);
        expect(mockTxn.set).not.toHaveBeenCalled();
        return { catch: vi.fn() };
      });

      await recordInteraction("uid1", "node1", { errorType: "none", confidence: 0.9, isCorrect: true });
    });

    it("handles existing concept with courseId fallback", async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ interactionCount: 1, correctCount: 1, reviewIntervalDays: 1, easeFactor: 2.5, courseId: "c1" }),
      });
      await recordInteraction("uid1", "node1", { errorType: "conceptual_misunderstanding", confidence: 0.9, isCorrect: false });
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({ courseId: "c1" }));
    });

    it("syncs maxAccuracy and handles transaction errors", async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ interactionCount: 0, correctCount: 0 }),
      });
      mockDb.runTransaction.mockImplementation(async (cb) => {
        try {
          await cb({
            get: vi.fn().mockRejectedValue(new Error("txn fail")),
            set: vi.fn(),
          });
        } catch (e) {
          return { catch: (fn: any) => fn(e) };
        }
        return { catch: vi.fn() };
      });

      await recordInteraction("uid1", "node1", { errorType: "none", confidence: 0.9, isCorrect: true });
      expect(mockDb.runTransaction).toHaveBeenCalled();
    });

    it("handles new concept with firstAccuracy and handles catch", async () => {
      mockDb.get.mockResolvedValue({ exists: false });
      const catchCb = vi.fn();
      mockDb.set.mockReturnValue({ catch: (fn: any) => { fn(new Error('fail')); return { catch: catchCb }; } });

      await recordInteraction("uid1", "node1", { errorType: "gap", confidence: 0.8, isCorrect: true });
    });
  });

  describe("getWeakestConcepts", () => {
    it("returns concepts and handles empty snap", async () => {
      mockDb.get.mockResolvedValueOnce({ empty: true });
      mockDb.get.mockResolvedValueOnce({ docs: [] });
      const res = await getWeakestConcepts("u1");
      expect(res).toEqual([]);
    });
  });

  describe("getGraph", () => {
    it("returns docs", async () => {
      mockDb.get.mockResolvedValue({ docs: [{ id: "n1", data: () => ({}) }] });
      const res = await getGraph("u1");
      expect(res[0].conceptNode).toBe("n1");
    });
  });

  describe("getDrillQueue", () => {
    it("sorts by urgency and handles toDate", async () => {
      const now = new Date();
      mockDb.get.mockResolvedValue({
        docs: [
          { id: "node1", data: () => ({ nextReviewDate: { toDate: () => new Date(now.getTime() - 100000) }, accuracyRate: 0.5 }) },
          { id: "node2", data: () => ({ nextReviewDate: new Date(now.getTime() - 1000), accuracyRate: 0.9 }) },
        ],
      });

      const result = await getDrillQueue("uid1");
      expect(result.length).toBe(2);
      expect(result[0].conceptNode).toBe("node1");
    });
  });
});
