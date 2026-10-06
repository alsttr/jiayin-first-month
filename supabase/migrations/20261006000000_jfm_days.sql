-- Jiayin's First Month At Work — the locked-in colouring, one row per day (number).
--
-- Rules enforced by the database itself:
--   * anyone can READ the picture (so it shows on every browser),
--   * each day can be ADDED ONCE (no updates, no deletes = no take-backs),
--   * colours must be hex codes like #A9DDF7, strokes must be a JSON array.
-- To undo a day in an emergency: Supabase dashboard → Table editor → jfm_days → delete the row.
-- Every device drops that day on its next sync.

create table if not exists public.jfm_days (
  n          smallint    primary key check (n between 1 and 99),
  fills      jsonb       not null default '{}'::jsonb,
  strokes    text        not null default '[]',
  at         bigint      not null,
  created_at timestamptz not null default now(),
  constraint jfm_fills_are_colours check (
    jsonb_typeof(fills) = 'object'
    and not jsonb_path_exists(fills, '$.* ? (@.type() != "string" || !(@ like_regex "^#[0-9A-Fa-f]{6}$"))')
  ),
  constraint jfm_strokes_json check (
    octet_length(strokes) <= 1000000 and jsonb_typeof(strokes::jsonb) = 'array'
  )
);

alter table public.jfm_days enable row level security;

drop policy if exists "jfm read" on public.jfm_days;
drop policy if exists "jfm lock once" on public.jfm_days;

create policy "jfm read" on public.jfm_days
  for select to anon, authenticated
  using (true);

create policy "jfm lock once" on public.jfm_days
  for insert to anon, authenticated
  with check (n between 1 and 99);

-- No update/delete policies, and no privileges either: rows can't be changed through the API.
revoke update, delete, truncate on public.jfm_days from anon, authenticated;
grant select, insert on public.jfm_days to anon, authenticated;
