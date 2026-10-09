import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RaffleFormValues, RaffleInput } from '@/domain/raffle'
import { RaffleForm } from './RaffleForm'

const EMPTY: RaffleFormValues = {
  name: '',
  description: '',
  price: '',
  currency: 'CRC',
  drawDate: '',
  paymentDeadline: '',
  reminderTemplate: '',
}

function renderForm(onSubmit = vi.fn<(input: RaffleInput) => void>(), initialValues = EMPTY) {
  render(
    <RaffleForm
      initialValues={initialValues}
      timeZone="America/Costa_Rica"
      submitLabel="Crear rifa"
      submitting={false}
      serverError={null}
      onSubmit={onSubmit}
    />,
  )
  return onSubmit
}

describe('RaffleForm', () => {
  it('muestra los errores y lleva el foco al primer campo inválido', async () => {
    const onSubmit = renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Crear rifa' }))

    const name = screen.getByLabelText('Nombre de la rifa')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription(/al menos 3 caracteres/)
    expect(name).toHaveFocus()
    expect(screen.getByLabelText('Precio por número')).toHaveAccessibleDescription(/mayor que cero/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envía los datos normalizados cuando todo es válido', async () => {
    const onSubmit = renderForm(vi.fn<(input: RaffleInput) => void>(), {
      ...EMPTY,
      drawDate: '2099-12-20',
      paymentDeadline: '2099-12-18',
    })

    await userEvent.type(screen.getByLabelText('Nombre de la rifa'), 'Canasta Navideña')
    await userEvent.type(screen.getByLabelText('Precio por número'), '2 000')
    await userEvent.click(screen.getByRole('button', { name: 'Crear rifa' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Canasta Navideña',
      description: null,
      priceMinor: 200000,
      currency: 'CRC',
      drawDate: '2099-12-20',
      paymentDeadline: '2099-12-18',
      reminderTemplate: null,
    })
  })

  it('muestra el error del servidor de forma que se anuncia', () => {
    render(
      <RaffleForm
        initialValues={EMPTY}
        timeZone="America/Costa_Rica"
        submitLabel="Crear rifa"
        submitting={false}
        serverError="Ya tienes 5 rifas. Elimina una para crear otra."
        onSubmit={vi.fn<(input: RaffleInput) => void>()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Ya tienes 5 rifas')
  })
})
