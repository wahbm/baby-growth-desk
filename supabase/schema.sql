-- Run once in Supabase Dashboard → SQL Editor → New query.
-- The app uses a shared family username + password, not email login.
create extension if not exists pgcrypto;

create table if not exists public.tt_families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '糖糖家',
  created_at timestamptz not null default now()
);
create table if not exists public.tt_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.tt_families(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9_-]{4,32}$'),
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.tt_sessions (
  token_hash bytea primary key,
  account_id uuid not null references public.tt_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.tt_courses (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.tt_families(id) on delete cascade,
  title text not null, category text not null, day integer not null check (day between 0 and 6), time text not null,
  homework text not null default '', images jsonb not null default '[]'::jsonb, audios jsonb not null default '[]'::jsonb, reminder_at timestamptz,
  done boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.tt_tasks (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.tt_families(id) on delete cascade,
  title text not null, subject text not null default '作业', due date not null default current_date,
  images jsonb not null default '[]'::jsonb, audios jsonb not null default '[]'::jsonb, reminder_at timestamptz,
  done boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.tt_health_records (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.tt_families(id) on delete cascade,
  illness text not null, hospital text not null default '', date date not null default current_date,
  plan text not null default '', follow_up date, effect text not null default '', images jsonb not null default '[]'::jsonb, audios jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tt_families enable row level security;
alter table public.tt_accounts enable row level security;
alter table public.tt_sessions enable row level security;
alter table public.tt_courses enable row level security;
alter table public.tt_tasks enable row level security;
alter table public.tt_health_records enable row level security;
revoke all on all tables in schema public from anon, authenticated;

create or replace function public.tt_session_info(p_token text)
returns table(account_id uuid, family_id uuid) language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_token is null or length(p_token) < 32 then raise exception '登录已过期'; end if;
  delete from tt_sessions where expires_at < now();
  return query select a.id, a.family_id from tt_sessions s join tt_accounts a on a.id = s.account_id
    where s.token_hash = digest(p_token, 'sha256') and s.expires_at > now();
  if not found then raise exception '登录已过期，请重新登录'; end if;
end;
$$;

create or replace function public.tt_new_session(p_account_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare token text;
begin
  token := encode(gen_random_bytes(32), 'hex');
  insert into tt_sessions(token_hash, account_id, expires_at) values (digest(token, 'sha256'), p_account_id, now() + interval '90 days');
  return token;
end;
$$;

create or replace function public.tt_create_account(p_username text, p_password text, p_family_name text default '糖糖家')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare family uuid; account uuid; uname text; token text;
begin
  uname := lower(trim(p_username));
  if uname !~ '^[a-z0-9_-]{4,32}$' then raise exception '账号名需为 4-32 位英文、数字、下划线或短横线'; end if;
  if length(p_password) < 8 then raise exception '密码至少需要 8 位'; end if;
  if exists(select 1 from tt_accounts where username = uname) then raise exception '该账号名已被使用'; end if;
  insert into tt_families(name) values (coalesce(nullif(trim(p_family_name), ''), '糖糖家')) returning id into family;
  insert into tt_accounts(family_id, username, password_hash) values (family, uname, crypt(p_password, gen_salt('bf', 12))) returning id into account;
  token := tt_new_session(account);
  return jsonb_build_object('token', token, 'family_id', family, 'username', uname);
end;
$$;

create or replace function public.tt_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare account tt_accounts%rowtype; token text;
begin
  select * into account from tt_accounts where username = lower(trim(p_username));
  if not found or account.password_hash <> crypt(p_password, account.password_hash) then raise exception '账号名或密码不正确'; end if;
  token := tt_new_session(account.id);
  return jsonb_build_object('token', token, 'family_id', account.family_id, 'username', account.username);
end;
$$;

create or replace function public.tt_get_data(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare f uuid;
begin
  select family_id into f from tt_session_info(p_token);
  return jsonb_build_object(
    'courses', coalesce((select jsonb_agg(to_jsonb(c) order by c.time) from tt_courses c where c.family_id = f), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.due) from tt_tasks t where t.family_id = f), '[]'::jsonb),
    'health', coalesce((select jsonb_agg(to_jsonb(h) order by h.date desc) from tt_health_records h where h.family_id = f), '[]'::jsonb)
  );
end;
$$;

create or replace function public.tt_add_course(p_token text, p_title text, p_category text, p_day integer, p_time text, p_homework text default '', p_images jsonb default '[]'::jsonb, p_reminder_at timestamptz default null, p_audios jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); insert into tt_courses(family_id,title,category,day,time,homework,images,reminder_at,audios) values(f,p_title,p_category,p_day,p_time,coalesce(p_homework,''),coalesce(p_images,'[]'::jsonb),p_reminder_at,coalesce(p_audios,'[]'::jsonb)); end; $$;
create or replace function public.tt_add_task(p_token text, p_title text, p_subject text, p_due date, p_images jsonb default '[]'::jsonb, p_reminder_at timestamptz default null, p_audios jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); insert into tt_tasks(family_id,title,subject,due,images,reminder_at,audios) values(f,p_title,coalesce(nullif(p_subject,''),'作业'),p_due,coalesce(p_images,'[]'::jsonb),p_reminder_at,coalesce(p_audios,'[]'::jsonb)); end; $$;
create or replace function public.tt_add_health(p_token text, p_illness text, p_hospital text, p_date date, p_plan text, p_follow_up date, p_effect text, p_images jsonb default '[]'::jsonb, p_audios jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); insert into tt_health_records(family_id,illness,hospital,date,plan,follow_up,effect,images,audios) values(f,p_illness,coalesce(p_hospital,''),p_date,coalesce(p_plan,''),p_follow_up,coalesce(p_effect,''),coalesce(p_images,'[]'::jsonb),coalesce(p_audios,'[]'::jsonb)); end; $$;
create or replace function public.tt_update_course(p_token text, p_id uuid, p_title text, p_category text, p_day integer, p_time text, p_homework text, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); update tt_courses set title=p_title,category=p_category,day=p_day,time=p_time,homework=coalesce(p_homework,''),images=coalesce(p_images,'[]'::jsonb),reminder_at=p_reminder_at,audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f; end; $$;
create or replace function public.tt_update_task(p_token text, p_id uuid, p_title text, p_subject text, p_due date, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); update tt_tasks set title=p_title,subject=coalesce(nullif(p_subject,''),'作业'),due=p_due,images=coalesce(p_images,'[]'::jsonb),reminder_at=p_reminder_at,audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f; end; $$;
create or replace function public.tt_update_health(p_token text, p_id uuid, p_illness text, p_hospital text, p_date date, p_plan text, p_follow_up date, p_effect text, p_images jsonb, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); update tt_health_records set illness=p_illness,hospital=coalesce(p_hospital,''),date=p_date,plan=coalesce(p_plan,''),follow_up=p_follow_up,effect=coalesce(p_effect,''),images=coalesce(p_images,'[]'::jsonb),audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f; end; $$;
create or replace function public.tt_delete_record(p_token text, p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); if p_kind='task' then delete from tt_tasks where id=p_id and family_id=f; elsif p_kind='course' then delete from tt_courses where id=p_id and family_id=f; elsif p_kind='health' then delete from tt_health_records where id=p_id and family_id=f; else raise exception '无效的记录类型'; end if; end; $$;

create or replace function public.tt_toggle_task(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); update tt_tasks set done = not done where id=p_id and family_id=f; end; $$;
create or replace function public.tt_toggle_course(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin select family_id into f from tt_session_info(p_token); update tt_courses set done = not done where id=p_id and family_id=f; end; $$;

grant execute on function public.tt_create_account(text,text,text), public.tt_login(text,text), public.tt_get_data(text), public.tt_add_course(text,text,text,integer,text,text,jsonb,timestamptz,jsonb), public.tt_add_task(text,text,text,date,jsonb,timestamptz,jsonb), public.tt_add_health(text,text,text,date,text,date,text,jsonb,jsonb), public.tt_update_course(text,uuid,text,text,integer,text,text,jsonb,timestamptz,jsonb), public.tt_update_task(text,uuid,text,text,date,jsonb,timestamptz,jsonb), public.tt_update_health(text,uuid,text,text,date,text,date,text,jsonb,jsonb), public.tt_delete_record(text,text,uuid), public.tt_toggle_task(text,uuid), public.tt_toggle_course(text,uuid) to anon, authenticated;
