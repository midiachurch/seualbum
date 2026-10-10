'use client'

/**
 * Upload direto navegador → Cloudflare R2, nos 3 passos usados em todo o app
 * (ver /api/uploads/*):
 *   1. POST na rota de assinatura → { key, url, headers };
 *   2. PUT do arquivo direto no R2 (não passa pela Vercel);
 *   3. POST na rota de confirmação (se houver) com a chave — o servidor
 *      confere no R2 (HeadObject) e grava a chave no banco.
 *
 * Lança `Error` com mensagem pronta para a tela.
 */

async function postJson(rota: string, corpo: unknown): Promise<Record<string, unknown>> {
  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  }).catch(() => null)
  if (!resposta) throw new Error('Sem conexão com o servidor. Tente de novo.')
  const json = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok) {
    const padrao: Record<number, string> = {
      401: 'Sua sessão expirou. Entre de novo e tente outra vez.',
      503: 'Envio de arquivos indisponível no momento. Tente mais tarde.',
    }
    throw new Error(typeof json.erro === 'string' ? json.erro : (padrao[resposta.status] ?? 'Falha no envio. Tente de novo.'))
  }
  return json
}

/** Passos 1 e 2: assina e envia. Devolve a chave do objeto no R2. */
export async function enviarArquivoR2(rotaAssinar: string, corpo: Record<string, unknown>, arquivo: Blob): Promise<string> {
  const assinatura = await postJson(rotaAssinar, corpo)
  if (typeof assinatura.url !== 'string' || typeof assinatura.key !== 'string') throw new Error('Não foi possível preparar o envio.')

  const envio = await fetch(assinatura.url, {
    method: 'PUT',
    headers: assinatura.headers as Record<string, string>,
    body: arquivo,
  }).catch(() => null)
  // Sem resposta: CORS do bucket, rede caindo no meio do arquivo ou URL expirada.
  if (!envio) throw new Error('O armazenamento recusou a conexão. Confira a internet e tente de novo.')
  if (!envio.ok) throw new Error(envio.status === 403 ? 'O link de envio expirou. Tente de novo.' : 'O armazenamento recusou o arquivo. Tente de novo.')
  return assinatura.key
}

/** Os 3 passos. Devolve a resposta da confirmação (com a `key`). */
export async function enviarEConfirmarR2(
  rota: string,
  corpo: Record<string, unknown>,
  arquivo: Blob,
  confirmacao: Record<string, unknown> = {},
): Promise<Record<string, unknown> & { key: string }> {
  const key = await enviarArquivoR2(rota, corpo, arquivo)
  const r = await postJson(`${rota}/confirmar`, { ...confirmacao, key })
  return { ...r, key }
}
