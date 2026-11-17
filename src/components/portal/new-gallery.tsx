'use client'
import { useRef,useState,useTransition } from 'react'
import {useRouter} from 'next/navigation'
import {criarGaleriaDigital} from '@/lib/actions/galeria-digital'
export function NewGallery(){
 const [pendente,iniciar]=useTransition(),[erro,setErro]=useState('');const id=useRef<string|null>(null),router=useRouter()
 return <form className="space-y-3 rounded-2xl border p-5" onChange={()=>{id.current=null}} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);iniciar(async()=>{id.current??=crypto.randomUUID();const r=await criarGaleriaDigital(id.current,String(f.get('nome')),String(f.get('cliente')),String(f.get('email')));if(r.ok)router.push(`/dashboard/albuns/${r.id}/compartilhar`);else setErro(r.erro)})}}>
 <h2 className="text-xl font-semibold">Nova galeria digital</h2><p className="text-sm text-muted-foreground">Crie a galeria sem contratar diagramação. Seu cliente acessará por link e código, sem cadastro.</p>
 <label className="block">Nome da galeria<input name="nome" required minLength={2} maxLength={160} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
 <label className="block">Nome do cliente<input name="cliente" required minLength={2} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
 <label className="block">E-mail do cliente<input name="email" type="email" required maxLength={254} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
 <button disabled={pendente} className="min-h-11 rounded-full bg-primary px-5 text-primary-foreground">{pendente?'Criando…':'Criar galeria'}</button><p role="alert">{erro}</p></form>
}
