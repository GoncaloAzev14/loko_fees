import type { ComponentType, SVGProps } from 'react'
import { CoinIcon, ListIcon, ReceiptPlusIcon, ShieldIcon, SlidersIcon, SwapIcon, UsersIcon } from './icons'

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
  { to: '/admin/catalog', label: 'Tipos de multa', Icon: ListIcon },
  { to: '/admin/players', label: 'Plantel', Icon: UsersIcon },
  { to: '/admin/admins', label: 'Administradores', Icon: ShieldIcon },
  { to: '/admin/settings', label: 'Definições', Icon: SlidersIcon },
]
