/**
 * Domínio público do Cloudflare R2 (vitrine e logos — R2_PUBLIC_URL). Lido no
 * build: trocar a variável exige um novo deploy para o next/image aceitar.
 */
function padraoR2Publico() {
  try {
    const u = new URL(process.env.R2_PUBLIC_URL ?? '')
    return [{ protocol: u.protocol.replace(':', ''), hostname: u.hostname, pathname: '/**' }]
  } catch {
    return []
  }
}

/** Origem (esquema + host) de uma URL de env, ou `null` se ausente/inválida. */
function origemDe(valor) {
  try {
    return new URL(valor ?? '').origin
  } catch {
    return null
  }
}

/**
 * Content-Security-Policy em modo REPORT-ONLY (não bloqueia nada; o navegador
 * só registra violações no console). Domínios levantados do código:
 *   - Supabase (NEXT_PUBLIC_SUPABASE_URL): REST/Auth/Storage + Realtime (wss);
 *     `*.supabase.co` para imagens antigas do Storage público da vitrine;
 *   - Cloudflare R2: domínio público (R2_PUBLIC_URL) e URLs assinadas de
 *     upload/leitura em `*.r2.cloudflarestorage.com`;
 *   - Stripe: Checkout hospedado (checkout.stripe.com) e js.stripe.com;
 *   - Google Fonts: só o CSS do código de barras (barcode.tsx) — o resto vem
 *     de next/font (servido do próprio domínio);
 *   - picsum.photos: fotos de exemplo do catálogo;
 *   - vercel.live: barra de comentários dos deploys de preview da Vercel.
 * `'unsafe-inline'` em script-src é exigido pelos scripts inline do Next sem
 * nonce; `'unsafe-eval'` só em dev (React usa eval para depuração).
 */
function cspReportOnly() {
  const dev = process.env.NODE_ENV === 'development'
  const supabase = origemDe(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseWs = supabase ? supabase.replace(/^http/, 'ws') : null
  const r2Publico = origemDe(process.env.R2_PUBLIC_URL)
  const lista = (...itens) => itens.filter(Boolean).join(' ')

  const diretivas = {
    'default-src': lista("'self'"),
    'script-src': lista("'self'", "'unsafe-inline'", dev && "'unsafe-eval'", 'https://js.stripe.com', 'https://vercel.live'),
    'style-src': lista("'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'),
    'img-src': lista(
      "'self'", 'data:', 'blob:', supabase, 'https://*.supabase.co', r2Publico,
      'https://*.r2.cloudflarestorage.com', 'https://picsum.photos', 'https://fastly.picsum.photos',
      'https://vercel.live', 'https://vercel.com',
    ),
    'font-src': lista("'self'", 'data:', 'https://fonts.gstatic.com', 'https://vercel.live'),
    'connect-src': lista(
      "'self'", supabase, supabaseWs, r2Publico, 'https://*.r2.cloudflarestorage.com',
      'https://checkout.stripe.com', 'https://vercel.live', 'wss://ws-us3.pusher.com',
    ),
    'media-src': lista("'self'", 'blob:', r2Publico),
    'worker-src': lista("'self'", 'blob:'),
    'frame-src': lista('https://js.stripe.com', 'https://checkout.stripe.com', 'https://vercel.live'),
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': lista("'self'", 'https://checkout.stripe.com'),
    'frame-ancestors': "'none'",
  }
  return Object.entries(diretivas)
    .map(([nome, valor]) => `${nome} ${valor}`)
    .join('; ')
}

/** Cabeçalhos de segurança aplicados a todas as rotas (páginas, API e estáticos). */
function cabecalhosDeSeguranca() {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Câmera só na própria origem: a selfie do "Encontrar minhas fotos" (getUserMedia).
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()' },
    // Ignorado pelos navegadores em http (localhost/IP da rede no dev).
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly() },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next dev` só aceita localhost por padrão; libera o IP da rede local para
  // testar pelo celular (192.168.x.x). Não tem efeito no build de produção.
  allowedDevOrigins: ['192.168.*.*'],
  async headers() {
    return [{ source: '/:path*', headers: cabecalhosDeSeguranca() }]
  },
  images: {
    remotePatterns: [
      // Storage público do Supabase (arquivos antigos da vitrine, de antes do R2).
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Bucket público do R2 (biblioteca de mídia: banners e portfólio).
      ...padraoR2Publico(),
      // Fotografias de exemplo enquanto o catálogo real (portfólio/produtos) não está cadastrado.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
