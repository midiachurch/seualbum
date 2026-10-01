'use client'

import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Link2,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WizardField } from '@/components/dashboard/novo-pedido/steps/field'
import {
  adicionarFotos,
  reenviarComErro,
  reenviarFoto,
  removerFoto,
  resumoUpload,
  temArquivoEmMemoria,
} from '@/lib/upload-pedido-foto'
import { cn, formatarTamanho } from '@/lib/utils'
import { linkFotosValido, usePedidoWizardStore, type ArquivoFoto } from '@/store/usePedidoWizardStore'

/**
 * Passo 3: upload direto da galeria (principal) e link externo (fallback para
 * galerias enormes ou conexão ruim). Sem miniaturas de propósito: decodificar
 * dezenas de JPEGs de 24 MP no Safari do iPhone derruba a aba — a lista por
 * nome e status é leve com qualquer quantidade de fotos.
 */
export function StepFotos({ userId }: { userId: string }) {
  const chave = usePedidoWizardStore((s) => s.chaveIdempotencia)
  const arquivos = usePedidoWizardStore((s) => s.fotos.arquivos)
  const link = usePedidoWizardStore((s) => s.fotos.linkExterno)
  const atualizarFotos = usePedidoWizardStore((s) => s.atualizarFotos)

  const inputRef = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [mostrarLink, setMostrarLink] = useState(link !== '')
  const [arrastando, setArrastando] = useState(false)

  const ctx = { userId, chave }
  const resumo = resumoUpload(arquivos)
  const pendentes = arquivos.filter((a) => a.status !== 'enviado')
  const enviados = arquivos.filter((a) => a.status === 'enviado')
  const podeReenviarErros = arquivos.some((a) => a.status === 'erro' && temArquivoEmMemoria(a.id))
  const erroLink = link.trim() && !linkFotosValido(link) ? 'Cole um link completo, começando com https://' : null

  function receber(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    const { repetidas } = adicionarFotos(files, ctx)
    setAviso(
      repetidas > 0
        ? `${repetidas} ${repetidas === 1 ? 'foto já estava' : 'fotos já estavam'} na lista e ${repetidas === 1 ? 'foi ignorada' : 'foram ignoradas'}.`
        : null,
    )
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          receber(e.target.files)
          // Permite escolher de novo a mesma foto (ex.: depois de um erro).
          e.target.value = ''
        }}
      />

      {arquivos.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            receber(e.dataTransfer.files)
          }}
          className={cn(
            'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
            arrastando ? 'border-[#171717] bg-[#F5F5F5]' : 'border-[#D4D4D4] bg-[#FAFAFA]',
          )}
        >
          <ImagePlus className="h-9 w-9 text-[#6B6B6B]" aria-hidden />
          <div>
            <p className="text-base font-semibold text-[#171717]">Envie as fotos do evento</p>
            <p className="mt-1 text-sm text-[#595959]">JPG, PNG ou HEIC, até 50 MB cada.</p>
          </div>
          <Button
            type="button"
            variant="brand"
            onClick={() => inputRef.current?.click()}
            className="h-14 w-full text-base"
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            Selecionar fotos da galeria
          </Button>
          <p className="hidden text-sm text-[#6B6B6B] sm:block">ou arraste as fotos para cá</p>
        </div>
      ) : (
        <ResumoEnvio
          resumo={resumo}
          podeReenviarErros={podeReenviarErros}
          onReenviarErros={() => reenviarComErro(ctx)}
          onAdicionar={() => inputRef.current?.click()}
        />
      )}

      <p aria-live="polite" className="text-sm text-[#595959] empty:hidden">
        {aviso}
      </p>

      {pendentes.length > 0 ? (
        <ul className="divide-y divide-[#EAEAEA] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
          {pendentes.map((arquivo) => (
            <LinhaArquivo
              key={arquivo.id}
              arquivo={arquivo}
              onReenviar={() => reenviarFoto(arquivo.id, ctx)}
              onRemover={() => removerFoto(arquivo.id)}
            />
          ))}
        </ul>
      ) : null}

      {enviados.length > 0 ? (
        <details className="group rounded-2xl border border-[#EAEAEA] bg-white">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-[#444444] [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              {enviados.length} {enviados.length === 1 ? 'foto enviada' : 'fotos enviadas'}
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-[#EAEAEA] border-t border-[#EAEAEA]">
            {enviados.map((arquivo) => (
              <LinhaArquivo key={arquivo.id} arquivo={arquivo} onRemover={() => removerFoto(arquivo.id)} />
            ))}
          </ul>
        </details>
      ) : null}

      <div className="pt-1">
        {mostrarLink ? (
          <WizardField
            label="Link da pasta (Drive, Dropbox, WeTransfer)"
            opcional={arquivos.length > 0}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://drive.google.com/…"
            enterKeyHint="done"
            value={link}
            onChange={(e) => atualizarFotos({ linkExterno: e.target.value })}
            erro={erroLink}
            hint="Confira se a pasta está liberada para quem tiver o link."
          />
        ) : (
          <button
            type="button"
            onClick={() => setMostrarLink(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-sm font-medium text-[#555555] underline underline-offset-4 hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Galeria muito grande? Envie um link do Drive ou Dropbox
          </button>
        )}
      </div>
    </div>
  )
}

function ResumoEnvio({
  resumo,
  podeReenviarErros,
  onReenviarErros,
  onAdicionar,
}: {
  resumo: ReturnType<typeof resumoUpload>
  podeReenviarErros: boolean
  onReenviarErros: () => void
  onAdicionar: () => void
}) {
  const concluido = !resumo.emAndamento && resumo.comErro === 0

  return (
    <section
      aria-label="Andamento do envio"
      className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-bold text-[#171717]">
          {resumo.enviados} de {resumo.total} {resumo.total === 1 ? 'foto' : 'fotos'}
        </p>
        <p className="shrink-0 text-sm tabular-nums text-[#595959]">
          {formatarTamanho(resumo.bytesEnviados)} de {formatarTamanho(resumo.bytesTotal)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Fotos enviadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={resumo.percentual}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EAEAEA]"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            concluido ? 'bg-emerald-600' : 'bg-[#171717]',
            resumo.emAndamento && resumo.percentual === 0 && 'w-1/12 animate-pulse',
          )}
          style={resumo.percentual > 0 ? { width: `${resumo.percentual}%` } : undefined}
        />
      </div>

      <div aria-live="polite" className="mt-3 text-sm">
        {resumo.emAndamento ? (
          <p className="flex items-center gap-2 font-medium text-[#444444]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Enviando… mantenha esta tela aberta.
          </p>
        ) : resumo.comErro > 0 ? (
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {resumo.comErro} {resumo.comErro === 1 ? 'foto não foi enviada' : 'fotos não foram enviadas'}
          </p>
        ) : (
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Todas as fotos foram enviadas.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="brandOutline" onClick={onAdicionar} className="h-11 flex-1 text-sm">
          <ImagePlus className="h-4 w-4" aria-hidden />
          Adicionar mais
        </Button>
        {podeReenviarErros && !resumo.emAndamento ? (
          <Button type="button" variant="brand" onClick={onReenviarErros} className="h-11 flex-1 text-sm">
            <RotateCw className="h-4 w-4" aria-hidden />
            Tentar de novo
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function LinhaArquivo({
  arquivo,
  onReenviar,
  onRemover,
}: {
  arquivo: ArquivoFoto
  onReenviar?: () => void
  onRemover: () => void
}) {
  const podeReenviar = arquivo.status === 'erro' && onReenviar && temArquivoEmMemoria(arquivo.id)

  return (
    <li className="flex min-h-[56px] items-center gap-3 py-1.5 pl-4 pr-1">
      <StatusIcone status={arquivo.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#171717]">{arquivo.nome}</p>
        {/* Erro quebra linha: é a instrução do que fazer, não pode sumir no "…". */}
        <p className={cn('text-xs', arquivo.status === 'erro' ? 'text-destructive' : 'truncate text-[#6B6B6B]')}>
          {arquivo.status === 'erro'
            ? arquivo.erro
            : arquivo.status === 'fila'
              ? `Na fila · ${formatarTamanho(arquivo.tamanho)}`
              : arquivo.status === 'enviando'
                ? `Enviando · ${formatarTamanho(arquivo.tamanho)}`
                : formatarTamanho(arquivo.tamanho)}
        </p>
      </div>

      {podeReenviar ? (
        <button
          type="button"
          onClick={onReenviar}
          aria-label={`Tentar enviar ${arquivo.nome} de novo`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#444444] hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {arquivo.status !== 'enviando' ? (
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${arquivo.nome}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <span className="h-11 w-11 shrink-0" aria-hidden />
      )}
    </li>
  )
}

function StatusIcone({ status }: { status: ArquivoFoto['status'] }) {
  if (status === 'enviando') return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#171717]" aria-hidden />
  if (status === 'enviado') return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
  if (status === 'erro') return <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
  return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#D4D4D4]" aria-hidden />
}
