import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm, limit = 20 } = await req.json();

    if (!searchTerm) {
      return new Response(
        JSON.stringify({ error: 'Search term is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const tenorApiKey = Deno.env.get('TENOR_API_KEY');
    if (!tenorApiKey) {
      return new Response(
        JSON.stringify({ error: 'Tenor API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const response = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchTerm)}&key=${tenorApiKey}&limit=${limit}&media_filter=gif`
    );

    if (!response.ok) {
      console.error('Tenor API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch GIFs from Tenor' }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    // Transform the Tenor response to a simpler format
    const gifs = data.results?.map((gif: any) => ({
      id: gif.id,
      title: gif.content_description || gif.h1_title || 'GIF',
      url: gif.media_formats?.gif?.url || gif.media_formats?.mp4?.url,
      preview: gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url,
      width: gif.media_formats?.gif?.dims?.[0] || 300,
      height: gif.media_formats?.gif?.dims?.[1] || 200,
    })) || [];

    return new Response(
      JSON.stringify({ gifs }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in search-gifs function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});