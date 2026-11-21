-- Pergunta "cabe este envio?" para a franquia de armazenamento (0050).
-- Só decide sobre NOVOS envios: leitura, visualização e download nunca passam
-- por aqui. Sem plano ativo, sempre permite (padrão de mercado: sem plano não
-- há franquia a aplicar). O consumo é do dono do projeto, não de quem envia, e
-- a função devolve apenas um booleano para não expor o consumo a clientes
-- finais nem à equipe. A aplicação na rota é opcional (flag) e desligada por
-- padrão. NÃO aplicada em ambiente remoto.
begin;

create function public.franquia_permite_envio(p_projeto uuid, p_bytes bigint) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_dono uuid; v_cap bigint; v_usado bigint;
begin
  if auth.uid() is null or not public.pode_ver_projeto(p_projeto) then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_bytes is null or p_bytes <= 0 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select p.fotografo_id into v_dono from public.projetos p where p.id = p_projeto;
  if v_dono is null then return true; end if;
  select a.armazenamento_bytes into v_cap from public.assinaturas_galeria a where a.fotografo_id = v_dono and a.status = 'ativa';
  if v_cap is null then return true; end if;
  select coalesce(sum(f.tamanho_bytes), 0) into v_usado
    from public.fotos f join public.projetos p on p.id = f.projeto_id
   where p.fotografo_id = v_dono and f.bucket = 'r2';
  return v_usado + p_bytes <= v_cap;
end $$;
revoke all on function public.franquia_permite_envio(uuid, bigint) from public, anon, service_role;
grant execute on function public.franquia_permite_envio(uuid, bigint) to authenticated;

commit;
