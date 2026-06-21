import { describe, it, expect } from "vitest";
import { normalizeModel, findModel, resolveModelImage, DEFAULT_MODEL_KEY } from "./models";

describe("normalizeModel", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeModel("ID.4")).toBe("id4");
    expect(normalizeModel("id 4")).toBe("id4");
    expect(normalizeModel("ID4")).toBe("id4");
    expect(normalizeModel("ID. Buzz")).toBe("idbuzz");
    expect(normalizeModel(null)).toBe("");
  });
});

describe("findModel", () => {
  it("finds the catalog entry for a stored label", () => {
    expect(findModel("ID. Buzz")?.key).toBe("idbuzz");
    expect(findModel("ID.7")?.label).toBe("ID.7");
  });
  it("returns undefined for unknown models", () => {
    expect(findModel("e-Golf")).toBeUndefined();
  });
});

describe("resolveModelImage", () => {
  const map = { id4: "u/id4.png", [DEFAULT_MODEL_KEY]: "u/default.png" };

  it("returns the uploaded image for a matching model (variant-insensitive)", () => {
    expect(resolveModelImage("ID.4", map)).toBe("u/id4.png");
    expect(resolveModelImage("id 4", map)).toBe("u/id4.png");
  });

  it("falls back to the default slot for unmatched models", () => {
    expect(resolveModelImage("ID.7", map)).toBe("u/default.png");
    expect(resolveModelImage(null, map)).toBe("u/default.png");
  });

  it("returns null when nothing is uploaded (caller shows a placeholder)", () => {
    expect(resolveModelImage("ID.4", {})).toBeNull();
    expect(resolveModelImage("ID.7", { id4: "u/id4.png" })).toBeNull();
  });
});
