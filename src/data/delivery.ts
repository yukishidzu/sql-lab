import type { Preset } from '../types'

const schemaSql = `
CREATE TABLE users (
  id integer PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  registered_at timestamp NOT NULL
);
CREATE TABLE restaurants (
  id integer PRIMARY KEY,
  name text NOT NULL,
  cuisine text NOT NULL,
  address text NOT NULL
);
CREATE TABLE menu_items (
  id integer PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id),
  name text NOT NULL,
  price numeric(10, 2) NOT NULL,
  available boolean NOT NULL DEFAULT true
);
CREATE TABLE couriers (
  id integer PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE orders (
  id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  restaurant_id integer NOT NULL REFERENCES restaurants(id),
  courier_id integer REFERENCES couriers(id),
  status text NOT NULL CHECK (status IN ('created', 'cooking', 'delivering', 'delivered', 'cancelled')),
  created_at timestamp NOT NULL,
  delivered_at timestamp
);
CREATE TABLE order_items (
  order_id integer NOT NULL REFERENCES orders(id),
  menu_item_id integer NOT NULL REFERENCES menu_items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_at_order numeric(10, 2) NOT NULL,
  PRIMARY KEY (order_id, menu_item_id)
);
CREATE TABLE order_status_history (
  id integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id),
  status text NOT NULL,
  changed_at timestamp NOT NULL
);
`

