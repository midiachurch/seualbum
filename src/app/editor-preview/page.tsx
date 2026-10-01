import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import { AlbumEditorPreview } from '@/components/editor/album-editor-preview'

// Fonte de CONTEÚDO do álbum (opção "display" do bloco de texto), não da
// interface — por isso carregada só nesta rota, não na raiz da aplicação.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500'], display: 'swap' })

export const metadata: Metadata = { title: 'Editor do álbum — prévia visual' }

export default function EditorPreviewPage() {
  return (
    <div className={fraunces.variable}>
      <AlbumEditorPreview />
    </div>
  )
}
