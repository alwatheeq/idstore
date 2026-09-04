import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !supabaseUrl || !publishableKey || !serviceRoleKey) {
    return response(401, { error: "Authentication is required." });
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return response(401, { error: "Authentication is required." });

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return response(400, { error: "A valid JSON body is required." });
  }

  const organizationId = typeof input.organizationId === "string" ? input.organizationId : "";
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  const mobile = typeof input.mobile === "string" ? input.mobile : "";
  const pin = typeof input.pin === "string" ? input.pin : "";
  const role = input.role === "admin" ? "admin" : input.role === "staff" ? "staff" : null;
  const branchIds = stringArray(input.branchIds);
  const permissionCodes = stringArray(input.permissionCodes);
  const isTechnician = input.isTechnician === true;
  const employeeNo = typeof input.employeeNo === "string" ? input.employeeNo.trim() : "";
  const laborGrade = typeof input.laborGrade === "string" ? input.laborGrade.trim() : "";

  if (
    !organizationId || !displayName || !/^\+[1-9][0-9]{7,14}$/.test(mobile) ||
    !/^\d{6}$/.test(pin) || !role || !branchIds || !permissionCodes
  ) {
    return response(400, { error: "Name, valid mobile, six-digit PIN, role and access selections are required." });
  }
  if (role === "staff" && branchIds.length === 0) {
    return response(400, { error: "Staff must be assigned to at least one branch." });
  }

  const { data: callerMembership } = await caller
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();
  if (!callerMembership) return response(403, { error: "Only administrators can add staff accounts." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authEmail = `${mobile.slice(1)}@mobile.idstore.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: pin,
    email_confirm: true,
    user_metadata: { display_name: displayName, mobile },
  });
  if (createError || !created.user) {
    return response(createError?.status === 422 ? 409 : 400, {
      error: createError?.status === 422 ? "This mobile number already has an account." : "The staff account could not be created.",
    });
  }

  const { data: membershipId, error: provisionError } = await caller.rpc("provision_staff_access", {
    p_organization_id: organizationId,
    p_user_id: created.user.id,
    p_display_name: displayName,
    p_mobile: mobile,
    p_role: role,
    p_branch_ids: role === "admin" ? [] : branchIds,
    p_permission_codes: role === "admin" ? [] : permissionCodes,
    p_is_technician: isTechnician,
    p_employee_no: employeeNo || null,
    p_labor_grade: laborGrade || null,
  });

  if (provisionError || !membershipId) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    if (cleanupError) console.error("staff_auth_cleanup_failed", { userId: created.user.id });
    return response(400, { error: "The selected branch or permission configuration is invalid." });
  }

  return response(201, { membershipId });
});
