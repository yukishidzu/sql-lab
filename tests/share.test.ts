import { beforeEach, describe, expect, it, vi } from 'vitest'
import { airlinePreset } from '../src/data/airline'
import { createShareUrl, decodeScenario, makeBackup, parseBackup } from '../src/lib/share'
import type { Workspace } from '../src/types'

beforeEach(() => {
  vi.stubGlobal('location', { origin: 'https://example.github.io', pathname: '/sql-lab/' })
})

describe('шаринг сценария', () => {
  it('передаёт patch пресета и восстанавливает контрольную сумму', async () => {
    const scenario = structuredClone(airlinePreset.scenario)
    scenario.notes += '\n\nДополнительное задание.'
    scenario.name = 'Авиаперелёты — группа А'
    scenario.mode = 'learn'
    scenario.tasks?.push({ id: 'custom', title: 'Своё задание', prompt: 'Выведите один рейс.', referenceQuery: 'SELECT id FROM flights LIMIT 1', rules: { compareColumns: true, compareOrder: true, readOnly: true } })
    const url = await createShareUrl(scenario)
    expect(url).toContain('https://example.github.io/sql-lab/#/import/')
    expect(url.length).toBeLessThan(60000)
    expect(await decodeScenario(url.split('#/import/')[1])).toEqual(scenario)
  })
  it('отклоняет повреждённую ссылку', async () => {
    await expect(decodeScenario('not-a-scenario')).rejects.toThrow('Ссылка повреждена')
  })
})

describe('резервная копия', () => {
  it('валидирует формат', () => {
    const workspace = { id: '1', scenario: structuredClone(airlinePreset.scenario) } as Workspace
    const backup = makeBackup(workspace, [], [], 'SELECT 1;')
    expect(parseBackup(JSON.stringify(backup)).dump).toBe('SELECT 1;')
    expect(() => parseBackup('{}')).toThrow('не поддерживаемый файл')
  })
})
