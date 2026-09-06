export type CheckRules = {
  groups?: string[]; baseline?: boolean; capability?: string; qualification?: string;
  procedure_ref?: string; unit?: string; criteria?: string; evidence_required?: boolean;
  year_from?: number; year_to?: number; market?: string; interval_km?: number;
  interval_months?: number; manufacturer_ref?: string;
};
export type CheckDefinition = {
  id: string; code: string; organization_id: string | null; vehicle_model_id: string | null;
  category: string; label_en: string; label_ar: string; rules: CheckRules;
  is_required: boolean; recommended?: boolean; reason?: string; eligible?: boolean;
};
export type CheckAttempt = {
  inspection_item_id: string | null;
  id: string; attempt: number; result: "pass" | "fail" | "inconclusive" | "not_applicable" | "exception";
  details: Record<string, string>; recorded_at: string; actor_name: string;
};
export type CheckTask = { id: string; definition_id: string; sequence: number; snapshot: CheckDefinition; attempts: CheckAttempt[] };
export type InspectionWorkspace = {
  inspection: { id: string; status: string; technician_id: string | null; checklist_generated_at: string | null; completed_at: string | null; review_note: string | null; assignment: Record<string, string | string[]> } | null;
  vehicle: { id: string; vin: string; model_year: number | null; registration_no: string | null; odometer_km: number | null; complaint: string; model: { name: string; market: string | null } | null } | null;
  technicians: { id: string; name: string }[]; catalog: CheckDefinition[]; tasks: CheckTask[];
  can_record: boolean; can_manage: boolean; can_review: boolean;
};
export type VehicleModelOption = { id: string; name: string; model_code: string; market: string | null };
export const problemGroups = ["general", "no_start", "charging", "range", "damage", "cooling", "brakes", "tyres", "steering", "climate", "visibility", "final"] as const;
export const checkCategories = ["identity", "hv_battery", "charging", "exterior", "tyres_brakes", "underbody", "cabin", "electronics", "road_test"] as const;
export function latestResult(task: CheckTask) { return task.attempts.at(-1); }
export function checklistProgress(tasks: CheckTask[]) {
  const outstanding = tasks.filter(task => !latestResult(task) || latestResult(task)?.result === "inconclusive");
  return { total: tasks.length, completed: tasks.length - outstanding.length, outstanding,
    failed: tasks.filter(task => latestResult(task)?.result === "fail") };
}
export function recommendedIds(checks: CheckDefinition[], existing: string[] = []) {
  return [...new Set(checks.filter(check => check.recommended && check.eligible && !existing.includes(check.id)).map(check => check.id))];
}
// Suggestions are editable by the advisor; they never generate or pass a task.
export function suggestedProblemGroups(complaint: string) {
  const groups = new Set<string>(["general"]);
  const signals: [string, RegExp][] = [
    ["charging", /charging|شحن/i], ["range", /range|battery|بطاري|مدى/i],
    ["no_start", /not start|no.start|لا تعمل|لا تبدأ|تعذر التشغيل/i], ["cooling", /overheat|coolant|حرارة|تبريد/i],
    ["brakes", /brak|فرامل/i], ["tyres", /tyre|tire|wheel|vibrat|إطار|إطارات|اهتزاز/i],
    ["steering", /steer|suspension|noise|توجيه|تعليق|ضوضاء/i], ["climate", /air.condition|heating|climate|تكييف|تدفئة/i],
    ["visibility", /light|visibility|accessor|مصابيح|رؤية|ملحقات/i], ["damage", /impact|damage|صدمة|أضرار/i],
  ];
  for (const [group, expression] of signals) if (expression.test(complaint)) groups.add(group);
  return [...groups];
}
