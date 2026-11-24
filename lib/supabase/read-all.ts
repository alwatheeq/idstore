/** Page through PostgREST's row cap; never treat a failed page as an empty result.
 * The caller's filters are retained and a unique tie-breaker stabilizes ordering.
 */
export async function readAll<T>(query: {
  order(column: string): { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }> };
}, key = "id"): Promise<{ data: T[]; error: null }> {
  const rows: T[] = [];
  const ordered = query.order(key);
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await ordered.range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Records could not be loaded.");
    rows.push(...result.data);
    if (result.data.length < pageSize) return { data: rows, error: null };
  }
}
