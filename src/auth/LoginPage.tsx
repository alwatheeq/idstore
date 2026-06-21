import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (authError) {
      setError(t("auth.error.failed"));
    } else {
      const from =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
      void navigate(from, { replace: true });
    }
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
        <BrandLogo className="mx-auto w-56 text-ink" />

        <div className="charge animate-charge-in">
          <span style={{ width: "100%" }} />
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-ink-2">
              {t("auth.email")}
            </label>
            <input
              id="email"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-volt-deep"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-ink-2">
              {t("auth.password")}
            </label>
            <input
              id="password"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-volt-deep"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <button
          className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper shadow-card transition-[background-color,transform] duration-150 hover:bg-black active:translate-y-px disabled:opacity-50"
          type="submit"
          disabled={submitting}
        >
          {t("auth.login")}
        </button>

        <Link
          to="/portal/login"
          className="block text-center text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          {t("auth.customerLogin")}
        </Link>
      </form>
    </div>
  );
}
