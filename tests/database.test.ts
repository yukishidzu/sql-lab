import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { presets } from '../src/data/presets'
import { bootstrapScenario } from '../src/lib/bootstrap'

const identityInserts: Record<string, string[]> = {
  shop: [
    `INSERT INTO categories (name) VALUES ('Новая категория') RETURNING id`,
    `INSERT INTO products (category_id, name, price) VALUES (1, 'Новый товар', 100) RETURNING id`,
    `INSERT INTO customers (full_name, email, registered_at) VALUES ('Новый клиент', 'new-client@example.com', DATE '2026-08-01') RETURNING id`,
    `INSERT INTO orders (customer_id, status, created_at) VALUES (1, 'new', TIMESTAMP '2026-08-01 10:00:00') RETURNING id`,
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (1, 15, 1, 100) RETURNING id`,
  ],
  cinema: [
    `INSERT INTO users (full_name, email, registered_at) VALUES ('Новый зритель', 'new-viewer@example.com', DATE '2026-08-01') RETURNING id`,
    `INSERT INTO genres (name) VALUES ('Новый жанр') RETURNING id`,
    `INSERT INTO movies (title, release_year, duration_min, age_rating) VALUES ('Новый фильм', 2026, 100, 12) RETURNING id`,
    `INSERT INTO watch_history (user_id, movie_id, watched_at, watched_min) VALUES (1, 1, TIMESTAMP '2026-08-01 10:00:00', 10) RETURNING id`,
  ],
  airline: [
    `INSERT INTO aircrafts (model, capacity, range_km) VALUES ('Учебный самолёт', 45, 3200) RETURNING id`,
    `INSERT INTO flights (flight_no, departure_airport, arrival_airport, aircraft_id, scheduled_departure, scheduled_arrival, status) VALUES ('TEST1', 'SVO', 'LED', 1, TIMESTAMP '2026-08-01 10:00:00', TIMESTAMP '2026-08-01 11:00:00', 'scheduled') RETURNING id`,
    `INSERT INTO bookings (book_ref, booked_at, total_amount) VALUES ('TESTBOOK', TIMESTAMP '2026-07-20 10:00:00', 0) RETURNING id`,
    `INSERT INTO tickets (booking_id, passenger_name, passenger_doc) VALUES (1, 'Новый пассажир', 'TESTDOC') RETURNING id`,
    `INSERT INTO ticket_flights (ticket_id, flight_id, fare_class, price) VALUES (1, 12, 'Economy', 1000) RETURNING id`,
  ],
}

describe('загрузка пресетов в PostgreSQL', () => {
  for (const preset of presets) {
    it(`${preset.name}: схема, seeds, эталонные задания и IDENTITY`, async () => {
      const db = new PGlite('memory://')
      try {
        await bootstrapScenario(db, preset.scenario)
        for (const task of preset.scenario.tasks ?? []) {
          const result = await db.query(task.referenceQuery)
          expect(result.rows.length, task.title).toBeGreaterThan(0)
        }
        if (preset.id === 'cinema') {
          const best = await db.query<{ genre: string; title: string; average_rating: number }>(preset.scenario.tasks![9].referenceQuery)
          expect(best.rows.filter((row) => row.genre === 'Драма')).toHaveLength(2)
          expect(best.rows.filter((row) => row.genre === 'Драма').every((row) => Number(row.average_rating) === 8)).toBe(true)
          expect(best.rows.some((row) => row.title === 'Тихая комната')).toBe(false)
        }
        if (preset.id === 'shop') {
          const categories = await db.query<{ name: string; units_sold: number; revenue: number }>(preset.scenario.tasks![8].referenceQuery)
          for (const name of ['Распродажа', 'Аксессуары']) {
            const category = categories.rows.find((row) => row.name === name)!
            expect(Number(category.units_sold)).toBe(0)
            expect(Number(category.revenue)).toBe(0)
          }
          const diverse = await db.query<{ full_name: string }>(preset.scenario.tasks![9].referenceQuery)
          expect(diverse.rows.length).toBeGreaterThanOrEqual(2)
          expect(diverse.rows.some((row) => row.full_name === 'Елена Морозова')).toBe(false)
        }
        if (preset.id === 'airline') {
          const delays = await db.query<{ city: string; delay_rank: number }>(preset.scenario.tasks![8].referenceQuery)
          const moscowRanks = delays.rows.filter((row) => row.city === 'Москва').map((row) => Number(row.delay_rank))
          expect(new Set(moscowRanks).size).toBeLessThan(moscowRanks.length)
        }
        const statements = identityInserts[preset.id]
        for (const statement of statements) {
          const result = await db.query<{ id: number }>(statement)
          expect(result.rows[0].id).toBeGreaterThan(0)
        }
        const identityCount = await db.query<{ count: number }>(`SELECT COUNT(*)::integer AS count FROM information_schema.columns WHERE table_schema = 'public' AND is_identity = 'YES'`)
        expect(identityCount.rows[0].count).toBe(statements.length)
      } finally {
        await db.close()
      }
    }, 30000)
  }
})
