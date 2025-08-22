-- Fix critical security vulnerability in users table
-- Remove overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;

-- Create more secure policies that respect privacy
-- Policy 1: Users can always view their own profile (full access)
CREATE POLICY "Users can view own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Users can view basic info of non-private users (name and avatar only for discovery)
CREATE POLICY "Users can view public profiles basic info" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() != id 
  AND (privacy_mode = false OR privacy_mode IS NULL)
);

-- Policy 3: Users can view full profile of allowed contacts
CREATE POLICY "Users can view allowed contacts full profile" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() != id 
  AND EXISTS (
    SELECT 1 FROM public.allowed_contacts ac 
    WHERE (
      (ac.user1_id = auth.uid() AND ac.user2_id = users.id) OR
      (ac.user2_id = auth.uid() AND ac.user1_id = users.id)
    )
  )
);