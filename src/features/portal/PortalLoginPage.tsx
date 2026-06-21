import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* ambient volt glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 start-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-volt/20 blur-[120px]"
      />
      <div className="absolute end-6 top-6 z-10">
        <LanguageToggle />
      </div>

      <form
        onSubmit={submit}
        className="card relative z-10 w-full max-w-sm animate-fade-up space-y-7 p-8"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-xl text-volt shadow-card">
            ⚡
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-tight text-ink">{t("portal.title")}</h1>
          </div>
        </div>

        <div className="charge animate-charge-in">
          <span style={{ width: "100%" }} />
        </div>

        <div className="space-y-5">
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
        </div>
        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {t("portal.login")}
        </Button>

        <Link
          to="/login"
          className="block text-center text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          {t("portal.staffLogin")}
        </Link>
      </form>
    </div>
  );
}
