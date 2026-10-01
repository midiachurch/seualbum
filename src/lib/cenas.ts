/**
 * Agrupamento das fotos em CENAS e MOMENTOS pela data/hora de captura (EXIF
 * lido no navegador no upload — lib/exif, migration 0025). Função pura, sem
 * rede: roda na tela do designer sobre todas as fotos do projeto.
 *
 *   * Cena (cerimônia, festa, making of…): começa quando há um intervalo
 *     maior que `limiarCenaMin` (15 min) entre duas fotos seguidas.
 *   * Momento (candidato a uma lâmina): fotos a menos de `limiarMomentoSeg`
 *     (90 s) umas das outras — rajadas, a mesma pose, o mesmo gesto.
 *   * Duas câmeras com relógios diferentes (segundo fotógrafo): antes de
 *     agrupar, estima a diferença de cada câmera secundária em relação à
 *     principal alinhando os picos de atividade das duas linhas do tempo
 *     (minuto a minuto, até ±3 h). Só corrige quando o alinhamento é claro.
 *   * Sem EXIF: grupo "Sem data", na ordem em que chegaram — nunca inventa hora.
 *
 * As horas são as do relógio da câmera (sem fuso): tratamos tudo como UTC só
 * para fazer conta, e mostramos de volta em UTC — "14:32" é o que a câmera marcou.
 */

export type FotoDatada = { id: string; capturadaEm?: string | null; camera?: string | null }

export type Cena<T> = {
  numero: number
  inicio: string
  fim: string
  fotos: T[]
  momentos: T[][]
  cameras: string[]
}

export type ResultadoCenas<T> = {
  cenas: Cena<T>[]
  semData: T[]
  /** Câmeras cujo relógio foi corrigido: câmera → minutos somados. */
  ajustesDeRelogio: { camera: string; minutos: number }[]
}

const MIN = 60_000

function instante(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(`${iso.length === 19 ? `${iso}.000` : iso}Z`)
  return Number.isNaN(t) ? null : t
}

/**
 * Diferença (em minutos) a somar na câmera secundária para alinhar com a
 * principal. Compara histogramas por minuto; aceita só se o melhor
 * deslocamento for claramente melhor que "nenhum" e tiver amostra suficiente.
 */
function estimarDeslocamento(principal: number[], secundaria: number[]): number {
  if (principal.length < 10 || secundaria.length < 10) return 0
  const minuto = (t: number) => Math.floor(t / MIN)
  const hp = new Map<number, number>()
  for (const t of principal) hp.set(minuto(t), (hp.get(minuto(t)) ?? 0) + 1)
  const hs = new Map<number, number>()
  for (const t of secundaria) hs.set(minuto(t), (hs.get(minuto(t)) ?? 0) + 1)

  // Janela de ±2 min em volta de cada minuto: o segundo fotógrafo não dispara
  // exatamente no mesmo segundo, mas cobre o mesmo momento.
  const pontuar = (desloc: number) => {
    let s = 0
    for (const [m, n] of hs) {
      let vizinhos = 0
      for (let d = -2; d <= 2; d++) vizinhos += hp.get(m + desloc + d) ?? 0
      s += Math.min(n, vizinhos)
    }
    return s
  }

  const semAjuste = pontuar(0)
  const notas = new Map<number, number>()
  for (let d = -180; d <= 180; d++) notas.set(d, d === 0 ? semAjuste : pontuar(d))
  const melhorNota = Math.max(...notas.values())
  // Vários deslocamentos podem empatar: a janela de ±2 min cria "platôs", e
  // eventos repetitivos criam platôs em lugares diferentes (as fotos da
  // câmera 2 cabem tanto na cerimônia quanto na festa). Entre os platôs, fica
  // o mais perto de zero (relógio fora por minutos/1 h é o comum) e, dentro
  // dele, o centro.
  const empatados = [...notas.entries()].filter(([, n]) => n === melhorNota).map(([d]) => d)
  const plats: number[][] = []
  for (const d of empatados) {
    const ultimo = plats[plats.length - 1]
    if (ultimo && d - ultimo[ultimo.length - 1] === 1) ultimo.push(d)
    else plats.push([d])
  }
  const centro = (p: number[]) => p[Math.floor(p.length / 2)]
  const plato = plats.sort((x, y) => Math.abs(centro(x)) - Math.abs(centro(y)))[0]
  const melhor = plato.includes(0) ? 0 : centro(plato)
  // Conservador: só corrige se o alinhamento for bem melhor e o relógio
  // estiver pelo menos 3 min fora (menos que isso não muda o agrupamento).
  const claramenteMelhor = melhorNota >= Math.max(semAjuste * 1.5, secundaria.length * 0.3)
  return Math.abs(melhor) >= 3 && claramenteMelhor ? melhor : 0
}

export function agruparPorCena<T extends FotoDatada>(
  fotos: T[],
  { limiarCenaMin = 15, limiarMomentoSeg = 90 }: { limiarCenaMin?: number; limiarMomentoSeg?: number } = {},
): ResultadoCenas<T> {
  const datadas: { foto: T; t: number; camera: string }[] = []
  const semData: T[] = []
  for (const foto of fotos) {
    const t = instante(foto.capturadaEm)
    if (t === null) semData.push(foto)
    else datadas.push({ foto, t, camera: foto.camera?.trim() || 'Câmera não identificada' })
  }
  if (datadas.length === 0) return { cenas: [], semData, ajustesDeRelogio: [] }

  // Relógios: a câmera com mais fotos é a referência.
  const porCamera = new Map<string, number[]>()
  for (const d of datadas) porCamera.set(d.camera, [...(porCamera.get(d.camera) ?? []), d.t])
  const [principal] = [...porCamera.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const ajustesDeRelogio: { camera: string; minutos: number }[] = []
  for (const [camera, tempos] of porCamera) {
    if (camera === principal || camera === 'Câmera não identificada') continue
    const minutos = estimarDeslocamento(porCamera.get(principal)!, tempos)
    if (minutos !== 0) ajustesDeRelogio.push({ camera, minutos })
  }
  const ajuste = new Map(ajustesDeRelogio.map((a) => [a.camera, a.minutos * MIN]))
  for (const d of datadas) d.t += ajuste.get(d.camera) ?? 0

  datadas.sort((a, b) => a.t - b.t)

  const cenas: Cena<T>[] = []
  let atual: typeof datadas = []
  const fechar = () => {
    if (atual.length === 0) return
    const momentos: T[][] = []
    let momento: T[] = []
    atual.forEach((d, i) => {
      if (i > 0 && d.t - atual[i - 1].t > limiarMomentoSeg * 1000) {
        momentos.push(momento)
        momento = []
      }
      momento.push(d.foto)
    })
    momentos.push(momento)
    cenas.push({
      numero: cenas.length + 1,
      inicio: new Date(atual[0].t).toISOString(),
      fim: new Date(atual[atual.length - 1].t).toISOString(),
      fotos: atual.map((d) => d.foto),
      momentos,
      cameras: [...new Set(atual.map((d) => d.camera))],
    })
    atual = []
  }
  for (const d of datadas) {
    if (atual.length > 0 && d.t - atual[atual.length - 1].t > limiarCenaMin * MIN) fechar()
    atual.push(d)
  }
  fechar()

  return { cenas, semData, ajustesDeRelogio }
}

/** "14:32" do relógio da câmera (as datas são tratadas como UTC só para a conta). */
export function horaDaCena(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
