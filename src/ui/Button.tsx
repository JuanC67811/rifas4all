import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

/*
 * Botones estilo Wise: todo en píldora. La lima es SOLO para la acción principal
 * (texto verde bosque encima); la secundaria es una píldora con borde; la terciaria,
 * un enlace subrayado. Nunca dos botones rellenos uno al lado del otro.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'rounded-full bg-cta text-cta-ink hover:brightness-95 active:brightness-90',
  secondary: 'rounded-full border border-text bg-transparent text-text hover:bg-surface-muted',
  danger: 'rounded-full bg-danger text-danger-contrast hover:brightness-95',
  ghost: 'rounded-full text-brand underline decoration-2 underline-offset-4 hover:bg-surface-muted',
}

// min-h-12 = 48 px: área táctil cómoda en el teléfono.
const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 px-6 text-base font-semibold ' +
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
