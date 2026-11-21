'use client'

import type { FormEvent } from 'react'
import type { EstadoLocal, ProdutoLocal, ComandoLocal } from '@/lib/operacao-local/modelo'
import type { ConfigComercialLocal, FinanceiroPedidoLocal } from '@/lib/operacao-local/comercial'
import s from './central-local.module.css'

const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)
const gb = (bytes: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(bytes / 1_000_000_000)
type Executar = (comando: ComandoLocal, mensagem?: string) => EstadoLocal | null

export function PlanosLocais({ estado, config, executar }: { estado: EstadoLocal; config: ConfigComercialLocal; executar: Executar }) {
  return <section className={s.panel} aria-labelledby="planos-locais-titulo">
    <div className={s.heading}><div><span className={s.eyebrow}>Condições ilustrativas</span><h2 id="planos-locais-titulo">Planos para seu estúdio</h2><p className={s.muted}>Valores simulados para exercitar o produto. A franquia exibida é ilustrativa; o armazenamento continua sujeito ao espaço deste navegador.</p></div><span className={s.badge}>Sem cobrança ou renovação automática</span></div>
    <div className={s.planGrid}>{config.planos.map(plano => <article className={s.planCard} key={plano.id}>
      <span className={s.badge}>{plano.nome}</span><h3>{moeda(plano.precoMensalCentavos)}<span> / mês</span></h3><p className={s.muted}>{gb(plano.armazenamentoBytes)} GB de armazenamento ilustrativo</p><ul><li>Galerias de seleção e de eventos</li><li>Catálogo de produtos e serviços</li><li>Fluxo comercial local</li></ul><button className={s.button} onClick={() => executar({ tipo: 'escolher_plano', planoId: plano.id }, `Plano ${plano.nome} simulado. Condições preservadas nesta assinatura; nenhuma cobrança foi realizada.`)}>Simular plano {plano.nome}</button>
    </article>)}</div>
    <div className={`${s.notice} mt-5`} role="status"><p>{estado.assinatura.status === 'simulada' ? <><strong>Assinatura simulada: {estado.assinatura.plano}.</strong>{estado.assinatura.precoMensalCentavos !== undefined && <> {moeda(estado.assinatura.precoMensalCentavos)} por mês · {gb(estado.assinatura.armazenamentoBytes ?? 0)} GB ilustrativos.</>} As condições selecionadas são preservadas mesmo quando o catálogo de planos muda.</> : 'Escolha um plano acima para percorrer a contratação simulada.'}</p></div>
  </section>
}

export function ConfiguracaoComercial({ config, executar }: { config: ConfigComercialLocal; executar: Executar }) {
  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const dados = new FormData(e.currentTarget)
    const configuracao: ConfigComercialLocal = {
      ...config,
      planos: config.planos.map(plano => ({ ...plano, precoMensalCentavos: Math.round(Number(dados.get(`preco-${plano.id}`)) * 100), armazenamentoBytes: Math.round(Number(dados.get(`quota-${plano.id}`)) * 1_000_000_000) })),
      comissaoEventoBps: Math.round(Number(dados.get('comissao-evento')) * 100),
    }
    executar({ tipo: 'configurar_comercial', config: configuracao }, 'Condições simuladas atualizadas. Solicitações e assinaturas anteriores mantêm seus valores registrados.')
  }
  return <section className={s.panel}><details><summary className={s.detailsSummary}>Configurar valores simulados</summary><p className={`${s.muted} my-4`}>Ajuste o cenário comercial local. Nenhuma mudança ativa cobrança, comissão real ou franquia em serviço externo.</p><form onSubmit={salvar} key={JSON.stringify(config)}>
    <div className={s.list}>{config.planos.map(plano => <fieldset className={s.commercialFieldset} key={plano.id}><legend>{plano.nome}</legend><div className={s.form}><label className={s.field}>Mensalidade {plano.nome} (R$)<input type="number" name={`preco-${plano.id}`} min="0" step="0.01" required defaultValue={(plano.precoMensalCentavos / 100).toFixed(2)} /></label><label className={s.field}>Franquia {plano.nome} (GB)<input type="number" name={`quota-${plano.id}`} min="0.001" step="0.001" required defaultValue={plano.armazenamentoBytes / 1_000_000_000} /></label></div></fieldset>)}</div>
    <label className={`${s.field} mt-5`}>Comissão sobre produtos em eventos (%)<input type="number" name="comissao-evento" min="0" max="100" step="0.01" required defaultValue={config.comissaoEventoBps / 100} /></label><p className={`${s.muted} my-4`}>Comissão aplicada aos produtos das galerias inteligentes. Serviços e galerias de seleção ficam sem comissão neste cenário.</p><button className={s.button}>Salvar condições simuladas</button>
  </form></details></section>
}

export function EditarProdutoLocal({ produto, executar }: { produto: ProdutoLocal; executar: Executar }) {
  return <details className={s.editItem}><summary className={s.detailsSummary}>Editar item</summary><form key={`${produto.nome}:${produto.precoCentavos}`} onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget); const preco = String(dados.get('preco') ?? '').trim()
    executar({ tipo: 'editar_produto', produtoId: produto.id, nome: String(dados.get('nome') ?? '').trim(), precoCentavos: preco === '' ? null : Math.round(Number(preco) * 100) }, 'Item atualizado. As solicitações anteriores mantêm o nome e o preço registrados.')
  }}><label className={`${s.field} mt-4`}>Nome do item<input name="nome" maxLength={160} required defaultValue={produto.nome} /></label><label className={`${s.field} mt-4`}>Valor simulado (R$)<input name="preco" type="number" min="0" step="0.01" defaultValue={produto.precoCentavos === null ? '' : (produto.precoCentavos / 100).toFixed(2)} placeholder="Vazio para sob consulta" /></label><button className={`${s.secondary} mt-4`}>Salvar item</button></form></details>
}

export function ResumoFinanceiroLocal({ totalCentavos, financeiro, registrado = false }: { totalCentavos: number | null; financeiro?: FinanceiroPedidoLocal; registrado?: boolean }) {
  const valor = (centavos: number | null) => centavos === null ? 'Sob consulta' : moeda(centavos)
  if (!financeiro) return <p className={s.commercialCaption}>Esta solicitação anterior não possui detalhamento financeiro registrado.</p>
  return <div className={s.finance}><dl><dt>Valor bruto</dt><dd>{valor(totalCentavos)}</dd><dt>Comissão simulada ({new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(financeiro.comissaoBps / 100)}%)</dt><dd>{valor(financeiro.comissaoCentavos)}</dd><dt><strong>Valor do fotógrafo</strong></dt><dd><strong>{valor(financeiro.liquidoCentavos)}</strong></dd></dl><p>{registrado ? 'Valores preservados no momento da solicitação.' : 'Condições atuais para uma nova solicitação.'} Sem movimentação financeira.</p></div>
}
