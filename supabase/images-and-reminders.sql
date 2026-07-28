-- Run this once in the Supabase SQL Editor before using photos or reminders.
alter table public.tt_courses add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.tt_courses add column if not exists reminder_at timestamptz;
alter table public.tt_tasks add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.tt_tasks add column if not exists reminder_at timestamptz;
alter table public.tt_health_records add column if not exists images jsonb not null default '[]'::jsonb;

create or replace function public.tt_add_course(p_token text, p_title text, p_category text, p_day integer, p_time text, p_homework text, p_images jsonb, p_reminder_at timestamptz)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_courses(family_id,title,category,day,time,homework,images,reminder_at)
  values(f,p_title,p_category,p_day,p_time,coalesce(p_homework,''),coalesce(p_images,'[]'::jsonb),p_reminder_at);
end; $$;

create or replace function public.tt_add_task(p_token text, p_title text, p_subject text, p_due date, p_images jsonb, p_reminder_at timestamptz)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_tasks(family_id,title,subject,due,images,reminder_at)
  values(f,p_title,coalesce(nullif(p_subject,''),'作业'),p_due,coalesce(p_images,'[]'::jsonb),p_reminder_at);
end; $$;

create or replace function public.tt_add_health(p_token text, p_illness text, p_hospital text, p_date date, p_plan text, p_follow_up date, p_effect text, p_images jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f uuid; begin
  select family_id into f from tt_session_info(p_token);
  insert into tt_health_records(family_id,illness,hospital,date,plan,follow_up,effect,images)
  values(f,p_illness,coalesce(p_hospital,''),p_date,coalesce(p_plan,''),p_follow_up,coalesce(p_effect,''),coalesce(p_images,'[]'::jsonb));
end; $$;

grant execute on function public.tt_add_course(text,text,text,integer,text,text,jsonb,timestamptz), public.tt_add_task(text,text,text,date,jsonb,timestamptz), public.tt_add_health(text,text,text,date,text,date,text,jsonb) to anon, authenticated;
