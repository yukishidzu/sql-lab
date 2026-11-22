import DiffMatchPatch from 'diff-match-patch'
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import { getPreset } from '../data/presets'
import type { QueryRun, SavedQuery, ScenarioDefinition, Workspace } from '../types'

type Envelope = {
  v: 1
  base: { id: string; version: number } | null
  hash: string
  patch?: string
  scenario?: ScenarioDefinition
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function hashScenario(scenario: ScenarioDefinition) {
  const bytes = await crypto.subtle.digest('SHA-256', strToU8(JSON.stringify(scenario)))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createShareUrl(scenario: ScenarioDefinition) {
  const envelope: Envelope = { v: 1, base: scenario.basePreset, hash: await hashScenario(scenario) }
  if (scenario.basePreset) {
    const preset = getPreset(scenario.basePreset.id)
    if (!preset || preset.version !== scenario.basePreset.version) throw new Error('Версия пресета больше не поддерживается. Используйте экспорт файла.')
    const differ = new DiffMatchPatch()
    envelope.patch = differ.patch_toText(differ.patch_make(JSON.stringify(preset.scenario), JSON.stringify(scenario)))
  } else envelope.scenario = scenario
  const encoded = toBase64Url(gzipSync(strToU8(JSON.stringify(envelope)), { level: 9 }))
  if (encoded.length > 60000) throw new Error('Сценарий слишком большой для ссылки. Экспортируйте файл SQL Lab.')
  return `${location.origin}${location.pathname}#/import/${encoded}`
}

export async function decodeScenario(encoded: string): Promise<ScenarioDefinition> {
  let envelope: Envelope
  try { envelope = JSON.parse(strFromU8(gunzipSync(fromBase64Url(encoded)))) as Envelope } catch {
    throw new Error('Ссылка повреждена или имеет неподдерживаемый формат')
  }
  if (envelope.v !== 1) throw new Error('Эта версия ссылки не поддерживается')
  let scenario: ScenarioDefinition
  if (envelope.base) {
    const preset = getPreset(envelope.base.id)
    if (!preset || preset.version !== envelope.base.version) throw new Error('Нужная версия пресета недоступна')
    const differ = new DiffMatchPatch()
    const [text, applied] = differ.patch_apply(differ.patch_fromText(envelope.patch ?? ''), JSON.stringify(preset.scenario))
    if (!applied.every(Boolean)) throw new Error('Не удалось применить изменения пресета')
    scenario = JSON.parse(text) as ScenarioDefinition
  } else {
    if (!envelope.scenario) throw new Error('В ссылке нет сценария')
    scenario = envelope.scenario
  }
  if (scenario.formatVersion !== 1 || typeof scenario.schemaSql !== 'string' || typeof scenario.notes !== 'string') throw new Error('Некорректный сценарий')
  if (await hashScenario(scenario) !== envelope.hash) throw new Error('Контрольная сумма сценария не совпала')
  return scenario
}

export type BackupFile = {
  app: 'sql-lab'
  formatVersion: 1
  exportedAt: string
  workspace: Workspace
  queries: SavedQuery[]
  runs: QueryRun[]
  dump: string
}

export function makeBackup(workspace: Workspace, queries: SavedQuery[], runs: QueryRun[], dump: string): BackupFile {
  return { app: 'sql-lab', formatVersion: 1, exportedAt: new Date().toISOString(), workspace, queries, runs, dump }
}

export function parseBackup(text: string): BackupFile {
  const backup = JSON.parse(text) as BackupFile
  if (backup.app !== 'sql-lab' || backup.formatVersion !== 1 || typeof backup.dump !== 'string' || !backup.workspace?.id || !backup.workspace.scenario) throw new Error('Это не поддерживаемый файл SQL Lab')
  return backup
}
