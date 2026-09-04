"use client";

import { useActionState } from "react";
import { callingCodes } from "@/lib/auth/mobile";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction}>
      {state.error ? (
        <div className="login-error" role="alert" aria-live="polite">
          {state.error}
        </div>
      ) : null}

      <div className="form-field">
        <label htmlFor="mobile">Mobile number</label>
        <div className="phone-control">
          <select name="dialCode" defaultValue="+962" aria-label="Country and calling code">
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
            autoComplete="tel-national"
            placeholder="79 000 0000"
            aria-describedby="mobile-help"
            required
          />
        </div>
        <span className="field-help" id="mobile-help">Choose the country, then enter the mobile number.</span>
      </div>

      <div className="form-field">
        <label htmlFor="pin">6-digit PIN</label>
        <input
          className="pin-input"
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          placeholder="••••••"
          aria-describedby="pin-help"
          required
        />
        <span className="field-help" id="pin-help">Exactly six numbers.</span>
      </div>

      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
