import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('MOVIEGLU_API_KEY');
    const CLIENT_ID = Deno.env.get('MOVIEGLU_CLIENT_ID');
    const TERRITORY = Deno.env.get('MOVIEGLU_TERRITORY');

    if (!API_KEY || !CLIENT_ID || !TERRITORY) {
      throw new Error('MovieGlu API credentials not configured');
    }

    const { cinemaId, filmId, date } = await req.json();
    
    console.log('Fetching showtimes from MovieGlu:', { cinemaId, filmId, date });

    const response = await fetch(
      `https://api-gate2.movieglu.com/cinemaShowTimes/?cinema_id=${cinemaId}${filmId ? `&film_id=${filmId}` : ''}`,
      {
        method: 'GET',
        headers: {
          'api-version': 'v201',
          'Authorization': `Basic ${btoa(`${CLIENT_ID}:${API_KEY}`)}`,
          'client': CLIENT_ID,
          'x-api-key': API_KEY,
          'territory': TERRITORY,
          'device-datetime': date || new Date().toISOString(),
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MovieGlu API error:', response.status, errorText);
      throw new Error(`MovieGlu API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('MovieGlu showtimes response:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-showtimes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
