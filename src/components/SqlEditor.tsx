import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import { autocompletion } from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { SchemaInfo } from '../types'

const popularKeywords = new Set(['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'GROUP BY', 'ORDER BY'])

export type SqlEditorHandle = {
  insert: (text: string) => void
  focus: () => void
}

type Props = {
  value: string
  onChange: (value: string) => void
  schema: SchemaInfo
  dark: boolean
  onRun: () => void
  onSave: () => void
  label?: string
}

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor(
  { value, onChange, schema, dark, onRun, onSave, label = 'SQL-редактор' }, ref,
) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const viewRef = useRef<EditorView | null>(null)
  const handlersRef = useRef({ onRun, onSave })
  handlersRef.current = { onRun, onSave }
  const schemaNamespace = useMemo(() => Object.fromEntries(schema.tables.map((table) => [
    table.name,
    {
      self: { label: table.name, type: 'table' },
      children: table.columns.map((column) => ({ label: column.name, type: 'column', detail: column.dataType })),
    },
  ])), [schema])
  const extensions = useMemo(() => [
    Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: () => { handlersRef.current.onRun(); return true } },
      { key: 'Mod-s', run: () => { handlersRef.current.onSave(); return true } },
    ])),
    sql({
      dialect: PostgreSQL,
      schema: schemaNamespace,
      upperCaseKeywords: true,
      keywordCompletion: (keyword) => ({ label: keyword, type: 'keyword', boost: popularKeywords.has(keyword) ? 90 : 0 }),
    }),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 30,
      icons: false,
      optionClass: (completion) => `sql-completion sql-completion-${completion.type || 'text'}`,
    }),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': label }),
  ], [schemaNamespace, label])

  useImperativeHandle(ref, () => ({
    insert(text) {
      const view = viewRef.current
      if (!view) return
      const from = view.state.selection.main.from
      view.dispatch(view.state.update({ changes: { from, to: view.state.selection.main.to, insert: text }, selection: { anchor: from + text.length } }))
      view.focus()
    },
    focus() { viewRef.current?.focus() },
  }), [])

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      onCreateEditor={(view) => { viewRef.current = view }}
      extensions={extensions}
      theme={dark ? 'dark' : 'light'}
      height="100%"
      minHeight="220px"
      basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false }}
      aria-label={label}
      className="sql-editor h-full min-h-0 overflow-hidden text-[13px]"
    />
  )
})
