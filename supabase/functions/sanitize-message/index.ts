import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const profanityFilter = [
  'damn', 'hell', 'stupid', 'dumb', 'idiot', 'hate', 'kill', 'die',
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

    // Simple profanity filter - replace bad words with asterisks
    let filteredContent = content || '';
    profanityFilter.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
    });

    // Insert sanitized message into database
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id,
        recipient_id,
        content: filteredContent,
        media_url: media_url || null,
        media_type: media_type || 'none'
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting message:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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