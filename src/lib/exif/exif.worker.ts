/// <reference lib="webworker" />
/**
 * Web Worker da leitura de EXIF: tira o parse da thread principal, para a tela
 * do upload não engasgar com centenas de fotos. Recebe o File (clonável) e
 * devolve só os dois campos que interessam.
 */
import { extrairMetadados } from './extrair'

self.onmessage = async (e: MessageEvent<{ id: number; arquivo: Blob }>) => {
  const meta = await extrairMetadados(e.data.arquivo)
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ id: e.data.id, meta })
}
