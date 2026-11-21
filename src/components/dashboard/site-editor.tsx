'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { atualizarDadosSite, salvarRascunhoSite } from '@/lib/actions/sites'
import { blocoVazio, LIMITES_SITE, ROTULO_BLOCO, TIPOS_BLOCO, type Bloco, type ConteudoSite, type TipoBloco } from '@/lib/sites/tipos'
import { podeEditarSite, podePublicarSite, type DominioUI, type EventoUI, type MidiaListaUI, type SiteUI, type VersaoUI } from '@/lib/sites/ui'
import type { PapelOrganizacao } from '@/types/database'
import { BlocoForm } from './site-bloco-form'
import { SiteMidias } from './site-midias'
import { SitePublicacao } from './site-publicacao'

const botao = 'min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50'
const entrada = 'min-h-11 w-full rounded-lg border px-3 py-2 text-sm'

type Props = {
  nomeOrganizacao: string
  meuPapel: PapelOrganizacao
  site: SiteUI
  rascunho: ConteudoSite
  versoes: VersaoUI[]
  dominios: DominioUI[]
  eventos: EventoUI[]
  midias: MidiaListaUI[]
}

const slugDe = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38)

function mover<T>(lista: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta
  if (j < 0 || j >= lista.length) return lista
  const c = [...lista]
  ;[c[i], c[j]] = [c[j], c[i]]
  return c
}

