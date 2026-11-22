-- Courtlab Cloud · raccolta RPE dagli atleti tramite link
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi (crea solo ciò che manca e aggiorna le funzioni).

-- Raccolte: una per seduta, create dallo staff (utente autenticato)
create table if not exists public.rpe_surveys (
  token          text primary key check (token ~ '^[A-Za-z0-9]{10,40}$'),
  owner          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_name      text not null check (length(team_name) <= 120),
  team_primary   text check (length(team_primary) <= 16),
  team_secondary text check (length(team_secondary) <= 16),
  team_logo      text check (length(team_logo) <= 150000),
  session_date   date not null,
  session_label  text not null check (length(session_label) <= 80),
  minutes        int check (minutes between 0 and 600),
  roster         jsonb not null default '[]'::jsonb check (jsonb_typeof(roster) = 'array' and jsonb_array_length(roster) <= 60),
  open           boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Risposte degli atleti (una per atleta e raccolta; reinviando si aggiorna)
create table if not exists public.rpe_responses (
  token      text not null references public.rpe_surveys (token) on delete cascade,
  player_id  int not null,
  rpe        numeric(3, 1) not null check (rpe in (0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)),
  updated_at timestamptz not null default now(),
  primary key (token, player_id)
);

alter table public.rpe_surveys enable row level security;
alter table public.rpe_responses enable row level security;

-- Lo staff vede e gestisce solo le proprie raccolte e le relative risposte
drop policy if exists "staff gestisce le proprie raccolte" on public.rpe_surveys;
create policy "staff gestisce le proprie raccolte" on public.rpe_surveys
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "staff legge le risposte" on public.rpe_responses;
create policy "staff legge le risposte" on public.rpe_responses
  for select to authenticated using (exists (select 1 from public.rpe_surveys s where s.token = rpe_responses.token and s.owner = auth.uid()));

drop policy if exists "staff elimina le risposte" on public.rpe_responses;
create policy "staff elimina le risposte" on public.rpe_responses
  for delete to authenticated using (exists (select 1 from public.rpe_surveys s where s.token = rpe_responses.token and s.owner = auth.uid()));

revoke all on public.rpe_surveys, public.rpe_responses from anon;
grant select, insert, update, delete on public.rpe_surveys to authenticated;
grant select, delete on public.rpe_responses to authenticated;

-- Per gli atleti (senza account): leggono solo ciò che serve alla pagina del link
create or replace function public.get_survey(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'team_name', s.team_name,
    'team_primary', s.team_primary,
    'team_secondary', s.team_secondary,
    'team_logo', s.team_logo,
    'session_date', s.session_date,
    'session_label', s.session_label,
    'open', s.open,
    'roster', s.roster,
    'answered', coalesce((select jsonb_agg(r.player_id) from public.rpe_responses r where r.token = s.token), '[]'::jsonb)
  )
  from public.rpe_surveys s
  where s.token = p_token;
$$;

-- Invio (o modifica) dell'RPE da parte dell'atleta
create or replace function public.submit_rpe(p_token text, p_player int, p_rpe numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rpe_surveys;
begin
  select * into s from public.rpe_surveys where token = p_token;
  if not found then
    raise exception 'Link non valido' using errcode = 'P0001';
  end if;
  if not s.open then
    raise exception 'La raccolta è chiusa' using errcode = 'P0001';
  end if;
  if not exists (select 1 from jsonb_array_elements(s.roster) r where (r ->> 'id')::int = p_player) then
    raise exception 'Atleta non in elenco' using errcode = 'P0001';
  end if;
  if p_rpe is null or p_rpe not in (0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) then
    raise exception 'Valore RPE non valido' using errcode = 'P0001';
  end if;
  insert into public.rpe_responses (token, player_id, rpe, updated_at)
  values (p_token, p_player, p_rpe, now())
  on conflict (token, player_id) do update set rpe = excluded.rpe, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_survey(text) from public;
revoke all on function public.submit_rpe(text, int, numeric) from public;
grant execute on function public.get_survey(text) to anon, authenticated;
grant execute on function public.submit_rpe(text, int, numeric) to anon, authenticated;
