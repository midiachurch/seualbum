'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Estado do wizard de novo pedido (/dashboard/novo-pedido).
 *
 * Persistido em `localStorage` (não `sessionStorage`) de propósito: no celular o
 * fotógrafo sai para o WhatsApp buscar o link das fotos e o sistema pode matar a
 * aba em segundo plano — `sessionStorage` morreria junto com ela.
 *
 * `skipHydration` evita divergência de hidratação: o HTML do servidor sempre
 * nasce com o estado inicial, e o wizard chama `persist.rehydrate()` num efeito
 * depois de montar (ver `useWizardHydrated`).
 */

export const TOTAL_STEPS = 5

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface DadosProjeto {
  /** Nome do casal ou do evento — vira `nome_projeto` do pedido. */
  nomeProjeto: string
  /** yyyy-mm-dd, formato nativo do <input type="date">. */
  dataEvento: string
  nomeCliente: string
  telefoneCliente: string
  emailCliente: string
}

export type StatusUpload = 'fila' | 'enviando' | 'enviado' | 'erro'

/**
 * Metadados de uma foto do passo 3. O `File` em si não cabe no `localStorage`
 * — fica num Map em memória (`src/lib/upload-pedido-foto.ts`); aqui vai só o
 * que sobrevive a um reload: nome, tamanho, status e o path final no Storage.
 */
export interface ArquivoFoto {
  id: string
  nome: string
  tamanho: number
  status: StatusUpload
  erro?: string
  /** `pedidos_fotos/{userId}/{chaveIdempotencia}/…`, preenchido quando `enviado`. */
  storagePath?: string
}

export interface FotosPedido {
  /** Fallback Drive/Dropbox/WeTransfer — vira `link_fotos_brutas`. */
  linkExterno: string
  arquivos: ArquivoFoto[]
}

export interface BriefingPedido {
  estilo: string
  observacoes: string
}

interface WizardState {
  /**
   * Identifica este rascunho no banco (`orders.chave_idempotencia`, UNIQUE).
   * Nasce com o rascunho e só muda no `limparPedido()` — reenviar o mesmo
   * rascunho devolve o pedido já criado em vez de duplicar.
   */
  chaveIdempotencia: string
  stepAtual: WizardStep
  planoSelecionado: string | null
  dadosProjeto: DadosProjeto
  fotos: FotosPedido
  briefing: BriefingPedido
}

interface WizardActions {
  irPara: (step: WizardStep) => void
  avancar: () => void
  voltar: () => void
  selecionarPlano: (planoId: string | null) => void
  atualizarProjeto: (patch: Partial<DadosProjeto>) => void
  atualizarFotos: (patch: Partial<FotosPedido>) => void
  adicionarArquivos: (arquivos: ArquivoFoto[]) => void
  atualizarArquivo: (id: string, patch: Partial<ArquivoFoto>) => void
  removerArquivo: (id: string) => void
  atualizarBriefing: (patch: Partial<BriefingPedido>) => void
  /** Descarta o rascunho (depois do envio com sucesso). */
  limparPedido: () => void
}

export type PedidoWizardStore = WizardState & WizardActions

/**
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS ou localhost) —
 * abrindo pelo IP da rede no celular (http://192.168…) ele é `undefined`.
 * `getRandomValues` funciona em qualquer contexto; monta um UUID v4 com ele.
 */
export function novoUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const estadoInicial = (): WizardState => ({
  chaveIdempotencia: novoUuid(),
  stepAtual: 1,
  planoSelecionado: null,
  dadosProjeto: {
    nomeProjeto: '',
    dataEvento: '',
    nomeCliente: '',
    telefoneCliente: '',
    emailCliente: '',
  },
  fotos: { linkExterno: '', arquivos: [] },
  briefing: { estilo: '', observacoes: '' },
})

function clampStep(step: number): WizardStep {
  return Math.min(Math.max(step, 1), TOTAL_STEPS) as WizardStep
}

