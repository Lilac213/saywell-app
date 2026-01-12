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
