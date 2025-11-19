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
    const API_KEY = Deno.env.get('MOVIEGLU_API_KEY')?.trim();
    const CLIENT_ID = Deno.env.get('MOVIEGLU_CLIENT_ID')?.trim();
    const TERRITORY = Deno.env.get('MOVIEGLU_TERRITORY')?.trim();
    const AUTH_TOKEN = Deno.env.get('MOVIEGLU_AUTH_TOKEN')?.trim();

    if (!API_KEY || !CLIENT_ID || !TERRITORY || !AUTH_TOKEN) {
      throw new Error('MovieGlu API credentials not configured');
    }

    console.log('MovieGlu credentials check:', {
      hasApiKey: !!API_KEY,
      apiKeyLength: API_KEY?.length,
      clientId: CLIENT_ID,
      territory: TERRITORY,
      hasAuthToken: !!AUTH_TOKEN,
      authTokenLength: AUTH_TOKEN?.length,
      authTokenPrefix: AUTH_TOKEN?.substring(0, 10) + '...'
    });

    console.log('Fetching movies from MovieGlu...');

    const response = await fetch(
      `https://api-gate2.movieglu.com/filmsNowShowing/?n=20`,
      {
        method: 'GET',
        headers: {
          'api-version': 'v200',
          'Authorization': `Basic ${AUTH_TOKEN}`,
          'client': CLIENT_ID,
          'x-api-key': API_KEY,
          'territory': TERRITORY,
          'device-datetime': new Date().toISOString(),
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MovieGlu API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        headers: {
          'api-version': 'v200',
          'client': CLIENT_ID,
          'territory': TERRITORY,
          'hasAuth': !!AUTH_TOKEN,
          'hasApiKey': !!API_KEY
        }
      });
      
      // Return empty films array so frontend can use mock data
      return new Response(JSON.stringify({ films: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('MovieGlu response:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-movies function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
