#!/usr/bin/env node
/**
 * Copia para o Cloudflare R2 os arquivos que ainda estão no Supabase Storage
 * e aponta as linhas do banco para a chave nova (migration 0034). OPCIONAL: o
 * app já lê os dois lugares (leitura dupla); isto só serve para esvaziar os
 * buckets antigos depois.
 *
 *   node --env-file=.env.local scripts/copiar-storage-para-r2.mjs            # só lista (dry-run)
 *   node --env-file=.env.local scripts/copiar-storage-para-r2.mjs --aplicar  # copia e atualiza o banco
 *   ... --so=fotos,midia,logos,albuns                                        # escolhe as partes
 *
 * Precisa de: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ignora RLS),
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e, para
 * vitrine/logos, R2_PUBLIC_BUCKET e R2_PUBLIC_URL. Exige a 0034 aplicada.
 *
 * Seguro de repetir: só pega linha que ainda não está no R2. NUNCA apaga nada
 * do Supabase — esvaziar os buckets antigos é decisão manual, depois de
 * conferir o app. Ordem por arquivo: copia para o R2, confere (HeadObject) e
 * só então atualiza a linha.
 *
 * Fica de fora: lâminas antigas de `versoes_laminas` (bucket `projetos_fotos`)
 * — continuam sendo lidas de lá.
 */

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--aplicar')
const SO = (process.argv.find((a) => a.startsWith('--so='))?.slice(5) ?? 'fotos,midia,logos,albuns').split(',')

function exigir(nome) {
  const v = process.env[nome]
  if (!v) {
    console.error(`Falta a variável ${nome}.`)
    process.exit(1)
  }
  return v
}

const supabase = createClient(exigir('NEXT_PUBLIC_SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${exigir('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: exigir('R2_ACCESS_KEY_ID'), secretAccessKey: exigir('R2_SECRET_ACCESS_KEY') },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})
const BUCKET_PRIVADO = exigir('R2_BUCKET')
const precisaPublico = SO.includes('midia') || SO.includes('logos')
const BUCKET_PUBLICO = precisaPublico ? exigir('R2_PUBLIC_BUCKET') : null
const URL_PUBLICA = precisaPublico ? exigir('R2_PUBLIC_URL').replace(/\/+$/, '') : null

/** Igual a `nomeSeguro` de src/lib/r2/chaves.ts. */
function nomeSeguro(nome) {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-80) || 'foto'
  )
}
const urlPublica = (key) => `${URL_PUBLICA}/${key.split('/').map(encodeURIComponent).join('/')}`

const total = { copiados: 0, pulados: 0, falhas: 0 }

// Bucket PÚBLICO só recebe imagem raster: os buckets antigos `midia_vitrine` e
// `fotografo_logos` não tinham lista de tipos, então podem guardar SVG/HTML —
// servidos do nosso domínio público, viram XSS armazenado. Mesmas listas de
// MIMES_MIDIA / MIMES_LOGO (src/lib/r2/chaves.ts).
const MIMES_MIDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MIMES_LOGO = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Baixa do Supabase, envia ao R2 e confere. Devolve true se o objeto está no R2.
 * Com `mimes`, recusa (sem copiar) arquivo de outro tipo.
 */
async function copiar(bucketOrigem, path, bucketR2, key, mimes = null) {
  if (!APLICAR) {
    console.log(`[dry-run] ${bucketOrigem}/${path} → ${bucketR2}/${key}`)
    return false
  }
  try {
    const { data, error } = await supabase.storage.from(bucketOrigem).download(path)
    if (error || !data) throw error ?? new Error('arquivo vazio')
    const tipo = (data.type || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    if (mimes && !mimes.has(tipo)) throw new Error(`tipo ${tipo} recusado para ${bucketR2} (fica no Supabase)`)
    const bytes = new Uint8Array(await data.arrayBuffer())
    await r2.send(new PutObjectCommand({ Bucket: bucketR2, Key: key, Body: bytes, ContentType: tipo }))
    await r2.send(new HeadObjectCommand({ Bucket: bucketR2, Key: key }))
    total.copiados++
    return true
  } catch (e) {
    total.falhas++
    console.error(`[falha] ${bucketOrigem}/${path}:`, e?.message ?? e)
    return false
  }
}

/** Todas as linhas de uma consulta, de 1000 em 1000. */
async function todas(montar) {
  const linhas = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) return linhas
  }
}

async function fotosDoProjeto() {
  // `pedidos_fotos` também: fotos de pedidos convertidos antes da 0031.
  const linhas = await todas(() =>
    supabase.from('fotos').select('id, projeto_id, storage_path, bucket').in('bucket', ['projetos_fotos', 'pedidos_fotos']).order('id'),
  )
  console.log(`fotos: ${linhas.length} no Supabase Storage`)
  for (const f of linhas) {
    const key = `projetos/${f.projeto_id}/fotos/${f.id}-${nomeSeguro(f.storage_path.split('/').pop() ?? 'foto')}`
    if (!(await copiar(f.bucket, f.storage_path, BUCKET_PRIVADO, key))) continue
    const { error } = await supabase.from('fotos').update({ bucket: 'r2', storage_path: key, url: null }).eq('id', f.id).eq('bucket', f.bucket)
    if (error) (total.falhas++, console.error('[falha] update fotos', f.id, error.message))
  }
}

