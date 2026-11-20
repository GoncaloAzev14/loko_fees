import type { ComponentType, SVGProps } from 'react'
import { ArchiveIcon, ClockIcon, CoinIcon, ReceiptPlusIcon, ShieldIcon, SlidersIcon, SwapIcon } from './icons'

export interface AdminLink {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Everything an admin can open. Shared by the sidebar and the swing menu. */
export const ADMIN_LINKS: AdminLink[] = [
  { to: '/admin/fines/new', label: 'Registar multa', Icon: ReceiptPlusIcon },
  { to: '/admin/payments', label: 'Pagamentos', Icon: CoinIcon },
  { to: '/admin/money', label: 'Receitas e despesas', Icon: SwapIcon },
  { to: '/admin/admins', label: 'Administradores', Icon: ShieldIcon },
  { to: '/admin/archive', label: 'Arquivo de épocas', Icon: ArchiveIcon },
  { to: '/admin/history', label: 'Histórico', Icon: ClockIcon },
  { to: '/admin/settings', label: 'Definições', Icon: SlidersIcon },
]
