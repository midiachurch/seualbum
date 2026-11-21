'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react'
import type { EstadoLocal, GaleriaLocal } from '@/lib/operacao-local/modelo'
import { fotosDisponiveisCompra, lerLoja, resumirCarrinho, type ComandoLojaLocal, type CompraLocal, type FotoCompraLocal, type ResumoCarrinhoLocal } from '@/lib/operacao-local/loja'
import { lerArquivo } from '@/lib/operacao-local/repositorio'
import s from './central-local.module.css'

const moeda = (valor: number | null) => valor === null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)
type EnvelopeLoja = { tipo: 'loja'; comando: ComandoLojaLocal }
type Props = { estado: EstadoLocal; galeria: GaleriaLocal; cliente: boolean; executar: (comando: EnvelopeLoja, mensagem?: string) => EstadoLocal | null }
const dataHora = (data: string) => new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const nomeSeguro = (nome: string) => nome.replace(/[\\/\u0000-\u001f]/g, '_').replaceAll('..', '_').replace(/^\.+/, '_') || 'foto'
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = nomeSeguro(nome); link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function recuperarOriginal(foto: FotoCompraLocal): Promise<Blob> {
  if (foto.url.startsWith('arquivo-local:')) {
    const arquivo = await lerArquivo(foto.id)
    if (!arquivo) throw new Error(`O original ${foto.nome} não está mais neste navegador.`)
    return arquivo
  }
  const resposta = await fetch(foto.url)
  if (!resposta.ok) throw new Error(`Não foi possível recuperar ${foto.nome}.`)
  return resposta.blob()
}

