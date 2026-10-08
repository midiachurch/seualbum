'use client'

import { novoUuid } from '@/store/usePedidoWizardStore'

/**
 * Envia UMA lâmina (JPG) de uma versão da prova para o Cloudflare R2:
 * pede a URL assinada em /api/uploads/lamina e faz o PUT direto (o arquivo
 * não passa pela Vercel). Devolve a chave, que vai para
 * `criarVersaoComLaminas` — lá cada chave é conferida no R2.
 *
 * Usado pelo upload manual de lâminas e pelo "Publicar versão" do editor.
 * Lança `Error` com mensagem pronta para a tela.
 */
export async function enviarLaminaR2(p: { projetoId: string; lote: string; arquivo: Blob; nome: string }): Promise<string> {
  const resposta = await fetch('/api/uploads/lamina', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projetoId: p.projetoId,
      lote: p.lote,
      idArquivo: novoUuid(),
      nome: p.nome,
      tipo: p.arquivo.type || 'image/jpeg',
      tamanho: p.arquivo.size,
    }),
  }).catch(() => null)
  if (!resposta) throw new Error('Sem conexão com o servidor. Tente de novo.')
  const json = (await resposta.json().catch(() => ({}))) as { erro?: string; key?: string; url?: string; headers?: Record<string, string> }
  if (!resposta.ok || !json.url || !json.key) {
    throw new Error(json.erro ?? (resposta.status === 401 ? 'Sua sessão expirou. Entre de novo.' : 'Não foi possível preparar o envio da lâmina.'))
  }

  const envio = await fetch(json.url, { method: 'PUT', headers: json.headers, body: p.arquivo }).catch(() => null)
  if (!envio) throw new Error('O armazenamento recusou a conexão. Confira a internet e tente de novo.')
  if (!envio.ok) throw new Error(envio.status === 403 ? 'O link de envio expirou. Tente de novo.' : 'O armazenamento recusou a lâmina. Tente de novo.')
  return json.key
}
