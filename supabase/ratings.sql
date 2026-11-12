-- BiteFlow star ratings. Already applied to the Supabase project "health-max"
-- (BiteFlow shares it because the free plan allows only 2 projects).
-- The app can only call the two functions below; it can't read or edit the table directly.

create table if not exists public.biteflow_ratings (
  recipe_id  text not null check (char_length(recipe_id) between 1 and 80),
  device_id  uuid not null,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, device_id)
);
alter table public.biteflow_ratings enable row level security;
revoke all on public.biteflow_ratings from anon, authenticated;

-- Save or change one phone's rating for one recipe
create or replace function public.biteflow_rate(p_recipe text, p_device uuid, p_stars int)
returns void language sql security definer set search_path = '' as $$
  insert into public.biteflow_ratings (recipe_id, device_id, stars)
  values (p_recipe, p_device, p_stars)
  on conflict (recipe_id, device_id) do update set stars = excluded.stars, updated_at = now();
$$;

-- Average stars and number of ratings per recipe
create or replace function public.biteflow_summary(p_recipes text[])
returns table (recipe_id text, avg_stars numeric, votes bigint)
language sql stable security definer set search_path = '' as $$
  select r.recipe_id, round(avg(r.stars)::numeric, 1), count(*)
  from public.biteflow_ratings r
  where r.recipe_id = any(p_recipes)
  group by r.recipe_id;
$$;

revoke all on function public.biteflow_rate(text, uuid, int) from public;
revoke all on function public.biteflow_summary(text[]) from public;
grant execute on function public.biteflow_rate(text, uuid, int) to anon, authenticated;
grant execute on function public.biteflow_summary(text[]) to anon, authenticated;
