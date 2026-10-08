import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('muestra el nombre del producto como encabezado principal', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Rifas4All' })).toBeInTheDocument()
  })

  it('muestra los números con dos dígitos, empezando por 00', () => {
    render(<App />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('00')
    expect(items[9]).toHaveTextContent('09')
  })
})
