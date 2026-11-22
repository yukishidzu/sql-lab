import { describe, expect, it } from 'vitest'
import { presets } from '../src/data/presets'

describe('учебные пресеты', () => {
  it('содержат полный контент без эталонов', () => {
    expect(presets).toHaveLength(3)
    for (const preset of presets) {
      expect(preset.scenario.schemaSql).toContain('CREATE TABLE')
      expect(Object.keys(preset.scenario.data)).toHaveLength(preset.id === 'hr' ? 6 : 7)
      expect(preset.scenario.notes.match(/^\d\./gm)).toHaveLength(6)
      expect(preset.scenario.starterQueries.length).toBeGreaterThanOrEqual(1)
      expect(preset.scenario.starterQueries.length).toBeLessThanOrEqual(2)
      expect(preset.scenario).not.toHaveProperty('expectedQuery')
    }
  })

  it('имеет краевые случаи авиаперелётов', () => {
    const data = presets[0].scenario.data
    expect(data.flights.filter((flight) => flight.status === 'cancelled')).toHaveLength(1)
    expect(data.ticket_flights.filter((segment) => segment.ticket_id === 2)).toHaveLength(2)
    expect(data.boarding_passes.length).toBeLessThan(data.ticket_flights.length)
    expect(presets[0].scenario.schemaSql).toContain('departure_airport text NOT NULL REFERENCES airports(code)')
  })

  it('имеет NULL, пустые сущности и равные значения', () => {
    const delivery = presets[1].scenario.data
    expect(delivery.orders.some((order) => order.courier_id === null)).toBe(true)
    const hr = presets[2].scenario.data
    expect(hr.employees.some((employee) => employee.manager_id === null)).toBe(true)
    expect(new Set(hr.employee_profiles.map((profile) => profile.salary)).size).toBeLessThan(hr.employee_profiles.length)
  })
})
