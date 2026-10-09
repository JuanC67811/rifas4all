import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-contrast hover:opacity-90',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-muted',
  danger: 'bg-danger text-danger-contrast hover:opacity-90',
  ghost: 'text-brand underline-offset-4 hover:underline',
}

// min-h-12 = 48 px: área táctil cómoda en el teléfono.
const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold ' +
  'transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

function classes(variant: Variant, fullWidth: boolean, extra = '') {
  return [BASE, VARIANTS[variant], fullWidth ? 'w-full' : '', extra].join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  fullWidth?: boolean
  /** Mientras es true, el botón se deshabilita y muestra el texto de carga. */
  loading?: boolean
  loadingText?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  loadingText = 'Guardando…',
  disabled,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? loadingText : children}
    </button>
  )
}

type ButtonLinkProps = LinkProps & { variant?: Variant; fullWidth?: boolean }

export function ButtonLink({
  variant = 'primary',
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={classes(variant, fullWidth, className)} {...props} />
}
