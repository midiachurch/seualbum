import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'
import { paletaDoSite } from '@/lib/sites/cores'
import { urlDaMidia } from '@/lib/sites/publico'
import { sanitizarHtmlSite } from '@/lib/sites/sanitizar'
import type { Bloco, ConteudoSite, MapaMidias, PaginaSite } from '@/lib/sites/tipos'
import { urlDeSiteValida } from '@/lib/sites/validar'

/**
 * Renderização do site (pública e prévia privada). Server components, sem JS
 * no cliente. Nada é confiado: HTML é sanitizado de novo aqui, links passam
 * pela mesma regra do banco e imagem sem alt não é desenhada.
 */

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'

function Midia({ id, alt, midias, className, prioridade, tamanhos }: { id?: string; alt?: string; midias: MapaMidias; className?: string; prioridade?: boolean; tamanhos?: string }) {
  const m = id ? midias[id] : undefined
  const src = urlDaMidia(m)
  if (!src || !alt?.trim()) return null
  return (
    <Image src={src} alt={alt} width={m?.largura ?? 1600} height={m?.altura ?? 1067} sizes={tamanhos ?? '(min-width: 1024px) 50vw, 100vw'}
      className={className} priority={prioridade} loading={prioridade ? undefined : 'lazy'} />
  )
}

function LinkSeguro({ href, children, className }: { href?: string; children: ReactNode; className?: string }) {
  if (!href || !urlDeSiteValida(href)) return null
  const externo = /^https?:/i.test(href)
  return <a href={href} className={className} {...(externo ? { rel: 'noopener noreferrer' } : {})}>{children}</a>
}

const botao = `inline-flex min-h-11 items-center justify-center rounded-full px-6 text-base font-medium [background:var(--site-acento)] [color:var(--site-sobre-acento)] hover:opacity-90 ${FOCO}`
const prosa = '[&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6'

