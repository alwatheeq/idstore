"use client";

import { useActionState, useId, useState } from "react";
import { useUiLocale } from "@/components/ui-locale";
import { addOrderItem } from "@/app/(app)/work-orders/item-actions";

export type OrderCatalogChoice = { id: string; name: string; nameAr: string | null; price: number | null };

export function OrderItemForm({ orderId, estimateId, invoiceVersion, type, currency, choices }: {
  orderId: string; estimateId: string; invoiceVersion?: number; type: "labor" | "part"; currency: string; choices: OrderCatalogChoice[];
}) {
  const id = useId();
  const { locale, pageText: t } = useUiLocale();
  const [selected, setSelected] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [tax, setTax] = useState("0");
  const [state, action, pending] = useActionState(async (previous: { error: string; saved?: boolean }, data: FormData) => {
    const result = await addOrderItem(previous, data);
    if (!result.error) { setSelected(""); setPrice(""); setQuantity("1"); setTax("0"); }
    return { ...result, saved: !result.error };
  }, { error: "", saved: false });
  return <form action={action} className="form-grid order-item-form">
    <input type="hidden" name="repairOrderId" value={orderId} /><input type="hidden" name={invoiceVersion === undefined ? "estimateId" : "invoiceId"} value={estimateId} /><input type="hidden" name="lineType" value={type} />
    {invoiceVersion === undefined ? null : <input type="hidden" name="version" value={invoiceVersion} />}
    <div className="form-field form-span-2"><label htmlFor={id + "-item"}>{t(type === "labor" ? "Service" : "Spare part")}</label>
      <select id={id + "-item"} name="catalogId" value={selected} required disabled={pending} onChange={event => {
        setSelected(event.target.value);
        const choice = choices.find(item => item.id === event.target.value);
        setPrice(choice?.price == null ? "" : String(choice.price));
      }}><option value="">{t("Choose an item")}</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{locale === "ar" ? choice.nameAr || choice.name : choice.name}</option>)}</select>
      {!choices.length ? <small className="field-help">{t(type === "labor" ? "Add services in the service catalog first." : "Add spare parts in inventory first.")}</small> : null}
    </div>
    <div className="form-field"><label htmlFor={id + "-quantity"}>{t("Quantity")}</label><input id={id + "-quantity"} name="quantity" type="number" dir="ltr" min="0.001" max="99999" step="0.001" required value={quantity} onChange={event => setQuantity(event.target.value)} /></div>
    <div className="form-field"><label htmlFor={id + "-price"}>{t("Unit price")} <bdi>{currency}</bdi></label><input id={id + "-price"} name="unitPrice" type="number" dir="ltr" min="0" max="999999.999" step="0.001" required value={price} onChange={event => setPrice(event.target.value)} /></div>
    <details className="service-options form-span-2"><summary>{t("Tax")}</summary><div className="form-field"><label htmlFor={id + "-tax"}>{t("Tax rate (%)")}</label><input id={id + "-tax"} name="taxRate" type="number" dir="ltr" min="0" max="100" step="0.001" required value={tax} onChange={event => setTax(event.target.value)} /></div></details>
    {state.error ? <p className="text-danger form-span-2" role="alert">{t(state.error)}</p> : state.saved ? <p className="field-help form-span-2" role="status">{t("Item added.")}</p> : null}
    <div className="form-actions form-span-2"><button className="button primary" type="submit" disabled={pending || !choices.length}>{t(pending ? "Saving…" : type === "labor" ? "Add service" : "Add part")}</button></div>
  </form>;
}
