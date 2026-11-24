'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { htmlParaTexto, textoParaHtml } from '@/lib/sites/texto-rico'
import type { Bloco } from '@/lib/sites/tipos'

export type MidiaUI = { id: string; nome: string; url: string | null }

const entrada = 'min-h-11 w-full rounded-lg border px-3 py-2 text-sm'
const botaoPequeno = 'min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50'

function Campo({ rotulo, valor, onChange, max, tipo = 'text', dica, obrigatorio }: { rotulo: string; valor: string | undefined; onChange: (v: string) => void; max: number; tipo?: string; dica?: string; obrigatorio?: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{rotulo}{obrigatorio ? <span aria-hidden="true"> *</span> : null}</span>
      <input type={tipo} value={valor ?? ''} maxLength={max} required={obrigatorio} onChange={(e) => onChange(e.target.value)} className={entrada} />
      {dica ? <span className="text-xs text-muted-foreground">{dica}</span> : null}
    </label>
  )
}

function CampoLongo({ rotulo, valor, onChange, max }: { rotulo: string; valor: string | undefined; onChange: (v: string) => void; max: number }) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{rotulo}</span>
      <textarea value={valor ?? ''} maxLength={max} rows={3} onChange={(e) => onChange(e.target.value)} className={entrada} />
    </label>
  )
}

/** Texto com marcações leves (ver texto-rico.ts). Estado local: o usuário digita livremente, o HTML é derivado. */
function CampoTextoRico({ rotulo, html, onHtml }: { rotulo: string; html: string; onHtml: (h: string) => void }) {
  const [texto, setTexto] = useState(() => htmlParaTexto(html))
  return (
    <label className="grid gap-1 text-sm">
      <span>{rotulo}</span>
      <textarea value={texto} rows={6} maxLength={5000} className={entrada} onChange={(e) => { setTexto(e.target.value); onHtml(textoParaHtml(e.target.value)) }} />
      <span className="text-xs text-muted-foreground">Linha em branco separa parágrafos. Use **negrito**, *itálico*, - lista, ## título e [texto](https://link).</span>
    </label>
  )
}

function SeletorMidia({ rotulo, valor, midias, onChange, obrigatorio }: { rotulo: string; valor: string | undefined; midias: MidiaUI[]; onChange: (v: string | undefined) => void; obrigatorio?: boolean }) {
  const atual = midias.find((m) => m.id === valor)
  return (
    <div className="grid gap-1 text-sm">
      <label className="grid gap-1">
        <span>{rotulo}{obrigatorio ? <span aria-hidden="true"> *</span> : null}</span>
        <select value={valor ?? ''} required={obrigatorio} onChange={(e) => onChange(e.target.value || undefined)} className={entrada}>
          {obrigatorio ? <option value="" disabled>Escolha uma imagem</option> : <option value="">Sem imagem</option>}
          {midias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>
      {atual?.url ? <Image src={atual.url} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-md object-cover" /> : null}
      {midias.length === 0 ? <span className="text-xs text-muted-foreground">Envie imagens na Biblioteca do site (abaixo) para usá-las aqui.</span> : null}
    </div>
  )
}

function ItemDeLista({ children, onRemover, rotulo }: { children: ReactNode; onRemover: () => void; rotulo: string }) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {children}
      <button type="button" className={`${botaoPequeno} justify-self-start`} onClick={onRemover} aria-label={`Remover ${rotulo}`}>Remover item</button>
    </div>
  )
}

