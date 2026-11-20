import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ic" {...props}>
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => <Svg {...p}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3.5 2.8 3.5 6" />
  </Svg>
)
export const ReceiptIcon = (p: IconProps) => <Svg {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8.5 8h7M8.5 12h7" /></Svg>
export const ReceiptPlusIcon = (p: IconProps) => <Svg {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM12 8v6M9 11h6" /></Svg>
export const WalletIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14h.01" /></Svg>
)
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const LoginIcon = (p: IconProps) => <Svg {...p}><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l4 4-4 4M14 12H4" /></Svg>
export const ShieldIcon = (p: IconProps) => <Svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></Svg>
export const CoinIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2a3.2 3.2 0 1 0 0 5.6M8 11h5M8 13h5" /></Svg>
)
export const SwapIcon = (p: IconProps) => <Svg {...p}><path d="M7 17V5M3.5 8.5L7 5l3.5 3.5M17 7v12M13.5 15.5L17 19l3.5-3.5" /></Svg>
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M4 6h16M4 12h10M4 18h6" /></Svg>
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></Svg>
)
export const TrainIcon = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="12" rx="3" /><path d="M5 11h14M9 20l2-4M15 20l-2-4M8 7.5h.01M16 7.5h.01" /></Svg>
)
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>
export const CalendarIcon = (p: IconProps) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 4l9 16H3zM12 10v4M12 17v.5" /></Svg>
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const ArrowDownIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v12M7 12l5 5 5-5" /></Svg>
export const ArrowUpIcon = (p: IconProps) => <Svg {...p}><path d="M12 19V7M7 12l5-5 5 5" /></Svg>
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
export const ArchiveIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" /></Svg>
export const MailIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7l8 6 8-6" /></Svg>
export const LockIcon = (p: IconProps) => <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
export const EyeIcon = (p: IconProps) => <Svg {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.5 7.7C3.7 9.5 2 12 2 12s3.5 6.5 10 6.5c1.5 0 2.8-.3 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
)
export const TouchIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 10V9a2 2 0 0 0-4 0v1M10 9.5V4a2 2 0 0 0-4 0v10M18 11v-1a2 2 0 0 0-4 0" />
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </Svg>
)

// icons for the small actions on rows and in the header (see IconButton)
export const LogoutIcon = (p: IconProps) => <Svg {...p}><path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" /></Svg>
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v5.5M14 11v5.5" /></Svg>
export const PencilIcon = (p: IconProps) => <Svg {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14 7l3 3" /></Svg>
export const BanIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M6.3 6.3l11.4 11.4" /></Svg>
export const UndoIcon = (p: IconProps) => <Svg {...p}><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>
export const RefreshIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4.5H8" /></Svg>
export const XIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const SendIcon = (p: IconProps) => <Svg {...p}><path d="M21 3L10 14M21 3l-6.5 18-4-7.5L3 9.5z" /></Svg>
export const UserMinusIcon = (p: IconProps) => <Svg {...p}><path d="M15 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 8h5" /></Svg>
export const ChevronsDownIcon = (p: IconProps) => <Svg {...p}><path d="M7 7.5l5 5 5-5M7 13l5 5 5-5" /></Svg>
export const ChevronsUpIcon = (p: IconProps) => <Svg {...p}><path d="M7 11l5-5 5 5M7 16.5l5-5 5 5" /></Svg>
