import { describe, expect, it } from "vitest";
import {
  analyzeRequestSchema,
  analyzeResponseSchema,
  clientEnvironmentSchema,
  graphResponseSchema,
} from "../src/index";

describe("shared contract schemas", () => {
  it("accepts a valid analyze request", () => {
    const result = analyzeRequestSchema.parse({
      content: "Explain the chain rule",
      courseId: "calc-1",
    });

    expect(result.content).toBe("Explain the chain rule");
  });

  it("rejects an empty analyze request", () => {
    expect(() => analyzeRequestSchema.parse({})).toThrow();
  });

  it("validates analyze responses shared by server and clients", () => {
    const result = analyzeResponseSchema.parse({
      question: "Explain derivatives basics",
      solution: "Use the limit definition.",
      mainConcept: "derivatives",
      relevantLecture: "Lecture 3",
      keyFormulas: ["f'(x) = lim h->0 (f(x+h)-f(x))/h"],
      personalizedCallout: "",
      classifierTag: {
        conceptNode: "derivatives_limit_definition",
        errorType: "knowledge_gap",
        confidence: 0.7,
      },
      eventId: "evt_123",
    });

    expect(result.classifierTag.conceptNode).toBe("derivatives_limit_definition");
  });

  it("validates graph payloads", () => {
    const result = graphResponseSchema.parse({
      nodes: [
        {
          conceptNode: "derivatives_chain_rule",
          accuracyRate: 0.5,
          interactionCount: 6,
        },
      ],
    });

    expect(result.nodes).toHaveLength(1);
  });

  it("parses client env values with defaults", () => {
    const environment = clientEnvironmentSchema.parse({
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_AUTH_DOMAIN: "",
      VITE_FIREBASE_PROJECT_ID: "",
    });

    expect(environment.VITE_API_URL).toBe("http://localhost:3000");
  });
});
