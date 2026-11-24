/** Gerador mínimo de iCalendar (RFC 5545) para "Adicionar ao calendário". Horários sempre em UTC. */
export type EventoIcs = { uid: string; inicio: string; fim: string; resumo: string; descricao?: string | null; local?: string | null; agora?: Date }

const dois = (n: number) => String(n).padStart(2, '0')
export function formatarUtc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error('Data inválida para o evento.')
  return `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}Z`
}

/** Escapa TEXT: barra, ponto e vírgula, vírgula e quebras de linha (impede injetar campos). */
export function escaparTexto(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

/** Dobra linhas em 75 octetos, sem partir um caractere multibyte. */
export function dobrarLinha(linha: string): string {
  const bytes = new TextEncoder()
  if (bytes.encode(linha).length <= 75) return linha
  const partes: string[] = []
  let atual = ''
  let limite = 75
  for (const ch of linha) {
    if (bytes.encode(atual + ch).length > limite) { partes.push(atual); atual = ch; limite = 74 } else atual += ch
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

export function gerarIcs(e: EventoIcs): string {
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SeuAlbum//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.uid.replace(/[^A-Za-z0-9@._-]/g, '')}@seualbum`,
    `DTSTAMP:${formatarUtc((e.agora ?? new Date()).toISOString())}`,
    `DTSTART:${formatarUtc(e.inicio)}`, `DTEND:${formatarUtc(e.fim)}`,
    `SUMMARY:${escaparTexto(e.resumo)}`,
    ...(e.descricao ? [`DESCRIPTION:${escaparTexto(e.descricao)}`] : []),
    ...(e.local ? [`LOCATION:${escaparTexto(e.local)}`] : []),
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ]
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}