export const deliveryPreset: Preset = {
  id: 'delivery', version: 1, name: 'Доставка еды', accent: '#d97745',
  description: 'Заказы, позиции меню, курьеры и история статусов. NULL, M:N и временные данные.',
  scenario: {
    formatVersion: 1, name: 'Доставка еды', description: 'Учебная база сервиса доставки', basePreset: { id: 'delivery', version: 1 }, schemaSql,
    notes: `## Задания: доставка еды\n\n1. Выведите заказы с именем клиента и рестораном, включая заказы без курьера.\n2. Найдите пользователей без заказов и свободных курьеров через LEFT JOIN.\n3. Посчитайте стоимость каждого заказа по price_at_order, а не по текущей цене меню.\n4. Выведите последний статус каждого заказа из order_status_history.\n5. Найдите отменённые заказы и определите, сколько времени прошло до отмены.\n6. Ранжируйте доставленные заказы по стоимости внутри каждого ресторана через DENSE_RANK.`,
    starterQueries: [
      { name: 'Активные заказы', sql: `SELECT o.id, u.name AS customer, r.name AS restaurant, c.name AS courier, o.status\nFROM orders o\nJOIN users u ON u.id = o.user_id\nJOIN restaurants r ON r.id = o.restaurant_id\nLEFT JOIN couriers c ON c.id = o.courier_id\nWHERE o.status NOT IN ('delivered', 'cancelled');` },
      { name: 'Состав заказа', sql: `SELECT oi.order_id, m.name, oi.quantity, oi.price_at_order,\n       oi.quantity * oi.price_at_order AS total\nFROM order_items oi\nJOIN menu_items m ON m.id = oi.menu_item_id\nWHERE oi.order_id = 1;` },
    ],
    data: {
      users: [
        { id: 1, name: 'Анна', email: 'anna@example.com', registered_at: '2026-01-10 10:00' },
        { id: 2, name: 'Иван', email: 'ivan@example.com', registered_at: '2026-01-12 10:00' },
        { id: 3, name: 'Мария', email: 'maria@example.com', registered_at: '2026-02-01 10:00' },
        { id: 4, name: 'Пётр', email: 'petr@example.com', registered_at: '2026-02-03 10:00' },
        { id: 5, name: 'Без заказов', email: 'new@example.com', registered_at: '2026-03-01 10:00' },
      ],
      restaurants: [
        { id: 1, name: 'Паста и точка', cuisine: 'Итальянская', address: 'Ленина, 10' },
        { id: 2, name: 'Суши-дом', cuisine: 'Японская', address: 'Мира, 5' },
        { id: 3, name: 'Пекарня', cuisine: 'Выпечка', address: 'Садовая, 3' },
        { id: 4, name: 'Новый вок', cuisine: 'Азиатская', address: 'Уральская, 8' },
      ],
      menu_items: [
        { id: 1, restaurant_id: 1, name: 'Паста карбонара', price: '590.00', available: true },
        { id: 2, restaurant_id: 1, name: 'Тирамису', price: '320.00', available: true },
        { id: 3, restaurant_id: 2, name: 'Сет Филадельфия', price: '1190.00', available: true },
        { id: 4, restaurant_id: 2, name: 'Мисо-суп', price: '290.00', available: true },
        { id: 5, restaurant_id: 3, name: 'Круассан', price: '210.00', available: true },
        { id: 6, restaurant_id: 1, name: 'Сезонное ризотто', price: '650.00', available: false },
      ],
      couriers: [
        { id: 1, name: 'Алексей', phone: '+79000000001', active: true },
        { id: 2, name: 'Дмитрий', phone: '+79000000002', active: true },
        { id: 3, name: 'Свободный курьер', phone: '+79000000003', active: true },
      ],
      orders: [
        { id: 1, user_id: 1, restaurant_id: 1, courier_id: 1, status: 'delivered', created_at: '2026-05-01 12:00', delivered_at: '2026-05-01 12:45' },
        { id: 2, user_id: 2, restaurant_id: 2, courier_id: 2, status: 'delivered', created_at: '2026-05-01 13:00', delivered_at: '2026-05-01 14:00' },
        { id: 3, user_id: 1, restaurant_id: 2, courier_id: null, status: 'created', created_at: '2026-05-02 10:00', delivered_at: null },
        { id: 4, user_id: 3, restaurant_id: 1, courier_id: null, status: 'cancelled', created_at: '2026-05-02 11:00', delivered_at: null },
        { id: 5, user_id: 4, restaurant_id: 3, courier_id: 1, status: 'delivering', created_at: '2026-05-02 12:00', delivered_at: null },
        { id: 6, user_id: 2, restaurant_id: 1, courier_id: 2, status: 'delivered', created_at: '2026-05-03 12:00', delivered_at: '2026-05-03 12:40' },
      ],
      order_items: [
        { order_id: 1, menu_item_id: 1, quantity: 1, price_at_order: '550.00' }, { order_id: 1, menu_item_id: 2, quantity: 2, price_at_order: '300.00' },
        { order_id: 2, menu_item_id: 3, quantity: 1, price_at_order: '1150.00' }, { order_id: 3, menu_item_id: 3, quantity: 1, price_at_order: '1190.00' },
        { order_id: 3, menu_item_id: 4, quantity: 1, price_at_order: '290.00' }, { order_id: 4, menu_item_id: 1, quantity: 2, price_at_order: '590.00' },
        { order_id: 5, menu_item_id: 5, quantity: 3, price_at_order: '210.00' }, { order_id: 6, menu_item_id: 1, quantity: 2, price_at_order: '575.00' },
      ],
      order_status_history: [
        { id: 1, order_id: 1, status: 'created', changed_at: '2026-05-01 12:00' }, { id: 2, order_id: 1, status: 'delivered', changed_at: '2026-05-01 12:45' },
        { id: 3, order_id: 2, status: 'created', changed_at: '2026-05-01 13:00' }, { id: 4, order_id: 2, status: 'delivered', changed_at: '2026-05-01 14:00' },
        { id: 5, order_id: 3, status: 'created', changed_at: '2026-05-02 10:00' }, { id: 6, order_id: 4, status: 'created', changed_at: '2026-05-02 11:00' },
        { id: 7, order_id: 4, status: 'cancelled', changed_at: '2026-05-02 11:15' }, { id: 8, order_id: 5, status: 'created', changed_at: '2026-05-02 12:00' },
        { id: 9, order_id: 5, status: 'delivering', changed_at: '2026-05-02 12:30' }, { id: 10, order_id: 6, status: 'delivered', changed_at: '2026-05-03 12:40' },
      ],
    },
    layout: {
      users: { x: 0, y: 0 }, restaurants: { x: 0, y: 300 }, menu_items: { x: 0, y: 560 }, orders: { x: 310, y: 100 },
      couriers: { x: 610, y: 0 }, order_items: { x: 610, y: 300 }, order_status_history: { x: 310, y: 500 },
    },
  },
}
