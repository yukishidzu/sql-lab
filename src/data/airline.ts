import type { Preset } from '../types'

const schemaSql = `
CREATE TABLE airports (
  code text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  timezone text NOT NULL
);
CREATE TABLE aircrafts (
  id integer PRIMARY KEY,
  model text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0)
);
CREATE TABLE flights (
  id integer PRIMARY KEY,
  flight_no text NOT NULL UNIQUE,
  aircraft_id integer NOT NULL REFERENCES aircrafts(id),
  departure_airport text NOT NULL REFERENCES airports(code),
  arrival_airport text NOT NULL REFERENCES airports(code),
  scheduled_departure timestamp NOT NULL,
  scheduled_arrival timestamp NOT NULL,
  actual_departure timestamp,
  actual_arrival timestamp,
  status text NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);
CREATE TABLE bookings (
  id integer PRIMARY KEY,
  book_ref text NOT NULL UNIQUE,
  booked_at timestamp NOT NULL,
  contact_email text NOT NULL
);
CREATE TABLE tickets (
  id integer PRIMARY KEY,
  booking_id integer NOT NULL REFERENCES bookings(id),
  passenger_name text NOT NULL,
  fare_conditions text NOT NULL,
  amount numeric(10, 2) NOT NULL
);
CREATE TABLE ticket_flights (
  ticket_id integer NOT NULL REFERENCES tickets(id),
  flight_id integer NOT NULL REFERENCES flights(id),
  PRIMARY KEY (ticket_id, flight_id)
);
CREATE TABLE boarding_passes (
  ticket_id integer NOT NULL,
  flight_id integer NOT NULL,
  seat_no text NOT NULL,
  issued_at timestamp NOT NULL,
  PRIMARY KEY (ticket_id, flight_id),
  FOREIGN KEY (ticket_id, flight_id) REFERENCES ticket_flights(ticket_id, flight_id)
);
`

