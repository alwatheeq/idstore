import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Customer } from "@/features/customers/types";
import { useProvisionPortalLogin } from "./hooks";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function genPin(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export function PortalAccessPanel({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const provision = useProvisionPortalLogin(customer.id);
  const [pin, setPin] = useState(genPin());
  const [created, setCreated] = useState(false);

  if (customer.auth_user_id) {
    return (
      <section className="border rounded-xl p-4 space-y-1">
        <h3 className="font-semibold">{t("portal.access")}</h3>
        <p className="text-sm text-green-700">{t("portal.linked")}</p>
      </section>
    );
  }

  if (!customer.phone) {
    return (
      <section className="border rounded-xl p-4 space-y-1">
        <h3 className="font-semibold">{t("portal.access")}</h3>
        <p className="text-sm opacity-70">{t("portal.needPhone")}</p>
      </section>
    );
  }

  return (
    <section className="border rounded-xl p-4 space-y-3 max-w-md">
      <h3 className="font-semibold">{t("portal.access")}</h3>
      <p className="text-sm opacity-70">{t("portal.notLinked")}</p>
      {created ? (
        <p className="text-sm">
          {t("portal.pinShown")}{" "}
          <strong className="text-lg tracking-widest">{pin}</strong>
        </p>
      ) : (
        <>
          <TextField
            label={t("portal.setPin")}
            inputMode="numeric"
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
