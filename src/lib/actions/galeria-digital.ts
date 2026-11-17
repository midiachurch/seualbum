'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/queries'
import { isDemoMode } from '@/lib/demo-mode'
import { uuidValido } from '@/lib/portal/segredos'
export async function criarGaleriaDigital(id: string, nome: string, cliente: string, email: string) {
  if (!uuidValido(id) || typeof nome!=='string' || nome.trim().length<2 || nome.length>160 || typeof cliente!=='string' || cliente.trim().length<2 || cliente.length>120 || typeof email!=='string' || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false as const,erro:'Confira o nome da galeria, nome e e-mail do cliente.'}
  if(isDemoMode()) return {ok:false as const,erro:'Demonstração: a galeria não será criada no servidor.'}
  const {supabase}=await requireUser()
  if(!supabase)return {ok:false as const,erro:'Banco indisponível.'}
  const {data,error}=await supabase.rpc('criar_galeria_digital',{p_id:id,p_nome:nome.trim(),p_cliente_nome:cliente.trim(),p_cliente_email:email.trim()})
  if(error||data!==id)return {ok:false as const,erro:'Não foi possível criar a galeria. Confira sua sessão e a configuração do banco.'}
  revalidatePath('/dashboard/galerias')
  return {ok:true as const,id}
}
