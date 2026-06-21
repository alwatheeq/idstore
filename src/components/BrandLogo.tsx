/**
 * ID. STORE — JORDAN wordmark with the VW front-fascia motif (light bar, roundel,
 * and ID-style headlights). Monochrome via currentColor, so it adapts to any
 * surface: `text-ink` on light, `text-paper`/`text-volt` on dark. Scales by width.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 196"
      className={className}
      role="img"
      aria-label="ID Store Jordan"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor">
        <text
          x="300"
          y="86"
          textAnchor="middle"
          fontFamily='"IBM Plex Sans", system-ui, sans-serif'
          fontWeight="700"
          fontSize="68"
          letterSpacing="1"
        >
          ID. STORE
        </text>
        <text
          x="300"
          y="120"
          textAnchor="middle"
          fontFamily='"IBM Plex Sans", system-ui, sans-serif'
          fontWeight="600"
          fontSize="22"
          letterSpacing="12"
        >
          JORDAN
        </text>
      </g>

      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* light bar to the VW roundel */}
        <path d="M232 164 H276" />
        <path d="M324 164 H368" />

        {/* VW roundel */}
        <circle cx="300" cy="164" r="24" />
        <path d="M291 152 l9 15 l9 -15" />
        <path d="M285 164 l4 13 l6 -9 l6 9 l4 -13" />

        {/* left headlight */}
        <path d="M232 158 L80 150 L52 164 L80 178 L232 170 Z" />
        {/* right headlight (mirror) */}
        <path d="M368 158 L520 150 L548 164 L520 178 L368 170 Z" />
      </g>

      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
        <path d="M96 164 H214" />
        <path d="M386 164 H504" />
      </g>

      <g fill="currentColor">
        <circle cx="70" cy="159" r="1.6" />
        <circle cx="78" cy="159" r="1.6" />
        <circle cx="70" cy="169" r="1.6" />
        <circle cx="78" cy="169" r="1.6" />
        <circle cx="530" cy="159" r="1.6" />
        <circle cx="522" cy="159" r="1.6" />
        <circle cx="530" cy="169" r="1.6" />
        <circle cx="522" cy="169" r="1.6" />
      </g>
    </svg>
  );
}
