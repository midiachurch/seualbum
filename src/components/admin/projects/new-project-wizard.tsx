'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VisualOptionCards } from '@/components/admin/projects/visual-option-cards'
import { UploadDropzone } from '@/components/admin/projects/upload-dropzone'
import { createProjeto } from '@/lib/actions/projetos'
import { uploadProjetoFoto } from '@/lib/upload-projeto-foto'
import {
  ALBUM_COVER_OPTIONS,
  ALBUM_FORMAT_OPTIONS,
  ALBUM_ORIENTATION_OPTIONS,
  ALBUM_TYPE_OPTIONS,
} from '@/lib/mock-projects-data'
import { cn } from '@/lib/utils'
import type {
  AlbumCoverValue,
  AlbumOrientationValue,
  AlbumTypeValue,
  Client,
  Photographer,
} from '@/types/platform'

// Inlined (não importado de '@/lib/demo-mode') porque essa checagem roda no
// navegador: NEXT_PUBLIC_SUPABASE_URL já vem embutida no bundle no build.
const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL

const STEPS = [
  { id: 1, label: 'Dados iniciais' },
  { id: 2, label: 'Configuração do produto' },
  { id: 3, label: 'Briefing' },
  { id: 4, label: 'Upload de fotos' },
]

interface Step1State {
  modoCliente: 'existente' | 'novo'
  clientId: string
  novoClienteNome: string
  novoClienteEmail: string
  fotografoId: string
  nomeProjeto: string
  tipoEvento: string
  dataEvento: string
}

interface Step2State {
  tipo: AlbumTypeValue | null
  formato: string | null
  orientacao: AlbumOrientationValue | null
  capa: AlbumCoverValue | null
  quantidadePaginas: string
}

interface Step3State {
  local: string
  quantidadePessoas: string
  estiloDesejado: string
  preferenciasDiagramacao: string
  fotosPrioritarias: string
  pessoasQueDevemAparecer: string
  momentosImportantes: string
  referencias: string
  observacoesGerais: string
  orientacaoDiagramacao: string
}

const EMPTY_STEP1: Step1State = {
  modoCliente: 'existente',
  clientId: '',
  novoClienteNome: '',
  novoClienteEmail: '',
  fotografoId: '',
  nomeProjeto: '',
  tipoEvento: '',
  dataEvento: '',
}

const EMPTY_STEP2: Step2State = { tipo: null, formato: null, orientacao: null, capa: null, quantidadePaginas: '' }

const EMPTY_STEP3: Step3State = {
  local: '',
  quantidadePessoas: '',
  estiloDesejado: '',
  preferenciasDiagramacao: '',
  fotosPrioritarias: '',
  pessoasQueDevemAparecer: '',
  momentosImportantes: '',
  referencias: '',
  observacoesGerais: '',
  orientacaoDiagramacao: '',
}

/**
 * Wizard de criação de projeto (seção 9 e 16). Em modo de demonstração, ao
 * enviar não persiste nada de verdade e mostra a tela de sucesso apontando
 * para um projeto de exemplo. Fora dele, cria o projeto de verdade
 * (`createProjeto`) e sobe as fotos staged no passo 4 para o Storage.
 */
