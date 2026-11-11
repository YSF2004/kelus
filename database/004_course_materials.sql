-- Private, authenticated material metadata and PDFs. Local storage remains the
-- guest/offline fallback; signed-in users can recover sources across devices.
create table if not exists course_materials (
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  course_id text not null,
  kind text not null check (kind in ('pdf', 'video', 'link')),
  title text not null,
  source_url text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  role text not null,
  processing_status text not null,
  storage_path text,
  added_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);

alter table course_materials enable row level security;
create index if not exists course_materials_user_course_added_idx on course_materials (user_id, course_id, added_at desc);

drop policy if exists "course_materials_select_own" on course_materials;
drop policy if exists "course_materials_insert_own" on course_materials;
drop policy if exists "course_materials_update_own" on course_materials;
drop policy if exists "course_materials_delete_own" on course_materials;
create policy "course_materials_select_own" on course_materials for select using (auth.uid() = user_id);
create policy "course_materials_insert_own" on course_materials for insert with check (auth.uid() = user_id);
create policy "course_materials_update_own" on course_materials for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "course_materials_delete_own" on course_materials for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-materials', 'course-materials', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

drop policy if exists "course_material_files_select_own" on storage.objects;
drop policy if exists "course_material_files_insert_own" on storage.objects;
drop policy if exists "course_material_files_update_own" on storage.objects;
drop policy if exists "course_material_files_delete_own" on storage.objects;
create policy "course_material_files_select_own" on storage.objects for select
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "course_material_files_insert_own" on storage.objects for insert
with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "course_material_files_update_own" on storage.objects for update
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "course_material_files_delete_own" on storage.objects for delete
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);
