/**
 * Extração dos metadados de captura de uma foto (EXIF) — pura, sem DOM, para
 * rodar tanto no Web Worker quanto na thread principal (fallback).
 *
 * Só lemos o necessário para agrupar cenas: data/hora de captura e câmera.
 * GPS e demais dados pessoais nem são pedidos à biblioteca. O `exifr` lê só
 * o começo do arquivo (os segmentos de metadados), não a foto inteira.
 *
 * O horário é guardado como o RELÓGIO DA CÂMERA marcou ("2026-09-20T14:32:05.120"),
 * sem fuso: o agrupamento só depende da diferença entre fotos, e o designer
 * vê a mesma hora que está na câmera, de onde estiver.
 */
import exifr from 'exifr'

export type MetadadosFoto = {
  /** Data/hora local da câmera, ISO sem fuso (ou null se a foto não tiver EXIF). */
  capturadaEm: string | null
  /** "Canon EOS R6 #001234" — modelo + fim do número de série, para separar 2 câmeras. */
  camera: string | null
}

const CAMPOS = ['DateTimeOriginal', 'SubSecTimeOriginal', 'CreateDate', 'Make', 'Model', 'BodySerialNumber', 'SerialNumber']

/** "2026:09:20 14:32:05" (+ subsegundos "12") → "2026-09-20T14:32:05.120" */
export function normalizarDataExif(bruto: unknown, subsegundos?: unknown): string | null {
  if (bruto instanceof Date) {
    // Alguns formatos (HEIC/XMP) chegam já como Date: usa a leitura local.
    if (Number.isNaN(bruto.getTime())) return null
    const p = (n: number, t = 2) => String(n).padStart(t, '0')
    return `${bruto.getFullYear()}-${p(bruto.getMonth() + 1)}-${p(bruto.getDate())}T${p(bruto.getHours())}:${p(bruto.getMinutes())}:${p(bruto.getSeconds())}.${p(bruto.getMilliseconds(), 3)}`
  }
  if (typeof bruto !== 'string') return null
  const m = bruto.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, ano, mes, dia, h, min, s] = m
  // Câmera sem data configurada grava 0000:00:00 ou 1970 — não serve para agrupar.
  if (Number(ano) < 1990 || Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1) return null
  const ms = String(subsegundos ?? '').replace(/\D/g, '').slice(0, 3).padEnd(3, '0')
  return `${ano}-${mes}-${dia}T${h}:${min}:${s}.${ms}`
}

export async function extrairMetadados(arquivo: Blob): Promise<MetadadosFoto> {
  try {
    const t = (await exifr.parse(arquivo, { pick: CAMPOS, reviveValues: false, translateValues: false })) as
      | Record<string, unknown>
      | undefined
    if (!t) return { capturadaEm: null, camera: null }
    const capturadaEm = normalizarDataExif(t.DateTimeOriginal ?? t.CreateDate, t.SubSecTimeOriginal)
    const partes = [t.Make, t.Model].filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())
    // "Canon" + "Canon EOS R6" → só "Canon EOS R6"
    // ("NIKON CORPORATION" + "NIKON Z 6" → "NIKON Z 6"): basta a 1ª palavra da marca.
    const marca = partes.length === 2 ? partes[0].split(/\s+/)[0].toLowerCase() : ''
    const modelo = partes.length === 2 && partes[1].toLowerCase().startsWith(marca) ? partes[1] : partes.join(' ')
    const serie = [t.BodySerialNumber, t.SerialNumber].find((v): v is string => typeof v === 'string' && v.trim() !== '')
    const camera = modelo ? `${modelo}${serie ? ` #${serie.trim().slice(-6)}` : ''}`.slice(0, 80) : null
    return { capturadaEm, camera }
  } catch {
    // Arquivo sem EXIF, corrompido ou formato não suportado: segue sem data.
    return { capturadaEm: null, camera: null }
  }
}