export const airlinePreset: Preset = {
  id: 'airline', version: 1, name: 'Авиаперелёты', accent: '#5b7cfa',
  description: 'Рейсы, билеты, пересадки и посадочные талоны. Двойные FK, M:N и составные ключи.',
  scenario: {
    formatVersion: 1, name: 'Авиаперелёты', description: 'Учебная база авиаперевозчика', basePreset: { id: 'airline', version: 1 }, schemaSql,
    notes: `## Задания: авиаперелёты\n\n1. Выведите номер рейса, города вылета и прилёта, используя два JOIN к airports.\n2. Найдите все рейсы, включая пустые, и число проданных билетов на каждый.\n3. Посчитайте задержку прибытия в минутах. Отменённые и ещё не завершённые рейсы не должны мешать результату.\n4. Найдите билеты с пересадками и выведите сегменты в порядке вылета.\n5. Найдите записи ticket_flights, для которых ещё нет посадочного талона.\n6. Ранжируйте завершённые рейсы по задержке через RANK и DENSE_RANK. Обратите внимание на одинаковые задержки.`,
    starterQueries: [
      { name: 'Маршруты рейсов', sql: `SELECT f.flight_no, dep.city AS departure_city, arr.city AS arrival_city, f.status\nFROM flights f\nJOIN airports dep ON dep.code = f.departure_airport\nJOIN airports arr ON arr.code = f.arrival_airport\nORDER BY f.scheduled_departure;` },
      { name: 'Сегменты билета', sql: `SELECT t.passenger_name, f.flight_no, f.scheduled_departure\nFROM tickets t\nJOIN ticket_flights tf ON tf.ticket_id = t.id\nJOIN flights f ON f.id = tf.flight_id\nWHERE t.id = 2\nORDER BY f.scheduled_departure;` },
    ],
    data: {
      airports: [
        { code: 'SVO', name: 'Шереметьево', city: 'Москва', timezone: 'Europe/Moscow' },
        { code: 'LED', name: 'Пулково', city: 'Санкт-Петербург', timezone: 'Europe/Moscow' },
        { code: 'KJA', name: 'Емельяново', city: 'Красноярск', timezone: 'Asia/Krasnoyarsk' },
        { code: 'OVB', name: 'Толмачёво', city: 'Новосибирск', timezone: 'Asia/Novosibirsk' },
      ],
      aircrafts: [
        { id: 1, model: 'Airbus A320', capacity: 180 }, { id: 2, model: 'Boeing 737', capacity: 189 },
        { id: 3, model: 'Sukhoi Superjet 100', capacity: 98 },
      ],
      flights: [
        { id: 1, flight_no: 'SL101', aircraft_id: 1, departure_airport: 'SVO', arrival_airport: 'LED', scheduled_departure: '2026-05-10 08:00', scheduled_arrival: '2026-05-10 09:30', actual_departure: '2026-05-10 08:10', actual_arrival: '2026-05-10 09:50', status: 'completed' },
        { id: 2, flight_no: 'SL202', aircraft_id: 2, departure_airport: 'LED', arrival_airport: 'KJA', scheduled_departure: '2026-05-10 12:00', scheduled_arrival: '2026-05-10 18:00', actual_departure: '2026-05-10 12:05', actual_arrival: '2026-05-10 18:20', status: 'completed' },
        { id: 3, flight_no: 'SL303', aircraft_id: 2, departure_airport: 'KJA', arrival_airport: 'OVB', scheduled_departure: '2026-05-10 20:00', scheduled_arrival: '2026-05-10 21:20', actual_departure: '2026-05-10 20:00', actual_arrival: '2026-05-10 21:05', status: 'completed' },
        { id: 4, flight_no: 'SL404', aircraft_id: 1, departure_airport: 'SVO', arrival_airport: 'OVB', scheduled_departure: '2026-05-12 10:00', scheduled_arrival: '2026-05-12 14:00', actual_departure: null, actual_arrival: null, status: 'cancelled' },
        { id: 5, flight_no: 'SL505', aircraft_id: 3, departure_airport: 'OVB', arrival_airport: 'SVO', scheduled_departure: '2026-05-13 10:00', scheduled_arrival: '2026-05-13 14:00', actual_departure: null, actual_arrival: null, status: 'scheduled' },
      ],
      bookings: [
        { id: 1, book_ref: 'BK1001', booked_at: '2026-05-01 10:00', contact_email: 'anna@example.com' },
        { id: 2, book_ref: 'BK1002', booked_at: '2026-05-02 11:00', contact_email: 'ivan@example.com' },
        { id: 3, book_ref: 'BK1003', booked_at: '2026-05-03 12:00', contact_email: 'maria@example.com' },
        { id: 4, book_ref: 'BK1004', booked_at: '2026-05-04 13:00', contact_email: 'oleg@example.com' },
      ],
      tickets: [
        { id: 1, booking_id: 1, passenger_name: 'Анна Смирнова', fare_conditions: 'economy', amount: '8500.00' },
        { id: 2, booking_id: 2, passenger_name: 'Иван Петров', fare_conditions: 'economy', amount: '17300.00' },
        { id: 3, booking_id: 3, passenger_name: 'Мария Орлова', fare_conditions: 'business', amount: '24100.00' },
        { id: 4, booking_id: 4, passenger_name: 'Олег Волков', fare_conditions: 'economy', amount: '9200.00' },
        { id: 5, booking_id: 4, passenger_name: 'Елена Волкова', fare_conditions: 'economy', amount: '9200.00' },
      ],
      ticket_flights: [
        { ticket_id: 1, flight_id: 1 }, { ticket_id: 2, flight_id: 1 }, { ticket_id: 2, flight_id: 2 },
        { ticket_id: 3, flight_id: 2 }, { ticket_id: 4, flight_id: 4 }, { ticket_id: 5, flight_id: 1 },
      ],
      boarding_passes: [
        { ticket_id: 1, flight_id: 1, seat_no: '12A', issued_at: '2026-05-10 06:30' },
        { ticket_id: 2, flight_id: 1, seat_no: '12B', issued_at: '2026-05-10 06:35' },
        { ticket_id: 2, flight_id: 2, seat_no: '18C', issued_at: '2026-05-10 10:30' },
        { ticket_id: 3, flight_id: 2, seat_no: '2A', issued_at: '2026-05-10 10:40' },
      ],
    },
    layout: {
      airports: { x: 0, y: 0 }, aircrafts: { x: 0, y: 300 }, flights: { x: 300, y: 80 },
      bookings: { x: 610, y: 0 }, tickets: { x: 610, y: 260 }, ticket_flights: { x: 350, y: 490 }, boarding_passes: { x: 0, y: 540 },
    },
  },
}
