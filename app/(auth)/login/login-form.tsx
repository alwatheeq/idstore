"use client";

import { useActionState } from "react";
import { useUiLocale } from "@/components/ui-locale";
import { callingCodes } from "@/lib/auth/mobile";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next = "/work-orders" }: { next?: string }) {
  const { pageText } = useUiLocale();
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <div className="login-error" role="alert" aria-live="polite">
          {pageText(state.error)}
        </div>
      ) : null}

      <div className="form-field">
        <label htmlFor="mobile">{pageText("Mobile number")}</label>
        <div className="phone-control">
          <select name="dialCode" defaultValue="+962" aria-label={pageText("Country and calling code")} dir="ltr">
            {callingCodes.map((country) => (
              <option key={country.iso} value={country.dialCode}>
                {country.iso} {country.dialCode}
              </option>
            ))}
          </select>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel-national"
            placeholder="79 000 0000"
            aria-describedby="mobile-help"
            required
          />
        </div>
        <span className="field-help" id="mobile-help">{pageText("Choose the country, then enter the mobile number.")}</span>
      </div>

      <div className="form-field">
        <label htmlFor="pin">{pageText("6-digit PIN")}</label>
        <input
          className="pin-input"
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          dir="ltr"
          autoComplete="current-password"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          placeholder="••••••"
          aria-describedby="pin-help"
          required
        />
        <span className="field-help" id="pin-help">{pageText("Exactly six numbers.")}</span>
      </div>

      <button className="button primary" type="submit" disabled={pending}>
        {pageText(pending ? "Signing in…" : "Sign in")}
      </button>
    </form>
  );
}
