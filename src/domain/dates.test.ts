import { addDays, daysBetween, formatDate, isIsoDate, todayIn } from './dates'

describe('fechas civiles', () => {
  it('formatea una fecha ISO como día/mes/año', () => {
    expect(formatDate('2026-12-20')).toBe('20/12/2026')
  })

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-30', 2)).toBe('2027-01-01')
  })

  it('cuenta los días entre dos fechas', () => {
    expect(daysBetween('2026-12-20', '2026-12-24')).toBe(4)
    expect(daysBetween('2026-12-24', '2026-12-20')).toBe(-4)
  })

  it('valida el formato ISO', () => {
    expect(isIsoDate('2026-12-20')).toBe(true)
    expect(isIsoDate('20/12/2026')).toBe(false)
    expect(isIsoDate('2026-13-40')).toBe(false)
  })

  it('calcula "hoy" en la zona horaria indicada, no en la del equipo', () => {
    // 02:00 UTC del 21 de diciembre todavía es 20 de diciembre en Costa Rica (UTC−6).
    const instant = new Date('2026-12-21T02:00:00Z')
    expect(todayIn('America/Costa_Rica', instant)).toBe('2026-12-20')
    expect(todayIn('UTC', instant)).toBe('2026-12-21')
  })
})
