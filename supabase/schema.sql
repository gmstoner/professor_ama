-- Classroom AMA schema for a fresh Supabase project.
-- Paste into the Supabase SQL Editor (or run via your preferred migration tool).

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.ama_session (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null,
  title text not null default 'Classroom AMA',
  join_code text not null unique,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
grant select, insert, update, delete on public.ama_session to authenticated;
grant select on public.ama_session to anon;
grant all on public.ama_session to service_role;
alter table public.ama_session enable row level security;
create policy "Instructors manage own sessions" on public.ama_session for all to authenticated using (auth.uid() = instructor_id) with check (auth.uid() = instructor_id);
create policy "Anyone can view open sessions" on public.ama_session for select to anon, authenticated using (is_open = true);

create table public.ama_question (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ama_session(id) on delete cascade,
  body text not null,
  status text not null default 'approved',
  moderation_reason text,
  upvote_count integer not null default 0,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz
);
create index ama_question_session_idx on public.ama_question(session_id, status);
grant select, insert, update, delete on public.ama_question to authenticated;
grant select on public.ama_question to anon;
grant all on public.ama_question to service_role;
alter table public.ama_question enable row level security;
create policy "Instructors manage questions in own sessions" on public.ama_question for all to authenticated
  using (exists (select 1 from public.ama_session s where s.id = session_id and s.instructor_id = auth.uid()))
  with check (exists (select 1 from public.ama_session s where s.id = session_id and s.instructor_id = auth.uid()));
create policy "Anyone can view visible questions in open sessions" on public.ama_question for select to anon, authenticated
  using (status in ('approved','answered') and exists (select 1 from public.ama_session s where s.id = session_id and s.is_open = true));

create table public.ama_question_submitter (
  question_id uuid primary key references public.ama_question(id) on delete cascade,
  submitter_token text not null,
  created_at timestamptz not null default now()
);
grant all on public.ama_question_submitter to service_role;
alter table public.ama_question_submitter enable row level security;

create table public.ama_vote (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.ama_question(id) on delete cascade,
  voter_token text not null,
  created_at timestamptz not null default now(),
  unique (question_id, voter_token)
);
grant all on public.ama_vote to service_role;
alter table public.ama_vote enable row level security;

create trigger ama_session_updated_at before update on public.ama_session for each row execute function public.update_updated_at_column();
create trigger ama_question_updated_at before update on public.ama_question for each row execute function public.update_updated_at_column();

alter publication supabase_realtime add table public.ama_question;
alter table public.ama_question replica identity full;
