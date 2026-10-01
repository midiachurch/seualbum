-- O site público (anon) precisa ler a linha de media_assets referenciada por
-- um banner ativo ou um item de portfólio publicado — sem isso, a Fase 7 não
-- consegue montar a URL da imagem, mesmo com o bucket midia_vitrine público.
-- Ativos fora desse uso (ex.: tag "Referências", uploads ainda não usados)
-- continuam visíveis só para admin/gestor.
drop policy if exists "media_assets_select_equipe" on public.media_assets;
drop policy if exists "media_assets_select_publico_ou_equipe" on public.media_assets;
create policy "media_assets_select_publico_ou_equipe"
  on public.media_assets for select to anon, authenticated
  using (
    public.is_gestor_ou_admin()
    or exists (select 1 from public.banners b where b.imagem_id = media_assets.id and b.ativo)
    or exists (
      select 1 from public.portfolio_items pi
      join public.portfolio_collections pc on pc.id = pi.collection_id
      where pi.imagem_id = media_assets.id and pc.status = 'publicado'
    )
    or exists (select 1 from public.portfolio_collections pc where pc.capa_imagem_id = media_assets.id and pc.status = 'publicado')
  );
