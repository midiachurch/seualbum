-- Criação digital independente de pedido de diagramação/produção física.
begin;
create function public.criar_galeria_digital(p_id uuid,p_nome text,p_cliente_nome text,p_cliente_email text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cliente uuid; v public.projetos; c public.clientes;
begin
 perform 1 from public.profiles where id=auth.uid() and role='fotografo' and status='ativo' for share;
 if not found then raise exception 'Sem permissão.' using errcode='42501'; end if;
 perform 1 from public.fotografos where id=auth.uid() and status='ativo' for share;
 if not found then raise exception 'Sem permissão.' using errcode='42501'; end if;
 if p_id is null or p_nome is null or length(trim(p_nome)) not between 2 and 160 or p_cliente_nome is null or length(trim(p_cliente_nome)) not between 2 and 120 or p_cliente_email is null or length(p_cliente_email)>254 or p_cliente_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Dados inválidos.' using errcode='22023'; end if;
 -- Serializa a mesma chave sem depender de autenticação fictícia para cliente.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,47));
 select * into v from public.projetos where id=p_id;
 if found then
  if v.fotografo_id<>auth.uid() then raise exception 'Sem permissão.' using errcode='42501'; end if;
  select * into c from public.clientes where id=v.cliente_id;
  if v.nome<>trim(p_nome) or c.nome<>trim(p_cliente_nome) or c.email<>lower(trim(p_cliente_email)) then raise exception 'Chave já utilizada com outros dados.' using errcode='22023'; end if;
  return v.id;
 end if;
 -- Reutiliza cadastro comercial do próprio fotógrafo quando nome/e-mail coincidem.
 select id into v_cliente from public.clientes where fotografo_id=auth.uid() and email=lower(trim(p_cliente_email)) and nome=trim(p_cliente_nome) and status='ativo' order by created_at limit 1;
 if v_cliente is null then
  insert into public.clientes(fotografo_id,nome,email) values(auth.uid(),trim(p_cliente_nome),lower(trim(p_cliente_email))) returning id into v_cliente;
 end if;
 insert into public.projetos(id,nome,cliente_id,fotografo_id) values(p_id,trim(p_nome),v_cliente,auth.uid());
 insert into public.projeto_atividades(projeto_id,autor_id,mensagem) values(p_id,auth.uid(),'Galeria digital criada, sem contratação de diagramação.');
 return p_id;
end $$;
revoke all on function public.criar_galeria_digital(uuid,text,text,text) from public,anon,service_role;
grant execute on function public.criar_galeria_digital(uuid,text,text,text) to authenticated;
commit;
