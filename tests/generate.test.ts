import { describe, expect, it } from 'vitest'
import { generateValidRow } from '../src/lib/generate'
import type { DbTable, DbRelationship } from '../src/types'

const bookings: DbTable = {
  name: 'bookings',
  columns: [
    { name: 'id', dataType: 'integer', nullable: false, primaryKey: true, foreignKey: false },
    { name: 'book_ref', dataType: 'text', nullable: false, primaryKey: false, foreignKey: false },
    { name: 'booked_at', dataType: 'timestamp without time zone', nullable: false, primaryKey: false, foreignKey: false },
  ],
}

describe('генератор синтетических данных', () => {
  it('создаёт уникальный PK и валидный timestamp', async () => {
    const row = await generateValidRow(bookings, [], [{ id: 1, book_ref: 'OLD', booked_at: '2026-01-01 00:00:00' }], async () => [])
    expect(row.id).not.toBe(1)
    expect(row.booked_at).toMatch(/^2026-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(row.book_ref).toMatch(/^BK-/)
  })

  it('согласованно заполняет составной PK+FK и избегает дублей', async () => {
    const table: DbTable = {
      name: 'ticket_flights',
      columns: [
        { name: 'ticket_id', dataType: 'integer', nullable: false, primaryKey: true, foreignKey: true },
        { name: 'flight_id', dataType: 'integer', nullable: false, primaryKey: true, foreignKey: true },
      ],
    }
    const relationships: DbRelationship[] = [
      { id: 'ticket', name: 'ticket', sourceTable: 'ticket_flights', sourceColumns: ['ticket_id'], targetTable: 'tickets', targetColumns: ['id'], cardinality: '1:N', junction: true },
      { id: 'flight', name: 'flight', sourceTable: 'ticket_flights', sourceColumns: ['flight_id'], targetTable: 'flights', targetColumns: ['id'], cardinality: '1:N', junction: true },
    ]
    const row = await generateValidRow(table, relationships, [{ ticket_id: 1, flight_id: 1 }], async (name) => name === 'tickets' ? [{ id: 1 }, { id: 2 }] : [{ id: 1 }])
    expect(row).toEqual({ ticket_id: 2, flight_id: 1 })
  })
})
