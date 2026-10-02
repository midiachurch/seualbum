'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileText, Images, Loader2, Printer, Send } from 'lucide-react'
import { zipSync } from 'fflate'
import { Button } from '@/components/ui/button'
import { MODAL_ACOES, Modal } from '@/components/ui/modal'
import { carregarImagem, renderizarLamina, renderizarLaminaParaTela } from '@/lib/album/exportar'
import { montarPdf } from '@/lib/album/pdf'
import { renovarLinksDasFotos } from '@/lib/actions/album-editor'
import { criarVersaoComLaminas } from '@/lib/actions/projetos'
import { createClient } from '@/lib/supabase/client'
import { rotuloDaLamina, type DocumentoAlbum, type Geometria } from '@/lib/album/documento'
import type { Problema } from '@/lib/album/verificacao'
import { cn } from '@/lib/utils'
import { novoUuid } from '@/store/usePedidoWizardStore'

type Formato = 'versao' | 'zip-producao' | 'pdf-producao' | 'pdf-visualizacao' | 'zip-visualizacao'

type Fase =
  | { etapa: 'pronto' }
  | { etapa: 'gerando'; feitas: number; total: number }
  | { etapa: 'enviando'; feitas: number; total: number }
  | { etapa: 'registrando' }
  | { etapa: 'concluido'; numero?: number; arquivo?: string }
  | { etapa: 'erro'; mensagem: string }

const UPLOADS_SIMULTANEOS = 2
const LARGURA_VISUALIZACAO_PX = 2400

function nomeDeArquivo(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'album'
  )
}

