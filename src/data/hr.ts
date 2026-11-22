import type { Preset } from '../types'

const schemaSql = `
CREATE TABLE departments (
  id integer PRIMARY KEY,
  name text NOT NULL,
  budget numeric(12, 2) NOT NULL
);
CREATE TABLE employees (
  id integer PRIMARY KEY,
  department_id integer REFERENCES departments(id),
  manager_id integer REFERENCES employees(id),
  name text NOT NULL,
  role text NOT NULL,
  hired_at date NOT NULL
);
CREATE TABLE employee_profiles (
  employee_id integer PRIMARY KEY REFERENCES employees(id),
  salary numeric(12, 2) NOT NULL,
  city text NOT NULL,
  bio text
);
CREATE TABLE projects (
  id integer PRIMARY KEY,
  name text NOT NULL,
  started_at date NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed', 'cancelled'))
);
CREATE TABLE tasks (
  id integer PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority integer NOT NULL,
  due_date date
);
CREATE TABLE task_assignees (
  task_id integer NOT NULL REFERENCES tasks(id),
  employee_id integer NOT NULL REFERENCES employees(id),
  assigned_at timestamp NOT NULL,
  PRIMARY KEY (task_id, employee_id)
);
`

export const hrPreset: Preset = {
  id: 'hr', version: 1, name: 'HR и таск-трекер', accent: '#4f9b79',
  description: 'Сотрудники, иерархия, проекты и исполнители. Self-join, 1:1 и M:N.',
  scenario: {
    formatVersion: 1, name: 'HR и таск-трекер', description: 'Учебная база команды и проектов', basePreset: { id: 'hr', version: 1 }, schemaSql,
    notes: `## Задания: HR и таск-трекер\n\n1. Выведите сотрудников, отделы и имена руководителей через self-join.\n2. Найдите пустые отделы и сотрудников без профиля через LEFT JOIN.\n3. Посчитайте число задач и исполнителей у каждого проекта, включая проекты без задач.\n4. Найдите задачи без исполнителей и сотрудников, которым не назначено ни одной задачи.\n5. Выведите иерархию сотрудников через рекурсивный CTE.\n6. Ранжируйте зарплаты внутри отделов через RANK и DENSE_RANK. Обратите внимание на одинаковые значения.`,
    starterQueries: [
      { name: 'Сотрудники и руководители', sql: `SELECT e.name, d.name AS department, m.name AS manager\nFROM employees e\nLEFT JOIN departments d ON d.id = e.department_id\nLEFT JOIN employees m ON m.id = e.manager_id\nORDER BY d.name, e.name;` },
      { name: 'Задачи проекта', sql: `SELECT p.name AS project, t.title, t.status, t.priority, t.due_date\nFROM tasks t\nJOIN projects p ON p.id = t.project_id\nWHERE p.id = 1\nORDER BY t.priority DESC, t.due_date NULLS LAST;` },
    ],
    data: {
      departments: [
        { id: 1, name: 'Разработка', budget: '1500000.00' }, { id: 2, name: 'Дизайн', budget: '600000.00' },
        { id: 3, name: 'Аналитика', budget: '800000.00' }, { id: 4, name: 'Новый отдел', budget: '100000.00' },
      ],
      employees: [
        { id: 1, department_id: 1, manager_id: null, name: 'Анна Смирнова', role: 'CTO', hired_at: '2023-01-15' },
        { id: 2, department_id: 1, manager_id: 1, name: 'Иван Петров', role: 'Team Lead', hired_at: '2023-03-10' },
        { id: 3, department_id: 1, manager_id: 2, name: 'Мария Орлова', role: 'Developer', hired_at: '2024-02-01' },
        { id: 4, department_id: 2, manager_id: 1, name: 'Олег Волков', role: 'Designer', hired_at: '2024-04-01' },
        { id: 5, department_id: 3, manager_id: 1, name: 'Елена Соколова', role: 'Analyst', hired_at: '2024-05-01' },
        { id: 6, department_id: null, manager_id: null, name: 'Новый сотрудник', role: 'Intern', hired_at: '2026-01-10' },
      ],
      employee_profiles: [
        { employee_id: 1, salary: '350000.00', city: 'Москва', bio: 'Технический директор' },
        { employee_id: 2, salary: '280000.00', city: 'Москва', bio: null },
        { employee_id: 3, salary: '220000.00', city: 'Казань', bio: 'Frontend' },
        { employee_id: 4, salary: '220000.00', city: 'Москва', bio: 'Product design' },
        { employee_id: 5, salary: '220000.00', city: 'Екатеринбург', bio: null },
      ],
      projects: [
        { id: 1, name: 'Новая платформа', started_at: '2026-01-15', status: 'active' },
        { id: 2, name: 'Редизайн', started_at: '2026-02-01', status: 'active' },
        { id: 3, name: 'Старый проект', started_at: '2025-01-10', status: 'completed' },
        { id: 4, name: 'Отменённый проект', started_at: '2026-01-01', status: 'cancelled' },
      ],
      tasks: [
        { id: 1, project_id: 1, title: 'Спроектировать схему', status: 'done', priority: 5, due_date: '2026-02-01' },
        { id: 2, project_id: 1, title: 'Написать API', status: 'in_progress', priority: 4, due_date: '2026-03-01' },
        { id: 3, project_id: 1, title: 'Неназначенная задача', status: 'todo', priority: 2, due_date: null },
        { id: 4, project_id: 2, title: 'Подготовить макет', status: 'in_progress', priority: 3, due_date: '2026-03-05' },
        { id: 5, project_id: 3, title: 'Перенести данные', status: 'done', priority: 3, due_date: '2025-02-01' },
        { id: 6, project_id: 4, title: 'Отменённая задача', status: 'cancelled', priority: 1, due_date: null },
      ],
      task_assignees: [
        { task_id: 1, employee_id: 2, assigned_at: '2026-01-15 10:00' }, { task_id: 1, employee_id: 3, assigned_at: '2026-01-15 10:05' },
        { task_id: 2, employee_id: 3, assigned_at: '2026-02-01 10:00' }, { task_id: 4, employee_id: 4, assigned_at: '2026-02-02 10:00' },
        { task_id: 5, employee_id: 5, assigned_at: '2025-01-10 10:00' },
      ],
    },
    layout: {
      departments: { x: 0, y: 0 }, employees: { x: 300, y: 0 }, employee_profiles: { x: 620, y: 0 },
      projects: { x: 0, y: 390 }, tasks: { x: 300, y: 390 }, task_assignees: { x: 620, y: 390 },
    },
  },
}
