import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { presets } from '../src/data/presets'
import { bootstrapScenario } from '../src/lib/bootstrap'
import { compareTaskResults } from '../src/lib/tasks'
import type { QueryResult, SqlValue } from '../src/types'

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

const negativeTaskQueries: Record<string, string[]> = {
  shop: [
    `SELECT name, price, stock_qty FROM products WHERE is_active AND price = 0 ORDER BY price DESC, id`,
    `SELECT full_name, email, city, registered_at FROM customers WHERE city = 'Москва' AND registered_at BETWEEN DATE '2026-01-01' AND DATE '2026-06-30' ORDER BY registered_at, id`,
    `SELECT name, price FROM products WHERE is_active ORDER BY price ASC, id LIMIT 5`,
    `SELECT DISTINCT c.name FROM categories c JOIN products p ON p.category_id = c.id WHERE p.name ILIKE '%pro%' AND p.stock_qty = 0 ORDER BY c.name`,
    `SELECT p.name, p.category_id, p.price, p.stock_qty FROM products p ORDER BY p.category_id, p.name`,
    `SELECT o.id AS order_id, cu.full_name AS customer, p.name AS product, oi.quantity, oi.quantity * oi.unit_price AS line_total FROM orders o JOIN customers cu ON cu.id = o.customer_id JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id WHERE o.status = 'paid' ORDER BY o.id, p.name`,
    `SELECT status, COUNT(*) AS order_count FROM orders GROUP BY status ORDER BY status`,
    `SELECT c.id, c.full_name, SUM(oi.unit_price * oi.quantity) AS total FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'delivered' GROUP BY c.id, c.full_name HAVING SUM(oi.unit_price * oi.quantity) > 1000000 ORDER BY total DESC, c.id`,
    `SELECT c.id, c.full_name, c.email, COALESCE(c.city, 'Не указан') AS city FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL ORDER BY c.id`,
    `WITH paid_sales AS (SELECT oi.product_id, SUM(oi.quantity) AS quantity, SUM(oi.unit_price * oi.quantity) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid' GROUP BY oi.product_id) SELECT c.name, COALESCE(SUM(ds.quantity), 0) AS units_sold, COALESCE(SUM(ds.revenue), 0) AS revenue FROM categories c LEFT JOIN products p ON p.category_id = c.id LEFT JOIN paid_sales ds ON ds.product_id = p.id GROUP BY c.id, c.name ORDER BY c.name`,
  ],
  cinema: [
    `SELECT title, release_year, duration_min, age_rating FROM movies WHERE release_year >= 2020 AND age_rating = 18 AND duration_min > 100 ORDER BY duration_min DESC, id`,
    `SELECT title, duration_min, age_rating FROM movies WHERE release_year = 2021 ORDER BY duration_min, id`,
    `SELECT u.full_name, u.email, s.plan, s.monthly_price, s.expires_at FROM users u JOIN subscriptions s ON s.user_id = u.id WHERE s.status = 'expired' ORDER BY s.expires_at, u.id`,
    `SELECT m.title, m.release_year, g.id AS genre FROM movies m JOIN movie_genres mg ON mg.movie_id = m.id JOIN genres g ON g.id = mg.genre_id ORDER BY m.title, g.id`,
    `SELECT u.id, u.full_name, COALESCE(s.plan, 'Без подписки') AS plan, COALESCE(CASE WHEN s.status = 'active' THEN s.monthly_price ELSE 0 END, 0) AS monthly_payment FROM users u JOIN subscriptions s ON s.user_id = u.id ORDER BY u.id`,
    `SELECT u.id, u.full_name, COALESCE(inviter.full_name, 'Сам') AS invited_by_name FROM users u LEFT JOIN users inviter ON inviter.id = u.invited_by ORDER BY u.id`,
    `SELECT DATE_TRUNC('month', watched_at) AS month, COUNT(*) AS views, SUM(watched_min) AS watched_minutes, ROUND(AVG(user_rating), 1) AS average_rating FROM watch_history GROUP BY DATE_TRUNC('month', watched_at) HAVING COUNT(*) >= 100 ORDER BY month`,
    `SELECT g.name, COUNT(m.id) AS movie_count, COUNT(wh.id) AS view_count, ROUND(AVG(wh.user_rating), 1) AS average_rating FROM genres g LEFT JOIN movie_genres mg ON mg.genre_id = g.id LEFT JOIN movies m ON m.id = mg.movie_id LEFT JOIN watch_history wh ON wh.movie_id = m.id GROUP BY g.id, g.name ORDER BY g.name`,
    `SELECT u.id, u.full_name, COUNT(wh.id) AS view_count, SUM(CASE WHEN wh.watched_min >= m.duration_min * 0.8 THEN 1 ELSE 0 END) AS completed_count, ROUND(100.0 * SUM(CASE WHEN wh.watched_min >= m.duration_min * 0.8 THEN 1 ELSE 0 END) / COUNT(wh.id), 1) AS completed_percent FROM users u JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active' JOIN watch_history wh ON wh.user_id = u.id JOIN movies m ON m.id = wh.movie_id GROUP BY u.id, u.full_name HAVING COUNT(wh.id) >= 1 ORDER BY completed_percent DESC, u.id`,
    `SELECT g.name, COUNT(DISTINCT u.id) AS active_viewers, COUNT(wh.id) AS view_count, ROUND(AVG(wh.user_rating), 1) AS average_rating FROM genres g JOIN movie_genres mg ON mg.genre_id = g.id JOIN movies m ON m.id = mg.movie_id AND m.release_year = 2021 JOIN watch_history wh ON wh.movie_id = m.id JOIN users u ON u.id = wh.user_id JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active' GROUP BY g.id, g.name HAVING COUNT(DISTINCT u.id) >= 2 ORDER BY view_count DESC, g.name`,
  ],
  airline: [
    `SELECT f.flight_no, a.model, a.capacity, a.range_km FROM flights f JOIN aircrafts a ON a.id = f.aircraft_id WHERE a.capacity >= 0 AND a.range_km > 0 ORDER BY f.flight_no`,
    `SELECT flight_no, scheduled_departure, status FROM flights WHERE status = 'cancelled' ORDER BY scheduled_departure, id`,
    `SELECT f.flight_no, dep.city AS departure_city, dep.city AS arrival_city, a.model, f.scheduled_departure FROM flights f JOIN airports dep ON dep.code = f.departure_airport JOIN aircrafts a ON a.id = f.aircraft_id ORDER BY f.scheduled_departure, f.id`,
    `SELECT b.book_ref, t.passenger_name, f.flight_no, tf.fare_class, tf.price FROM bookings b JOIN tickets t ON t.booking_id = b.id JOIN ticket_flights tf ON tf.ticket_id = t.id JOIN flights f ON f.id = tf.flight_id WHERE tf.fare_class = 'Business' ORDER BY b.book_ref, t.id, f.scheduled_departure`,
    `SELECT DATE_TRUNC('day', f.scheduled_departure) AS departure_date, COUNT(tf.id) AS sold_segments, SUM(tf.price) AS revenue FROM flights f JOIN ticket_flights tf ON tf.flight_id = f.id GROUP BY DATE_TRUNC('day', f.scheduled_departure) ORDER BY departure_date`,
    `SELECT b.book_ref, COUNT(DISTINCT t.id) AS passenger_count, b.total_amount, SUM(tf.price) AS calculated_amount FROM bookings b JOIN tickets t ON t.booking_id = b.id JOIN ticket_flights tf ON tf.ticket_id = t.id GROUP BY b.id, b.book_ref, b.total_amount ORDER BY b.book_ref`,
    `WITH departures AS (SELECT departure_airport AS code, COUNT(*) AS count FROM flights GROUP BY departure_airport), arrivals AS (SELECT arrival_airport AS code, COUNT(*) AS count FROM flights GROUP BY arrival_airport) SELECT a.country, a.city, a.code, COALESCE(d.count, 0) AS departures, 0 AS arrivals FROM airports a LEFT JOIN departures d ON d.code = a.code LEFT JOIN arrivals ar ON ar.code = a.code ORDER BY a.country, a.city, a.code`,
    `SELECT f.id, f.flight_no, f.scheduled_departure FROM flights f WHERE NOT EXISTS (SELECT 1 FROM ticket_flights tf WHERE tf.flight_id = f.id) ORDER BY f.scheduled_departure, f.id`,
    `WITH delays AS (SELECT dep.city, f.flight_no, EXTRACT(EPOCH FROM (f.actual_arrival - f.scheduled_arrival)) / 60 AS delay_minutes FROM flights f JOIN airports dep ON dep.code = f.departure_airport WHERE f.status = 'arrived' AND f.actual_arrival IS NOT NULL) SELECT city, flight_no, delay_minutes, ROW_NUMBER() OVER (PARTITION BY city ORDER BY delay_minutes DESC) AS delay_rank FROM delays ORDER BY city, delay_rank, flight_no`,
    `WITH segments AS (SELECT t.passenger_name, t.id AS ticket_id, f.flight_no, f.scheduled_departure, LEAD(f.flight_no) OVER (PARTITION BY t.id ORDER BY f.scheduled_departure) AS previous_flight, LEAD(f.flight_no) OVER (PARTITION BY t.id ORDER BY f.scheduled_departure) AS next_flight, LAG(f.scheduled_arrival) OVER (PARTITION BY t.id ORDER BY f.scheduled_departure) AS previous_arrival FROM tickets t JOIN ticket_flights tf ON tf.ticket_id = t.id JOIN flights f ON f.id = tf.flight_id WHERE t.id IN (SELECT ticket_id FROM ticket_flights GROUP BY ticket_id HAVING COUNT(*) > 1)) SELECT passenger_name, ticket_id, flight_no, scheduled_departure, previous_flight, next_flight, EXTRACT(EPOCH FROM (scheduled_departure - previous_arrival)) / 60 AS connection_minutes FROM segments ORDER BY ticket_id, scheduled_departure`,
  ],
}

