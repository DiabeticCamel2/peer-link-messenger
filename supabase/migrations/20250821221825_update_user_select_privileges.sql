-- Grant select access to the new email_confirmed_at column to the authenticated role.
-- This allows the frontend to filter by this column without exposing any other data.
GRANT SELECT (email_confirmed_at) ON TABLE public.users TO authenticated;
