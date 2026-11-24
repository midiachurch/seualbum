import type { DestinoAlbum } from '@/lib/design-selecao/contrato'

/**
 * Regras de teclado e foco do formulário "Criar álbum a partir da seleção",
 * puras para serem testadas sem navegador (D04). O componente só aplica o que
 * estas funções decidem.
 */

export type EstadoFormulario = { destino: DestinoAlbum; precisaFormato: boolean; ocupado: boolean }

/** Ids dos controles focáveis, na ordem em que o Tab os percorre. */
export function idsFocaveis(prefixo: string, e: Pick<EstadoFormulario, 'destino' | 'precisaFormato'>): string[] {
  // Radios nativos: só o marcado entra na sequência do Tab; as setas trocam a escolha.
  const ids = [`${prefixo}-destino-${e.destino}`]
  if (e.destino === 'avulso') ids.push(`${prefixo}-nome`)
  if (e.precisaFormato) ids.push(`${prefixo}-formato`, `${prefixo}-orientacao`)
  ids.push(`${prefixo}-criar`, `${prefixo}-cancelar`)
  return ids
}

/** Foco inicial ao abrir o formulário: o destino marcado. */
export function focoInicial(prefixo: string, destino: DestinoAlbum) {
  return `${prefixo}-destino-${destino}`
}

/** Escape fecha, exceto durante o envio (para não perder a confirmação do servidor). */
export function acaoDaTecla(tecla: string, e: Pick<EstadoFormulario, 'ocupado'>): 'cancelar' | 'nenhuma' {
  return tecla === 'Escape' && !e.ocupado ? 'cancelar' : 'nenhuma'
}

/** Foco ao fechar: volta para quem abriu (se ainda existir). */
export function focoAoFechar(prefixoGatilho: string, revisao: number) {
  return `${prefixoGatilho}-${revisao}`
}
