-- Create a simple `profiles` table used by the app.
-- Run this in your Supabase SQL editor or via psql against your project's DB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  first_name text,
  last_name text,
  role text DEFAULT 'USER',
  school_id uuid,
  school_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- update `updated_at` on row change
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();

-- Grant basic select/insert/update for anon/auth roles if desired
-- Note: Use the Supabase UI to tune RLS policies; service role key bypasses RLS.
