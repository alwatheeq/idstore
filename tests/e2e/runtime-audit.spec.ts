import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";

const nativeRequire = createRequire(path.resolve("package.json"));
function load(file: string, mocks: Record<string, unknown> = {}): Record<string, unknown> {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", source)((name: string): unknown => {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(path.resolve(name.slice(2) + ".ts"), mocks);
    return nativeRequire(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

function loginFixture({ member = true, active = true, failure = false } = {}) {
  let signedOut = false;
  const query = (table: string) => {
    const builder = { select: () => builder, eq: () => builder, limit: () => builder,
      maybeSingle: async () => ({ data: table === "memberships" ? (member ? { id: "member" } : null) : (active ? { user_id: "user" } : null), error: failure ? { message: "offline" } : null }) };
    return builder;
  };
  const client = { auth: { signInWithPassword: async () => ({ data: { user: { id: "user" } }, error: null }), signOut: async () => { signedOut = true; } }, from: query, rpc: async () => ({ data: [{ customer_id: "customer" }], error: null }) };
  const signIn = load("app/(auth)/login/actions.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
    "next/navigation": { redirect(url: string) { throw new Error(`REDIRECT:${url}`); } },
  }).signIn as (state: {error:null}, data: FormData) => Promise<unknown>;
  return { signIn, signedOut: () => signedOut };
}
function credentials(next = "") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ dialCode: "+962", mobile: "790000000", pin: "123456", next })) form.set(key, value);
  return form;
}

test("portal login redirects instead of catching its successful redirect", async () => {
  const fixture = loginFixture({ member: false });
  await expect(fixture.signIn({error:null}, credentials())).rejects.toThrow("REDIRECT:/portal");
});
test("staff login preserves record context and rejects external return destinations", async () => {
  const fixture = loginFixture();
  await expect(fixture.signIn({error:null}, credentials("/inspections?inspection=test&tab=record#inspection-workspace"))).rejects.toThrow("REDIRECT:/inspections?inspection=test&tab=record#inspection-workspace");
  for (const url of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/login", "/auth/signout", "/does-not-exist"]) {
    await expect(fixture.signIn({error:null}, credentials(url))).rejects.toThrow("REDIRECT:/work-orders");
  }
});
test("inactive profiles cannot complete staff login", async () => {
  const fixture = loginFixture({ active: false });
  expect(await fixture.signIn({error:null}, credentials())).toEqual({error:"This account is not active. Contact an administrator."});
  expect(fixture.signedOut()).toBe(true);
});
test("appointment date conversion rejects impossible dates and DST gaps", () => {
  const convert = load("lib/actions/form.ts").zonedLocalToIso as (value: string, zone: string) => string;
  expect(convert("2026-09-08T10:30", "Asia/Amman")).toBe("2026-09-08T07:30:00.000Z");
  for (const value of ["2026-02-30T12:00", "2026-13-01T12:00", "2026-09-08T25:00", "2026-09-08T12:60"]) {
    expect(() => convert(value, "Asia/Amman")).toThrow();
  }
  expect(() => convert("2026-03-08T02:30", "America/New_York")).toThrow();
  expect(() => convert("2026-11-01T01:30", "America/New_York")).toThrow();
});

test("retrying the same payment submission retains its idempotency key", async () => {
  const calls: Record<string, unknown>[] = [];
  const receive = load("app/(app)/invoices/actions.ts", {
    "@/lib/auth/session": { getCurrentStaff: async () => ({organizationId:"org"}) },
    "@/lib/supabase/server": { createClient: async () => ({rpc: async (_name: string, args: Record<string, unknown>) => { calls.push(args); return {error:null}; }}) },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url: string) { throw new Error(url); } },
  }).receivePayment as (form: FormData) => Promise<unknown>;
  const form = new FormData();
  for (const [key,value] of Object.entries({invoiceId:"invoice",amount:"10",method:"cash",idempotencyKey:"b93402b9-fd78-4c11-991a-59d689874fcf"})) form.set(key,value);
  await expect(receive(form)).rejects.toThrow("created=");
  await expect(receive(form)).rejects.toThrow("created=");
  expect(calls[0].p_idempotency_key).toBe(calls[1].p_idempotency_key);
  form.delete("idempotencyKey");
  await expect(receive(form)).rejects.toThrow("error=");
  expect(calls).toHaveLength(2);
});

test("portal appointments use the authorized branch timezone and reject unavailable branches", async () => {
  const calls: Record<string, unknown>[] = [];
  const submit = load("app/portal/actions.ts", {
    "@/lib/supabase/server": { createClient: async () => ({rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "portal_service_options") return {data:{branches:[{id:"amman",timezone:"Asia/Amman"}]},error:null};
      calls.push(args); return {error:null};
    }}) },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url: string) { throw new Error(url); } },
  }).requestAppointment as (form: FormData) => Promise<unknown>;
  const form = new FormData();
  for (const [key,value] of Object.entries({branchId:"amman",vehicleId:"vehicle",preferredFrom:"2026-10-01T10:00",preferredTo:"2026-10-01T11:00",durationMinutes:"60",serviceMode:"workshop",transportMode:"customer_dropoff"})) form.set(key,value);
  await expect(submit(form)).rejects.toThrow("created=");
  expect(calls[0]).toMatchObject({p_preferred_from:"2026-10-01T07:00:00.000Z",p_preferred_to:"2026-10-01T08:00:00.000Z"});
  form.set("branchId","unavailable");
  await expect(submit(form)).rejects.toThrow("error=");
  expect(calls).toHaveLength(1);
});

test("public routes avoid Auth calls; expired sessions preserve context and cleared cookies", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test";
  let authCalls = 0;
  const update = load("lib/supabase/proxy.ts", {
    "@supabase/ssr": {createServerClient: (_url: string, _key: string, options: {cookies:{setAll:(items:unknown[])=>void}}) => ({auth:{getClaims:async()=>{
      authCalls++;
      options.cookies.setAll([{name:"expired-session",value:"",options:{maxAge:0,path:"/"}}]);
      throw new Error("Auth unavailable");
    }}})},
  }).updateSession as (request: NextRequest) => Promise<Response>;
  try {
    for (const route of ["/login","/auth/signout","/api/health","/api/readiness"]) {
      expect((await update(new NextRequest(`http://localhost${route}`))).status).toBe(200);
    }
    expect(authCalls).toBe(0);
    const response = await update(new NextRequest("http://localhost/inspections?inspection=record&tab=results"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/inspections?inspection=record&tab=results");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(authCalls).toBe(1);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test("navigation and literal internal links resolve to implemented routes", () => {
  const routes = new Set<string>();
  const files: string[] = [];
  function scan(dir: string) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir,entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.tsx?$/.test(file)) files.push(file);
      if (entry.isFile() && /^(page|route)\.tsx?$/.test(entry.name)) {
        routes.add("/" + path.dirname(file).replace(/^app\/?/,"").split("/").filter(segment=>segment && !segment.startsWith("(")).join("/"));
      }
    }
  }
  scan("app"); scan("components");
  const failures: string[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file,"utf8");
    for (const match of source.matchAll(/href=["'](\/[^"']*)["']/g)) {
      const route = match[1].split(/[?#]/)[0];
      if (!routes.has(route)) failures.push(`${file}: ${route}`);
    }
  }
  const groups = load("lib/navigation.ts").navigationGroups as Array<{items:Array<{href:string}>}>;
  for (const item of groups.flatMap(group=>group.items)) if (!routes.has(item.href)) failures.push(`navigation: ${item.href}`);
  expect(failures).toEqual([]);
});
