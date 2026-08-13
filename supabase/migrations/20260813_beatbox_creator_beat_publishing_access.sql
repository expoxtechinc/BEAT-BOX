-- Permit Professional Mode creators to publish their own marketplace beats.
-- Ownership, public discovery, and private-master folder boundaries remain unchanged.

drop policy if exists "BeatBox sellers create own beats" on public.beats;
drop policy if exists beats_insert_seller on public.beats;
create policy "BeatBox creators create own beats" on public.beats
  for insert to authenticated
  with check (seller_id = auth.uid() and public.is_beatbox_creator());

drop policy if exists "BeatBox seller cover uploads" on storage.objects;
create policy "BeatBox creators upload beat covers" on storage.objects
  for all to authenticated
  using (bucket_id = 'beat-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'beat-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());

drop policy if exists "BeatBox seller preview uploads" on storage.objects;
create policy "BeatBox creators upload beat previews" on storage.objects
  for all to authenticated
  using (bucket_id = 'beat-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'beat-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());

drop policy if exists "BeatBox seller master access" on storage.objects;
create policy "BeatBox creators manage beat masters" on storage.objects
  for all to authenticated
  using (bucket_id = 'beat-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'beat-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());