export function NewProjectWizard({
  clients,
  photographers,
}: {
  clients: Client[]
  photographers: Photographer[]
}) {
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [novoProjetoId, setNovoProjetoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [s1, setS1] = useState<Step1State>(EMPTY_STEP1)
  const [s2, setS2] = useState<Step2State>(EMPTY_STEP2)
  const [s3, setS3] = useState<Step3State>(EMPTY_STEP3)
  const [arquivos, setArquivos] = useState<File[]>([])

  const step1Valid =
    s1.nomeProjeto.trim().length > 0 &&
    s1.fotografoId.length > 0 &&
    (s1.modoCliente === 'existente' ? s1.clientId.length > 0 : s1.novoClienteNome.trim().length > 0)
  const step2Valid = Boolean(s2.tipo && s2.formato && s2.orientacao && s2.capa)

  function goTo(target: number) {
    setStep(Math.min(4, Math.max(1, target)))
  }

  async function submit() {
    if (DEMO_MODE) {
      setDone(true)
      return
    }

    setEnviando(true)
    setErro(null)
    try {
      const projeto = await createProjeto({
        modoCliente: s1.modoCliente,
        clientId: s1.clientId,
        novoClienteNome: s1.novoClienteNome,
        novoClienteEmail: s1.novoClienteEmail,
        fotografoId: s1.fotografoId,
        nomeProjeto: s1.nomeProjeto,
        tipoEvento: s1.tipoEvento,
        dataEvento: s1.dataEvento,
        album: {
          tipo: s2.tipo!,
          formato: s2.formato!,
          orientacao: s2.orientacao!,
          capa: s2.capa!,
          quantidadePaginas: Number(s2.quantidadePaginas) || 0,
          observacoes: null,
        },
        briefing: { nomeEvento: s1.nomeProjeto, tipoEvento: s1.tipoEvento, ...s3, data: s1.dataEvento || null },
      })

      await Promise.all(
        arquivos.map(async (file) => {
          await uploadProjetoFoto(projeto.id, file, 'Fotos do briefing')
        }),
      )

      setNovoProjetoId(projeto.id)
      setDone(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar o projeto.')
    } finally {
      setEnviando(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-2xl border bg-card p-10 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-foreground" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projeto criado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>{s1.nomeProjeto}</strong> entrou na esteira de produção.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="brand">
            <Link href={novoProjetoId ? `/admin/projetos/${novoProjetoId}` : '/admin/projetos/proj-1042'}>
              {novoProjetoId ? 'Ver projeto' : 'Ver exemplo de projeto'}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/projetos">Ir para todos os projetos</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo projeto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passo {step} de {STEPS.length} — {STEPS[step - 1].label}
        </p>
      </header>

      <ol className="flex items-center gap-2">
        {STEPS.map((s) => {
          const state = s.id === step ? 'atual' : s.id < step ? 'concluido' : 'pendente'
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  state === 'atual' && 'bg-foreground text-background',
                  state === 'concluido' && 'bg-foreground/10 text-foreground',
                  state === 'pendente' && 'bg-secondary text-muted-foreground',
                )}
              >
                {state === 'concluido' ? <Check className="h-4 w-4" /> : s.id}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:inline',
                  state === 'pendente' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {s.label}
              </span>
              {s.id < STEPS.length ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          )
        })}
      </ol>

      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={s1.modoCliente === 'existente' ? 'brand' : 'outline'}
                onClick={() => setS1((f) => ({ ...f, modoCliente: 'existente' }))}
              >
                Cliente existente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={s1.modoCliente === 'novo' ? 'brand' : 'outline'}
                onClick={() => setS1((f) => ({ ...f, modoCliente: 'novo' }))}
              >
                Cadastrar novo cliente
              </Button>
            </div>

            {s1.modoCliente === 'existente' ? (
              <div className="space-y-1.5">
                <Label htmlFor="wiz-cliente">Cliente</Label>
                <select
                  id="wiz-cliente"
                  value={s1.clientId}
                  onChange={(e) => setS1((f) => ({ ...f, clientId: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-novo-nome">Nome do cliente</Label>
                  <Input
                    id="wiz-novo-nome"
                    value={s1.novoClienteNome}
                    onChange={(e) => setS1((f) => ({ ...f, novoClienteNome: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-novo-email">E-mail</Label>
                  <Input
                    id="wiz-novo-email"
                    type="email"
                    value={s1.novoClienteEmail}
                    onChange={(e) => setS1((f) => ({ ...f, novoClienteEmail: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-fotografo">Fotógrafo responsável</Label>
                <select
                  id="wiz-fotografo"
                  value={s1.fotografoId}
                  onChange={(e) => setS1((f) => ({ ...f, fotografoId: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {photographers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.estudio}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wiz-tipo-evento">Tipo de evento</Label>
                <Input
                  id="wiz-tipo-evento"
                  value={s1.tipoEvento}
                  onChange={(e) => setS1((f) => ({ ...f, tipoEvento: e.target.value }))}
                  placeholder="Casamento, aniversário, ensaio…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wiz-nome-projeto">Nome do projeto</Label>
                <Input
                  id="wiz-nome-projeto"
                  value={s1.nomeProjeto}
                  onChange={(e) => setS1((f) => ({ ...f, nomeProjeto: e.target.value }))}
                  placeholder="Ex.: Casamento Marina & Théo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wiz-data-evento">Data do evento</Label>
                <Input
                  id="wiz-data-evento"
                  type="date"
                  value={s1.dataEvento}
                  onChange={(e) => setS1((f) => ({ ...f, dataEvento: e.target.value }))}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo de álbum
              </h2>
              <VisualOptionCards options={ALBUM_TYPE_OPTIONS} value={s2.tipo} onChange={(v) => setS2((f) => ({ ...f, tipo: v }))} />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Formato</h2>
              <VisualOptionCards
                options={ALBUM_FORMAT_OPTIONS}
                value={s2.formato}
                onChange={(v) => setS2((f) => ({ ...f, formato: v }))}
                className="sm:grid-cols-4"
              />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Orientação</h2>
              <VisualOptionCards
                options={ALBUM_ORIENTATION_OPTIONS}
                value={s2.orientacao}
                onChange={(v) => setS2((f) => ({ ...f, orientacao: v }))}
              />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Capa</h2>
              <VisualOptionCards
                options={ALBUM_COVER_OPTIONS}
                value={s2.capa}
                onChange={(v) => setS2((f) => ({ ...f, capa: v }))}
              />
            </section>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="wiz-paginas">Quantidade de páginas</Label>
              <Input
                id="wiz-paginas"
                type="number"
                min={1}
                value={s2.quantidadePaginas}
                onChange={(e) => setS2((f) => ({ ...f, quantidadePaginas: e.target.value }))}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wiz-estilo">Estilo desejado</Label>
              <Input
                id="wiz-estilo"
                value={s3.estiloDesejado}
                onChange={(e) => setS3((f) => ({ ...f, estiloDesejado: e.target.value }))}
                placeholder="Clássico, moderno, minimalista…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-local">Local do evento</Label>
              <Input id="wiz-local" value={s3.local} onChange={(e) => setS3((f) => ({ ...f, local: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-pessoas">Quantidade de pessoas</Label>
              <Input
                id="wiz-pessoas"
                value={s3.quantidadePessoas}
                onChange={(e) => setS3((f) => ({ ...f, quantidadePessoas: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wiz-preferencias">Preferências de diagramação</Label>
              <Input
                id="wiz-preferencias"
                value={s3.preferenciasDiagramacao}
                onChange={(e) => setS3((f) => ({ ...f, preferenciasDiagramacao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wiz-fotos-prioritarias">Fotos prioritárias / obrigatórias</Label>
              <Input
                id="wiz-fotos-prioritarias"
                value={s3.fotosPrioritarias}
                onChange={(e) => setS3((f) => ({ ...f, fotosPrioritarias: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-pessoas-aparecer">Pessoas que precisam aparecer</Label>
              <Input
                id="wiz-pessoas-aparecer"
                value={s3.pessoasQueDevemAparecer}
                onChange={(e) => setS3((f) => ({ ...f, pessoasQueDevemAparecer: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-momentos">Momentos importantes</Label>
              <Input
                id="wiz-momentos"
                value={s3.momentosImportantes}
                onChange={(e) => setS3((f) => ({ ...f, momentosImportantes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-referencias">Referências</Label>
              <Input
                id="wiz-referencias"
                value={s3.referencias}
                onChange={(e) => setS3((f) => ({ ...f, referencias: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-orientacao-diagramacao">Orientação específica para a diagramação</Label>
              <Input
                id="wiz-orientacao-diagramacao"
                value={s3.orientacaoDiagramacao}
                onChange={(e) => setS3((f) => ({ ...f, orientacaoDiagramacao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wiz-obs-gerais">Observações gerais</Label>
              <Input
                id="wiz-obs-gerais"
                value={s3.observacoesGerais}
                onChange={(e) => setS3((f) => ({ ...f, observacoesGerais: e.target.value }))}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? <UploadDropzone onFilesChange={setArquivos} /> : null}
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Button>

        {step < STEPS.length ? (
          <Button
            type="button"
            variant="brand"
            onClick={() => goTo(step + 1)}
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
          >
            Avançar
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="brand" onClick={submit} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar projeto'}
          </Button>
        )}
      </div>
    </div>
  )
}
