/**
 * ID Store Jordan logo. The supplied asset (public/logo.jpg) is white artwork on
 * a solid black background, so it's shown on a dark "plaque" that absorbs the
 * background, and kept near its native size to stay crisp on the light UI.
 * Swap to a transparent/higher-res asset later without touching call sites.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex w-fit items-center rounded-xl bg-ink p-2 shadow-card ${className}`}>
      <img src="/logo.jpg" alt="ID Store Jordan" className="h-9 w-auto rounded-md" />
    </div>
  );
}
