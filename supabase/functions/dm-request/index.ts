import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sender_id, recipient_id, request_id } = await req.json();

    if (action === 'send') {
      // Send a DM request
      const { data, error } = await supabase
        .from('dm_requests')
        .insert({
          sender_id,
          recipient_id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending DM request:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'respond') {
      const { status } = await req.json();
      
      // Update DM request status (accept/reject)
      const { data, error } = await supabase
        .from('dm_requests')
        .update({ status })
        .eq('id', request_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating DM request:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If accepted, add to allowed_contacts
      if (status === 'accepted') {
        const user1_id = data.sender_id < data.recipient_id ? data.sender_id : data.recipient_id;
        const user2_id = data.sender_id < data.recipient_id ? data.recipient_id : data.sender_id;

        const { error: contactError } = await supabase
          .from('allowed_contacts')
          .insert({
            user1_id,
            user2_id
          });

        if (contactError) {
          console.error('Error adding to allowed contacts:', contactError);
          return new Response(JSON.stringify({ error: 'Failed to add contact' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in dm-request function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});