export const usePedidoWizardStore = create<PedidoWizardStore>()(
  persist(
    (set) => ({
      ...estadoInicial(),

      irPara: (step) => set({ stepAtual: clampStep(step) }),
      avancar: () => set((s) => ({ stepAtual: clampStep(s.stepAtual + 1) })),
      voltar: () => set((s) => ({ stepAtual: clampStep(s.stepAtual - 1) })),

      selecionarPlano: (planoId) => set({ planoSelecionado: planoId }),
      atualizarProjeto: (patch) => set((s) => ({ dadosProjeto: { ...s.dadosProjeto, ...patch } })),
      atualizarFotos: (patch) => set((s) => ({ fotos: { ...s.fotos, ...patch } })),
      // Mesmo nome e tamanho = mesma foto: substitui a entrada antiga (é assim
      // que o fotógrafo reenvia uma foto que falhou ou foi interrompida).
      adicionarArquivos: (novos) =>
        set((s) => {
          const chave = (a: ArquivoFoto) => `${a.nome}:${a.tamanho}`
          const substituidas = new Set(novos.map(chave))
          return {
            fotos: {
              ...s.fotos,
              arquivos: [...s.fotos.arquivos.filter((a) => !substituidas.has(chave(a))), ...novos],
            },
          }
        }),
      removerArquivo: (id) =>
        set((s) => ({
          fotos: { ...s.fotos, arquivos: s.fotos.arquivos.filter((a) => a.id !== id) },
        })),
      atualizarArquivo: (id, patch) =>
        set((s) => ({
          fotos: {
            ...s.fotos,
            arquivos: s.fotos.arquivos.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          },
        })),
      atualizarBriefing: (patch) => set((s) => ({ briefing: { ...s.briefing, ...patch } })),

      limparPedido: () => set(estadoInicial()),
    }),
    {
      name: 'seualbum:novo-pedido',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ chaveIdempotencia, stepAtual, planoSelecionado, dadosProjeto, fotos, briefing }) => ({
        chaveIdempotencia,
        stepAtual,
        planoSelecionado,
        dadosProjeto,
        fotos,
        briefing,
      }),
      // Um upload que estava em andamento quando a aba morreu não vai terminar
      // sozinho — volta como erro para o fotógrafo reenviar. Rascunho salvo
      // antes da chave existir fica com a chave nova de `current`.
      merge: (persisted, current) => {
        const salvo = (persisted ?? {}) as Partial<WizardState>
        const fotos = salvo.fotos ?? current.fotos
        return {
          ...current,
          ...salvo,
          fotos: {
            ...fotos,
            arquivos: fotos.arquivos.map((a) =>
              a.status === 'fila' || a.status === 'enviando'
                ? { ...a, status: 'erro' as const, erro: 'Envio interrompido. Selecione a foto de novo.' }
                : a,
            ),
          },
        }
      },
    },
  ),
)

/** Link precisa ser HTTPS — é o que a equipe abre para baixar as fotos brutas. */
export function linkFotosValido(link: string) {
  try {
    return new URL(link.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

/** Regra de "pode avançar" de cada passo — o rodapé usa isso para habilitar o botão. */
export function passoCompleto(state: WizardState, step: WizardStep): boolean {
  switch (step) {
    case 1:
      return state.planoSelecionado !== null
    case 2:
      return state.dadosProjeto.nomeProjeto.trim().length >= 2
    case 3:
      // Selecionou fotos: todas precisam terminar (as com erro são reenviadas
      // ou removidas). Sem fotos, vale o link externo.
      if (state.fotos.arquivos.length > 0) {
        return state.fotos.arquivos.every((a) => a.status === 'enviado')
      }
      return linkFotosValido(state.fotos.linkExterno)
    case 4:
      // `estilo_design` é obrigatório no pedido; as observações são livres.
      return state.briefing.estilo !== ''
    case 5:
      return ([1, 2, 3, 4] as const).every((s) => passoCompleto(state, s))
  }
}
