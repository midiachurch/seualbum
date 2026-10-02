import { DPI_MINIMO } from '@/lib/resolucao'
import { LIMITE_ESTOURO } from '@/lib/album/ajustes'
import { alturaDoTexto } from '@/lib/album/texto'
import { caixaRotacionada, dpiDoQuadro, rotuloDaLamina, type DocumentoAlbum, type Geometria } from '@/lib/album/documento'

/**
 * Verificação de impressão ("pre-flight") do álbum inteiro, em três níveis:
 *   - `erro`: sai errado com certeza (em branco, fora da área, texto cortado)
 *     — impede FINALIZAR (enviar para o cliente ainda pode);
 *   - `aviso` (atenção): vale olhar (resolução, estouro, corte, dobra);
 *   - `info`: recomendação (fotos não usadas, repetidas).
 * `laminaIndice` −1 = álbum inteiro. Elementos ocultos não contam.
 */

export type NivelProblema = 'erro' | 'aviso' | 'info'

export type Problema = {
  nivel: NivelProblema
  laminaIndice: number
  elementoId?: string
  /** Problemas do álbum inteiro que abrem outra tela (ex.: biblioteca filtrada). */
  acao?: 'fotos-nao-usadas'
  mensagem: string
}

const FOLGA_MM = 0.5
const LADO_MINIMO_MM = 20

type Dimensoes = Map<string, { largura: number | null; altura: number | null; estouro?: number | null }>

