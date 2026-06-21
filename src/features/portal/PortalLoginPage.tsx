import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { phoneToEmail } from "@/lib/phone";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/LanguageToggle";

export function PortalLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    let email: string;
    try {
      email = phoneToEmail(phone);
    } catch {
      setSubmitting(false);
      setError(t("portal.invalidLogin"));
      return;
    }
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pin });
    setSubmitting(false);
    if (authErr) setError(t("portal.invalidLogin"));
    else void navigate("/portal", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded-2xl p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{t("portal.title")}</h1>
          <LanguageToggle />
        </div>
        <TextField
          label={t("portal.phone")}
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          label={t("portal.pin")}
          inputMode="numeric"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {t("portal.login")}
        </Button>
      </form>
    </div>
  );
}
