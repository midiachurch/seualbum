import { previaLocalAtiva } from '@/lib/previa-local/ambiente'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SiteCriar } from '@/components/dashboard/site-criar'
import { SiteEditor } from '@/components/dashboard/site-editor'
import { urlPublica } from '@/lib/r2/cliente'
import { requireUser } from '@/lib/supabase/queries'
import { conteudoInicial, type ConteudoSite } from '@/lib/sites/tipos'
import { podePublicarSite } from '@/lib/sites/ui'
import { validarConteudoSite } from '@/lib/sites/validar'

export const metadata: Metadata = { title: 'Site', robots: { index: false } }

export default async function SitePage() {
  if (previaLocalAtiva()) redirect('/previa/sites')
  const { profile, supabase } = await requireUser()
  if (profile?.role !== 'fotografo') notFound()
  const organizacoes = supabase ? await supabase.from('organizacoes').select('id,nome,dono_id,created_at').order('created_at') : null
  const lista = organizacoes?.data ?? []

  const blocos = supabase ? await Promise.all(lista.map(async (org) => {
    const [papel, site] = await Promise.all([
      supabase.rpc('papel_na_organizacao', { p_org: org.id }),
      supabase.from('sites').select('id,organizacao_id,slug,nome,status,rascunho,rascunho_rev,versao_publicada_id,publicado_em').eq('organizacao_id', org.id).maybeSingle(),
    ])
    if (!site.data) return { org, papel: papel.data, erro: Boolean(papel.error || site.error), site: null }
    const [versoes, dominios, eventos, midias] = await Promise.all([
      supabase.from('site_versoes').select('id,numero,nota,created_at').eq('site_id', site.data.id).order('numero', { ascending: false }).limit(30),
      supabase.from('site_dominios').select('id,dominio,status,token,ativo,falhou_motivo').eq('site_id', site.data.id).order('created_at'),
      supabase.from('site_eventos').select('id,acao,detalhe,created_at').eq('site_id', site.data.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('site_midias').select('id,nome,chave,largura_px,altura_px').eq('organizacao_id', org.id).order('created_at', { ascending: false }).limit(300),
    ])
    return {
      org, papel: papel.data, erro: Boolean(papel.error || versoes.error || dominios.error || midias.error),
      site: site.data, versoes: versoes.data ?? [], dominios: dominios.data ?? [], eventos: eventos.data ?? [],
      midias: (midias.data ?? []).map((m) => ({ id: m.id, nome: m.nome, url: urlPublica(m.chave), largura: m.largura_px, altura: m.altura_px })),
    }
  })) : []

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Site</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seu portfólio na internet, montado com blocos. Você edita o rascunho, vê a prévia privada e só depois publica.</p>
      </div>
      {organizacoes?.error ? <p role="status" className="text-sm">Site temporariamente indisponível.</p>
        : !supabase ? <p role="status" className="text-sm">O editor de site não está disponível no modo de demonstração.</p>
        : !lista.length ? <p className="text-sm text-muted-foreground">Seu estúdio ainda não tem organização configurada.</p>
        : blocos.map((b) => {
          if (b.erro || !b.papel) return <p key={b.org.id} role="status" className="text-sm">O site de {b.org.nome} está temporariamente indisponível.</p>
          if (!b.site) {
            return podePublicarSite(b.papel)
              ? <section key={b.org.id} className="space-y-3" aria-label={`Criar site de ${b.org.nome}`}><h2 className="text-xl font-semibold">{b.org.nome}</h2><SiteCriar organizacaoId={b.org.id} nomeSugerido={b.org.nome} /></section>
              : <p key={b.org.id} className="text-sm text-muted-foreground">{b.org.nome} ainda não tem site. Peça ao dono ou a um administrador para criá-lo.</p>
          }
          const v = validarConteudoSite(b.site.rascunho)
          const rascunho: ConteudoSite = v.ok ? v.conteudo : (b.site.rascunho as unknown as ConteudoSite) ?? conteudoInicial(b.site.nome)
          return (
            <SiteEditor key={b.site.id} nomeOrganizacao={b.org.nome} meuPapel={b.papel} site={b.site} rascunho={rascunho}
              versoes={b.versoes ?? []} dominios={b.dominios ?? []} eventos={b.eventos ?? []} midias={b.midias ?? []} />
          )
        })}
    </main>
  )
}
