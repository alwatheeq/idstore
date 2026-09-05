export const dynamic = "force-dynamic";

function hasValidSupabaseConfiguration() {
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!endpoint || !publishableKey) return false;

  try {
    const url = new URL(endpoint);
    return (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") && publishableKey.length >= 20;
  } catch {
    return false;
  }
}

export function GET() {
  const ready = hasValidSupabaseConfiguration();

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      checks: { supabaseConfiguration: ready },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