export function SiteEditor({ nomeOrganizacao, meuPapel, site, rascunho, versoes, dominios, eventos, midias }: Props) {
  const router = useRouter()
  const podeEditar = podeEditarSite(meuPapel)
  const podePublicar = podePublicarSite(meuPapel)
  const [conteudo, setConteudo] = useState<ConteudoSite>(rascunho)
  const [rev, setRev] = useState(site.rascunho_rev)
  const [sujo, setSujo] = useState(false)
  const [pagIdx, setPagIdx] = useState(0)
  const [erro, setErro] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [aviso, setAviso] = useState('')
  const [novoTipo, setNovoTipo] = useState<TipoBloco>('texto')
  const [novaPagina, setNovaPagina] = useState('')
  const [nome, setNome] = useState(site.nome)
  const [slug, setSlug] = useState(site.slug)
  const [pendente, iniciar] = useTransition()
  const [desatualizado, setDesatualizado] = useState(false)

  // O servidor trouxe outra revisão (ex.: restauração de versão): adota se não há edição local; senão avisa.
  const [revVista, setRevVista] = useState(site.rascunho_rev)
  if (site.rascunho_rev !== revVista) {
    setRevVista(site.rascunho_rev)
    if (site.rascunho_rev !== rev) {
      if (!sujo) { setConteudo(rascunho); setRev(site.rascunho_rev); setPagIdx(0) } else setDesatualizado(true)
    }
  }

  const pagina = conteudo.paginas[Math.min(pagIdx, conteudo.paginas.length - 1)]
  const midiasUI = midias.map((m) => ({ id: m.id, nome: m.nome, url: m.url }))

  const alterar = (fn: (c: ConteudoSite) => ConteudoSite) => { setConteudo((c) => fn(c)); setSujo(true); setAviso('') }
  const alterarPagina = (fn: (blocos: Bloco[]) => Bloco[]) => alterar((c) => ({ ...c, paginas: c.paginas.map((p, i) => (i === pagIdx ? { ...p, blocos: fn(p.blocos) } : p)) }))

  function salvar() {
    setErro(''); setErros([]); setAviso('')
    iniciar(async () => {
      const r = await salvarRascunhoSite(site.id, conteudo, rev)
      if (r.ok) { setRev(r.revisao); setRevVista(r.revisao); setConteudo(r.conteudo); setSujo(false); setDesatualizado(false); setAviso('Rascunho salvo.'); router.refresh() }
      else { setErro(r.erro); setErros(r.erros ?? []); if (r.conflito) setDesatualizado(true) }
    })
  }

  function salvarDados(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setAviso('')
    iniciar(async () => {
      const r = await atualizarDadosSite(site.id, nome, slug)
      if (!r.ok) setErro(r.erro); else { setAviso('Nome e endereço salvos.'); router.refresh() }
    })
  }

  return (
    <section className="space-y-6" aria-label={`Site de ${nomeOrganizacao}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-5">
        <div>
          <h2 className="text-xl font-semibold">{site.nome}</h2>
          <p className="text-sm text-muted-foreground">
            Endereço: <code>/s/{site.slug}</code>
            {site.status === 'publicado' ? <> · <a className="underline" href={`/s/${site.slug}`} target="_blank" rel="noopener noreferrer">abrir site publicado</a></> : ' · ainda fora do ar'}
          </p>
          <p className="text-sm text-muted-foreground">Seu papel: {meuPapel}. {podeEditar ? '' : 'Somente leitura.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={`${botao} inline-flex items-center`} href={`/dashboard/site/previa?site=${site.id}&pagina=${pagina.slug}`} target="_blank" rel="noopener noreferrer">Prévia privada</a>
          {podeEditar && <button type="button" className={botao} disabled={pendente || !sujo} onClick={salvar}>{pendente ? 'Salvando…' : sujo ? 'Salvar rascunho' : 'Rascunho salvo'}</button>}
        </div>
      </div>

      {erro && <div role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}{erros.length > 0 && <ul className="mt-1 list-disc pl-5">{erros.map((x) => <li key={x}>{x}</li>)}</ul>}</div>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
      {desatualizado && <p role="alert" className="rounded-xl border p-3 text-sm">O rascunho mudou em outro lugar. Recarregue a página para ver a versão mais recente (suas alterações não salvas serão perdidas).</p>}
      {sujo && <p className="text-sm">Alterações não salvas. A prévia e a publicação usam o último rascunho salvo.</p>}

      <fieldset disabled={!podeEditar} className="space-y-6 border-0 p-0">
        {podePublicar && (
          <form onSubmit={salvarDados} className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm">Nome do estúdio no site
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required className={entrada} />
            </label>
            <label className="grid gap-1 text-sm">Endereço (letras, números e hífen)
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={40} required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" className={entrada} />
            </label>
            <button type="submit" className={botao} disabled={pendente}>Salvar nome e endereço</button>
          </form>
        )}

        <div className="space-y-4 rounded-2xl border p-5">
          <h3 className="text-lg font-semibold">Aparência e busca (SEO)</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">Cor de destaque
              <input type="color" value={conteudo.tema?.cor ?? '#1f2937'} onChange={(e) => alterar((c) => ({ ...c, tema: { ...c.tema, cor: e.target.value } }))} className="min-h-11 w-full rounded-lg border" />
            </label>
            <label className="grid gap-1 text-sm">Fonte
              <select value={conteudo.tema?.fonte ?? 'sans'} onChange={(e) => alterar((c) => ({ ...c, tema: { ...c.tema, fonte: e.target.value as 'sans' | 'serif' } }))} className={entrada}>
                <option value="sans">Sem serifa (moderna)</option><option value="serif">Com serifa (clássica)</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Fundo
              <select value={conteudo.tema?.modo ?? 'claro'} onChange={(e) => alterar((c) => ({ ...c, tema: { ...c.tema, modo: e.target.value as 'claro' | 'escuro' } }))} className={entrada}>
                <option value="claro">Claro</option><option value="escuro">Escuro</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">O app escolhe automaticamente texto claro ou escuro sobre a cor de destaque para manter o contraste legível.</p>
          <label className="grid gap-1 text-sm">Título nos buscadores (até 70 caracteres)
            <input value={conteudo.seo?.titulo ?? ''} maxLength={70} onChange={(e) => alterar((c) => ({ ...c, seo: { ...c.seo, titulo: e.target.value || undefined } }))} className={entrada} />
          </label>
          <label className="grid gap-1 text-sm">Descrição nos buscadores (até 200 caracteres)
            <textarea rows={2} value={conteudo.seo?.descricao ?? ''} maxLength={200} onChange={(e) => alterar((c) => ({ ...c, seo: { ...c.seo, descricao: e.target.value || undefined } }))} className={entrada} />
          </label>
          <label className="grid gap-1 text-sm">Imagem de compartilhamento (redes sociais)
            <select value={conteudo.seo?.midia_id ?? ''} onChange={(e) => alterar((c) => ({ ...c, seo: { ...c.seo, midia_id: e.target.value || undefined } }))} className={entrada}>
              <option value="">Automática</option>
              {midias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border p-5">
          <h3 className="text-lg font-semibold">Páginas</h3>
          <div role="tablist" aria-label="Páginas do site" className="flex flex-wrap gap-2">
            {conteudo.paginas.map((p, i) => (
              <button key={p.slug} type="button" role="tab" aria-selected={i === pagIdx} onClick={() => setPagIdx(i)}
                className={`min-h-11 rounded-full border px-4 text-sm ${i === pagIdx ? 'bg-foreground text-background' : ''}`}>{p.titulo}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label className="grid gap-1 text-sm">Título da página
              <input value={pagina.titulo} maxLength={60} onChange={(e) => alterar((c) => ({ ...c, paginas: c.paginas.map((p, i) => (i === pagIdx ? { ...p, titulo: e.target.value } : p)) }))} className={entrada} />
            </label>
            <button type="button" className={botao} disabled={pagIdx === 0 || pagIdx === 1} aria-label="Mover página para a esquerda" onClick={() => { alterar((c) => ({ ...c, paginas: mover(c.paginas, pagIdx, -1) })); setPagIdx(pagIdx - 1) }}>←</button>
            <button type="button" className={botao} disabled={pagIdx === 0 || pagIdx === conteudo.paginas.length - 1} aria-label="Mover página para a direita" onClick={() => { alterar((c) => ({ ...c, paginas: mover(c.paginas, pagIdx, 1) })); setPagIdx(pagIdx + 1) }}>→</button>
            <button type="button" className={botao} disabled={pagIdx === 0} onClick={() => { if (window.confirm(`Remover a página “${pagina.titulo}”?`)) { alterar((c) => ({ ...c, paginas: c.paginas.filter((_, i) => i !== pagIdx) })); setPagIdx(0) } }}>Remover página</button>
          </div>
          {conteudo.paginas.length < LIMITES_SITE.paginas && (
            <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => {
              e.preventDefault()
              const base = slugDe(novaPagina) || 'pagina'
              const usados = new Set(conteudo.paginas.map((p) => p.slug))
              let s = base === 'inicio' ? 'pagina' : base; let n = 2
              while (usados.has(s)) s = `${base}-${n++}`
              alterar((c) => ({ ...c, paginas: [...c.paginas, { slug: s, titulo: novaPagina.trim().slice(0, 60), blocos: [] }] }))
              setPagIdx(conteudo.paginas.length); setNovaPagina('')
            }}>
              <label className="grid gap-1 text-sm">Nova página
                <input value={novaPagina} onChange={(e) => setNovaPagina(e.target.value)} placeholder="Ex.: Portfólio" maxLength={60} required className={entrada} />
              </label>
              <button type="submit" className={botao}>Adicionar página</button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Blocos de “{pagina.titulo}”</h3>
          {pagina.blocos.length === 0 && <p className="text-sm text-muted-foreground">Esta página ainda não tem blocos.</p>}
          <ol className="space-y-4">
            {pagina.blocos.map((b, i) => (
              <li key={b.id} className="space-y-3 rounded-2xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium">{i + 1}. {ROTULO_BLOCO[b.tipo]}</h4>
                  <div className="flex gap-2">
                    <button type="button" className={botao} disabled={i === 0} aria-label={`Subir bloco ${ROTULO_BLOCO[b.tipo]}`} onClick={() => alterarPagina((l) => mover(l, i, -1))}>Subir</button>
                    <button type="button" className={botao} disabled={i === pagina.blocos.length - 1} aria-label={`Descer bloco ${ROTULO_BLOCO[b.tipo]}`} onClick={() => alterarPagina((l) => mover(l, i, 1))}>Descer</button>
                    <button type="button" className={botao} aria-label={`Remover bloco ${ROTULO_BLOCO[b.tipo]}`} onClick={() => { if (window.confirm('Remover este bloco?')) alterarPagina((l) => l.filter((_, j) => j !== i)) }}>Remover</button>
                  </div>
                </div>
                <BlocoForm bloco={b} midias={midiasUI} onChange={(nb) => alterarPagina((l) => l.map((x, j) => (j === i ? nb : x)))} />
              </li>
            ))}
          </ol>
          {pagina.blocos.length < LIMITES_SITE.blocosPorPagina && (
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed p-5">
              <label className="grid gap-1 text-sm">Tipo de bloco
                <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoBloco)} className={entrada}>
                  {TIPOS_BLOCO.map((t) => <option key={t} value={t}>{ROTULO_BLOCO[t]}</option>)}
                </select>
              </label>
              <button type="button" className={botao} onClick={() => alterarPagina((l) => [...l, blocoVazio(novoTipo)])}>Adicionar bloco</button>
            </div>
          )}
        </div>
      </fieldset>

      <SiteMidias organizacaoId={site.organizacao_id} midias={midias} podeEditar={podeEditar} aoMudar={() => router.refresh()} />
      <SitePublicacao site={site} versoes={versoes} dominios={dominios} eventos={eventos} podePublicar={podePublicar} podeEditar={podeEditar} sujo={sujo} aoMudar={() => router.refresh()} />
    </section>
  )
}
