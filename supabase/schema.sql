-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create verification_codes table
create table if not exists public.verification_codes (
  id uuid default uuid_generate_v4() primary key,
  phone text not null,
  code text not null,
  type text not null, -- 'register' or 'reset_password'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  verified boolean default false
);

-- Enable RLS
alter table public.verification_codes enable row level security;

-- Only service_role can access this table (Edge Functions)
create policy "Service role can do everything on verification_codes"
  on public.verification_codes
  for all
  using ( auth.role() = 'service_role' );

-- 2. Update user_profiles table
-- Add role column if not exists
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'user_profiles' and column_name = 'role') then
    alter table public.user_profiles add column role text default 'user';
  end if;
  
  -- Add user_id column to link with auth.users if not exists
  if not exists (select 1 from information_schema.columns where table_name = 'user_profiles' and column_name = 'user_id') then
    alter table public.user_profiles add column user_id uuid references auth.users(id);
  end if;

  -- Add is_tester column
  if not exists (select 1 from information_schema.columns where table_name = 'user_profiles' and column_name = 'is_tester') then
    alter table public.user_profiles add column is_tester boolean default false;
  end if;
end $$;

-- 3. Create RLS policies for user_profiles to ensure data security
alter table public.user_profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.user_profiles for select
  using ( auth.uid() = user_id );

-- Users can update their own profile
create policy "Users can update own profile"
  on public.user_profiles for update
  using ( auth.uid() = user_id );

-- Admins can read all profiles
create policy "Admins can read all profiles"
  on public.user_profiles for select
  using ( 
    auth.jwt() ->> 'role' = 'service_role' 
    or 
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update all profiles
create policy "Admins can update all profiles"
  on public.user_profiles for update
  using ( 
    auth.jwt() ->> 'role' = 'service_role' 
    or 
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- 4. Create ai_feedbacks table
create table if not exists public.ai_feedbacks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id), -- or references user_profiles(user_id)
  ai_result_id text not null, -- Associated AI result ID (e.g., chat_session_id or reply_id)
  feedback_type text not null, -- 'role_confusion', 'analysis_error', 'style_mismatch', 'other'
  content text not null,
  attach_file text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  handle_status text default 'pending', -- 'pending', 'tuned', 'verified'
  handle_note text
);

-- Enable RLS for ai_feedbacks
alter table public.ai_feedbacks enable row level security;

-- Testers can create feedbacks
create policy "Testers can create feedbacks"
  on public.ai_feedbacks for insert
  with check (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_tester = true
    )
  );

-- Testers can view their own feedbacks
create policy "Testers can view own feedbacks"
  on public.ai_feedbacks for select
  using ( user_id = auth.uid() );

-- Admins can view and update all feedbacks
create policy "Admins can do everything on feedbacks"
  on public.ai_feedbacks for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- 5. Create app_config table
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default config for AI feedback
insert into public.app_config (key, value)
values ('ai_feedback_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- Enable RLS for app_config
alter table public.app_config enable row level security;

-- Everyone can read config
create policy "Everyone can read app_config"
  on public.app_config for select
  using ( true );

-- Only admins can update config
create policy "Admins can update app_config"
  on public.app_config for update
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
  );
