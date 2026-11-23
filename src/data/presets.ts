import type { Preset, ScenarioDefinition } from '../types'
import { shopPreset } from './shop'
import { cinemaPreset } from './cinema'
import { airlinePreset } from './airline'

export const presets = [shopPreset, cinemaPreset, airlinePreset]

export function getPreset(id: string) {
  return presets.find((preset) => preset.id === id)
}

export function cloneScenario(preset: Preset): ScenarioDefinition {
  return structuredClone(preset.scenario)
}

export function emptyScenario(): ScenarioDefinition {
  return {
    formatVersion: 1,
    name: 'Новая база',
    description: 'Пустой проект PostgreSQL',
    basePreset: null,
    schemaSql: '-- Создайте таблицы здесь или через кнопку «Новая таблица».\n',
    data: {},
    notes: '## Заметки / Задания\n\nОпишите здесь задачу или добавьте полезные ссылки.',
    tasks: [],
    starterQueries: [],
    layout: {},
  }
}
