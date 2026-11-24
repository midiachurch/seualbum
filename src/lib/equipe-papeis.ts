import type { PapelOrganizacao } from '@/types/database'

/** Rótulos e descrições dos papéis da equipe do estúdio (0051). */
export const PAPEIS_EQUIPE: Record<PapelOrganizacao, { rotulo: string; descricao: string }> = {
  dono: { rotulo: 'Dono', descricao: 'Responsável pela conta e pelo plano. Não pode ser removido.' },
  admin: { rotulo: 'Administrador', descricao: 'Gerencia a equipe (exceto outros administradores e o dono).' },
  editor: { rotulo: 'Editor', descricao: 'Produz: trabalha nas galerias e álbuns do estúdio.' },
  visualizador: { rotulo: 'Visualizador', descricao: 'Somente leitura.' },
}

export const PAPEIS_CONVITE = ['admin', 'editor', 'visualizador'] as const
