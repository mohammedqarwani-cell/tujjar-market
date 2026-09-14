import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const StoreIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 10v10h16V10M3 10l1.6-6h14.8L21 10" />
    <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9.5 20v-5h5v5" />
  </svg>
);
export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" />
  </svg>
);
export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
);
export const PinIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const PhoneIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
);
export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
export const VerifiedIcon = ({ size = 18, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <path
      fill="currentColor"
      d="m12 2 2.4 2.1 3.1-.4.9 3 2.8 1.5-1 3 1 3-2.8 1.5-.9 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.9-3-2.8-1.5 1-3-1-3 2.8-1.5.9-3 3.1.4z"
    />
    <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const TruckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
);
export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>
);
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const FlagIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 21V4h11l-2 4 2 4H5" /></svg>
);
export const XIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
export const BoxIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></svg>
);
export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20V11M10 20V5M16 20v-6M21 20H3" /></svg>
);
export const SlidersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" />
  </svg>
);
export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" /></svg>
);
export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="15.5" cy="8.5" r="1.5" /></svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const EditIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
);
export const TagIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 12V3h9l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>
);
export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>
);
export const WhatsAppIcon = ({ size = 20, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <path
      fill="currentColor"
      d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm0 1.8a7.7 7.7 0 1 1-3.9 14.3l-.3-.2-2.8.8.8-2.7-.2-.3A7.7 7.7 0 0 1 12 4.3z"
    />
    <path
      fill="currentColor"
      d="M9.1 7.6c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.3-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.2 6.2 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3l.1-.4-.1-.3z"
    />
  </svg>
);
