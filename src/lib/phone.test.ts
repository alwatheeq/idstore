import { describe, it, expect } from "vitest";
import { normalizePhone, phoneToEmail } from "@/lib/phone";

describe("normalizePhone", () => {
  it("strips spaces, dashes, parens and leading +", () => {
    expect(normalizePhone("+962 79-000 0000")).toBe("962790000000");
    expect(normalizePhone("(0790) 000-000")).toBe("0790000000");
  });
});

describe("phoneToEmail", () => {
  it("maps the same number to the same synthetic email regardless of formatting", () => {
    const a = phoneToEmail("+962 790000000");
    const b = phoneToEmail("962790000000");
    expect(a).toBe(b);
    expect(a).toBe("962790000000@portal.idstore.com");
  });
  it("throws on a number with no digits", () => {
    expect(() => phoneToEmail("   ")).toThrow();
  });
});
