import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="brand">
          <div className="brand-mark">ID</div>
          <div>
            <div className="brand-name">IDstore</div>
            <div className="brand-sub">Service operations</div>
          </div>
        </div>
        <div>
          <h1>Every vehicle.<br /><span>Every branch.</span><br />One clear view.</h1>
          <p>Purpose-built operating software for VW ID electric vehicle service centers—from arrival and HV safety to parts, invoicing and handover.</p>
        </div>
        <div className="brand-sub">Secure · Branch-aware · Audit-ready</div>
      </section>
      <section className="login-panel">
        <div className="login-eyebrow">Authorized access</div>
        <h2>Welcome back</h2>
        <p>Sign in with the mobile number and PIN assigned to your Admin or Staff account.</p>
        <LoginForm />
        <div className="login-security-note">Your mobile number is normalized securely and your PIN is never stored in this browser.</div>
      </section>
    </main>
  );
}
