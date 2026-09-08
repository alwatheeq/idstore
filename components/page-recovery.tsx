"use client";

/** Also works outside the application shell, including failed account lookups. */
export function PageRecovery({ retry }: { retry: () => void }) {
  return <div className="recovery-state">
    <section className="panel panel-body" role="alert">
      <h1>Unable to load this page</h1>
      <p lang="ar" dir="rtl">تعذر تحميل الصفحة</p>
      <p>Check your connection and try again. If access has changed, sign in again.</p>
      <p lang="ar" dir="rtl">تحقق من الاتصال وحاول مجددًا. إذا تغيرت صلاحياتك، سجّل الدخول مرة أخرى.</p>
      <div className="inline-actions"><button className="button primary" type="button" onClick={retry}>Try again / حاول مجددًا</button><a className="button" href="/login">Sign in / تسجيل الدخول</a></div>
    </section>
  </div>;
}
