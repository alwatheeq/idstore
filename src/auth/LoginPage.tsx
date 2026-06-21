import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/LanguageToggle";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    if (authError) setError(t("auth.error.failed"));
    else void navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border rounded-2xl p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
          <LanguageToggle />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm">{t("auth.email")}</label>
          <input
            id="email"
            className="w-full border rounded-lg px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm">{t("auth.password")}</label>
          <input
            id="password"
            className="w-full border rounded-lg px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="w-full rounded-lg bg-blue-600 text-white py-2"
          type="submit"
          disabled={submitting}
        >
          {t("auth.login")}
        </button>
      </form>
    </div>
  );
}