function Secao({ id, titulo, nivel = 2, children, className }: { id: string; titulo?: string; nivel?: 1 | 2; children: ReactNode; className?: string }) {
  const H = nivel === 1 ? 'h1' : 'h2'
  const hid = `${id}-t`
  return (
    <section aria-labelledby={titulo ? hid : undefined} className={`mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 ${className ?? ''}`}>
      {titulo ? <H id={hid} className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">{titulo}</H> : null}
      {children}
    </section>
  )
}

function ContatoCanais({ d }: { d: Extract<Bloco, { tipo: 'contato' }>['dados'] }) {
  const itens: { rotulo: string; href: string; texto: string }[] = []
  if (d.email) itens.push({ rotulo: 'E-mail', href: `mailto:${d.email}`, texto: d.email })
  if (d.telefone) itens.push({ rotulo: 'Telefone', href: `tel:${d.telefone.replace(/[^0-9+]/g, '')}`, texto: d.telefone })
  if (d.whatsapp) itens.push({ rotulo: 'WhatsApp', href: `https://wa.me/${d.whatsapp}`, texto: `+${d.whatsapp}` })
  if (d.instagram) itens.push({ rotulo: 'Instagram', href: `https://instagram.com/${d.instagram}`, texto: `@${d.instagram}` })
  const principal = itens.find((i) => i.rotulo === 'WhatsApp') ?? itens[0]
  return (
    <>
      <ul className="mb-8 space-y-2 text-lg">
        {itens.map((i) => (
          <li key={i.rotulo}><span className="opacity-75">{i.rotulo}: </span><LinkSeguro href={i.href} className={`underline underline-offset-2 ${FOCO}`}>{i.texto}</LinkSeguro></li>
        ))}
      </ul>
      {d.cta_texto && principal ? <LinkSeguro href={principal.href} className={botao}>{d.cta_texto}</LinkSeguro> : null}
    </>
  )
}

function BlocoSite({ b, midias, primeiroHero }: { b: Bloco; midias: MapaMidias; primeiroHero: boolean }) {
  const id = `bloco-${b.id}`
  switch (b.tipo) {
    case 'hero': {
      const d = b.dados
      const imagem = <Midia id={d.midia_id} alt={d.alt} midias={midias} prioridade={primeiroHero} tamanhos="100vw" className="h-auto max-h-[70vh] w-full rounded-2xl object-cover" />
      return (
        <Secao id={id} className="text-center">
          {imagem ? <div className="mb-8">{imagem}</div> : null}
          {primeiroHero ? <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{d.titulo}</h1> : <h2 className="text-4xl font-semibold tracking-tight">{d.titulo}</h2>}
          {d.subtitulo ? <p className="mx-auto mt-4 max-w-2xl text-lg opacity-80 sm:text-xl">{d.subtitulo}</p> : null}
          {d.cta_texto && d.cta_url ? <div className="mt-8"><LinkSeguro href={d.cta_url} className={botao}>{d.cta_texto}</LinkSeguro></div> : null}
        </Secao>
      )
    }
    case 'texto':
      return (
        <Secao id={id} titulo={b.dados.titulo} className="max-w-3xl">
          <div className={`text-lg leading-relaxed ${prosa}`} dangerouslySetInnerHTML={{ __html: sanitizarHtmlSite(b.dados.html) }} />
        </Secao>
      )
    case 'sobre': {
      const imagem = <Midia id={b.dados.midia_id} alt={b.dados.alt} midias={midias} className="h-auto w-full rounded-2xl object-cover" tamanhos="(min-width: 768px) 40vw, 100vw" />
      return (
        <Secao id={id} titulo={b.dados.titulo}>
          <div className={imagem ? 'grid items-start gap-8 md:grid-cols-[2fr_3fr]' : 'max-w-3xl'}>
            {imagem}
            <div className={`text-lg leading-relaxed ${prosa}`} dangerouslySetInnerHTML={{ __html: sanitizarHtmlSite(b.dados.html) }} />
          </div>
        </Secao>
      )
    }
    case 'galeria': {
      const col = b.dados.colunas === 2 ? 'sm:grid-cols-2' : b.dados.colunas === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'
      return (
        <Secao id={id} titulo={b.dados.titulo}>
          <ul className={`grid grid-cols-1 gap-4 ${col}`}>
            {b.dados.itens.map((it, i) => (
              <li key={`${it.midia_id}-${i}`}>
                <figure>
                  <Midia id={it.midia_id} alt={it.alt} midias={midias} className="h-auto w-full rounded-xl object-cover" tamanhos="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                  {it.legenda ? <figcaption className="mt-2 text-sm opacity-75">{it.legenda}</figcaption> : null}
                </figure>
              </li>
            ))}
          </ul>
        </Secao>
      )
    }
    case 'servicos':
      return (
        <Secao id={id} titulo={b.dados.titulo}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {b.dados.itens.map((s, i) => (
              <li key={`${s.nome}-${i}`} className="rounded-2xl border border-current/20 p-6">
                <h3 className="text-xl font-semibold">{s.nome}</h3>
                {s.preco ? <p className="mt-1 text-lg font-medium [color:var(--site-acento-texto)]">{s.preco}</p> : null}
                {s.descricao ? <p className="mt-3 opacity-80">{s.descricao}</p> : null}
              </li>
            ))}
          </ul>
        </Secao>
      )
    case 'contato':
      return (
        <Secao id={id} titulo={b.dados.titulo} className="max-w-3xl">
          {b.dados.texto ? <p className="mb-6 text-lg opacity-80">{b.dados.texto}</p> : null}
          <ContatoCanais d={b.dados} />
        </Secao>
      )
    case 'depoimentos':
      return (
        <Secao id={id} titulo={b.dados.titulo}>
          <ul className="grid gap-6 md:grid-cols-2">
            {b.dados.itens.map((t, i) => (
              <li key={`${t.autor}-${i}`}>
                <figure className="h-full rounded-2xl border border-current/20 p-6">
                  <blockquote className="text-lg leading-relaxed">“{t.texto}”</blockquote>
                  <figcaption className="mt-4 text-sm"><span className="font-semibold">{t.autor}</span>{t.detalhe ? <span className="opacity-75"> · {t.detalhe}</span> : null}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Secao>
      )
    case 'rodape':
      return (
        <Secao id={id} className="border-t border-current/20 text-center text-sm">
          {b.dados.texto ? <p>{b.dados.texto}</p> : null}
          <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1">
            {b.dados.instagram ? <li><LinkSeguro href={`https://instagram.com/${b.dados.instagram}`} className={`inline-flex min-h-11 items-center underline underline-offset-2 ${FOCO}`}>Instagram</LinkSeguro></li> : null}
            {(b.dados.links ?? []).map((l, i) => <li key={`${l.url}-${i}`}><LinkSeguro href={l.url} className={`inline-flex min-h-11 items-center underline underline-offset-2 ${FOCO}`}>{l.rotulo}</LinkSeguro></li>)}
          </ul>
        </Secao>
      )
  }
}

/** Blocos de uma página. Sem hero, o título da página vira o h1 (oculto visualmente) para manter a hierarquia. */
export function BlocosDaPagina({ pagina, midias }: { pagina: PaginaSite; midias: MapaMidias }) {
  const primeiroHero = pagina.blocos.find((b) => b.tipo === 'hero')?.id
  return (
    <>
      {primeiroHero ? null : <h1 className="sr-only">{pagina.titulo}</h1>}
      {pagina.blocos.map((b) => <BlocoSite key={b.id} b={b} midias={midias} primeiroHero={b.id === primeiroHero} />)}
    </>
  )
}

/** Casca do site: pular para o conteúdo, cabeçalho com navegação, <main> e rodapé. */
export function SiteShell({ nome, conteudo, hrefs, paginaAtual, children, aviso }: {
  nome: string
  conteudo: ConteudoSite
  /** slug da página → endereço (calculado pelo chamador conforme o modo de acesso). */
  hrefs: Record<string, string>
  paginaAtual: string
  children: ReactNode
  /** Faixa de aviso (prévia privada). */
  aviso?: string
}) {
  const p = paletaDoSite(conteudo.tema?.cor, conteudo.tema?.modo)
  const estilo = { '--site-acento': p.acento, '--site-sobre-acento': p.textoSobreAcento, '--site-acento-texto': p.acentoNoTexto, background: p.fundo, color: p.texto } as CSSProperties
  return (
    <div style={estilo} className={`min-h-screen ${conteudo.tema?.fonte === 'serif' ? 'font-serif' : 'font-sans'}`}>
      <a href="#conteudo" className={`sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:[background:var(--site-acento)] focus:[color:var(--site-sobre-acento)] ${FOCO}`}>Pular para o conteúdo</a>
      {aviso ? <p role="status" className="bg-[#fde68a] px-4 py-2 text-center text-sm font-medium text-[#451a03]">{aviso}</p> : null}
      <header className="border-b border-current/20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <a href={hrefs.inicio} className={`text-lg font-semibold ${FOCO}`}>{nome}</a>
          {conteudo.paginas.length > 1 ? (
            <nav aria-label="Páginas do site">
              <ul className="flex flex-wrap gap-x-5">
                {conteudo.paginas.map((pg) => (
                  <li key={pg.slug}>
                    <a href={hrefs[pg.slug]} aria-current={pg.slug === paginaAtual ? 'page' : undefined}
                      className={`inline-flex min-h-11 items-center ${pg.slug === paginaAtual ? 'font-semibold underline underline-offset-4' : 'opacity-80 hover:opacity-100'} ${FOCO}`}>{pg.titulo}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>{children}</main>
      <footer className="border-t border-current/20 px-4 py-6 text-center text-sm opacity-80">© {new Date().getFullYear()} {nome}</footer>
    </div>
  )
}
