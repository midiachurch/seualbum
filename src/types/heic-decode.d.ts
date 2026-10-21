/** heic-decode (libheif em WebAssembly) não traz tipos. Só a imagem principal do arquivo. */
declare module 'heic-decode' {
  export default function decode(entrada: { buffer: ArrayBuffer | Uint8Array }): Promise<{
    width: number
    height: number
    /** RGBA, 4 bytes por pixel. */
    data: Uint8ClampedArray
  }>
}
