-- 0044 — favorito manual compartilhado por projeto (ADR-003).
-- Não entrega seleção nem aprova álbum. Selfie mantém RPC independente.
begin;

create or replace function public.definir_favorito_foto(
  p_projeto_id uuid, p_foto_id uuid, p_favorita boolean
) returns boolean
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_anterior boolean;
begin
  if auth.uid() is null then
    raise exception 'Sem permissão para alterar esta foto.' using errcode = '42501';
  end if;
  -- Serializa com desativação e transferência/revogação do vínculo.
  perform 1 from public.profiles where id = auth.uid() and status = 'ativo' for share;
  if not found then
    raise exception 'Sem permissão para alterar esta foto.' using errcode = '42501';
  end if;
  perform 1 from public.projetos where id = p_projeto_id for share;
  if not found then
    raise exception 'Sem permissão para alterar esta foto.' using errcode = '42501';
  end if;
  perform 1 from public.clientes
    where id = (select cliente_id from public.projetos where id = p_projeto_id) for share;
  if not public.pode_ver_projeto(p_projeto_id) then
    raise exception 'Sem permissão para alterar esta foto.' using errcode = '42501';
  end if;
  if p_favorita is null then
    raise exception 'Valor de favorito inválido.' using errcode = '22023';
  end if;
  select favorita into v_anterior from public.fotos
    where id = p_foto_id and projeto_id = p_projeto_id for update;
  if not found then
    raise exception 'Sem permissão para alterar esta foto.' using errcode = '42501';
  end if;
  if v_anterior is distinct from p_favorita then
    update public.fotos set favorita = p_favorita
      where id = p_foto_id and projeto_id = p_projeto_id;
    insert into public.projeto_atividades(projeto_id, autor_id, mensagem)
      values (p_projeto_id, auth.uid(),
        format('Favorito manual: foto %s %s. Seleção em rascunho, sem entrega.', p_foto_id,
          case when p_favorita then 'adicionada aos favoritos' else 'removida dos favoritos' end));
  end if;
  return true;
end;
$$;
revoke all on function public.definir_favorito_foto(uuid, uuid, boolean) from public, anon, service_role;
grant execute on function public.definir_favorito_foto(uuid, uuid, boolean) to authenticated;
commit;
