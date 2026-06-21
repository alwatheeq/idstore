import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Customer } from "@/features/customers/types";
import { useProvisionPortalLogin } from "./hooks";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function genPin(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 10).toString()).join("");
}

export function PortalAccessPanel({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const provision = useProvisionPortalLogin(customer.id);
  const [pin, setPin] = useState(genPin());
  const [created, setCreated] = useState(false);

  if (customer.auth_user_id) {
    return (
      <section className="card space-y-3 p-5">
        <div className="micro">{t("portal.access")}</div>
        <span className="badge bg-ok-soft text-ok">{t("portal.linked")}</span>
      </section>
    );
  }

  if (!customer.phone) {
    return (
      <section className="card space-y-3 p-5">
        <div className="micro">{t("portal.access")}</div>
        <span className="badge bg-warn-soft text-warn">{t("portal.needPhone")}</span>
      </section>
    );
  }

  return (
    <section className="card max-w-md space-y-4 p-5">
      <div className="micro">{t("portal.access")}</div>
      <p className="text-sm text-muted">{t("portal.notLinked")}</p>
      {created ? (
        <p className="text-sm text-ink-2">
          {t("portal.pinShown")}{" "}
          <strong className="num text-lg tracking-widest text-ink">{pin}</strong>
        </p>
      ) : (
        <>
          <TextField
            label={t("portal.setPin")}
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <Button
            disabled={provision.isPending || pin.length !== 6}
            onClick={() =>
              provision.mutate(
                { phone: customer.phone!, pin },
                {
                  onSuccess: () => setCreated(true),
                  onError: () => toast.show(t("errors.saveFailed")),
                },
              )
            }
          >
            {t("portal.createLogin")}
          </Button>
        </>
      )}
    </section>
  );
}