function asQueryResult(result: { fields: { name: string; dataTypeID: number }[]; rows: Record<string, SqlValue>[] }): QueryResult {
  return { fields: result.fields, rows: result.rows, rowCount: result.rows.length, durationMs: 0 }
}

describe('загрузка пресетов в PostgreSQL', () => {
  for (const preset of presets) {
    it(`${preset.name}: схема, seeds, эталонные задания и IDENTITY`, async () => {
      const db = new PGlite('memory://')
      try {
        await bootstrapScenario(db, preset.scenario)
        for (const [index, task] of (preset.scenario.tasks ?? []).entries()) {
          const result = await db.query(task.referenceQuery)
          expect(result.rows.length, task.title).toBeGreaterThan(0)
          const wrong = await db.query(negativeTaskQueries[preset.id][index])
          const comparison = compareTaskResults(asQueryResult(wrong), asQueryResult(result), task.rules)
          expect(comparison.status, `${task.title}: известный неправильный запрос не должен проходить`).not.toBe('passed')
        }
        if (preset.id === 'cinema') {
          const completed = await db.query<{ full_name: string; completed_percent: number }>(preset.scenario.tasks![8].referenceQuery)
          expect(completed.rows.map((row) => row.full_name)).toEqual(['Анна Ветрова', 'Дарья Жукова', 'Борис Громов', 'Егор Зайцев'])
          const genres = await db.query<{ active_viewers: number }>(preset.scenario.tasks![9].referenceQuery)
          expect(genres.rows.length).toBeGreaterThan(0)
          expect(genres.rows.every((row) => Number(row.active_viewers) >= 2)).toBe(true)
        }
        if (preset.id === 'shop') {
          const categories = await db.query<{ name: string; units_sold: number; revenue: number }>(preset.scenario.tasks![9].referenceQuery)
          for (const name of ['Распродажа', 'Аксессуары']) {
            const category = categories.rows.find((row) => row.name === name)!
            expect(Number(category.units_sold)).toBe(0)
            expect(Number(category.revenue)).toBe(0)
          }
          const withoutOrders = await db.query<{ full_name: string; city: string }>(preset.scenario.tasks![8].referenceQuery)
          expect(withoutOrders.rows).toHaveLength(2)
          expect(withoutOrders.rows.some((row) => row.full_name === 'Анна Соколова' && row.city === 'Не указан')).toBe(true)
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
