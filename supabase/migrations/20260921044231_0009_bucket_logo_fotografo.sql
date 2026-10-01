-- Bucket público para o logo do estúdio do fotógrafo (usado na tela pública
-- de orçamento). Convenção de path: fotografo_logos/{fotografo_id}/{arquivo}
-- — cada fotógrafo só escreve dentro da própria pasta.

insert into storage.buckets (id, name, public, file_size_limit)
values ('fotografo_logos', 'fotografo_logos', true, 5242880) -- 5 MB
on conflict (id) do nothing;

drop policy if exists "fotografo_logos_read_public" on storage.objects;
create policy "fotografo_logos_read_public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'fotografo_logos');

drop policy if exists "fotografo_logos_write_dono" on storage.objects;
create policy "fotografo_logos_write_dono" on storage.objects for all to authenticated
  using (bucket_id = 'fotografo_logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotografo_logos' and (storage.foldername(name))[1] = auth.uid()::text);
