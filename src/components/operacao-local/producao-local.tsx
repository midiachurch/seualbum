'use client'

/* eslint-disable @next/next/no-img-element -- imagens importadas no próprio navegador. */
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Upload, FileCheck2, Check, MessageSquare, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react'
import type { EstadoLocal, GaleriaLocal, ComandoLocal } from '@/lib/operacao-local/modelo'
import { obterProducao, type ComandoProducaoLocal, type LaminaProducaoLocal } from '@/lib/operacao-local/producao'
import { salvarArquivo, lerArquivo, apagarArquivo } from '@/lib/operacao-local/repositorio'
import s from './producao-local.module.css'

type Executar = (comando: ComandoLocal, mensagem?: string) => EstadoLocal | null
const moeda = (c: number | null) => c === null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100)
const horario = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const rotulos = { rascunho: 'Rascunho do fotógrafo', publicada: 'Aguardando revisão do cliente', ajustes: 'Ajustes solicitados', aprovada: 'Álbum aprovado' }

export function ProducaoLocal({ estado, galeria, cliente, executar }: { estado: EstadoLocal; galeria: GaleriaLocal; cliente: boolean; executar: Executar }) {
  const projeto = obterProducao(estado, galeria.id)
  const [selecaoId, setSelecaoId] = useState(galeria.selecoes.at(-1)?.id ?? '')
  const [versaoVistaId, setVersaoVistaId] = useState<string | null>(null)
  const [laminaVistaId, setLaminaVistaId] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [ponto, setPonto] = useState<{ x: number; y: number } | null>(null)
  const [marcando, setMarcando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [confirmar, setConfirmar] = useState<'publicar' | 'aprovar' | 'solicitar_ajustes' | null>(null)
  const [acaoConfirmada, setAcaoConfirmada] = useState<{ comando: ComandoProducaoLocal; numero: number } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const tentativa = useRef<{ payload: string; chave: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const versoes = projeto?.versoes.filter(v => !cliente || v.status !== 'rascunho') ?? []
  const atual = projeto?.versoes.at(-1)
  const versao = versoes.find(v => v.id === versaoVistaId) ?? versoes.at(-1)
  const lamina = versao?.laminas.find(l => l.id === laminaVistaId) ?? versao?.laminas[0]
  const indice = versao?.laminas.findIndex(l => l.id === lamina?.id) ?? -1
  const podeRevisar = versao?.id === atual?.id && versao?.status === 'publicada' && (!cliente || galeria.acesso.ativo)
  const podeEditar = !cliente && versao?.id === atual?.id && versao?.status === 'rascunho'
  const fotosSelecao = galeria.selecoes.find(s => s.id === projeto?.selecaoId)
  const servico = estado.catalogo.find(p => p.id === 'servico-diagramacao' && p.ativo)
  const arquivoIds = projeto?.versoes.flatMap(v => v.laminas).filter(l => l.url.startsWith('arquivo-local:')).map(l => l.id).join('|') ?? ''

  useEffect(() => {
    let cancelado = false
    const temporarias: string[] = []
    void Promise.all(arquivoIds.split('|').filter(Boolean).map(async id => {
      const blob = await lerArquivo(id)
      if (!blob || cancelado) return [id, ''] as const
      const url = URL.createObjectURL(blob); temporarias.push(url); return [id, url] as const
    })).then(itens => { if (!cancelado) setUrls(Object.fromEntries(itens)) }).catch(() => { if (!cancelado) setAviso('Algumas lâminas não puderam ser recuperadas. Reimporte os arquivos no rascunho ou restaure seu backup local.') })
    return () => { cancelado = true; temporarias.forEach(url => URL.revokeObjectURL(url)) }
  }, [arquivoIds])
  useEffect(() => { if (confirmar && !dialog.current?.open) dialog.current?.showModal() }, [confirmar])

  function enviar(comando: ComandoProducaoLocal, mensagem: string) { return executar({ tipo: 'producao', comando }, mensagem) }
  const base = { galeriaId: galeria.id, revisaoEsperada: projeto?.revisao ?? 0, ator: cliente ? 'cliente' as const : 'fotografo' as const }
  function escolher(opcao: 'propria' | 'seualbum') {
    enviar({ ...base, tipo: 'escolher_diagramacao', opcao, selecaoId: selecaoId || galeria.selecoes.at(-1)?.id || '' }, opcao === 'propria' ? 'Diagramação própria registrada para esta seleção.' : 'Solicitação de diagramação registrada localmente, sem cobrança.')
  }
  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []); e.target.value = ''
    if (!versao || !podeEditar || enviando) return
    setEnviando(true); setAviso('')
    let revisao = projeto!.revisao
    const falhas: string[] = []
    for (const arquivo of arquivos) {
      const arquivoId = crypto.randomUUID()
      let salvo = false
      try {
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(arquivo.type) || arquivo.size > 25 * 1024 * 1024) throw new Error('use imagem de até 25 MB')
        const bitmap = await createImageBitmap(arquivo)
        const medidas = { largura: bitmap.width, altura: bitmap.height }; bitmap.close()
        await salvarArquivo(arquivoId, arquivo); salvo = true
        const item: LaminaProducaoLocal = { id: arquivoId, nome: arquivo.name, url: `arquivo-local:${arquivoId}`, bytes: arquivo.size, tipo: arquivo.type, ...medidas }
        const resultado = enviar({ ...base, revisaoEsperada: revisao, tipo: 'adicionar_laminas', versaoId: versao.id, laminas: [item] }, 'Lâmina importada no rascunho local.')
        if (!resultado) throw new Error('o rascunho mudou ou não pôde ser salvo')
        revisao = obterProducao(resultado, galeria.id)!.revisao
        salvo = false
      } catch (erro) {
        if (salvo) { try { await apagarArquivo(arquivoId) } catch { /* Só compensa o arquivo que não entrou no estado. */ } }
        falhas.push(`${arquivo.name}: ${erro instanceof Error ? erro.message : 'falha na importação'}`)
      }
    }
    setEnviando(false); setAviso(falhas.length ? falhas.join(' · ') : `${arquivos.length} lâmina(s) importada(s) neste navegador.`)
  }
  function chavePara(payload: unknown) {
    const serializado = JSON.stringify(payload)
    if (tentativa.current?.payload !== serializado) tentativa.current = { payload: serializado, chave: crypto.randomUUID() }
    return tentativa.current.chave
  }
  function comentar() {
    if (!versao || !lamina || !podeRevisar) return
    const comando = { ...base, tipo: 'comentar' as const, versaoId: versao.id, laminaId: lamina.id, texto, x: ponto?.x, y: ponto?.y }
    if (enviar({ ...comando, chave: chavePara(comando) }, 'Comentário salvo na prova local.')) { setTexto(''); setPonto(null); setMarcando(false); tentativa.current = null }
  }
  function abrirConfirmacao(tipo: 'publicar' | 'aprovar' | 'solicitar_ajustes') {
    if (!versao) return
    const comando = tipo === 'solicitar_ajustes' ? { ...base, tipo, versaoId: versao.id, texto } : { ...base, tipo, versaoId: versao.id }
    setAcaoConfirmada({ comando: { ...comando, chave: chavePara(comando) }, numero: versao.numero })
    setConfirmar(tipo)
  }
  function decidir() {
    if (!acaoConfirmada || !confirmar) return
    if (enviar(acaoConfirmada.comando, confirmar === 'publicar' ? 'Versão publicada para a prévia do cliente.' : confirmar === 'aprovar' ? 'Álbum aprovado no ambiente local.' : 'Pedido de ajustes enviado ao fotógrafo local.')) { tentativa.current = null; setAcaoConfirmada(null); setConfirmar(null); dialog.current?.close(); setTexto(''); setPonto(null) }
  }
  function trocarVersao(id: string) { setVersaoVistaId(id); setLaminaVistaId(null); setPonto(null); setTexto(''); setMarcando(false) }

  if (cliente && !galeria.acesso.ativo) return <section className={s.panel}><h2>Diagramação e prova</h2><p>O acesso local desta galeria foi revogado.</p></section>
  if (!projeto) return <section className={s.panel}><span className={s.eyebrow}>Após a seleção</span><h2>Diagramação e prova do álbum</h2>
    {cliente ? <p>O fotógrafo organizará a produção depois de receber sua seleção. A prova aparecerá aqui quando uma versão for publicada.</p> : !galeria.selecoes.length ? <p>Entregue uma seleção de fotos para iniciar a produção do álbum. Favoritos ainda são um rascunho.</p> : <>
      <p>Escolha como diagramar o álbum. A seleção entregue será preservada como referência da produção.</p>
      <label className={s.field}>Seleção de origem<select value={selecaoId || galeria.selecoes.at(-1)?.id} onChange={e => setSelecaoId(e.target.value)}>{galeria.selecoes.map(v => <option value={v.id} key={v.id}>Revisão {v.revisao} · {v.fotoIds.length} foto(s) · {horario(v.entregueEm)}</option>)}</select></label>
      <div className={s.options}><article><h3>Diagramação própria</h3><p>Diagrame com suas ferramentas e importe as lâminas para revisão do cliente.</p><button className={s.button} onClick={() => escolher('propria')}>Escolher diagramação própria</button></article><article><h3>Serviço SeuAlbum</h3><p>{servico ? `${moeda(servico.precoCentavos)} por solicitação na simulação local.` : 'Serviço indisponível no catálogo.'} A contratação é independente da assinatura.</p><button className={s.secondary} disabled={!servico} onClick={() => escolher('seualbum')}>Solicitar diagramação SeuAlbum</button></article></div>
    </>}
  </section>
  return <section className={s.panel} aria-labelledby="producao-titulo">
    <header className={s.header}><div><span className={s.eyebrow}>Produção do álbum</span><h2 id="producao-titulo">Diagramação e prova</h2><p>{projeto.opcao === 'propria' ? 'Diagramação própria' : `Serviço SeuAlbum · ${moeda(projeto.servico?.precoCentavos ?? null)} registrado`}{fotosSelecao && ` · Seleção revisão ${fotosSelecao.revisao} · ${fotosSelecao.fotoIds.length} foto(s)`}</p></div><span className={s.badge}>{cliente ? 'Prévia do cliente' : 'Modo fotógrafo'} · local</span></header>
    <p className={s.notice}>A seleção entregue, os favoritos e a aprovação do álbum são etapas distintas. Os arquivos e as decisões desta prova ficam neste navegador.</p>
    {projeto.pedidoId && !cliente && <p className={s.muted}>Solicitação de serviço registrada em Pedidos. Estado: {estado.pedidos.find(p => p.id === projeto.pedidoId)?.status.replaceAll('_',' ') ?? 'não disponível'}. Nenhuma cobrança foi realizada.</p>}
    {!cliente && (!atual || atual.status === 'ajustes') && <button className={s.button} onClick={() => { const novo = enviar({ ...base, tipo: 'criar_versao' }, 'Nova versão em rascunho iniciada.'); if (novo) trocarVersao(obterProducao(novo, galeria.id)!.versoes.at(-1)!.id) }}><FileCheck2 size={18} />{atual ? 'Iniciar nova versão após ajustes' : 'Iniciar primeira versão'}</button>}
    {!versao ? <p className={s.empty}>{cliente ? 'O fotógrafo está preparando a prova. Nenhum rascunho interno é exibido nesta prévia.' : 'Inicie uma versão para importar as lâminas diagramadas.'}</p> : <>
      <div className={s.toolbar}><label className={s.field}>Versão da prova<select value={versao.id} onChange={e => trocarVersao(e.target.value)}>{versoes.map(v => <option key={v.id} value={v.id}>Versão {v.numero} · {rotulos[v.status]}</option>)}</select></label><span className={`${s.badge} ${versao.status === 'aprovada' ? s.success : ''}`}>{rotulos[versao.status]}</span></div>
      {versao.id !== atual?.id && <p className={s.notice}>Você está consultando uma versão anterior. Seus arquivos, comentários e decisões permanecem preservados.</p>}
      {podeEditar && <div className={s.toolbar}><input aria-label="Arquivos de lâminas" ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => void importar(e)} /><button className={s.secondary} disabled={enviando} onClick={() => input.current?.click()}><Upload size={18} />{enviando ? 'Importando lâminas…' : 'Importar lâminas diagramadas'}</button><button className={s.button} disabled={enviando || !versao.laminas.length} onClick={() => abrirConfirmacao('publicar')}>Publicar versão para o cliente</button><span className={s.muted}>Até 100 imagens · 25 MB por lâmina</span></div>}
      <div className={s.review}>
        <div className={s.viewer}>
          {lamina ? <><div className={s.imageWrap} onClick={e => { if (!marcando || !podeRevisar) return; const r = e.currentTarget.getBoundingClientRect(); setPonto({ x: Math.round((e.clientX-r.left)/r.width*1000)/10, y: Math.round((e.clientY-r.top)/r.height*1000)/10 }); setMarcando(false) }} style={{ cursor: marcando ? 'crosshair' : undefined }}>
            {lamina.url.startsWith('arquivo-local:') && !urls[lamina.id] ? <p className={s.empty}>Arquivo local indisponível. Restaure-o a partir do seu backup.</p> : <img src={lamina.url.startsWith('arquivo-local:') ? urls[lamina.id] : lamina.url} alt={`Lâmina ${indice + 1}: ${lamina.nome}`} draggable={false} />}
            {versao.comentarios.filter(c => c.laminaId === lamina.id && c.x !== null).map((c, i) => <span key={c.id} className={s.pin} style={{ left: `${c.x}%`, top: `${c.y}%` }} title={c.texto}>{i + 1}</span>)}
            {ponto && <span className={`${s.pin} ${s.newPin}`} style={{ left: `${ponto.x}%`, top: `${ponto.y}%` }} title="Novo comentário"><MapPin size={16} /></span>}
          </div><nav className={s.navigation} aria-label="Navegar lâminas"><button className={s.iconButton} aria-label="Lâmina anterior" disabled={indice <= 0} onClick={() => { setLaminaVistaId(versao.laminas[indice - 1].id); setPonto(null) }}><ChevronLeft size={20} /></button><span>Lâmina {indice + 1} de {versao.laminas.length}</span><button className={s.iconButton} aria-label="Próxima lâmina" disabled={indice >= versao.laminas.length - 1} onClick={() => { setLaminaVistaId(versao.laminas[indice + 1].id); setPonto(null) }}><ChevronRight size={20} /></button></nav><p className={s.filename}>{lamina.nome}</p>{podeEditar && <button className={s.link} disabled={enviando} onClick={() => enviar({ ...base, tipo: 'remover_lamina', versaoId: versao.id, laminaId: lamina.id }, 'Lâmina retirada do rascunho.')}><X size={16} />Retirar lâmina do rascunho</button>}</> : <p className={s.empty}>Importe as lâminas diagramadas para preparar esta versão.</p>}
          {versao.laminas.length > 1 && <div className={s.thumbnails} aria-label="Lâminas desta versão">{versao.laminas.map((l, i) => <button key={l.id} className={l.id === lamina?.id ? s.selectedThumb : s.thumb} aria-label={`Abrir lâmina ${i + 1}`} aria-pressed={l.id === lamina?.id} onClick={() => { setLaminaVistaId(l.id); setPonto(null) }}>{i + 1}</button>)}</div>}
        </div>
        <aside className={s.comments}><h3><MessageSquare size={19} />Comentários desta versão</h3>{!versao.comentarios.length && <p className={s.muted}>Nenhum comentário enviado.</p>}<ol>{versao.comentarios.map(c => <li key={c.id}><strong>{c.ator === 'cliente' ? 'Cliente local' : 'Fotógrafo local'} · lâmina {versao.laminas.findIndex(l => l.id === c.laminaId) + 1}</strong><p>{c.texto}</p>{c.x !== null && <button className={s.link} onClick={() => { setLaminaVistaId(c.laminaId); setPonto(null) }}>Ver posição {c.x}%, {c.y}%</button>}<time dateTime={c.criadoEm}>{horario(c.criadoEm)}</time></li>)}</ol>
          {podeRevisar && <form onSubmit={e => { e.preventDefault(); comentar() }} className={s.form}><label className={s.field}>Comentário sobre a lâmina<textarea value={texto} onChange={e => setTexto(e.target.value)} required maxLength={2000} rows={4} /></label><div className={s.toolbar}><button type="button" className={s.secondary} disabled={!lamina} aria-pressed={marcando} onClick={() => setMarcando(v => !v)}><MapPin size={16} />{marcando ? 'Clique na lâmina' : 'Marcar posição'}</button>{ponto && <button type="button" className={s.link} onClick={() => setPonto(null)}>Limpar posição</button>}</div><button className={s.secondary} disabled={!lamina || !texto.trim()}>Enviar comentário na lâmina</button></form>}
        </aside>
      </div>
      {versao.mensagemDecisao && <div className={s.notice}><strong>Ajustes solicitados</strong><p>{versao.mensagemDecisao}</p></div>}
      {versao.decididaEm && <p className={s.muted}>Decisão registrada no modo cliente em {horario(versao.decididaEm)}.</p>}
      {cliente && podeRevisar && <div className={s.decision}><p>Revise todas as lâminas antes de confirmar. A aprovação encerra a revisão desta versão.</p><div className={s.toolbar}><button className={s.button} onClick={() => abrirConfirmacao('aprovar')}><Check size={18} />Aprovar álbum nesta versão</button><button className={s.secondary} disabled={!texto.trim()} onClick={() => abrirConfirmacao('solicitar_ajustes')}>Solicitar ajustes com o texto acima</button></div></div>}
    </>}
    <p role="status" className={s.muted}>{aviso}</p>
    <dialog ref={dialog} className={s.dialog} onCancel={() => setConfirmar(null)} onClose={() => setConfirmar(null)}><h3>{confirmar === 'publicar' ? `Publicar versão ${acaoConfirmada?.numero}?` : confirmar === 'aprovar' ? `Aprovar álbum na versão ${acaoConfirmada?.numero}?` : 'Enviar solicitação de ajustes?'}</h3><p>{confirmar === 'publicar' ? 'As lâminas desta versão serão preservadas e disponibilizadas na prévia local do cliente.' : confirmar === 'aprovar' ? 'Esta decisão aprova o álbum completo nesta versão e encerra a revisão local. Não confirma pagamento ou produção física.' : 'A revisão será encerrada e o fotógrafo poderá preparar uma nova versão. O texto digitado será preservado como pedido de ajustes.'}</p><div className={s.toolbar}><button className={s.button} onClick={decidir}>Confirmar {confirmar === 'publicar' ? 'publicação' : confirmar === 'aprovar' ? 'aprovação' : 'ajustes'}</button><button className={s.secondary} onClick={() => { setConfirmar(null); dialog.current?.close() }}>Continuar revisando</button></div></dialog>
  </section>
}
