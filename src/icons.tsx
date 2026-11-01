import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest
  }
}

export const StackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
    <path d="M4 12.5 12 17l8-4.5" />
    <path d="M4 16.5 12 21l8-4.5" />
  </svg>
)

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const PinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 4h6l-1 5 4 3v2H6v-2l4-3-1-5Z" />
    <path d="M12 14v6" />
  </svg>
)

/** 收藏. Filled in by `.star-btn.on svg { fill: currentColor }`. */
export const StarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 4.4 2.35 4.86 5.15.72-3.75 3.6.9 5.32L12 16.4l-4.65 2.5.9-5.32-3.75-3.6 5.15-.72L12 4.4Z" />
  </svg>
)

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 5.5 15" />
  </svg>
)

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12" />
  </svg>
)

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 4.4-4.2 3.3 3 2.6-2.4 4.7 4.3" />
  </svg>
)

export const FileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13.5 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
    <path d="M13 4v5.5h5.5" />
  </svg>
)

export const TextIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
  </svg>
)

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
  </svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)

export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="7" y="5" width="3.5" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" />
  </svg>
)

export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.8 2.2h8A2 2 0 0 1 20.5 9.7v7.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
  </svg>
)

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
)

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </svg>
)

export const LayersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
    <path d="M3.5 12 12 16.5l8.5-4.5" />
    <path d="M3.5 16.5 12 21l8.5-4.5" />
  </svg>
)