async function midia() {
  const linhas = await todas(() => supabase.from('media_assets').select('id, storage_path, nome').eq('bucket', 'midia_vitrine').order('id'))
  console.log(`media_assets: ${linhas.length} no midia_vitrine`)
  for (const m of linhas) {
    const key = `vitrine/${m.id}-${nomeSeguro(m.storage_path.split('/').pop() ?? m.nome)}`
    if (!(await copiar('midia_vitrine', m.storage_path, BUCKET_PUBLICO, key, MIMES_MIDIA))) continue
    const { error } = await supabase.from('media_assets').update({ bucket: 'r2', storage_path: key, url: urlPublica(key) }).eq('id', m.id)
    if (error) (total.falhas++, console.error('[falha] update media_assets', m.id, error.message))
  }
}

async function logos() {
  const linhas = await todas(() => supabase.from('fotografos').select('id, logo_url, logo_bucket').not('logo_url', 'is', null).order('id'))
  const antigos = linhas.filter((f) => f.logo_bucket !== 'r2' && f.logo_url.includes('/fotografo_logos/'))
  console.log(`logos: ${antigos.length} no fotografo_logos`)
  for (const f of antigos) {
    const path = decodeURIComponent(f.logo_url.split('/fotografo_logos/')[1].split('?')[0])
    const key = `logos/${f.id}/${crypto.randomUUID()}-${nomeSeguro(path.split('/').pop() ?? 'logo')}`
    if (!(await copiar('fotografo_logos', path, BUCKET_PUBLICO, key, MIMES_LOGO))) continue
    const { error } = await supabase.from('fotografos').update({ logo_path: key, logo_bucket: 'r2', logo_url: urlPublica(key) }).eq('id', f.id)
    if (error) (total.falhas++, console.error('[falha] update fotografos', f.id, error.message))
  }
}

/** Caminho antigo do álbum ({album}/...) → chave no R2: o mesmo caminho com o prefixo `albuns/`. */
const noR2 = (p) => typeof p === 'string' && p.startsWith('albuns/')

async function migrarCaminhos(paths) {
  const mapa = new Map()
  for (const p of paths) {
    if (noR2(p) || mapa.has(p)) continue
    if (await copiar('albuns_fotos', p, BUCKET_PRIVADO, `albuns/${p}`)) mapa.set(p, `albuns/${p}`)
  }
  return mapa
}

async function albuns() {
  const layouts = await todas(() => supabase.from('album_layouts').select('id, fotos, derivados').order('id'))
  console.log(`album_layouts: ${layouts.length} álbuns para conferir`)
  for (const a of layouts) {
    const derivados = a.derivados ?? {}
    const paths = [...(a.fotos ?? []).map((f) => f.path), ...Object.values(derivados).flatMap((d) => [d.mini, d.preview])]
    if (paths.every(noR2)) {
      total.pulados++
      continue
    }
    const mapa = await migrarCaminhos(paths)
    if (mapa.size === 0) continue
    const troca = (p) => mapa.get(p) ?? p
    const fotos = (a.fotos ?? []).map((f) => ({ ...f, path: troca(f.path) }))
    const novosDerivados = Object.fromEntries(Object.entries(derivados).map(([id, d]) => [id, { ...d, mini: troca(d.mini), preview: troca(d.preview) }]))
    // Grava só `fotos`/`derivados`: o documento (e a trava `revisao`) não muda.
    const { error } = await supabase.from('album_layouts').update({ fotos, derivados: novosDerivados }).eq('id', a.id)
    if (error) (total.falhas++, console.error('[falha] update album_layouts', a.id, error.message))
  }

  const aprovacoes = await todas(() => supabase.from('album_aprovacoes').select('id, laminas').order('id'))
  console.log(`album_aprovacoes: ${aprovacoes.length} links para conferir`)
  for (const ap of aprovacoes) {
    const laminas = ap.laminas ?? []
    if (laminas.every((l) => noR2(l.path))) continue
    const mapa = await migrarCaminhos(laminas.map((l) => l.path))
    if (mapa.size === 0) continue
    const { error } = await supabase
      .from('album_aprovacoes')
      .update({ laminas: laminas.map((l) => ({ ...l, path: mapa.get(l.path) ?? l.path })) })
      .eq('id', ap.id)
    if (error) (total.falhas++, console.error('[falha] update album_aprovacoes', ap.id, error.message))
  }
}

console.log(APLICAR ? 'Modo: APLICAR (copia e atualiza o banco)' : 'Modo: dry-run (nada é gravado; use --aplicar)')
if (SO.includes('fotos')) await fotosDoProjeto()
if (SO.includes('midia')) await midia()
if (SO.includes('logos')) await logos()
if (SO.includes('albuns')) await albuns()
console.log(`Fim. Copiados: ${total.copiados}; álbuns já no R2: ${total.pulados}; falhas: ${total.falhas}.`)
console.log('Nada foi apagado do Supabase Storage.')
process.exit(total.falhas > 0 ? 1 : 0)
