import { renderServiceDocument, type ServiceDocument } from "@/lib/documents/service-document";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!["invoice", "estimate"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Document not found.", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_document", {
    p_document_type: kind,
    p_document_id: id,
  });
  if (error || !data) return new Response("Document not found or access denied.", { status: 404 });

  return new Response(renderServiceDocument(data as unknown as ServiceDocument), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": "inline",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
    },
  });
}
