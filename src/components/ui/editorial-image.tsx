import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Tratamentos de imagem do sistema editorial (Diretriz 25). Cada projeto/seção
 * escolhe o enquadramento — nunca distorce, sempre object-cover dentro da proporção.
 */
const ASPECT_CLASSES = {
  landscape: 'aspect-[4/3]',
  portrait: 'aspect-[3/4]',
  square: 'aspect-square',
  editorial: 'aspect-[16/10]',
  'full-bleed': 'aspect-auto h-full w-full',
} as const

export type ImageAspect = keyof typeof ASPECT_CLASSES

interface EditorialImageProps extends Omit<ImageProps, 'fill' | 'className'> {
  aspect?: ImageAspect
  className?: string
  containerClassName?: string
}

export function EditorialImage({
  aspect = 'editorial',
  className,
  containerClassName,
  alt,
  ...props
}: EditorialImageProps) {
  return (
    <div className={cn('relative overflow-hidden', ASPECT_CLASSES[aspect], containerClassName)}>
      <Image fill alt={alt} className={cn('object-cover', className)} {...props} />
    </div>
  )
}
