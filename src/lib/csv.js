// CSV export: UTF-8 with BOM so Excel opens non-English text correctly.

const FORMULA_START = /^[=+\-@\t\r]/

/** Quote a cell and stop spreadsheets from treating text as a formula. */
export function csvCell(value) {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','))
  return '﻿' + [header, ...body].join('\r\n') + '\r\n'
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'keywords'
}
