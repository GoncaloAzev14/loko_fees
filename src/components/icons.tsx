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
