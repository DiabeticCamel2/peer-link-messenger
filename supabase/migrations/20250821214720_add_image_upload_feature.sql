-- Add image-related columns to the messages table
ALTER TABLE public.messages ADD COLUMN image_url TEXT;
ALTER TABLE public.messages ADD COLUMN image_filename TEXT;
ALTER TABLE public.messages ADD COLUMN image_size INTEGER;

-- Drop existing permissive policies on the chat-images bucket
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;

-- Create a helper function to check conversation membership from a conversation_id
CREATE OR REPLACE FUNCTION is_in_conversation(conversation_id TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  id1_text TEXT;
  id2_text TEXT;
BEGIN
  id1_text := SUBSTRING(conversation_id FROM 1 FOR 36);
  id2_text := SUBSTRING(conversation_id FROM 38);
  RETURN user_id::text = id1_text OR user_id::text = id2_text;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for chat-images bucket
-- Path: chat-images/{conversation_id}/{user_id}/{filename}
-- conversation_id is {user1_id}_{user2_id} sorted alphabetically

-- Policy for uploading images
CREATE POLICY "Users can upload to conversations they are part of"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chat-images' AND
    is_in_conversation((storage.foldername(name))[1], auth.uid()) AND
    auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy for viewing images
CREATE POLICY "Users can view images from conversations they are part of"
ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'chat-images' AND
    is_in_conversation((storage.foldername(name))[1], auth.uid())
);

-- Policy for deleting images
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'chat-images' AND
    auth.uid()::text = (storage.foldername(name))[2]
);
