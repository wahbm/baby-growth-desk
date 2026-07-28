-- Run this small repair once in Supabase SQL Editor after the original schema.sql.
alter function public.tt_session_info(text) set search_path = public, extensions;
alter function public.tt_new_session(uuid) set search_path = public, extensions;
alter function public.tt_create_account(text,text,text) set search_path = public, extensions;
alter function public.tt_login(text,text) set search_path = public, extensions;
alter function public.tt_get_data(text) set search_path = public, extensions;
alter function public.tt_add_course(text,text,text,integer,text,text) set search_path = public, extensions;
alter function public.tt_add_task(text,text,text,date) set search_path = public, extensions;
alter function public.tt_add_health(text,text,text,date,text,date,text) set search_path = public, extensions;
alter function public.tt_toggle_task(text,uuid) set search_path = public, extensions;
alter function public.tt_toggle_course(text,uuid) set search_path = public, extensions;