export function verificarAlbum(doc: DocumentoAlbum, g: Geometria, dimensoes: Dimensoes): Problema[] {
  const problemas: Problema[] = []
  const usos = new Map<string, number[]>()
  const rotulo = (i: number) => rotuloDaLamina(i, doc.primeiraEhCapa, false)

  doc.laminas.forEach((lamina, li) => {
    if (lamina.quadros.length === 0 && lamina.textos.length === 0 && lamina.formas.length === 0 && !lamina.fundoImagem) {
      problemas.push({ nivel: 'erro', laminaIndice: li, mensagem: 'Lâmina sem conteúdo.' })
      return
    }

    if (lamina.fundoImagem) {
      const d = dimensoes.get(lamina.fundoImagem.fotoId)
      usos.set(lamina.fundoImagem.fotoId, [...(usos.get(lamina.fundoImagem.fotoId) ?? []), li])
      if (d?.largura && d.altura) {
        const total = { w: g.laminaW + 2 * g.sangria, h: g.laminaH + 2 * g.sangria, recorte: { zoom: 1, cx: 0.5, cy: 0.5 } }
        const dpi = dpiDoQuadro(total, d.largura, d.altura)
        if (dpi < DPI_MINIMO) problemas.push({ nivel: 'aviso', laminaIndice: li, mensagem: `Imagem de fundo com ${dpi} DPI (mínimo ${DPI_MINIMO}).` })
      }
    }

    for (const q of lamina.quadros) {
      if (q.oculto) continue
      if (!q.fotoId) {
        problemas.push({ nivel: 'erro', laminaIndice: li, elementoId: q.id, mensagem: 'Quadro sem foto — sai em branco na impressão.' })
        continue
      }
      usos.set(q.fotoId, [...(usos.get(q.fotoId) ?? []), li])

      const d = dimensoes.get(q.fotoId)
      if (d?.largura && d.altura) {
        const dpi = dpiDoQuadro(q, d.largura, d.altura)
        if (dpi < DPI_MINIMO) {
          problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: q.id, mensagem: `Foto com ${dpi} DPI (mínimo ${DPI_MINIMO}) — pode sair sem nitidez.` })
        }
      }
      if (d?.estouro != null && d.estouro > LIMITE_ESTOURO) {
        problemas.push({
          nivel: 'aviso',
          laminaIndice: li,
          elementoId: q.id,
          mensagem: `Foto estourada: ${Math.round(d.estouro * 100)}% das altas luzes sem detalhe.`,
        })
      }
      if (Math.min(q.w, q.h) < LADO_MINIMO_MM) {
        problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: q.id, mensagem: `Quadro muito pequeno (${Math.round(Math.min(q.w, q.h))} mm) — a foto some na impressão.` })
      }

      const c = caixaRotacionada(q)
      if (c.x + c.w <= 0 || c.y + c.h <= 0 || c.x >= g.laminaW || c.y >= g.laminaH) {
        problemas.push({ nivel: 'erro', laminaIndice: li, elementoId: q.id, mensagem: 'Imagem fora da área permitida — não aparece na impressão.' })
        continue
      }

      // Cada borda: ou fica dentro da área segura, ou vai até o fim da sangria.
      const bordas = [
        { nome: 'esquerda', dentro: c.x },
        { nome: 'direita', dentro: g.laminaW - (c.x + c.w) },
        { nome: 'de cima', dentro: c.y },
        { nome: 'de baixo', dentro: g.laminaH - (c.y + c.h) },
      ]
      for (const b of bordas) {
        if (b.dentro <= -g.sangria + FOLGA_MM || b.dentro >= g.margem) continue
        problemas.push(
          b.dentro <= FOLGA_MM
            ? { nivel: 'aviso', laminaIndice: li, elementoId: q.id, mensagem: `Borda ${b.nome} encosta no corte sem chegar à sangria — risco de filete branco.` }
            : { nivel: 'aviso', laminaIndice: li, elementoId: q.id, mensagem: `Borda ${b.nome} dentro da margem de corte (${g.margem} mm) — pode ser cortada.` },
        )
      }

      if (c.x < g.paginaW - FOLGA_MM && c.x + c.w > g.paginaW + FOLGA_MM) {
        problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: q.id, mensagem: 'Foto atravessa a dobra — confira se nenhum rosto cai no meio.' })
      }
    }

    for (const t of lamina.textos) {
      if (t.oculto) continue
      if (!t.texto.trim()) {
        problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: t.id, mensagem: 'Caixa de texto vazia.' })
        continue
      }
      const c = caixaRotacionada({ ...t, h: alturaDoTexto(t) })
      const foraDaSegura = c.x < g.margem || c.y < g.margem || c.x + c.w > g.laminaW - g.margem || c.y + c.h > g.laminaH - g.margem
      if (c.x + c.w <= 0 || c.y + c.h <= 0 || c.x >= g.laminaW || c.y >= g.laminaH) {
        problemas.push({ nivel: 'erro', laminaIndice: li, elementoId: t.id, mensagem: 'Texto fora da lâmina.' })
      } else if (c.x < 0 || c.y < 0 || c.x + c.w > g.laminaW || c.y + c.h > g.laminaH) {
        problemas.push({ nivel: 'erro', laminaIndice: li, elementoId: t.id, mensagem: 'Texto cortado: passa da linha de corte.' })
      } else if (foraDaSegura) {
        problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: t.id, mensagem: 'Texto próximo da área de corte.' })
      }
      if (c.x < g.paginaW && c.x + c.w > g.paginaW) {
        problemas.push({ nivel: 'aviso', laminaIndice: li, elementoId: t.id, mensagem: 'Texto em cima da dobra.' })
      }
    }
  })

  for (const [, laminas] of usos) {
    if (laminas.length > 1) {
      const onde = [...new Set(laminas)].map(rotulo).join(', ')
      problemas.push({ nivel: 'info', laminaIndice: laminas[1], mensagem: `A mesma foto aparece ${laminas.length} vezes (${onde}).` })
    }
  }

  const naoUsadas = [...dimensoes.keys()].filter((id) => !usos.has(id)).length
  if (naoUsadas > 0) {
    problemas.push({
      nivel: 'info',
      laminaIndice: -1,
      acao: 'fotos-nao-usadas',
      mensagem: `${naoUsadas} foto(s) da biblioteca não foram usadas no álbum.`,
    })
  }

  const ordem: Record<NivelProblema, number> = { erro: 0, aviso: 1, info: 2 }
  return problemas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || a.laminaIndice - b.laminaIndice)
}
