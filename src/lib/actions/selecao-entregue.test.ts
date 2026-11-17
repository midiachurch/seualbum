import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc:vi.fn(), requireUser:vi.fn(), revalidatePath:vi.fn(), demo:false }))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidatePath}))
vi.mock('@/lib/supabase/queries',()=>({requireUser:mocks.requireUser}))
vi.mock('@/lib/demo-mode',()=>({isDemoMode:()=>mocks.demo}))
vi.mock('@/lib/r2/cliente',()=>({urlDeLeitura:vi.fn()}))
const { entregarSelecao } = await import('./selecao-entregue')
const { manifestoCsv,entradaValida } = await import('@/lib/selecao-entregue/contrato')
const projeto='c2000000-0000-4000-8000-000000000001',foto='c4000000-0000-4000-8000-000000000001',chave='c5000000-0000-4000-8000-000000000001'
beforeEach(()=>{vi.clearAllMocks();mocks.demo=false;mocks.requireUser.mockResolvedValue({supabase:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{id:chave,revisao:1,total:1},error:null})})
describe('entrega de seleção',()=>{
 it('usa comando separado de favorito e retorna entrega confirmada',async()=>{
  expect(await entregarSelecao(projeto,[foto],0,chave)).toEqual({ok:true,entrega:{id:chave,revisao:1,total:1}})
  expect(mocks.rpc).toHaveBeenCalledWith('entregar_selecao',{p_projeto_id:projeto,p_foto_ids:[foto],p_revisao_esperada:0,p_chave:chave})
 })
 it('rejeita duplicatas sem RPC',async()=>{expect((await entregarSelecao(projeto,[foto,foto],0,chave)).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled()})
 it.each([-1,1.5,NaN])('rejeita revisão inválida %s',async(r)=>{expect((await entregarSelecao(projeto,[foto],r,chave)).ok).toBe(false)})
 it('não simula entrega em demo',async()=>{mocks.demo=true;expect((await entregarSelecao(projeto,[foto],0,chave)).ok).toBe(false);expect(mocks.requireUser).not.toHaveBeenCalled()})
 it('sinaliza conflito sem expor detalhe SQL',async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:'40001',message:'interno'}});const r=await entregarSelecao(projeto,[foto],0,chave);expect(r).toMatchObject({ok:false,conflito:true});expect(JSON.stringify(r)).not.toContain('interno');expect(mocks.revalidatePath).not.toHaveBeenCalled()})
 it('falha de rede permite retry com mesma chave',async()=>{mocks.rpc.mockRejectedValueOnce(new Error('rede'));expect((await entregarSelecao(projeto,[foto],0,chave)).ok).toBe(false);expect((await entregarSelecao(projeto,[foto],0,chave)).ok).toBe(true)})
 it('não aceita sucesso malformado',async()=>{mocks.rpc.mockResolvedValue({data:{id:'x'},error:null});expect((await entregarSelecao(projeto,[foto],0,chave)).ok).toBe(false)})
 it('limita lote e rejeita IDs inválidos',()=>{expect(entradaValida(projeto,Array(1001).fill(foto),0,chave)).toBe(false);expect(entradaValida(projeto,['novo-1'],0,chave)).toBe(false)})
 it('manifesto preserva desconhecido e neutraliza fórmula de planilha',()=>{const csv=manifestoCsv([{foto_id:foto,bucket:'r2',storage_path:'x',nome_original:'=SOMA(1)'},{foto_id:chave,bucket:'r2',storage_path:'y',nome_original:null}]);expect(csv).toContain('"\'=SOMA(1)"');expect(csv).toContain(`"${chave}","","r2","y"`)})
})

describe('exportação autorizada',()=>{
 function banco(selecao: boolean, fotos: {foto_id:string;bucket:string;storage_path:string;nome_original:string|null}[]){
  return {from:(t:string)=>{
   const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:selecao?{id:chave}:null,error:null}),order:async()=>({data:t==='selecao_entregue_fotos'?fotos:[],error:null})}
   return q
  }}
 }
 it('seleção invisível não chega à assinatura',async()=>{
  const {exportarSelecao}=await import('./selecao-entregue')
  const {urlDeLeitura}=await import('@/lib/r2/cliente')
  mocks.requireUser.mockResolvedValue({supabase:banco(false,[])})
  expect((await exportarSelecao(chave)).ok).toBe(false);expect(urlDeLeitura).not.toHaveBeenCalled()
 })
 it('snapshot autorizado gera manifesto e link temporário do bucket privado',async()=>{
  const {exportarSelecao}=await import('./selecao-entregue')
  const {urlDeLeitura}=await import('@/lib/r2/cliente')
  vi.mocked(urlDeLeitura).mockResolvedValue('https://arquivo.invalid/temporario')
  mocks.requireUser.mockResolvedValue({supabase:banco(true,[{foto_id:foto,bucket:'r2',storage_path:'projeto/foto.jpg',nome_original:'DSC.jpg'}])})
  const r=await exportarSelecao(chave)
  expect(r.ok).toBe(true);expect(urlDeLeitura).toHaveBeenCalledWith('projeto/foto.jpg',{expiraEmS:300,nomeDownload:'DSC.jpg'})
  if(r.ok){expect(r.csv).toContain('DSC.jpg');expect(r.arquivos).toEqual([{fotoId:foto,nomeOriginal:'DSC.jpg',url:'https://arquivo.invalid/temporario'}])}
 })
 it('bucket fora do contrato falha sem URL pública improvisada',async()=>{
  const {exportarSelecao}=await import('./selecao-entregue')
  mocks.requireUser.mockResolvedValue({supabase:banco(true,[{foto_id:foto,bucket:'publico',storage_path:'x',nome_original:null}])})
  expect((await exportarSelecao(chave)).ok).toBe(false)
 })
})
