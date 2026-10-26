import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const IconBack = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const IconChevron = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconArrow = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconScan = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconInfo = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconKeyboard = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></svg>
);
export const IconUnknownTag = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L4.6 13.6A2 2 0 0 1 4 12.2z" />
    <path d="M9.5 10a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9v.4M11.5 15.5h.01" />
  </svg>
);

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9.4c.66 0 1.3.26 1.77.73l5.6 5.6c.47.47.73 1.1.73 1.77v9.4A2.5 2.5 0 0 1 21.5 24h-15A2.5 2.5 0 0 1 4 21.5z"
        stroke="#3DDC97"
        strokeWidth="2"
      />
      <path d="M9 14.5l3 3 6.5-6.5" stroke="#3DDC97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pictogramme simple par catégorie de vêtement. */
export function CategoryIcon({ category, size = 36 }: { category: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#1F6B4A", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };
  switch (category) {
    case "Jean":
    case "Pantalon":
      return <svg {...props}><path d="M7 3h10l1 18h-4.5L12 10l-1.5 11H6z" /><path d="M7 6h10" /></svg>;
    case "Robe":
      return <svg {...props}><path d="M9 3h6l-1 5 5 13H5l5-13z" /><path d="M10 8h4" /></svg>;
    case "Veste":
    case "Chemise":
      return <svg {...props}><path d="M8 3L3 6l1.5 6L7 11v10h10V11l2.5 1L21 6l-5-3-4 5z" /><path d="M12 8v13" /></svg>;
    case "Pull":
    case "Sweat":
      return <svg {...props}><path d="M8 3L3 7l1 9 3-1v6h10v-6l3 1 1-9-5-4c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" /><path d="M7 19h10" /></svg>;
    default:
      return <svg {...props}><path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" /></svg>;
  }
}
