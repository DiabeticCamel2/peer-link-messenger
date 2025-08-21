-- Drop the corrupted messages table completely
DROP TABLE IF EXISTS public.messages CASCADE;

-- Remove from realtime publication if it exists
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS messages;

-- Create the correct messages table structure
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text,
  media_type text DEFAULT 'text',
  media_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add performance indexes
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies
CREATE POLICY "Users can read their own messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;