type ServiceLoopIllustrationProps = {
  className?: string;
};

/** A small, self-contained EV service illustration used as a visual landmark. */
export function ServiceLoopIllustration({ className }: ServiceLoopIllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 420 250" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="service-route" x1="48" y1="198" x2="361" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A9CF8" />
          <stop offset="1" stopColor="#62D8BF" />
        </linearGradient>
        <linearGradient id="service-car" x1="132" y1="112" x2="279" y2="183" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5FBFF" />
          <stop offset="1" stopColor="#B5DCFB" />
        </linearGradient>
      </defs>
      <path d="M47 204C91 204 91 68 164 68c72 0 58 108 123 108 34 0 48-23 78-55" stroke="url(#service-route)" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 12" />
      <path d="M353 39v46M330 62h46" stroke="#62D8BF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="164" cy="68" r="8" fill="#62D8BF" />
      <circle cx="287" cy="176" r="8" fill="#1A9CF8" />
      <path d="M117 160c9-26 29-43 58-49l54-10c20-4 39 5 51 22l21 30c4 5 6 12 6 19v8H108v-7c0-5 2-10 9-13Z" fill="url(#service-car)" stroke="#E9F7FF" strokeWidth="3" strokeLinejoin="round" />
      <path d="m194 112 10 41m0 0h67m-67 0h-63" stroke="#2B87CA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
      <path d="M151 152h18m94 0h16" stroke="#075EBD" strokeWidth="4" strokeLinecap="round" />
      <circle cx="151" cy="181" r="18" fill="#09223A" stroke="#EFF9FF" strokeWidth="4" />
      <circle cx="151" cy="181" r="6" fill="#62D8BF" />
      <circle cx="268" cy="181" r="18" fill="#09223A" stroke="#EFF9FF" strokeWidth="4" />
      <circle cx="268" cy="181" r="6" fill="#62D8BF" />
      <path d="M319 110h24l-7 11h8l-19 27 6-20h-9l-3-18Z" fill="#FFC54D" />
      <path d="M49 204h62" stroke="#7BC9F7" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
