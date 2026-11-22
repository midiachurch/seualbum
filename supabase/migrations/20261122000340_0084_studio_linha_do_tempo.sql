-- STUDIO T03 (parte 2) — linha do tempo única do cliente.
-- ADITIVA, somente leitura. Consolida numa só lista, por cliente (e
-- opcionalmente por projeto): mensagens do fio cliente↔estúdio, mudanças de
-- etapa, tarefas concluídas, orçamentos vinculados e comunicações da outbox
-- (simuladas). O fio estúdio↔equipe (interno, 0037) NÃO entra: ele tem
-- política própria de leitura e não é histórico do cliente. Isolamento: toda
-- consulta parte da organização do chamador e confere o cliente contra o
-- estúdio dono; membro de outra organização recebe 42501.
-- NÃO aplicada em ambiente remoto.
begin;

create function public.linha_do_tempo_studio(p_org uuid, p_cliente uuid, p_projeto uuid default null, p_limite integer default 100)
returns table (ocorrido_em timestamptz, tipo text, titulo text, detalhe text, ref_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_dono uuid;
begin
  perform public.studio_exigir(p_org, 'leitura');
  if p_cliente is null or p_limite is null or p_limite not between 1 and 300 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select dono_id into v_dono from public.organizacoes where id = p_org;
  if not exists (select 1 from public.clientes where id = p_cliente and fotografo_id = v_dono) then
    raise exception 'Cliente não encontrado.' using errcode = '22023'; end if;
  if p_projeto is not null and not exists (
      select 1 from public.projetos where id = p_projeto and cliente_id = p_cliente and fotografo_id = v_dono) then
    raise exception 'Projeto não encontrado.' using errcode = '22023'; end if;
  return query
    select x.ocorrido_em, x.tipo, x.titulo, x.detalhe, x.ref_id from (
      -- Mensagens do fio cliente↔estúdio dos projetos do cliente.
      select m.created_at as ocorrido_em,
             case when m.tipo = 'sistema' then 'mensagem_sistema' else 'mensagem' end as tipo,
             case when m.tipo = 'sistema' then 'Aviso do sistema' else m.autor_nome end as titulo,
             case when m.apagada_em is not null then 'Mensagem apagada' else left(m.corpo, 280) end as detalhe,
             m.id as ref_id
        from public.mensagens m
        join public.conversas cv on cv.id = m.conversa_id and cv.canal = 'cliente_estudio'
        join public.projetos pj on pj.id = cv.projeto_id
       where pj.cliente_id = p_cliente and pj.fotografo_id = v_dono and (p_projeto is null or pj.id = p_projeto)
      union all
      select h.created_at, 'etapa',
             case when h.de_etapa is null then 'Entrou no funil: ' || h.para_etapa else 'Etapa: ' || h.de_etapa || ' → ' || h.para_etapa end,
             h.motivo, h.id
        from public.studio_negocio_historico h join public.studio_negocios n on n.id = h.negocio_id
       where n.cliente_id = p_cliente and n.organizacao_id = p_org and h.organizacao_id = p_org
         and (p_projeto is null or n.projeto_id = p_projeto)
      union all
      select t.concluida_em, 'tarefa_concluida', 'Tarefa concluída: ' || t.titulo, null, t.id
        from public.studio_tarefas t
       where t.organizacao_id = p_org and t.cliente_id = p_cliente and t.status = 'concluida'
         and (p_projeto is null or t.projeto_id = p_projeto)
      union all
      select o.created_at, 'orcamento', 'Orçamento ' || o.status::text,
             'R$ ' || to_char(o.valor_total, 'FM999999990.00'), o.id
        from public.orcamentos o
       where o.fotografo_id = v_dono and (
         o.id in (select n.orcamento_id from public.studio_negocios n where n.cliente_id = p_cliente and n.organizacao_id = p_org
                   and n.orcamento_id is not null and (p_projeto is null or n.projeto_id = p_projeto))
         or (p_projeto is null and o.id in (select t.orcamento_id from public.studio_tarefas t
                   where t.cliente_id = p_cliente and t.organizacao_id = p_org and t.orcamento_id is not null)))
      union all
      select coalesce(ob.enviada_em, ob.created_at), 'comunicacao',
             case ob.status when 'enviada' then 'Comunicação simulada (nada foi enviado)' else 'Comunicação ' || ob.status end,
             coalesce(nullif(ob.assunto, ''), left(ob.corpo, 120)), ob.id
        from public.studio_outbox ob
       where ob.organizacao_id = p_org and ob.cliente_id = p_cliente and p_projeto is null
    ) x
    order by x.ocorrido_em desc
    limit p_limite;
end $$;
revoke all on function public.linha_do_tempo_studio(uuid, uuid, uuid, integer) from public, anon, service_role;
grant execute on function public.linha_do_tempo_studio(uuid, uuid, uuid, integer) to authenticated;

commit;
