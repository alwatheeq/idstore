import { useModelImageMap } from "./ModelImagesContext";
import { resolveModelImage } from "./models";

function CarPlaceholder() {
  return (
    <svg
      viewBox="0 0 64 28"
      className="h-1/2 w-1/2 text-muted/40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 19h2m54 0h2M6 19l3.5-8.5A4 4 0 0 1 13.2 8h24.3a4 4 0 0 1 2.9 1.2L47 16l9 1.6a4 4 0 0 1 3 3.4" />
      <path d="M6 19v0a3 3 0 0 0 3 3M59 21a3 3 0 0 1-3 3" />
      <circle cx="20" cy="22" r="3.5" />
      <circle cx="45" cy="22" r="3.5" />
    </svg>
  );
}

/** Per-model image (admin-uploaded). Shows a neutral placeholder until one is uploaded. */
export function VehicleImage({
  model,
  className = "",
}: {
  model: string | null;
  className?: string;
}) {
  const map = useModelImageMap();
  const url = resolveModelImage(model, map);
  return (
    <div
      className={`grid place-items-center overflow-hidden rounded-xl border border-line bg-paper-2 ${className}`}
    >
      {url ? (
        <img
          src={url}
          alt={model ?? "EV"}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <CarPlaceholder />
      )}
    </div>
  );
}
