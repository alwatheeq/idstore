export function workshopToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function followupDueState(due: string | null, today: string) {
  return !due ? "undated" : due < today ? "overdue" : due === today ? "today" : "upcoming";
}
export function sortFollowups<T extends { id: string; due_date: string | null }>(items: T[]) {
  return [...items].sort((a,b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") || a.id.localeCompare(b.id));
}
