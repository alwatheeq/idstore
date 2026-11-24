import { test, expect } from "@playwright/test";
import { readAll } from "../../lib/supabase/read-all";

test("record loading spans the API cap and retains every record", async () => {
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const pages: number[] = [];
  const result = await readAll({ order(key) {
    expect(key).toBe("id");
    return { async range(from, to) { pages.push(from); return { data: rows.slice(from, to + 1), error: null }; } };
  } });
  expect(result.data).toEqual(rows);
  expect(pages).toEqual([0, 500, 1000]);
});

test("a failed later page never produces a partial total", async () => {
  await expect(readAll({ order() { return { async range(from) {
    return from === 0 ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
      : { data: null, error: new Error("Connection lost") };
  } }; } })).rejects.toThrow("Connection lost");
});
