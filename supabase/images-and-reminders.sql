-- Run this once in the Supabase SQL Editor before using photos or reminders.
alter table public.tt_courses add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.tt_courses add column if not exists reminder_at timestamptz;
alter table public.tt_tasks add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.tt_tasks add column if not exists reminder_at timestamptz;
alter table public.tt_health_records add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.tt_courses add column if not exists audios jsonb not null default '[]'::jsonb;
alter table public.tt_tasks add column if not exists audios jsonb not null default '[]'::jsonb;
alter table public.tt_health_records add column if not exists audios jsonb not null default '[]'::jsonb;

create or replace function public.tt_add_course(p_token text, p_title text, p_category text, p_day integer, p_time text, p_homework text, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_courses(family_id,title,category,day,time,homework,images,reminder_at,audios)
  values(f,p_title,p_category,p_day,p_time,coalesce(p_homework,''),coalesce(p_images,'[]'::jsonb),p_reminder_at,coalesce(p_audios,'[]'::jsonb));
end; $$;

create or replace function public.tt_add_task(p_token text, p_title text, p_subject text, p_due date, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_tasks(family_id,title,subject,due,images,reminder_at,audios)
  values(f,p_title,coalesce(nullif(p_subject,''),'作业'),p_due,coalesce(p_images,'[]'::jsonb),p_reminder_at,coalesce(p_audios,'[]'::jsonb));
end; $$;

create or replace function public.tt_add_health(p_token text, p_illness text, p_hospital text, p_date date, p_plan text, p_follow_up date, p_effect text, p_images jsonb, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_health_records(family_id,illness,hospital,date,plan,follow_up,effect,images,audios)
  values(f,p_illness,coalesce(p_hospital,''),p_date,coalesce(p_plan,''),p_follow_up,coalesce(p_effect,''),coalesce(p_images,'[]'::jsonb),coalesce(p_audios,'[]'::jsonb));
end; $$;

create or replace function public.tt_update_course(p_token text, p_id uuid, p_title text, p_category text, p_day integer, p_time text, p_homework text, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  update tt_courses set title=p_title,category=p_category,day=p_day,time=p_time,homework=coalesce(p_homework,''),images=coalesce(p_images,'[]'::jsonb),reminder_at=p_reminder_at,audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f;
end; $$;
create or replace function public.tt_update_task(p_token text, p_id uuid, p_title text, p_subject text, p_due date, p_images jsonb, p_reminder_at timestamptz, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  update tt_tasks set title=p_title,subject=coalesce(nullif(p_subject,''),'作业'),due=p_due,images=coalesce(p_images,'[]'::jsonb),reminder_at=p_reminder_at,audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f;
end; $$;
create or replace function public.tt_update_health(p_token text, p_id uuid, p_illness text, p_hospital text, p_date date, p_plan text, p_follow_up date, p_effect text, p_images jsonb, p_audios jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  update tt_health_records set illness=p_illness,hospital=coalesce(p_hospital,''),date=p_date,plan=coalesce(p_plan,''),follow_up=p_follow_up,effect=coalesce(p_effect,''),images=coalesce(p_images,'[]'::jsonb),audios=coalesce(p_audios,'[]'::jsonb) where id=p_id and family_id=f;
end; $$;
create or replace function public.tt_delete_record(p_token text, p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$ declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  if p_kind='task' then delete from tt_tasks where id=p_id and family_id=f;
  elsif p_kind='course' then delete from tt_courses where id=p_id and family_id=f;
  elsif p_kind='health' then delete from tt_health_records where id=p_id and family_id=f;
  else raise exception '无效的记录类型'; end if;
end; $$;

grant execute on function public.tt_add_course(text,text,text,integer,text,text,jsonb,timestamptz,jsonb), public.tt_add_task(text,text,text,date,jsonb,timestamptz,jsonb), public.tt_add_health(text,text,text,date,text,date,text,jsonb,jsonb), public.tt_update_course(text,uuid,text,text,integer,text,text,jsonb,timestamptz,jsonb), public.tt_update_task(text,uuid,text,text,date,jsonb,timestamptz,jsonb), public.tt_update_health(text,uuid,text,text,date,text,date,text,jsonb,jsonb), public.tt_delete_record(text,text,uuid) to anon, authenticated;
