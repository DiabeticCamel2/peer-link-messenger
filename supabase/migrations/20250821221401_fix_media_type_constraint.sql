-- Drop the existing check constraint
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS check_media_type;

-- Re-create the check constraint with 'text' included
ALTER TABLE public.messages ADD CONSTRAINT check_media_type CHECK (media_type IN ('image', 'gif', 'text', 'none'));
