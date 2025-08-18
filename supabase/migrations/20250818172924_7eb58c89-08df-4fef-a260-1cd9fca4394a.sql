-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Add check constraint for media type (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_media_type') THEN
        ALTER TABLE public.messages ADD CONSTRAINT check_media_type CHECK (media_type IN ('image', 'gif', 'none'));
    END IF;
END $$;

-- Enable realtime on messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat images
CREATE POLICY "Authenticated users can upload chat images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view chat images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-images');

-- Create trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();