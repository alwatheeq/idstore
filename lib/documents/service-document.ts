export type ServiceDocument = {
  type: "invoice" | "estimate";
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid?: number;
  hash?: string | null;
  issued_at: string;
  expires_at?: string | null;
  repair_order?: string | null;
  seller?: Record<string, unknown>;
  buyer?: Record<string, unknown>;
  vehicle?: Record<string, unknown>;
  lines: Array<{
    line_no: number;
    line_type: string;
    description: string;
    approval_group?: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    tax: number;
    total: number;
  }>;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const text = (record: Record<string, unknown> | undefined, key: string) => escapeHtml(record?.[key]);
const money = (value: number, currency: string) => `${Number(value).toFixed(3)} ${escapeHtml(currency)}`;
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-JO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Amman",
}).format(new Date(value)) : "—";

export function renderServiceDocument(document: ServiceDocument) {
  const title = document.type === "invoice" ? "Tax invoice" : "Service estimate";
  const titleAr = document.type === "invoice" ? "فاتورة ضريبية" : "عرض أسعار خدمة";
  const seller = document.seller;
  const buyer = document.buyer;
  const vehicle = document.vehicle;
  const rows = document.lines.map((line) => `<tr>
    <td>${line.line_no}</td>
    <td><strong>${escapeHtml(line.description)}</strong><small>${escapeHtml(line.line_type.replaceAll("_", " "))}${line.approval_group ? ` · ${escapeHtml(line.approval_group)}` : ""}</small></td>
    <td class="num">${Number(line.quantity).toFixed(3)}</td>
    <td class="num">${money(line.unit_price, document.currency)}</td>
    <td class="num">${Number(line.tax_rate).toFixed(2)}%<small>${money(line.tax, document.currency)}</small></td>
    <td class="num">${money(line.total, document.currency)}</td>
  </tr>`).join("");
  const address = seller?.address && typeof seller.address === "object"
    ? Object.values(seller.address as Record<string, unknown>).filter(Boolean).map(escapeHtml).join(", ")
    : "";

  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.number)} · ${title}</title><style>
  :root{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#17201c;background:#f3f5f4}*{box-sizing:border-box}body{margin:0}.toolbar{display:flex;justify-content:flex-end;gap:8px;max-width:960px;margin:16px auto}.toolbar button{border:0;border-radius:8px;padding:10px 18px;background:#173f35;color:#fff;font-weight:700;cursor:pointer}.sheet{width:min(960px,calc(100% - 32px));margin:0 auto 32px;background:#fff;padding:42px;box-shadow:0 12px 40px #1d30251a}.header{display:flex;justify-content:space-between;gap:32px;border-bottom:3px solid #173f35;padding-bottom:24px}.brand h1{margin:0;font-size:30px}.brand .ar{font-size:22px;color:#537067}.doc{text-align:right}.doc strong{display:block;font-size:20px}.doc span,.meta span,small{display:block;color:#617069;margin-top:5px}.parties,.vehicle{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}.card{border:1px solid #dce4df;border-radius:10px;padding:16px}.card h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#537067;margin:0 0 10px}.card strong,.card span{display:block;margin-top:5px}.vehicle{grid-template-columns:repeat(4,1fr);background:#f5f8f6;border-radius:10px;padding:16px}.meta b{display:block;font-size:11px;text-transform:uppercase;color:#617069}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr;unicode-bidi:isolate}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#173f35;color:#fff;text-align:left;font-size:12px;padding:10px}td{padding:12px 10px;border-bottom:1px solid #dce4df;vertical-align:top}.num{text-align:right;white-space:nowrap}.totals{width:min(420px,100%);margin:24px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:8px 0}.totals .grand{border-top:2px solid #173f35;font-size:20px;font-weight:800}.hash{margin-top:30px;padding-top:16px;border-top:1px solid #dce4df;overflow-wrap:anywhere}.hash b{font-size:11px;text-transform:uppercase;color:#617069}.draft{color:#9f3b2f;font-weight:800}@page{size:A4;margin:12mm}@media(max-width:650px){.sheet{padding:20px}.header,.parties{grid-template-columns:1fr;display:grid}.doc{text-align:left}.vehicle{grid-template-columns:1fr 1fr}.table-wrap{overflow-x:auto}}@media print{body{background:#fff}.toolbar{display:none}.sheet{width:100%;margin:0;padding:0;box-shadow:none}thead{display:table-header-group}tr{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save PDF · طباعة</button></div><main class="sheet">
  <header class="header"><div class="brand"><h1>${title}</h1><div class="ar" dir="rtl">${titleAr}</div><span>${text(seller,"organization_name")}</span></div><div class="doc"><strong class="mono">${escapeHtml(document.number)}</strong><span class="${document.status === "draft" ? "draft" : ""}">${escapeHtml(document.status.toUpperCase())}</span><span>Issued / تاريخ الإصدار: ${date(document.issued_at)}</span>${document.expires_at ? `<span>Expires / صالح لغاية: ${date(document.expires_at)}</span>` : ""}</div></header>
  <section class="parties"><div class="card"><h2>Seller / البائع</h2><strong>${text(seller,"branch_name")}</strong><span>${text(seller,"city")}${address ? ` · ${address}` : ""}</span><span>Tax / الرقم الضريبي: <span class="mono">${text(seller,"branch_tax_registration") || text(seller,"organization_tax_number") || "—"}</span></span><span>${text(seller,"phone")} ${text(seller,"email")}</span></div><div class="card"><h2>Customer / العميل</h2><strong>${text(buyer,"customer_name")}</strong><span>${text(buyer,"customer_type")}</span><span>Tax / الرقم الضريبي: <span class="mono">${text(buyer,"customer_tax_number") || "—"}</span></span><span>${text(buyer,"mobile")} ${text(buyer,"email")}</span></div></section>
  <section class="vehicle"><div class="meta"><b>Repair order / أمر العمل</b><span class="mono">${escapeHtml(document.repair_order || "—")}</span></div><div class="meta"><b>Vehicle / المركبة</b><span>${text(vehicle,"model")} ${text(vehicle,"model_year")}</span></div><div class="meta"><b>Registration / رقم اللوحة</b><span class="mono">${text(vehicle,"registration_no") || "—"}</span></div><div class="meta"><b>VIN / رقم الهيكل</b><span class="mono">${text(vehicle,"vin") || "—"}</span></div></section>
  <div class="table-wrap"><table><thead><tr><th>#</th><th>Description / البيان</th><th class="num">Qty / الكمية</th><th class="num">Unit / الوحدة</th><th class="num">Tax / الضريبة</th><th class="num">Total / الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No lines / لا توجد بنود</td></tr>'}</tbody></table></div>
  <section class="totals"><div><span>Subtotal / المجموع</span><strong>${money(document.subtotal, document.currency)}</strong></div><div><span>Discount / الخصم</span><strong>− ${money(document.discount, document.currency)}</strong></div><div><span>Tax / الضريبة</span><strong>${money(document.tax, document.currency)}</strong></div><div class="grand"><span>Total / الإجمالي</span><strong>${money(document.total, document.currency)}</strong></div>${document.paid !== undefined ? `<div><span>Paid / المدفوع</span><strong>${money(document.paid, document.currency)}</strong></div><div><span>Due / المستحق</span><strong>${money(Math.max(0, document.total - document.paid), document.currency)}</strong></div>` : ""}</section>
  <footer class="hash"><b>Document integrity hash / بصمة سلامة المستند</b><div class="mono">${escapeHtml(document.hash || "Not locked — draft document / مسودة غير مقفلة")}</div></footer>
  </main></body></html>`;
}
