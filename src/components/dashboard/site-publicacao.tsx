'use client'

import { useState, useTransition } from 'react'
import {
  adicionarDominioSite, definirDominioAtivoSite, despublicarSite, publicarSite, removerDominioSite,
  restaurarVersaoNoRascunho, reverterSite, verificarDominioSiteAction,
} from '@/lib/actions/sites'
import { PREFIXO_TXT } from '@/lib/sites/dominio'
import { ROTULO_EVENTO_SITE, ROTULO_STATUS_SITE, type DominioUI, type EventoUI, type SiteUI, type VersaoUI } from '@/lib/sites/ui'

const botao = 'min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50'
const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

type Props = {
  site: SiteUI
  versoes: VersaoUI[]
  dominios: DominioUI[]
  eventos: EventoUI[]
  podePublicar: boolean
  podeEditar: boolean
  /** Há alterações não salvas no editor: publicar publica o que está SALVO. */
  sujo: boolean
  aoMudar: () => void
}

export function SitePublicacao({ site, versoes, dominios, eventos, podePublicar, podeEditar, sujo, aoMudar }: Props) {
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [nota, setNota] = useState('')
  const [dominio, setDominio] = useState('')
  const [pendente, iniciar] = useTransition()
  // Uma chave por tentativa de publicação: duplo clique/retry não gera versão repetida.
  const [chave, setChave] = useState(() => crypto.randomUUID())

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) => {
    setErro(''); setAviso('')
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.')
      else { setAviso(sucesso); aoMudar() }
    })
  }

  return (
    <section className="space-y-6 rounded-2xl border p-5" aria-labelledby="site-pub-t">
      <div>
        <h3 id="site-pub-t" className="text-lg font-semibold">Publicação</h3>
        <p className="text-sm text-muted-foreground">Situação: <strong>{ROTULO_STATUS_SITE[site.status]}</strong>{site.publicado_em && site.status === 'publicado' ? ` desde ${data(site.publicado_em)}` : ''}. Cada publicação vira uma versão que não muda, e você pode voltar para qualquer uma.</p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}

      {podePublicar ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="grid gap-1 text-sm">Nota da versão (opcional)
            <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} className="min-h-11 rounded-lg border px-3" />
          </label>
          <button type="button" className={botao} disabled={pendente || sujo} title={sujo ? 'Salve o rascunho antes de publicar' : undefined}
            onClick={() => rodar(async () => { const r = await publicarSite(site.id, chave, nota); if (r.ok) { setChave(crypto.randomUUID()); setNota('') } return r }, 'Site publicado.')}>
            {pendente ? 'Publicando…' : 'Publicar rascunho salvo'}
          </button>
          {site.status === 'publicado' && (
            <button type="button" className={botao} disabled={pendente} onClick={() => { if (window.confirm('Tirar o site do ar? O endereço passa a mostrar “indisponível”.')) rodar(() => despublicarSite(site.id), 'Site fora do ar.') }}>Tirar do ar</button>
          )}
        </div>
      ) : <p className="text-sm text-muted-foreground">Só dono e administradores publicam. Você pode editar o rascunho{podeEditar ? '' : ' (somente leitura no seu papel)'}.</p>}
      {sujo && podePublicar && <p className="text-sm">Há alterações não salvas. Salve o rascunho para incluí-las na publicação.</p>}

      <div>
        <h4 className="font-medium">Versões</h4>
        {versoes.length === 0 ? <p className="text-sm text-muted-foreground">Nada publicado ainda.</p> : (
          <ul className="mt-2 divide-y rounded-xl border">
            {versoes.map((v) => {
              const atual = site.status === 'publicado' && site.versao_publicada_id === v.id
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">Versão {v.numero}{atual ? ' · no ar agora' : ''}</p>
                    <p className="text-muted-foreground">{data(v.created_at)}{v.nota ? ` · ${v.nota}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {podeEditar && <button type="button" className={botao} disabled={pendente} onClick={() => { if (window.confirm('Substituir o rascunho atual pelo conteúdo desta versão?')) rodar(() => restaurarVersaoNoRascunho(site.id, v.id), 'Versão restaurada no rascunho.') }}>Restaurar no rascunho</button>}
                    {podePublicar && !atual && <button type="button" className={botao} disabled={pendente} onClick={() => { if (window.confirm(`Colocar a versão ${v.numero} no ar agora?`)) rodar(() => reverterSite(site.id, v.id), `Versão ${v.numero} no ar.`) }}>{site.status === 'publicado' ? 'Voltar para esta versão' : 'Colocar no ar'}</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div>
          <h4 className="font-medium">Domínio próprio</h4>
          <p className="text-sm text-muted-foreground">Prove que o domínio é seu criando um registro TXT no DNS; só depois de verificado ele pode ser ativado. Aponte também o domínio para a hospedagem do SeuAlbum (ver orientação de DNS com o suporte): sem isso o endereço não abre o site.</p>
        </div>
        {dominios.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {dominios.map((d) => (
              <li key={d.id} className="space-y-2 p-3 text-sm">
                <p className="font-medium">{d.dominio} · {d.status === 'verificado' ? (d.ativo ? 'verificado e ativo' : 'verificado, inativo') : d.status === 'falhou' ? 'verificação falhou' : 'aguardando verificação'}</p>
                {d.status !== 'verificado' && (
                  <div className="rounded-lg bg-muted p-3">
                    <p>Crie um registro <strong>TXT</strong> com o nome <code className="break-all">{PREFIXO_TXT}.{d.dominio}</code> e o valor:</p>
                    <p className="mt-1 break-all"><code>{d.token}</code></p>
                    {d.status === 'falhou' && d.falhou_motivo === 'registro_nao_encontrado' && <p className="mt-1">Não encontramos o registro. O DNS pode levar alguns minutos para propagar.</p>}
                    {d.status === 'falhou' && d.falhou_motivo && d.falhou_motivo !== 'registro_nao_encontrado' && <p className="mt-1">Este domínio já foi verificado por outro estúdio.</p>}
                  </div>
                )}
                {podePublicar && (
                  <div className="flex flex-wrap gap-2">
                    {d.status !== 'verificado' && <button type="button" className={botao} disabled={pendente} onClick={() => rodar(async () => { const r = await verificarDominioSiteAction(d.id); if (r.ok && r.status === 'falhou') return { ok: false, erro: 'Registro TXT não encontrado ainda. Confira o nome e o valor e tente novamente em alguns minutos.' }; return r }, 'Domínio verificado.')}>Verificar agora</button>}
                    {d.status === 'verificado' && <button type="button" className={botao} disabled={pendente} onClick={() => rodar(() => definirDominioAtivoSite(d.id, !d.ativo), d.ativo ? 'Domínio desativado.' : 'Domínio ativado.')}>{d.ativo ? 'Desativar' : 'Ativar'}</button>}
                    <button type="button" className={botao} disabled={pendente} onClick={() => { if (window.confirm(`Remover ${d.dominio}?`)) rodar(() => removerDominioSite(d.id), 'Domínio removido.') }}>Remover</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {podePublicar && dominios.length < 5 && (
          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); rodar(async () => { const r = await adicionarDominioSite(site.id, dominio); if (r.ok) setDominio(''); return r }, 'Domínio adicionado. Crie o registro TXT e verifique.') }}>
            <label className="grid gap-1 text-sm">Novo domínio
              <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="fotos.meuestudio.com.br" maxLength={253} required className="min-h-11 rounded-lg border px-3" autoComplete="off" />
            </label>
            <button type="submit" className={botao} disabled={pendente}>Adicionar domínio</button>
          </form>
        )}
      </div>

      {eventos.length > 0 && (
        <details className="border-t pt-4 text-sm">
          <summary className="min-h-11 cursor-pointer font-medium">Histórico recente</summary>
          <ul className="mt-2 space-y-1">
            {eventos.map((e) => <li key={e.id}>{data(e.created_at)} · {ROTULO_EVENTO_SITE[e.acao] ?? e.acao}{e.detalhe ? ` (${e.detalhe})` : ''}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
}
