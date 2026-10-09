import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

/**
 * Campos de formulario accesibles: etiqueta visible siempre asociada, ayuda y
 * error enlazados con aria-describedby, y aria-invalid cuando hay error.
 * Texto de 16 px para que iOS no haga zoom al enfocar.
 */
const CONTROL =
  'block w-full min-h-12 rounded-xl border border-border bg-surface px-4 text-base text-text ' +
  'placeholder:text-muted focus:border-brand focus:outline-2 focus:outline-brand ' +
  'aria-invalid:border-danger disabled:bg-surface-muted disabled:text-muted'

type FieldShellProps = {
  id: string
  label: string
  hint?: string
  error?: string
  children: (describedBy: string | undefined) => ReactNode
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type CommonProps = { label: string; hint?: string; error?: string }

export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={fieldId}
          className={CONTROL}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          id={fieldId}
          className={`${CONTROL} py-3`}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <select
          id={fieldId}
          className={CONTROL}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