function baixar(dados: BlobPart, tipo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const OPCOES: { formato: Exclude<Formato, 'versao'>; titulo: string; descricao: string; icone: typeof Printer }[] = [
  { formato: 'zip-producao', titulo: 'Imagens para produção', descricao: 'Um JPG por lâmina, 300 DPI, com sangria — dos arquivos originais (ZIP).', icone: Printer },
  { formato: 'pdf-producao', titulo: 'PDF para produção', descricao: 'Uma página por lâmina no tamanho real, com sangria, 300 DPI.', icone: FileText },
  { formato: 'pdf-visualizacao', titulo: 'PDF de visualização', descricao: 'Leve, sem sangria — para mandar ao cliente ou conferir.', icone: FileText },
  { formato: 'zip-visualizacao', titulo: 'Imagens de visualização', descricao: 'JPGs leves sem sangria, para redes ou apresentação (ZIP).', icone: Images },
]

/**
 * Publicar (álbum de projeto → nova versão na esteira) e Exportar (qualquer
 * álbum → arquivos). As lâminas são geradas uma de cada vez (cada uma pode
 * ter ~25 megapixels). Produção usa os ORIGINAIS; visualização usa as prévias.
 * Cor em sRGB: a conversão para o perfil da gráfica fica com a produção.
 */
export function Publicar({
  aberto,
  onFechar,
  albumId,
  nome,
  projeto,
  documento,
  geometria,
  problemas,
  urlsOriginais,
  urlsPreview,
  finalizado,
  antesDePublicar,
}: {
  aberto: boolean
  onFechar: () => void
  albumId: string
  nome: string
  projeto: { id: string; numero: number } | null
  documento: DocumentoAlbum
  geometria: Geometria
  problemas: Problema[]
  urlsOriginais: Map<string, string>
  urlsPreview: Map<string, string>
  finalizado: boolean
  /** Garante o salvamento do que está na tela antes de gerar. */
  antesDePublicar: () => Promise<boolean>
}) {
  const [formato, setFormato] = useState<Formato>(projeto ? 'versao' : 'zip-producao')
  const [fase, setFase] = useState<Fase>({ etapa: 'pronto' })
  const [comentarios, setComentarios] = useState('')
  const erros = problemas.filter((p) => p.nivel === 'erro').length
  const avisos = problemas.filter((p) => p.nivel === 'aviso').length
  const ocupado = fase.etapa === 'gerando' || fase.etapa === 'enviando' || fase.etapa === 'registrando'
  const producao = formato === 'versao' || formato === 'zip-producao' || formato === 'pdf-producao'
  const nLaminas = documento.laminas.length

  async function gerar(alta: boolean) {
    const urls = new Map(alta ? urlsOriginais : urlsPreview)
    if (alta) {
      const links = await renovarLinksDasFotos(albumId)
      if (links.ok) for (const [id, url] of Object.entries(links.urls)) urls.set(id, url)
    }
    const saida: { blob: Blob; largura: number; altura: number }[] = []
    for (let i = 0; i < nLaminas; i++) {
      setFase({ etapa: 'gerando', feitas: i, total: nLaminas })
      // Cache só dentro da lâmina: segurar 100 originais na memória derruba a aba.
      const cache = new Map<string, Promise<HTMLImageElement>>()
      const imagem = (fotoId: string) => {
        const url = urls.get(fotoId) ?? urlsOriginais.get(fotoId)
        if (!url) return Promise.reject(new Error('Uma foto do álbum não foi encontrada.'))
        if (!cache.has(fotoId)) cache.set(fotoId, carregarImagem(url))
        return cache.get(fotoId)!
      }
      saida.push(alta ? await renderizarLamina(documento.laminas[i], geometria, imagem) : await renderizarLaminaParaTela(documento.laminas[i], geometria, imagem, LARGURA_VISUALIZACAO_PX))
    }
    return saida
  }

  const rotuloArquivo = (i: number) => `${String(i + 1).padStart(3, '0')}-${nomeDeArquivo(rotuloDaLamina(i, documento.primeiraEhCapa, false))}.jpg`

  async function executar() {
    try {
      if (!(await antesDePublicar())) {
        setFase({ etapa: 'erro', mensagem: 'Não foi possível salvar o álbum antes de gerar. Confira a conexão e tente de novo.' })
        return
      }
      const blobs = await gerar(producao)
      const base = nomeDeArquivo(nome)

      if (formato === 'zip-producao' || formato === 'zip-visualizacao') {
        setFase({ etapa: 'registrando' })
        const arquivos: Record<string, Uint8Array> = {}
        for (let i = 0; i < blobs.length; i++) arquivos[rotuloArquivo(i)] = new Uint8Array(await blobs[i].blob.arrayBuffer())
        // JPG já é comprimido: o ZIP só empacota (level 0).
        const arquivo = `${base}-${formato === 'zip-producao' ? 'producao' : 'visualizacao'}.zip`
        baixar(zipSync(arquivos, { level: 0 }) as BlobPart, 'application/zip', arquivo)
        setFase({ etapa: 'concluido', arquivo })
        return
      }

      if (formato === 'pdf-producao' || formato === 'pdf-visualizacao') {
        setFase({ etapa: 'registrando' })
        const comSangria = formato === 'pdf-producao'
        const larguraMm = geometria.laminaW + (comSangria ? 2 * geometria.sangria : 0)
        const alturaMm = geometria.laminaH + (comSangria ? 2 * geometria.sangria : 0)
        const paginas = []
        for (const b of blobs) paginas.push({ jpeg: new Uint8Array(await b.blob.arrayBuffer()), larguraPx: b.largura, alturaPx: b.altura, larguraMm, alturaMm })
        const arquivo = `${base}-${comSangria ? 'producao' : 'visualizacao'}.pdf`
        baixar(montarPdf(paginas, nome) as BlobPart, 'application/pdf', arquivo)
        setFase({ etapa: 'concluido', arquivo })
        return
      }

      // Publicar versão do projeto: sobe na pasta da versão e passa pela mesma Server Action do upload manual.
      if (!projeto) return
      const supabase = createClient()
      const lote = novoUuid()
      const pasta = `${projeto.id}/versoes/${lote}`
      const caminhos: string[] = new Array(blobs.length)
      let feitas = 0
      let falhou = false
      const fila = blobs.map((b, i) => ({ ...b, i }))
      setFase({ etapa: 'enviando', feitas: 0, total: blobs.length })
      await Promise.all(
        Array.from({ length: UPLOADS_SIMULTANEOS }, async () => {
          while (fila.length > 0 && !falhou) {
            const item = fila.shift()!
            const path = `${pasta}/${String(item.i + 1).padStart(3, '0')}-lamina.jpg`
            const { error } = await supabase.storage.from('projetos_fotos').upload(path, item.blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' })
            if (error) {
              falhou = true
              return
            }
            caminhos[item.i] = path
            feitas++
            setFase({ etapa: 'enviando', feitas, total: blobs.length })
          }
        }),
      )
      if (falhou) throw new Error('Uma lâmina não subiu. Confira a conexão e publique de novo.')
      setFase({ etapa: 'registrando' })
      const versao = await criarVersaoComLaminas({
        projetoId: projeto.id,
        lote,
        comentarios: comentarios.trim() || 'Versão gerada no editor de álbum.',
        primeiraEhCapa: documento.primeiraEhCapa,
        laminas: blobs.map((b, i) => ({ storagePath: caminhos[i], ordem: i + 1, largura: b.largura, altura: b.altura })),
      })
      setFase({ etapa: 'concluido', numero: versao.numero })
    } catch (e) {
      setFase({ etapa: 'erro', mensagem: e instanceof Error ? e.message : 'Não foi possível concluir.' })
    }
  }

  function fechar() {
    if (ocupado) return
    setFase({ etapa: 'pronto' })
    onFechar()
  }

  return (
    <Modal open={aberto} onClose={fechar} title={projeto ? 'Publicar e exportar' : 'Exportar álbum'} className="sm:max-w-xl">
      <div className="space-y-4 text-sm">
        {fase.etapa === 'concluido' ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {fase.numero ? `Versão ${fase.numero} criada com ${nLaminas} lâmina(s) e enviada para a revisão interna.` : `Arquivo ${fase.arquivo} baixado.`}
            </p>
            <div className={MODAL_ACOES}>
              {fase.numero && projeto ? (
                <Button asChild variant="outline">
                  <Link href={`/admin/projetos/${projeto.id}/prova`}>Ver na prova</Link>
                </Button>
              ) : null}
              <Button variant="brand" onClick={fechar}>
                Voltar ao editor
              </Button>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="space-y-1.5" disabled={ocupado}>
              <legend className="sr-only">O que gerar</legend>
              {projeto ? (
                <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', formato === 'versao' && 'border-[#171717] bg-secondary/50')}>
                  <input type="radio" name="formato" checked={formato === 'versao'} onChange={() => setFormato('versao')} className="mt-1" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Send className="h-4 w-4" aria-hidden /> Publicar versão no projeto #{projeto.numero}
                    </span>
                    <span className="block text-xs text-muted-foreground">JPGs de 300 DPI → próxima versão → revisão interna → prova do cliente.</span>
                  </span>
                </label>
              ) : null}
              {OPCOES.map((o) => (
                <label key={o.formato} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', formato === o.formato && 'border-[#171717] bg-secondary/50')}>
                  <input type="radio" name="formato" checked={formato === o.formato} onChange={() => setFormato(o.formato)} className="mt-1" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <o.icone className="h-4 w-4" aria-hidden /> {o.titulo}
                    </span>
                    <span className="block text-xs text-muted-foreground">{o.descricao}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {producao && !projeto && !finalizado ? (
              <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">O álbum ainda não foi finalizado: o arquivo de produção sai desta versão em edição.</p>
            ) : null}
            {erros + avisos > 0 ? (
              <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Verificação: {erros > 0 ? `${erros} erro(s)` : ''}
                  {erros > 0 && avisos > 0 ? ' e ' : ''}
                  {avisos > 0 ? `${avisos} ponto(s) de atenção` : ''}.
                </p>
                <p className="mt-1 text-xs">Dá para gerar mesmo assim, mas vale revisar no painel “Verificar”.</p>
              </div>
            ) : null}
            {formato === 'versao' ? (
              <label className="block">
                <span className="text-xs text-muted-foreground">Comentários para a revisão interna</span>
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={2}
                  disabled={ocupado}
                  className="mt-1 block w-full resize-y rounded-xl border border-[#D4D4D4] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                />
              </label>
            ) : null}
            {ocupado ? (
              <p role="status" className="flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {fase.etapa === 'gerando'
                  ? `Gerando lâmina ${fase.feitas + 1} de ${fase.total}…`
                  : fase.etapa === 'enviando'
                    ? `Enviando ${fase.feitas} de ${fase.total}…`
                    : formato === 'versao'
                      ? 'Registrando a versão…'
                      : 'Montando o arquivo…'}
              </p>
            ) : null}
            {fase.etapa === 'erro' ? (
              <p role="alert" className="flex items-start gap-2 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {fase.mensagem}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">Mantenha esta aba aberta até terminar — as lâminas são geradas no seu navegador. Cor em sRGB.</p>
            <div className={MODAL_ACOES}>
              <Button variant="outline" onClick={fechar} disabled={ocupado}>
                Cancelar
              </Button>
              <Button variant="brand" onClick={executar} disabled={ocupado}>
                {formato === 'versao' ? <Send className="h-4 w-4" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                {formato === 'versao' ? 'Publicar versão' : 'Gerar e baixar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
