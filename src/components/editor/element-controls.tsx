'use client'

import type { ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Palette,
  RectangleHorizontal,
  RotateCw,
  Scaling,
  SendToBack,
  SunDim,
  Type,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type ImageKey = 'imagem-principal' | 'imagem-secundaria'

export interface ImageStyle {
  scale: number
  opacity: number
  rotate: number
  flipH: boolean
  flipV: boolean
  fit: 'cover' | 'contain'
  showCropGuide: boolean
  z: number
}

export interface TextStyle {
  font: 'display' | 'sans'
  size: number
  weight: 400 | 500 | 600
  tracking: number
  align: 'left' | 'center' | 'right'
  color: string
}

export const DEFAULT_IMAGE_STYLE: Omit<ImageStyle, 'z'> = {
  scale: 100,
  opacity: 100,
  rotate: 0,
  flipH: false,
  flipV: false,
  fit: 'cover',
  showCropGuide: false,
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'display',
  size: 24,
  weight: 500,
  tracking: 1.5,
  align: 'left',
  color: 'hsl(var(--foreground))',
}

export const TEXT_COLORS = [
  { label: 'Preto', value: 'hsl(var(--foreground))' },
  { label: 'Cinza', value: 'hsl(var(--muted-foreground))' },
  { label: 'Marinho', value: 'hsl(var(--primary))' },
  { label: 'Destaque', value: 'hsl(var(--accent))' },
]

export function composeImageTransform(style: ImageStyle) {
  const scaleX = (style.flipH ? -1 : 1) * (style.scale / 100)
  const scaleY = (style.flipV ? -1 : 1) * (style.scale / 100)
  return `rotate(${style.rotate}deg) scale(${scaleX}, ${scaleY})`
}

/** Sobreposição de regra dos terços — feedback visual do modo de corte. */
export function CropGuide() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/3 top-0 h-full w-px bg-white/70" />
      <div className="absolute left-2/3 top-0 h-full w-px bg-white/70" />
      <div className="absolute left-0 top-1/3 h-px w-full bg-white/70" />
      <div className="absolute left-0 top-2/3 h-px w-full bg-white/70" />
    </div>
  )
}

