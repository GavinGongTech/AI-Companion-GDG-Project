import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEmbed, mockCollection } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
  mockCollection: vi.fn(),
}));

vi.mock("./embeddings", () => ({ embed: mockEmbed }));
vi.mock("../db/firebase", () => ({ db: { collection: mockCollection } }));

import { retrieveChunks, getCourseFileURIs } from "./rag";

/** A Firestore document snapshot, reduced to the one method this code calls. */
function doc(data: any) {
  return { data: () => data };
}

/**
 * Stand in for `db.collection("users").doc(uid).collection("courses")...`.
 *
 * The production code walks that chain differently depending on whether a
 * courseId was supplied, so the double has to be a real chain rather than a
 * flat mock: `courses` either gets a `.doc(id)` hung off it or is read whole.
 */
function firestore({ nearest, coursesDocs, filesDocs }: any) {
  const chunksCollection = {
    findNearest: vi.fn(() => ({ get: vi.fn(async () => ({ docs: nearest ?? [] })) })),
  };
  const courseDoc = {
    collection: vi.fn((name: string) => (name === "chunks" ? chunksCollection : { get: vi.fn(async () => ({ docs: filesDocs ?? [] })) })),
  };
  mockCollection.mockReturnValue({
    doc: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => courseDoc),
        get: vi.fn(async () => ({ docs: coursesDocs ?? [] })),
      })),
    })),
  });
  return { chunksCollection, courseDoc };
}

/** A course whose chunk collection yields the given chunk documents. */
function course(chunks: any[]) {
  return { ref: { collection: vi.fn(() => ({ get: vi.fn(async () => ({ docs: chunks })) })) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retrieveChunks with a course scoped", () => {
  it("asks Firestore for the nearest vectors and returns their content", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    const { chunksCollection } = firestore({ nearest: [doc({ content: "alpha" }), doc({ content: "beta" })] });

    await expect(retrieveChunks("u1", "c1", "what is alpha?")).resolves.toEqual(["alpha", "beta"]);
    expect(chunksCollection.findNearest).toHaveBeenCalledWith("embedding", [1, 0], {
      limit: 5,
      distanceMeasure: "COSINE",
    });
  });

  it("returns nothing when the question could not be embedded", async () => {
    mockEmbed.mockResolvedValue(null);
    firestore({});
    await expect(retrieveChunks("u1", "c1", "q")).resolves.toEqual([]);
    // Bailing before touching the database is the point: a null vector would
    // make findNearest throw rather than return an empty result.
    expect(mockCollection).not.toHaveBeenCalled();
  });
});

describe("retrieveChunks across every course", () => {
  it("ranks chunks from all courses by cosine similarity", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    firestore({
      coursesDocs: [
        course([doc({ content: "orthogonal", embedding: [0, 1] })]),
        course([doc({ content: "aligned", embedding: [1, 0] })]),
      ],
    });

    // Ranked, not merely collected: "aligned" is stored second and comes back
    // first because it points the same way as the query.
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toEqual(["aligned", "orthogonal"]);
  });

  it("unwraps a Firestore VectorValue via toArray", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    firestore({
      coursesDocs: [course([doc({ content: "wrapped", embedding: { toArray: () => [1, 0] } })])],
    });
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toEqual(["wrapped"]);
  });

  it("skips chunks missing an embedding or missing content", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    firestore({
      coursesDocs: [
        course([
          doc({ content: "no vector" }),
          doc({ embedding: [1, 0] }),
          doc({ content: "complete", embedding: [1, 0] }),
        ]),
      ],
    });
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toEqual(["complete"]);
  });

  it("scores a zero vector as zero instead of dividing by zero", async () => {
    mockEmbed.mockResolvedValue([0, 0]);
    firestore({ coursesDocs: [course([doc({ content: "only", embedding: [1, 0] })])] });
    // The chunk still comes back; what matters is that NaN never enters the
    // sort, which would leave the ordering up to the comparison's implementation.
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toEqual(["only"]);
  });

  it("returns at most the top five", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    const many = Array.from({ length: 8 }, (_, i) => doc({ content: `chunk-${i}`, embedding: [1, i / 100] }));
    firestore({ coursesDocs: [course(many)] });
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toHaveLength(5);
  });

  it("copes with a user who has no courses", async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    firestore({ coursesDocs: [] });
    await expect(retrieveChunks("u1", undefined, "q")).resolves.toEqual([]);
  });
});

describe("getCourseFileURIs", () => {
  it("returns the uploaded Gemini file URIs", async () => {
    firestore({
      filesDocs: [doc({ geminiFileUri: "files/abc" }), doc({ geminiFileUri: "files/def" })],
    });
    await expect(getCourseFileURIs("u1", "c1")).resolves.toEqual(["files/abc", "files/def"]);
  });

  it("drops local placeholders and files that were never uploaded", async () => {
    firestore({
      filesDocs: [
        doc({ geminiFileUri: "local://pending" }),
        doc({}),
        doc({ geminiFileUri: "" }),
        doc({ geminiFileUri: "files/real" }),
      ],
    });
    // A local:// URI is a file the ingest step never finished uploading.
    // Handing it to Gemini as context is a request that fails on the server.
    await expect(getCourseFileURIs("u1", "c1")).resolves.toEqual(["files/real"]);
  });
});
