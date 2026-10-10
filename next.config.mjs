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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next dev` só aceita localhost por padrão; libera o IP da rede local para
  // testar pelo celular (192.168.x.x). Não tem efeito no build de produção.
  allowedDevOrigins: ['192.168.*.*'],
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
