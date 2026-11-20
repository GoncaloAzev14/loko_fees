import type { ComponentType, MouseEventHandler, SVGProps } from 'react'

interface Props {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /** What the button does. It is the accessible name and the tooltip, since there is no visible text. */
  label: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  /** 'danger' for something destructive (red), 'solid' for the main action of a small form (filled). */
  tone?: 'default' | 'danger' | 'solid'
  disabled?: boolean
  type?: 'button' | 'submit'
}

/** A small action shown as an icon (bin, pencil, exit…): never an unlabelled one, the label is read aloud and shown on hover. */
export default function IconButton({ Icon, label, onClick, tone = 'default', disabled, type = 'button' }: Props) {
  return (
    <button type={type} className={`ib${tone === 'default' ? '' : ` ${tone}`}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon />
    </button>
  )
}