export function LojaLocal({ estado, galeria, cliente, executar }: Props) {
  const [escolhas, setEscolhas] = useState<Record<string, string[]>>({})
  const [resultado, setResultado] = useState<CompraLocal['status']>('pago_simulado')
  const [confirmando, setConfirmando] = useState(false)
  const [cotacaoConfirmada, setCotacaoConfirmada] = useState<ResumoCarrinhoLocal | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const tentativaRef = useRef<{ assinatura: string; comando: Extract<ComandoLojaLocal, { tipo: 'checkout' }> } | null>(null)
  const estadoRef = useRef(estado)
  useEffect(() => { estadoRef.current = estado }, [estado])
  const loja = lerLoja(estado)
  const carrinho = loja.carrinhos.find(item => item.galeriaId === galeria.id)
  const compras = loja.compras.filter(item => item.galeriaId === galeria.id)
  const catalogo = estado.catalogo.filter(produto => produto.proprietarioId === estado.proprietarioId && produto.ativo && galeria.produtoIds.includes(produto.id))
  let resumo: ReturnType<typeof resumirCarrinho> | null = null
  let erroCarrinho: string | null = null
  try { resumo = resumirCarrinho(estado, galeria.id) } catch (erro) { erroCarrinho = erro instanceof Error ? erro.message : 'Revise o carrinho.' }
  const fotosEscolhidas = (produtoId: string) => escolhas[produtoId] ?? carrinho?.itens.find(item => item.produtoId === produtoId)?.fotoIds ?? galeria.favoritas
  function comandar(comando: ComandoLojaLocal, mensagem: string) {
    const atualizado = executar({ tipo: 'loja', comando }, mensagem)
    if (atualizado) { setAviso({ texto: mensagem, erro: false }); setConfirmando(false) }
    return atualizado
  }
  function checkout() {
    if (!cotacaoConfirmada || cotacaoConfirmada.totalCentavos === null || ocupado) return
    setOcupado(true)
    try {
      const itens = cotacaoConfirmada.itens.map(item => ({ produtoId: item.produtoId, fotoIds: [...item.fotoIds] }))
      const cotacaoEsperada = cotacaoConfirmada.itens.map(item => ({ produtoId: item.produtoId, totalCentavos: item.totalCentavos, comissaoBps: item.financeiro.comissaoBps }))
      const assinatura = JSON.stringify({ itens, resultado, total: cotacaoConfirmada.totalCentavos, cotacaoEsperada })
      if (tentativaRef.current?.assinatura !== assinatura) tentativaRef.current = { assinatura, comando: { tipo: 'checkout', galeriaId: galeria.id, itens, resultado, chave: crypto.randomUUID(), totalEsperadoCentavos: cotacaoConfirmada.totalCentavos, cotacaoEsperada } }
      const atualizado = comandar(tentativaRef.current.comando, resultado === 'pago_simulado' ? 'Compra aprovada na simulação. Nenhum dinheiro foi movimentado.' : 'Recusa simulada registrada. Os arquivos não foram liberados.')
      if (atualizado) tentativaRef.current = null
    } finally { setOcupado(false) }
  }
  async function entregar(compraId: string, fotoId?: string) {
    if (ocupado) return
    setOcupado(true); setAviso(null)
    try {
      const fotos = fotosDisponiveisCompra(estadoRef.current, compraId)
      const autorizadas = fotoId === undefined ? fotos : fotos.filter(foto => foto.id === fotoId)
      if (!autorizadas.length) throw new Error('Este pedido não contém originais digitais disponíveis para esta entrega.')
      const limite = 100 * 1024 * 1024
      if (fotoId === undefined && autorizadas.reduce((bytes, foto) => bytes + foto.bytes, 0) > limite) throw new Error('O ZIP local tem limite de 100 MB. Baixe os arquivos individualmente.')
      const arquivos: Record<string, Uint8Array> = {}
      let bytes = 0
      for (let index = 0; index < autorizadas.length; index++) {
        const foto = autorizadas[index]
        const original = await recuperarOriginal(foto)
        bytes += original.size
        if (fotoId === undefined && bytes > limite) throw new Error('O ZIP local tem limite de 100 MB. Baixe os arquivos individualmente.')
        // Revalida após I/O para impedir entrega com acesso revogado em outra aba.
        if (!fotosDisponiveisCompra(estadoRef.current, compraId).some(item => item.id === foto.id)) throw new Error('A entrega deixou de estar disponível.')
        if (fotoId !== undefined) { baixar(original, foto.nome); setAviso({ texto: 'Original adquirido preparado para download.', erro: false }); return }
        arquivos[`${String(index + 1).padStart(4, '0')}_${nomeSeguro(foto.nome)}`] = new Uint8Array(await original.arrayBuffer())
      }
      fotosDisponiveisCompra(estadoRef.current, compraId)
      const { zipSync } = await import('fflate')
      const zip = zipSync(arquivos, { level: 0 })
      baixar(new Blob([new Uint8Array(zip)], { type: 'application/zip' }), `compra-${compraId}.zip`)
      setAviso({ texto: `Entrega preparada com ${autorizadas.length} original(is) do snapshot aprovado.`, erro: false })
    } catch (erro) { setAviso({ texto: erro instanceof Error ? erro.message : 'Não foi possível preparar a entrega.', erro: true }) }
    finally { setOcupado(false) }
  }

  return <div>
    <section className={s.panel}><div className={s.heading}><div><span className={s.eyebrow}>Loja da galeria</span><h2>Pacotes e compras locais</h2><p className={s.muted}>Cada produto é um pacote de preço fixo com as fotos escolhidas. O total não aumenta por quantidade de fotos. Serviços são contratados separadamente e não liberam os originais anexados.</p></div><span className={s.badge}>Checkout simulado · sem cobrança</span></div>
      {aviso && <div className={`${s.notice} my-4`} role={aviso.erro ? 'alert' : 'status'}>{aviso.texto}</div>}
      {!galeria.acesso.ativo && <p role="alert" className={s.muted}>O acesso está revogado. Carrinho, checkout e entrega estão indisponíveis.</p>}
      {!cliente && <p className={`${s.notice} my-4`}>Você está na visão do fotógrafo. As compras e seus valores registrados aparecem abaixo. Use a prévia do cliente para montar um carrinho e testar o checkout.</p>}
      {cliente && <div className={s.list}>{catalogo.length === 0 ? <p className={s.muted}>O fotógrafo ainda não vinculou produtos ou serviços a esta galeria.</p> : catalogo.map(produto => {
        const ids = fotosEscolhidas(produto.id)
        const noCarrinho = carrinho?.itens.some(item => item.produtoId === produto.id)
        return <article className={s.panel} key={produto.id} aria-label={`Pacote ${produto.nome}`}><div className={s.heading}><div><span className={s.badge}>{produto.tipo === 'produto' ? 'Pacote digital' : 'Serviço complementar'}</span><h3>{produto.nome}</h3><p className={s.muted}>{produto.descricao}</p></div><strong>{moeda(produto.precoCentavos)}</strong></div>
          <p className={`${s.muted} my-4`}>{ids.length} foto(s) escolhida(s) para este pacote. {produto.tipo === 'produto' ? 'Ao aprovar a compra simulada, somente estas fotos serão liberadas.' : 'As fotos anexadas orientam o serviço; não há entrega automática de diagramação.'}</p>
          <details><summary className={s.detailsSummary}>Escolher fotos de {produto.nome}</summary><button className={`${s.secondary} my-4`} type="button" onClick={() => setEscolhas(atual => ({ ...atual, [produto.id]: [...galeria.favoritas] }))}>Usar favoritas atuais ({galeria.favoritas.length})</button><div className={s.list}>{galeria.fotos.map(foto => <label key={foto.id} className={s.row}><span>{foto.nome}</span><input type="checkbox" aria-label={`Incluir ${foto.nome} em ${produto.nome}`} checked={ids.includes(foto.id)} onChange={e => setEscolhas(atual => ({ ...atual, [produto.id]: e.target.checked ? [...ids.filter(id => id !== foto.id), foto.id] : ids.filter(id => id !== foto.id) }))} /></label>)}</div></details>
          <button className={`${s.button} mt-4`} disabled={!galeria.acesso.ativo || ocupado || produto.tipo === 'produto' && ids.length === 0} onClick={() => comandar({ tipo: 'definir_item', galeriaId: galeria.id, produtoId: produto.id, fotoIds: ids }, `${produto.nome} atualizado no carrinho com ${ids.length} foto(s).`)}><ShoppingCart size={16} aria-hidden="true" />{noCarrinho ? 'Atualizar pacote no carrinho' : 'Adicionar pacote ao carrinho'}</button>
        </article>
      })}</div>}
    </section>
    {cliente && <section className={s.panel} aria-labelledby="carrinho-local-titulo"><h2 id="carrinho-local-titulo">Seu carrinho</h2>{erroCarrinho && <p role="alert">{erroCarrinho}</p>}{!carrinho?.itens.length ? <p className={s.muted}>Escolha as fotos e adicione um pacote acima.</p> : <><div className={s.list}>{carrinho.itens.map(item => {
      const linha = resumo?.itens.find(linha => linha.produtoId === item.produtoId)
      return <div className={s.row} key={item.produtoId}><div><h3>{linha?.produtoNome ?? estado.catalogo.find(produto => produto.id === item.produtoId)?.nome ?? 'Item indisponível'}</h3><p>{item.fotoIds.length} foto(s) · {linha ? moeda(linha.totalCentavos) : 'Revise a disponibilidade'}</p><p className={s.muted}>{item.fotoIds.map(id => galeria.fotos.find(foto => foto.id === id)?.nome).join(', ')}</p></div><button className={s.danger} disabled={!galeria.acesso.ativo || ocupado} aria-label={`Remover ${linha?.produtoNome ?? 'item'} do carrinho`} onClick={() => comandar({ tipo: 'remover_item', galeriaId: galeria.id, produtoId: item.produtoId }, 'Pacote removido do carrinho.')}><Trash2 size={16} aria-hidden="true" />Remover</button></div>
    })}</div>{resumo && <><p className="my-4"><strong>Total do carrinho: {moeda(resumo.totalCentavos)}</strong></p><p className={s.muted}>Comissão simulada: {moeda(resumo.comissaoCentavos)} · Líquido do fotógrafo: {moeda(resumo.liquidoCentavos)}.</p>{resumo.totalCentavos === null && <p role="status" className={s.muted}>O checkout fica bloqueado enquanto algum item estiver sob consulta. O fotógrafo pode definir o valor no catálogo.</p>}<button className={`${s.button} mt-4`} disabled={!galeria.acesso.ativo || ocupado || resumo.totalCentavos === null} onClick={() => { setCotacaoConfirmada(structuredClone(resumo)); setConfirmando(true) }}>Revisar compra simulada</button></>}</>}
      {confirmando && cotacaoConfirmada && <section className={`${s.notice} mt-5`} aria-label="Confirmação da compra simulada"><h3>Confirme os pacotes e o resultado de teste</h3><p className="my-4">{cotacaoConfirmada.itens.length} pacote(s) · {moeda(cotacaoConfirmada.totalCentavos)}. As fotos e os valores serão preservados em um snapshot. Nenhum cartão, PIX ou dinheiro será utilizado.</p><label className={s.field}>Resultado do checkout de teste<select value={resultado} onChange={e => setResultado(e.target.value as CompraLocal['status'])}><option value="pago_simulado">Aprovar pagamento simulado</option><option value="recusado_simulado">Recusar pagamento simulado</option></select></label><div className={`${s.actions} mt-4`}><button className={s.button} disabled={!galeria.acesso.ativo || ocupado} onClick={checkout}>{ocupado ? 'Confirmando…' : 'Confirmar checkout simulado'}</button><button className={s.secondary} disabled={ocupado} onClick={() => setConfirmando(false)}>Voltar ao carrinho</button></div></section>}
    </section>}
    <section className={s.panel} aria-labelledby="compras-locais-titulo"><h2 id="compras-locais-titulo">Compras desta galeria</h2><p className={`${s.muted} mb-4`}>Compras são diferentes das solicitações de serviço existentes. Estes registros demonstram checkout e entrega, sem transação financeira real.</p>{!compras.length ? <p className={s.muted}>Nenhuma compra simulada registrada.</p> : <div className={s.list}>{compras.map(compra => {
      const fotos = compra.itens.filter(item => item.produtoTipo === 'produto').flatMap(item => item.fotos).filter((foto, index, todas) => todas.findIndex(item => item.id === foto.id) === index)
      return <article className={s.panel} key={compra.id} aria-label={`Compra ${compra.id}`}><div className={s.heading}><div><span className={s.badge}>{compra.status === 'pago_simulado' ? 'Aprovada na simulação' : 'Recusada na simulação'}</span><h3>{moeda(compra.totalCentavos)} · {compra.itens.length} pacote(s)</h3><p className={s.muted}>{dataHora(compra.criadaEm)}</p></div>{compra.status === 'pago_simulado' && <CheckCircle2 aria-label="Compra simulada aprovada" />}</div><ul className="my-4">{compra.itens.map(item => <li key={item.produtoId}>{item.produtoNome}: {moeda(item.totalCentavos)} · {item.fotoIds.length} foto(s) · comissão {moeda(item.financeiro.comissaoCentavos)}</li>)}</ul><p className={s.muted}>Comissão registrada: {moeda(compra.comissaoCentavos)} · Líquido registrado: {moeda(compra.liquidoCentavos)}. Condições preservadas no momento do checkout.</p>
        {compra.status === 'recusado_simulado' ? <p className={`${s.notice} mt-4`}>Entrega bloqueada: a compra foi recusada na simulação. Você pode testar uma nova tentativa pelo carrinho.</p> : fotos.length === 0 ? <p className={`${s.notice} mt-4`}>Este pedido contém serviços. Nenhum original digital foi vendido neste checkout.</p> : <div className="mt-4"><button className={s.button} disabled={ocupado || !galeria.acesso.ativo} onClick={() => void entregar(compra.id)}><Download size={16} aria-hidden="true" />{ocupado ? 'Preparando entrega…' : 'Baixar compra em ZIP'}</button><p className={`${s.muted} my-4`}>{fotos.length} original(is) do snapshot. Limite técnico do ZIP: 100 MB. Os arquivos precisam continuar disponíveis neste navegador.</p><div className={s.list}>{fotos.map(foto => <div className={s.row} key={foto.id}><span>{foto.nome}</span><button className={s.secondary} disabled={ocupado || !galeria.acesso.ativo} onClick={() => void entregar(compra.id, foto.id)} aria-label={`Baixar original adquirido ${foto.nome}`}><Download size={16} aria-hidden="true" />Baixar original</button></div>)}</div></div>}
      </article>
    })}</div>}</section>
  </div>
}
