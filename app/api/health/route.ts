export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "idstore",
      version: process.env.DEPLOYMENT_VERSION ?? "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
