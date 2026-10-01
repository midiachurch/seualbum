/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next dev` só aceita localhost por padrão; libera o IP da rede local para
  // testar pelo celular (192.168.x.x). Não tem efeito no build de produção.
  allowedDevOrigins: ['192.168.*.*'],
  images: {
    remotePatterns: [
      // Storage público do Supabase (capas de portfólio, previews de álbum).
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Fotografias de exemplo enquanto o catálogo real (portfólio/produtos) não está cadastrado.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
