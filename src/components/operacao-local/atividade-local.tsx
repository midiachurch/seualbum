'use client'

import { useRef, useState } from 'react'
import type { ComandoLocal, EstadoLocal, GaleriaLocal } from '@/lib/operacao-local/modelo'
import s from './central-local.module.css'

type Executar = (comando: ComandoLocal, mensagem?: string) => EstadoLocal | null
const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function NotificacoesLocais({ estado, executar }: { estado: EstadoLocal; executar: Executar }) {
  const avisos = estado.notificacoes ?? []
  const abertas = avisos.filter(item => !item.lidaEm).length
  return <section className={s.panel} aria-labelledby="notificacoes-local-titulo">
    <h2 id="notificacoes-local-titulo">Notificações · {abertas} não lidas</h2>
    <p className={`${s.muted} mb-4`}>Avisos internos gerados por ações realizadas nesta operação local.</p>
    {!avisos.length ? <p className={s.muted}>As próximas etapas realizadas aparecerão aqui.</p> : <ul className={s.list}>{avisos.slice(0, 50).map(item => <li key={item.id} className={s.row}><div><p>{item.texto}</p><time className={s.muted} dateTime={item.criadaEm}>{data(item.criadaEm)}</time><p>{item.lidaEm ? 'Lida' : 'Não lida'}</p></div>{!item.lidaEm && <button className={s.secondary} onClick={() => executar({ tipo: 'ler_notificacao', id: item.id })}>Marcar como lida</button>}</li>)}</ul>}
  </section>
}

export function ConversaHistoricoLocal({ estado, galeria, cliente, executar }: { estado: EstadoLocal; galeria: GaleriaLocal; cliente: boolean; executar: Executar }) {
  const [texto, setTexto] = useState('')
  const tentativa = useRef<{ texto: string; chave: string } | null>(null)
  const mensagens = estado.mensagens?.filter(item => item.galeriaId === galeria.id) ?? []
  const atividades = estado.atividades.filter(item => item.galeriaId === galeria.id)
  return <div className={s.split}>
    <section className={s.panel} aria-labelledby="conversa-local-titulo"><h2 id="conversa-local-titulo">Conversa da galeria</h2><p className={s.muted}>Mensagens entre os modos locais de cliente e fotógrafo. Nenhum e-mail será enviado.</p>
      <ol className={`${s.list} my-5`} aria-label="Mensagens da galeria">{mensagens.map(item => <li key={item.id} className={s.row}><div><strong>{item.autor === 'cliente' ? 'Cliente' : 'Fotógrafo'}</strong><p className="whitespace-pre-wrap">{item.texto}</p><time className={s.muted} dateTime={item.criadaEm}>{data(item.criadaEm)}</time></div></li>)}</ol>
      <form onSubmit={e => {
        e.preventDefault()
        if (tentativa.current?.texto !== texto) tentativa.current = { texto, chave: crypto.randomUUID() }
        if (executar({ tipo: 'enviar_mensagem', galeriaId: galeria.id, autor: cliente ? 'cliente' : 'fotografo', texto, chave: tentativa.current.chave }, 'Mensagem registrada na conversa local.')) { setTexto(''); tentativa.current = null }
      }}><label className={s.field}>Mensagem para {cliente ? 'o fotógrafo' : 'o cliente'}<textarea value={texto} onChange={e => setTexto(e.target.value)} required maxLength={2000} rows={4} /></label><button className={`${s.button} mt-4`} disabled={!texto.trim()}>Enviar mensagem</button></form>
    </section>
    <section className={s.panel} aria-labelledby="historico-local-titulo"><h2 id="historico-local-titulo">Histórico da galeria</h2>{!atividades.length ? <p className={s.muted}>As etapas realizadas serão registradas com a data real.</p> : <ol className={s.timeline}>{atividades.map(item => <li key={item.id}><p>{item.texto}</p><time dateTime={item.criadaEm}>{data(item.criadaEm)}</time></li>)}</ol>}</section>
  </div>
}
