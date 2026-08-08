create extension if not exists pgcrypto;

create type public.team_role as enum ('owner','admin','member','viewer');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.task_status as enum ('todo','in_progress','done');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key(team_id,user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role public.team_role not null default 'member',
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  description text default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(team_id,name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text default '',
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  assignee_id uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  ) stored
);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key(task_id,label_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(body,''))
  ) stored
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index tasks_search_idx on public.tasks using gin(search_vector);
create index comments_search_idx on public.comments using gin(search_vector);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index activity_project_idx on public.activity_events(project_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.team_role(p_team_id uuid)
returns public.team_role
language sql stable security definer
set search_path = public
as $$
  select role from public.team_members
  where team_id = p_team_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.project_team(p_project_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select team_id from public.projects where id = p_project_id;
$$;

create or replace function public.task_team(p_task_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.team_id from public.tasks t join public.projects p on p.id=t.project_id
  where t.id=p_task_id;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;
alter table public.labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;

create policy teams_select on public.teams for select using (public.is_team_member(id));
create policy teams_insert on public.teams for insert with check (auth.uid() is not null);
create policy teams_update on public.teams for update using (public.team_role(id) in ('owner','admin'));
create policy teams_delete on public.teams for delete using (public.team_role(id)='owner');

create policy members_select on public.team_members for select using (public.is_team_member(team_id));
create policy members_insert on public.team_members for insert with check (public.team_role(team_id) in ('owner','admin'));
create policy members_update on public.team_members for update using (public.team_role(team_id) in ('owner','admin'));
create policy members_delete on public.team_members for delete using (public.team_role(team_id) in ('owner','admin'));

create policy invitations_select on public.invitations for select using (
  public.team_role(team_id) in ('owner','admin') or
  lower(email)=lower((select email from auth.users where id=auth.uid()))
);
create policy invitations_insert on public.invitations for insert with check (public.team_role(team_id) in ('owner','admin'));
create policy invitations_update on public.invitations for update using (public.team_role(team_id) in ('owner','admin'));

create policy projects_select on public.projects for select using (public.is_team_member(team_id));
create policy projects_insert on public.projects for insert with check (public.team_role(team_id) in ('owner','admin','member'));
create policy projects_update on public.projects for update using (public.team_role(team_id) in ('owner','admin','member'));
create policy projects_delete on public.projects for delete using (public.team_role(team_id) in ('owner','admin'));

create policy labels_select on public.labels for select using (public.is_team_member(team_id));
create policy labels_insert on public.labels for insert with check (public.team_role(team_id) in ('owner','admin','member'));
create policy labels_update on public.labels for update using (public.team_role(team_id) in ('owner','admin','member'));
create policy labels_delete on public.labels for delete using (public.team_role(team_id) in ('owner','admin'));

create policy tasks_select on public.tasks for select using (public.is_team_member(public.project_team(project_id)));
create policy tasks_insert on public.tasks for insert with check (public.team_role(public.project_team(project_id)) in ('owner','admin','member'));
create policy tasks_update on public.tasks for update using (public.team_role(public.project_team(project_id)) in ('owner','admin','member'));
create policy tasks_delete on public.tasks for delete using (public.team_role(public.project_team(project_id)) in ('owner','admin','member'));

create policy task_labels_select on public.task_labels for select using (public.is_team_member(public.task_team(task_id)));
create policy task_labels_insert on public.task_labels for insert with check (public.team_role((select team_id from public.labels l where l.id=label_id)) in ('owner','admin','member'));
create policy task_labels_delete on public.task_labels for delete using (public.team_role((select team_id from public.labels l where l.id=label_id)) in ('owner','admin','member'));

create policy comments_select on public.comments for select using (public.is_team_member(public.task_team(task_id)));
create policy comments_insert on public.comments for insert with check (public.team_role(public.task_team(task_id)) in ('owner','admin','member'));
create policy comments_update on public.comments for update using (
  author_id=auth.uid() or public.team_role(public.task_team(task_id)) in ('owner','admin')
);
create policy comments_delete on public.comments for delete using (
  author_id=auth.uid() or public.team_role(public.task_team(task_id)) in ('owner','admin')
);

create policy notifications_select on public.notifications for select using (user_id=auth.uid());
create policy notifications_update on public.notifications for update using (user_id=auth.uid());
create policy notifications_insert on public.notifications for insert with check (user_id=auth.uid());

create policy activity_select on public.activity_events for select using (
  public.is_team_member(public.project_team(project_id))
);