export function IconButton({
  label,
  active,
  onClick,
  size = 'md',
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  size?: 'sm' | 'md'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
        size === 'md' ? 'h-7 w-7' : 'h-6 w-6',
        active ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
}

/* ---------------------------------- toolbar ---------------------------------- */

function ImageToolbarControls({
  style,
  onChange,
  onBringToFront,
  onSendToBack,
}: {
  style: ImageStyle
  onChange: (patch: Partial<ImageStyle>) => void
  onBringToFront: () => void
  onSendToBack: () => void
}) {
  return (
    <>
      <Divider />
      <IconButton
        label="Corte"
        active={style.showCropGuide}
        onClick={() => onChange({ showCropGuide: !style.showCropGuide })}
      >
        <Crop className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label={style.fit === 'cover' ? 'Ajuste: cobrir' : 'Ajuste: conter'}
        active={style.fit === 'contain'}
        onClick={() => onChange({ fit: style.fit === 'cover' ? 'contain' : 'cover' })}
      >
        <RectangleHorizontal className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Ampliar" onClick={() => onChange({ scale: style.scale >= 130 ? 80 : style.scale + 10 })}>
        <Scaling className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="Opacidade"
        onClick={() => onChange({ opacity: style.opacity <= 20 ? 100 : style.opacity - 20 })}
      >
        <SunDim className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Girar" onClick={() => onChange({ rotate: style.rotate >= 10 ? -10 : style.rotate + 5 })}>
        <RotateCw className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Espelhar horizontal" active={style.flipH} onClick={() => onChange({ flipH: !style.flipH })}>
        <FlipHorizontal className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Espelhar vertical" active={style.flipV} onClick={() => onChange({ flipV: !style.flipV })}>
        <FlipVertical className="h-3.5 w-3.5" />
      </IconButton>
      <Divider />
      <IconButton label="Trazer para frente" onClick={onBringToFront}>
        <BringToFront className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Enviar para trás" onClick={onSendToBack}>
        <SendToBack className="h-3.5 w-3.5" />
      </IconButton>
    </>
  )
}

const WEIGHT_STEPS: TextStyle['weight'][] = [400, 500, 600]

function TextToolbarControls({
  style,
  onChange,
}: {
  style: TextStyle
  onChange: (patch: Partial<TextStyle>) => void
}) {
  return (
    <>
      <Divider />
      <IconButton
        label={style.font === 'display' ? 'Fonte: editorial' : 'Fonte: sans'}
        active={style.font === 'display'}
        onClick={() => onChange({ font: style.font === 'display' ? 'sans' : 'display' })}
      >
        <Type className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="Peso"
        onClick={() => {
          const i = WEIGHT_STEPS.indexOf(style.weight)
          onChange({ weight: WEIGHT_STEPS[(i + 1) % WEIGHT_STEPS.length] })
        }}
      >
        <Bold className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Alinhar à esquerda" active={style.align === 'left'} onClick={() => onChange({ align: 'left' })}>
        <AlignLeft className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Centralizar" active={style.align === 'center'} onClick={() => onChange({ align: 'center' })}>
        <AlignCenter className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Alinhar à direita" active={style.align === 'right'} onClick={() => onChange({ align: 'right' })}>
        <AlignRight className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="Cor"
        onClick={() => {
          const i = TEXT_COLORS.findIndex((c) => c.value === style.color)
          onChange({ color: TEXT_COLORS[(i + 1) % TEXT_COLORS.length].value })
        }}
      >
        <Palette className="h-3.5 w-3.5" />
      </IconButton>
    </>
  )
}

interface ContextualToolbarProps {
  label: string
  hasSelection: boolean
  isImage: boolean
  isText: boolean
  imageStyle?: ImageStyle
  onImageChange: (patch: Partial<ImageStyle>) => void
  onBringToFront: () => void
  onSendToBack: () => void
  textStyle: TextStyle
  onTextChange: (patch: Partial<TextStyle>) => void
  selectionKey: string
}

/** Toolbar flutuante — responde ao tipo de elemento selecionado (diretriz 18). */
export function ContextualToolbar({
  label,
  hasSelection,
  isImage,
  isText,
  imageStyle,
  onImageChange,
  onBringToFront,
  onSendToBack,
  textStyle,
  onTextChange,
  selectionKey,
}: ContextualToolbarProps) {
  return (
    <div
      className={cn(
        'absolute left-1/2 top-4 flex max-w-[92vw] -translate-x-1/2 items-center overflow-x-auto whitespace-nowrap rounded-sm border border-border bg-white px-2.5 py-1.5 text-[11px] shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-opacity duration-200 sm:top-6 sm:px-3 sm:text-xs',
        hasSelection ? 'opacity-100' : 'opacity-60',
      )}
    >
      <div key={selectionKey} className="animate-select-in flex items-center gap-1.5 sm:gap-2">
        <span className="font-medium text-foreground">{label}</span>
        {isImage && imageStyle ? (
          <ImageToolbarControls
            style={imageStyle}
            onChange={onImageChange}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
          />
        ) : null}
        {isText ? <TextToolbarControls style={textStyle} onChange={onTextChange} /> : null}
      </div>
    </div>
  )
}

/* ------------------------------ properties panel ------------------------------ */

function SliderRow({
  label,
  value,
  unit = '',
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  unit?: string
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="slider-thin w-full"
      />
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-sm border border-border p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-sm px-2 py-1 text-xs transition-colors duration-150',
            value === option.value ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface PropertiesPanelProps {
  hasSelection: boolean
  label: string
  isImage: boolean
  isText: boolean
  imageStyle?: ImageStyle
  onImageChange: (patch: Partial<ImageStyle>) => void
  onBringToFront: () => void
  onSendToBack: () => void
  textStyle: TextStyle
  onTextChange: (patch: Partial<TextStyle>) => void
  selectionKey: string
}

/** Painel lateral discreto (diretriz 16) com os controles finos da diretriz 17. */
export function PropertiesPanel({
  hasSelection,
  label,
  isImage,
  isText,
  imageStyle,
  onImageChange,
  onBringToFront,
  onSendToBack,
  textStyle,
  onTextChange,
  selectionKey,
}: PropertiesPanelProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-l border-border p-6 lg:block">
      {hasSelection ? (
        <div key={selectionKey} className="animate-select-in space-y-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</p>

          {isImage && imageStyle ? (
            <div className="space-y-5">
              <SliderRow
                label="Escala"
                value={imageStyle.scale}
                unit="%"
                min={80}
                max={130}
                onChange={(v) => onImageChange({ scale: v })}
              />
              <SliderRow
                label="Opacidade"
                value={imageStyle.opacity}
                unit="%"
                min={20}
                max={100}
                step={5}
                onChange={(v) => onImageChange({ opacity: v })}
              />
              <SliderRow
                label="Rotação"
                value={imageStyle.rotate}
                unit="°"
                min={-10}
                max={10}
                onChange={(v) => onImageChange({ rotate: v })}
              />

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Ajuste</span>
                <SegmentedControl
                  options={[
                    { label: 'Cobrir', value: 'cover' as const },
                    { label: 'Conter', value: 'contain' as const },
                  ]}
                  value={imageStyle.fit}
                  onChange={(v) => onImageChange({ fit: v })}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Grade de corte</span>
                <Switch
                  checked={imageStyle.showCropGuide}
                  onCheckedChange={(v) => onImageChange({ showCropGuide: v })}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Espelhar</span>
                <div className="flex gap-1">
                  <IconButton
                    label="Espelhar horizontal"
                    active={imageStyle.flipH}
                    onClick={() => onImageChange({ flipH: !imageStyle.flipH })}
                  >
                    <FlipHorizontal className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Espelhar vertical"
                    active={imageStyle.flipV}
                    onClick={() => onImageChange({ flipV: !imageStyle.flipV })}
                  >
                    <FlipVertical className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Camada · {imageStyle.z}</span>
                <div className="flex gap-1">
                  <IconButton label="Trazer para frente" onClick={onBringToFront}>
                    <BringToFront className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Enviar para trás" onClick={onSendToBack}>
                    <SendToBack className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </div>
          ) : null}

          {isText ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Fonte</span>
                <SegmentedControl
                  options={[
                    { label: 'Editorial', value: 'display' as const },
                    { label: 'Sans', value: 'sans' as const },
                  ]}
                  value={textStyle.font}
                  onChange={(v) => onTextChange({ font: v })}
                />
              </div>

              <SliderRow
                label="Tamanho"
                value={textStyle.size}
                unit="px"
                min={14}
                max={40}
                onChange={(v) => onTextChange({ size: v })}
              />

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Peso</span>
                <SegmentedControl
                  options={[
                    { label: 'Regular', value: 400 as const },
                    { label: 'Médio', value: 500 as const },
                    { label: 'Semibold', value: 600 as const },
                  ]}
                  value={textStyle.weight}
                  onChange={(v) => onTextChange({ weight: v })}
                />
              </div>

              <SliderRow
                label="Espaçamento"
                value={textStyle.tracking}
                unit="%"
                min={-2}
                max={8}
                onChange={(v) => onTextChange({ tracking: v })}
              />

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Alinhamento</span>
                <SegmentedControl
                  options={[
                    { label: 'Esquerda', value: 'left' as const },
                    { label: 'Centro', value: 'center' as const },
                    { label: 'Direita', value: 'right' as const },
                  ]}
                  value={textStyle.align}
                  onChange={(v) => onTextChange({ align: v })}
                />
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Cor</span>
                <div className="flex gap-2">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onClick={() => onTextChange({ color: c.value })}
                      className={cn(
                        'h-5 w-5 rounded-full ring-1 ring-offset-2 ring-offset-white transition-transform duration-150 hover:scale-110',
                        textStyle.color === c.value ? 'ring-accent' : 'ring-border',
                      )}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecione um elemento da página para ver e editar suas propriedades.
        </p>
      )}
    </aside>
  )
}
