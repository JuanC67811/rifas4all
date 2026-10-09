import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BoardCell } from '@/domain/sale'
import { BoardFilters } from './BoardFilters'
import { NumberGrid } from './NumberGrid'

const cells: BoardCell[] = [
  { number: 0, status: 'available', collaboratorId: 'carlos', version: 1 },
  { number: 7, status: 'paid', collaboratorId: 'carlos', version: 4 },
  { number: 60, status: 'reserved', collaboratorId: 'maria', version: 2 },
]
const names = new Map([
  ['carlos', 'Carlos'],
  ['maria', 'María'],
])

describe('NumberGrid', () => {
  it('anuncia número, estado y dueño de cada botón', () => {
    render(
      <NumberGrid
        cells={cells}
        myCollaboratorId="carlos"
        ownerName={(id) => names.get(id) ?? null}
        onSelect={vi.fn<(number: number) => void>()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Número 00, Disponible, tuyo' })).toHaveTextContent(
      '00',
    )
    expect(screen.getByRole('button', { name: 'Número 07, Pagado, tuyo' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Número 60, Reservado, de María' }),
    ).toBeInTheDocument()
  })

  it('avisa del número elegido', async () => {
    const onSelect = vi.fn<(number: number) => void>()
    render(<NumberGrid cells={cells} ownerName={() => null} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: 'Número 07, Pagado' }))

    expect(onSelect).toHaveBeenCalledWith(7)
  })

  it('explica cuando ningún número coincide con el filtro', () => {
    render(<NumberGrid cells={[]} ownerName={() => null} onSelect={vi.fn<(n: number) => void>()} />)

    expect(screen.getByText('Ningún número coincide con este filtro.')).toBeInTheDocument()
  })
})

describe('BoardFilters', () => {
  it('marca el filtro activo con aria-pressed y muestra las cantidades', async () => {
    const onChange = vi.fn<(filter: string) => void>()
    render(
      <BoardFilters
        value="mine"
        onChange={onChange}
        counts={{ available: 1, reserved: 1, pending_payment: 0, paid: 1, overdue: 0 }}
        total={3}
        mineCount={2}
      />,
    )

    expect(screen.getByRole('button', { name: 'Mis números (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Pagados (1)' }))
    expect(onChange).toHaveBeenCalledWith('paid')
  })
})
