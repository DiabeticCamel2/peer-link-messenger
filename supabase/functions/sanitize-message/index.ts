import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const profanityFilter = [
  'damn', 'hell', 'stupid', 'dumb', 'idiot', 'hate', 'kill', 'die',
  'crap', 'poop', 'butt', 'heck'
  // Add more words as needed for school environment
];

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    const { sender_id, recipient_id, content, media_url, media_type } = message;

    console.log('Processing message:', { sender_id, recipient_id, content: content ? 'has content' : 'no content', media_type });

    // Check if recipient has profanity filter enabled
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('profanity_filter_enabled')
      .eq('id', recipient_id)
      .single();

    if (userError) {
      console.error('Error fetching user settings:', userError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user settings' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply profanity filter only if user has it enabled
    let filteredContent = content || '';
    if (userData.profanity_filter_enabled) {
      console.log('Applying profanity filter');
      profanityFilter.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
      });
    }

    // Check if users are allowed to message each other (privacy mode handling)
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('privacy_mode')
      .eq('id', recipient_id)
      .single();

    if (recipientError) {
      console.error('Error fetching recipient settings:', recipientError);
      return new Response(JSON.stringify({ error: 'Failed to fetch recipient settings' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If recipient has privacy mode enabled, check if contact is allowed
    if (recipientData.privacy_mode) {
      console.log('Checking privacy mode for recipient');
      const user1_id = sender_id < recipient_id ? sender_id : recipient_id;
      const user2_id = sender_id < recipient_id ? recipient_id : sender_id;
      
      const { data: allowedContact } = await supabase
        .from('allowed_contacts')
        .select('id')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .single();

      if (!allowedContact) {
        console.log('Contact not allowed - privacy mode active');
        return new Response(JSON.stringify({ error: 'Contact not allowed. Send a DM request first.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Insert sanitized message into database
    const messageData = {
      sender_id,
      recipient_id,
      content: filteredContent,
      media_url: media_url || null,
      media_type: media_type || 'text'
    };
    
    console.log('Inserting message:', messageData);
    
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting message:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Message inserted successfully:', data);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sanitize-message function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});