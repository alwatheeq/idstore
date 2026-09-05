import { createClient } from "@/lib/supabase/server";

type DocumentRow = {
  type: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid?: number;
  hash: string | null;
  issued_at: string | null;
  customer: string;
  lines: Array<{ description: string; quantity: number; unit_price: number; tax: number; total: number }>;
};

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!['invoice', 'estimate'].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Document not found.", { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_document", { p_document_type: kind, p_document_id: id });
  if (error || !data) return new Response("Document not found or access denied.", { status: 404 });
  const document = data as unknown as DocumentRow;
  const rows = [
    ["Document", document.number], ["Type", document.type], ["Customer", document.customer], ["Status", document.status], ["Issued", document.issued_at ?? ""],
    [], ["Description", "Quantity", "Unit price", "Tax", "Total"],
    ...document.lines.map((line) => [line.description, line.quantity, line.unit_price, line.tax, line.total]),
    [], ["Subtotal", document.subtotal], ["Discount", document.discount], ["Tax", document.tax], ["Total", document.total], ["Paid", document.paid ?? ""], ["Currency", document.currency], ["Document hash", document.hash ?? ""],
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = `${document.type}-${document.number || id}.csv`.replace(/[^a-z0-9_.-]/gi, "-");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
