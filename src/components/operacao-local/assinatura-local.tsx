'use client'

import { useState, type FormEvent } from 'react'
import type { EstadoLocal, ComandoLocal } from '@/lib/operacao-local/modelo'
import { lerConfigComercial } from '@/lib/operacao-local/comercial'
import { calcularConsumoAssinatura, proximaCompetencia } from '@/lib/operacao-local/assinatura'
import s from './central-local.module.css'

const moeda = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
const bytes = (valor: number) => valor < 1_000_000 ? `${new Intl.NumberFormat('pt-BR').format(valor)} bytes` : valor < 1_000_000_000 ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor / 1_000_000)} MB` : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor / 1_000_000_000)} GB`
const dataHora = (valor: string) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const nomeStatus = { ativa_simulada: 'Ativa na simulação', inadimplente_simulada: 'Em atraso na simulação', cancelada: 'Cancelada', aberta_simulada: 'Em aberto', vencida_simulada: 'Atraso simulado', paga_simulada: 'Pagamento simulado' }
type Executar = (comando: ComandoLocal, mensagem?: string) => EstadoLocal | null

export function AssinaturaLocal({ estado, executar }: { estado: EstadoLocal; executar: Executar }) {
  const [chaveAdicional, setChaveAdicional] = useState<string | null>(null)
  const [adicionalConfirmado, setAdicionalConfirmado] = useState(false)
  const ciclo = estado.cicloAssinatura
  const consumo = calcularConsumoAssinatura(estado)
  const planos = lerConfigComercial(estado).planos
  const proxima = ciclo ? proximaCompetencia(ciclo.competenciaAtual) : null
  const pendentes = ciclo?.faturas.some(item => item.status !== 'paga_simulada') ?? false
  function iniciar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const planoId = String(new FormData(e.currentTarget).get('planoId'))
    executar({ tipo: 'assinatura', comando: { acao: 'iniciar', planoId, chave: `iniciar:${estado.proprietarioId}:${planoId}` } }, 'Ciclo iniciado com fatura simulada. Nenhum pagamento foi processado.')
  }
  function contratar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const quantidade = Number(new FormData(e.currentTarget).get('quantidade'))
    const chave = chaveAdicional ?? crypto.randomUUID(); setChaveAdicional(chave)
    if (executar({ tipo: 'assinatura', comando: { acao: 'contratar_adicional', quantidade, chave } }, 'Adicional contratado na simulação. Capacidade ilustrativa atualizada; valor será incluído na próxima competência.')) setAdicionalConfirmado(true)
  }
  return <section className={s.panel} aria-labelledby="ciclo-assinatura-local-titulo">
    <div className={s.heading}><div><span className={s.eyebrow}>Gestão da assinatura</span><h2 id="ciclo-assinatura-local-titulo">Ciclo de assinatura e consumo</h2><p className={s.muted}>Exercite faturas, renovação mensal, atraso e adicionais. Todos os valores e estados são simulados.</p></div><span className={s.badge}>Sem cobrança real</span></div>
    <div className={s.stats}>
      <div className={s.stat}><strong>{bytes(consumo.bytes)}</strong><span>Bytes importados: fotos e lâminas</span></div>
      <div className={s.stat}><strong>{bytes(consumo.capacidadeBytes)}</strong><span>{ciclo?.status === 'cancelada' ? 'Capacidade histórica do contrato' : 'Capacidade contratada ilustrativa'}</span></div>
      <div className={s.stat}><strong>{bytes(consumo.excessoBytes)}</strong><span>Excesso sobre essa capacidade</span></div>
      <div className={s.stat}><strong>Não medido</strong><span>Tráfego de arquivos</span></div>
    </div>
    <p className={s.commercialCaption}>O consumo soma os metadados das fotos e lâminas importadas, contando cada arquivo uma vez e preservando os exemplos com zero bytes. A capacidade comercial não representa espaço disponível no dispositivo. Não bloqueamos uploads nem apagamos fotos por consumo ou cancelamento.</p>
    {!ciclo ? <form className={`${s.form} mt-5`} onSubmit={iniciar}><label className={s.field}>Plano do ciclo<select name="planoId" defaultValue={estado.assinatura.planoId ?? planos[0]?.id}>{planos.map(plano => <option key={plano.id} value={plano.id}>{plano.nome} · {moeda(plano.precoMensalCentavos)} / mês</option>)}</select></label><div className={s.actions}><button className={s.button}>Iniciar ciclo simulado</button></div></form> : <>
      <div className={`${s.row} mt-5`}><div><h3>{ciclo.plano.nome} · {moeda(ciclo.plano.precoMensalCentavos)} / mês</h3><p>{nomeStatus[ciclo.status]} · competência {ciclo.competenciaAtual}</p><p>Iniciado em {dataHora(ciclo.iniciadoEm)}</p>{ciclo.canceladoEm && <p>Cancelado em {dataHora(ciclo.canceladoEm)}. Fotos e faturas mantidas.</p>}</div><div className={s.actions}><button className={s.secondary} disabled={ciclo.status !== 'ativa_simulada' || pendentes} onClick={() => executar({ tipo: 'assinatura', comando: { acao: 'renovar', competencia: proxima!, chave: `renovar:${ciclo.id}:${proxima}` } }, `Fatura de ${proxima} gerada na simulação com os valores do contrato.`)}>Gerar próxima mensalidade simulada</button><button className={s.danger} disabled={ciclo.status === 'cancelada'} onClick={() => executar({ tipo: 'assinatura', comando: { acao: 'cancelar' } }, 'Ciclo cancelado. Fotos, faturas e histórico foram preservados.')}>Cancelar ciclo simulado</button></div></div>
      <p className={s.commercialCaption}>{ciclo.status === 'cancelada' ? 'Este contrato foi encerrado e permanece disponível como histórico. Nenhuma nova mensalidade ou adicional será criado.' : `Próxima competência: ${proxima}. Simule o pagamento de todas as faturas em aberto antes de renovar. A competência avança sem alterar a data real de emissão.`}</p>
      <div className={`${s.split} mt-6`}>
        <div><h3 className="mb-4 font-medium">Faturas mensais simuladas</h3><div className={s.list}>{[...ciclo.faturas].reverse().map(fatura => <article className={s.row} key={fatura.id} aria-label={`Fatura ${fatura.competencia}`}><div><h3>{fatura.competencia} · {moeda(fatura.totalCentavos)}</h3><p>{nomeStatus[fatura.status]}</p><p>Plano {moeda(fatura.planoCentavos)} · adicionais {moeda(fatura.adicionaisCentavos)}</p><p>Emitida em {dataHora(fatura.criadaEm)}</p>{fatura.pagaEm && <p>Pagamento simulado em {dataHora(fatura.pagaEm)}</p>}</div>{fatura.status !== 'paga_simulada' && <div className={s.actions}><button className={s.secondary} onClick={() => executar({ tipo: 'assinatura', comando: { acao: 'simular_pagamento', faturaId: fatura.id } }, 'Pagamento registrado apenas na simulação, sem movimentação de valores.')}>Simular pagamento</button>{fatura.status === 'aberta_simulada' && ciclo.status !== 'cancelada' && <button className={s.secondary} onClick={() => executar({ tipo: 'assinatura', comando: { acao: 'simular_atraso', faturaId: fatura.id } }, 'Atraso marcado na simulação. Os arquivos continuam preservados.')}>Simular atraso</button>}</div>}</article>)}</div></div>
        <div><h3 className="mb-4 font-medium">Armazenamento adicional</h3><p className={s.muted}>{moeda(ciclo.ofertaAdicional.precoMensalCentavos)} por {bytes(ciclo.ofertaAdicional.armazenamentoBytes)} / mês por unidade. Hipótese editável de teste; começa na próxima mensalidade simulada, sem cobrança proporcional.</p><form className="mt-4" onSubmit={contratar}><label className={s.field}>Unidades de adicional<input name="quantidade" type="number" min="1" max="100" step="1" required defaultValue="1" disabled={adicionalConfirmado || ciclo.status !== 'ativa_simulada'} onChange={() => setChaveAdicional(null)} /></label><div className={`${s.actions} mt-4`}><button className={s.button} disabled={adicionalConfirmado || ciclo.status !== 'ativa_simulada'}>Contratar adicional simulado</button>{adicionalConfirmado && <button className={s.secondary} type="button" onClick={() => { setAdicionalConfirmado(false); setChaveAdicional(null) }}>Preparar outro adicional</button>}</div></form>
          {ciclo.adicionais.length > 0 && <div className={`${s.list} mt-5`}>{ciclo.adicionais.map(item => <div className={s.row} key={item.id}><div><h3>{item.quantidade} × {bytes(item.armazenamentoBytes)}</h3><p>{moeda(item.precoMensalCentavos)} / unidade / mês · condições preservadas</p></div></div>)}</div>}
          <details className="mt-5"><summary className={s.detailsSummary}>Editar oferta do adicional</summary><form key={`${ciclo.ofertaAdicional.precoMensalCentavos}:${ciclo.ofertaAdicional.armazenamentoBytes}`} onSubmit={e => { e.preventDefault(); const dados = new FormData(e.currentTarget); executar({ tipo: 'assinatura', comando: { acao: 'configurar_adicional', precoMensalCentavos: Math.round(Number(dados.get('preco')) * 100), armazenamentoBytes: Math.round(Number(dados.get('gb')) * 1_000_000_000) } }, 'Oferta atualizada para próximos adicionais. Os anteriores mantêm preço e capacidade contratados.') }}><label className={`${s.field} mt-4`}>Preço mensal do adicional (R$)<input name="preco" type="number" min="0" step="0.01" required defaultValue={(ciclo.ofertaAdicional.precoMensalCentavos / 100).toFixed(2)} disabled={ciclo.status === 'cancelada'} /></label><label className={`${s.field} mt-4`}>Capacidade por unidade (GB)<input name="gb" type="number" min="0.001" step="0.001" required defaultValue={ciclo.ofertaAdicional.armazenamentoBytes / 1_000_000_000} disabled={ciclo.status === 'cancelada'} /></label><button className={`${s.secondary} mt-4`} disabled={ciclo.status === 'cancelada'}>Salvar oferta do adicional</button></form></details>
        </div>
      </div>
    </>}
  </section>
}