export function BlocoForm({ bloco, midias, onChange }: { bloco: Bloco; midias: MidiaUI[]; onChange: (b: Bloco) => void }) {
  const set = <K extends string>(chave: K, valor: unknown) => onChange({ ...bloco, dados: { ...bloco.dados, [chave]: valor } } as Bloco)
  const setItem = (i: number, campo: string, valor: unknown) => {
    const d = bloco.dados as { itens?: Record<string, unknown>[] }
    set('itens', (d.itens ?? []).map((it, j) => (j === i ? { ...it, [campo]: valor } : it)))
  }
  const addItem = (novo: Record<string, unknown>) => set('itens', [...((bloco.dados as { itens?: unknown[] }).itens ?? []), novo])
  const delItem = (i: number) => set('itens', ((bloco.dados as { itens?: unknown[] }).itens ?? []).filter((_, j) => j !== i))

  switch (bloco.tipo) {
    case 'hero': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} obrigatorio />
          <Campo rotulo="Subtítulo" valor={d.subtitulo} onChange={(v) => set('subtitulo', v)} max={240} />
          <SeletorMidia rotulo="Imagem de destaque" valor={d.midia_id} midias={midias} onChange={(v) => set('midia_id', v)} />
          {d.midia_id ? <Campo rotulo="Descrição da imagem (texto alternativo)" valor={d.alt} onChange={(v) => set('alt', v)} max={200} obrigatorio dica="Descreva a foto para quem não a enxerga. Obrigatório." /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Texto do botão" valor={d.cta_texto} onChange={(v) => set('cta_texto', v)} max={40} />
            <Campo rotulo="Link do botão" valor={d.cta_url} onChange={(v) => set('cta_url', v)} max={255} dica="https://…, mailto:, tel: ou #contato" />
          </div>
        </div>
      )
    }
    case 'texto':
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título (opcional)" valor={bloco.dados.titulo} onChange={(v) => set('titulo', v)} max={120} />
          <CampoTextoRico rotulo="Texto" html={bloco.dados.html} onHtml={(h) => set('html', h)} />
        </div>
      )
    case 'sobre': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} obrigatorio />
          <CampoTextoRico rotulo="Sua história" html={d.html} onHtml={(h) => set('html', h)} />
          <SeletorMidia rotulo="Foto sua (opcional)" valor={d.midia_id} midias={midias} onChange={(v) => set('midia_id', v)} />
          {d.midia_id ? <Campo rotulo="Descrição da imagem (texto alternativo)" valor={d.alt} onChange={(v) => set('alt', v)} max={200} obrigatorio /> : null}
        </div>
      )
    }
    case 'galeria': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título (opcional)" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} />
          <label className="grid gap-1 text-sm">Colunas
            <select value={d.colunas ?? 3} onChange={(e) => set('colunas', Number(e.target.value))} className={entrada}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </label>
          {d.itens.map((it, i) => (
            <ItemDeLista key={i} rotulo={`foto ${i + 1}`} onRemover={() => delItem(i)}>
              <SeletorMidia rotulo={`Foto ${i + 1}`} valor={it.midia_id} midias={midias} onChange={(v) => setItem(i, 'midia_id', v)} obrigatorio />
              <Campo rotulo="Descrição (texto alternativo)" valor={it.alt} onChange={(v) => setItem(i, 'alt', v)} max={200} obrigatorio />
              <Campo rotulo="Legenda (opcional)" valor={it.legenda} onChange={(v) => setItem(i, 'legenda', v)} max={200} />
            </ItemDeLista>
          ))}
          {d.itens.length < 30 ? <button type="button" className={`${botaoPequeno} justify-self-start`} onClick={() => addItem({ midia_id: '', alt: '' })}>Adicionar foto</button> : null}
        </div>
      )
    }
    case 'servicos': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título (opcional)" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} />
          {d.itens.map((it, i) => (
            <ItemDeLista key={i} rotulo={`serviço ${i + 1}`} onRemover={() => delItem(i)}>
              <Campo rotulo="Nome do serviço" valor={it.nome} onChange={(v) => setItem(i, 'nome', v)} max={80} obrigatorio />
              <Campo rotulo="Preço (texto livre)" valor={it.preco} onChange={(v) => setItem(i, 'preco', v)} max={40} dica="Ex.: A partir de R$ 800" />
              <CampoLongo rotulo="Descrição" valor={it.descricao} onChange={(v) => setItem(i, 'descricao', v)} max={300} />
            </ItemDeLista>
          ))}
          {d.itens.length < 12 ? <button type="button" className={`${botaoPequeno} justify-self-start`} onClick={() => addItem({ nome: '' })}>Adicionar serviço</button> : null}
        </div>
      )
    }
    case 'contato': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} obrigatorio />
          <CampoLongo rotulo="Texto (opcional)" valor={d.texto} onChange={(v) => set('texto', v)} max={500} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="E-mail" tipo="email" valor={d.email} onChange={(v) => set('email', v)} max={254} />
            <Campo rotulo="Telefone" valor={d.telefone} onChange={(v) => set('telefone', v)} max={30} />
            <Campo rotulo="WhatsApp (só dígitos, com DDI)" valor={d.whatsapp} onChange={(v) => set('whatsapp', v.replace(/\D/g, ''))} max={15} dica="Ex.: 5511999999999" />
            <Campo rotulo="Instagram (sem @)" valor={d.instagram} onChange={(v) => set('instagram', v.replace(/^@/, ''))} max={30} />
          </div>
          <Campo rotulo="Texto do botão de contato (opcional)" valor={d.cta_texto} onChange={(v) => set('cta_texto', v)} max={40} />
          <p className="text-xs text-muted-foreground">Informe ao menos um canal. O site mostra estes dados publicamente; nenhum cadastro privado é exposto.</p>
        </div>
      )
    }
    case 'depoimentos': {
      const d = bloco.dados
      return (
        <div className="grid gap-3">
          <Campo rotulo="Título (opcional)" valor={d.titulo} onChange={(v) => set('titulo', v)} max={120} />
          {d.itens.map((it, i) => (
            <ItemDeLista key={i} rotulo={`depoimento ${i + 1}`} onRemover={() => delItem(i)}>
              <CampoLongo rotulo="Depoimento" valor={it.texto} onChange={(v) => setItem(i, 'texto', v)} max={500} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Quem disse" valor={it.autor} onChange={(v) => setItem(i, 'autor', v)} max={80} obrigatorio />
                <Campo rotulo="Detalhe (ex.: Casamento 2025)" valor={it.detalhe} onChange={(v) => setItem(i, 'detalhe', v)} max={80} />
              </div>
            </ItemDeLista>
          ))}
          {d.itens.length < 10 ? <button type="button" className={`${botaoPequeno} justify-self-start`} onClick={() => addItem({ texto: '', autor: '' })}>Adicionar depoimento</button> : null}
        </div>
      )
    }
    case 'rodape': {
      const d = bloco.dados
      const links = d.links ?? []
      const setLinks = (l: typeof links) => set('links', l.length ? l : undefined)
      return (
        <div className="grid gap-3">
          <Campo rotulo="Texto" valor={d.texto} onChange={(v) => set('texto', v)} max={200} />
          <Campo rotulo="Instagram (sem @)" valor={d.instagram} onChange={(v) => set('instagram', v.replace(/^@/, ''))} max={30} />
          {links.map((l, i) => (
            <ItemDeLista key={i} rotulo={`link ${i + 1}`} onRemover={() => setLinks(links.filter((_, j) => j !== i))}>
              <Campo rotulo="Rótulo" valor={l.rotulo} onChange={(v) => setLinks(links.map((x, j) => (j === i ? { ...x, rotulo: v } : x)))} max={40} obrigatorio />
              <Campo rotulo="Link" valor={l.url} onChange={(v) => setLinks(links.map((x, j) => (j === i ? { ...x, url: v } : x)))} max={255} obrigatorio />
            </ItemDeLista>
          ))}
          {links.length < 6 ? <button type="button" className={`${botaoPequeno} justify-self-start`} onClick={() => setLinks([...links, { rotulo: '', url: '' }])}>Adicionar link</button> : null}
        </div>
      )
    }
  }
}
