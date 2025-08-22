-- Add new fields to users table
ALTER TABLE public.users 
ADD COLUMN profanity_filter_enabled BOOLEAN DEFAULT false,
ADD COLUMN privacy_mode BOOLEAN DEFAULT false;

-- Create enum for DM request status
CREATE TYPE public.dm_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create dm_requests table
CREATE TABLE public.dm_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status dm_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, recipient_id)
);

-- Create allowed_contacts table for accepted DM requests
CREATE TABLE public.allowed_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Enable RLS on new tables
ALTER TABLE public.dm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dm_requests
CREATE POLICY "Users can view their own DM requests"
ON public.dm_requests 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create DM requests"
ON public.dm_requests 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update DM requests"
ON public.dm_requests 
FOR UPDATE 
USING (auth.uid() = recipient_id);

-- RLS Policies for allowed_contacts
CREATE POLICY "Users can view their allowed contacts"
ON public.allowed_contacts 
FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "System can insert allowed contacts"
ON public.allowed_contacts 
FOR INSERT 
WITH CHECK (true); -- Will be controlled by edge function

-- Add trigger for updating updated_at on dm_requests
CREATE TRIGGER update_dm_requests_updated_at
BEFORE UPDATE ON public.dm_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_dm_requests_recipient_status ON public.dm_requests(recipient_id, status);
CREATE INDEX idx_allowed_contacts_users ON public.allowed_contacts(user1_id, user2_id);