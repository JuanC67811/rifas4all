import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button, ButtonLink } from '@/ui/Button'
import { TextField } from '@/ui/fields'
import { Card, Page, PageTitle } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'
import {
  emailSchema,
  passwordSchema,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from './api'
import { useAuth } from './auth-context'

type Errors = { email?: string; password?: string }

function validate(email: string, password: string | null): Errors {
  const errors: Errors = {}
  const emailResult = emailSchema.safeParse(email)
  if (!emailResult.success) errors.email = emailResult.error.issues[0]?.message
  if (password !== null) {
    const passwordResult = passwordSchema.safeParse(password)
    if (!passwordResult.success) errors.password = passwordResult.error.issues[0]?.message
  }
  return errors
}

// -----------------------------------------------------------------------------
// Entrar
// -----------------------------------------------------------------------------
export function LoginPage() {
  useDocumentTitle('Entrar')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/rifas'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Al entrar solo se exige que haya contraseña; las reglas de longitud son para crearla.
    const nextErrors = validate(email, null)
    if (!password) nextErrors.password = 'Escribe tu contraseña.'
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate(from, { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageTitle title="Entrar" subtitle="Administra tus rifas desde cualquier dispositivo." />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Button type="submit" fullWidth loading={submitting} loadingText="Entrando…">
            Entrar
          </Button>
        </form>
        <Link to="/recuperar" className="text-center text-brand underline-offset-4 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </Card>
      <p className="text-center text-muted">
        ¿Primera vez?{' '}
        <Link
          to="/registro"
          className="font-semibold text-brand underline-offset-4 hover:underline"
        >
          Crea tu cuenta
        </Link>
      </p>
    </Page>
  )
}

// -----------------------------------------------------------------------------
// Crear cuenta
// -----------------------------------------------------------------------------
export function RegisterPage() {
  useDocumentTitle('Crear cuenta')
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validate(email, password)
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const { needsConfirmation } = await signUp(email.trim(), password)
      if (needsConfirmation) setSentTo(email.trim())
      else navigate('/rifas', { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <Page>
        <PageTitle title="Revisa tu correo" />
        <Alert tone="success">
          Te enviamos un enlace a <strong>{sentTo}</strong> para confirmar tu cuenta. Ábrelo desde
          este mismo dispositivo.
        </Alert>
        <ButtonLink to="/entrar" variant="secondary">
          Ir a Entrar
        </ButtonLink>
      </Page>
    )
  }

  return (
    <Page>
      <PageTitle
        title="Crear cuenta"
        subtitle="Solo quien organiza la rifa necesita cuenta. Tus colaboradores entran con un enlace."
      />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            hint="Al menos 8 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <p className="text-sm text-muted">
            Al crear tu cuenta aceptas la{' '}
            <Link to="/privacidad" className="text-brand underline-offset-4 hover:underline">
              política de privacidad y condiciones
            </Link>
            .
          </p>
          <Button type="submit" fullWidth loading={submitting} loadingText="Creando cuenta…">
            Crear cuenta
          </Button>
        </form>
      </Card>
      <p className="text-center text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/entrar" className="font-semibold text-brand underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </Page>
  )
}

// -----------------------------------------------------------------------------
// Recuperar contraseña
// -----------------------------------------------------------------------------
export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextError = validate(email, null).email
    setError(nextError)
    setFormError(null)
    if (nextError) return

    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setFormError(toAppError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageTitle title="Recuperar contraseña" />
      {sent ? (
        <Alert tone="success">
          Si existe una cuenta con ese correo, te enviamos un enlace para elegir una contraseña
          nueva. Revisa también la carpeta de correo no deseado.
        </Alert>
      ) : (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            {formError && <Alert tone="error">{formError}</Alert>}
            <TextField
              label="Correo de tu cuenta"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
            />
            <Button type="submit" fullWidth loading={submitting} loadingText="Enviando…">
              Enviar enlace
            </Button>
          </form>
        </Card>
      )}
      <Link to="/entrar" className="text-center text-brand underline-offset-4 hover:underline">
        Volver a Entrar
      </Link>
    </Page>
  )
}

// -----------------------------------------------------------------------------
// Elegir contraseña nueva (al volver desde el enlace del correo)
// -----------------------------------------------------------------------------
export function ResetPasswordPage() {
  useDocumentTitle('Contraseña nueva')
  const navigate = useNavigate()
  const { loading, session } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && !session) {
    return (
      <Page>
        <PageTitle title="Contraseña nueva" />
        <Alert tone="error">El enlace expiró o ya se usó. Solicita uno nuevo.</Alert>
        <ButtonLink to="/recuperar">Solicitar otro enlace</ButtonLink>
      </Page>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = passwordSchema.safeParse(password)
    setError(result.success ? undefined : result.error.issues[0]?.message)
    setFormError(null)
    if (!result.success) return

    setSubmitting(true)
    try {
      await updatePassword(password)
      navigate('/rifas', { replace: true })
    } catch (err) {
      setFormError(toAppError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageTitle title="Contraseña nueva" />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            hint="Al menos 8 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <Button type="submit" fullWidth loading={submitting}>
            Guardar contraseña
          </Button>
        </form>
      </Card>
    </Page>
  )
}
