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
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')?.trim();
    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY not configured');
    }

    console.log('TMDB key length:', TMDB_API_KEY.length, 'prefix:', TMDB_API_KEY.substring(0, 8));

    const today = new Date().toISOString().split('T')[0];

    // Determine auth method: long tokens (>40 chars) use Bearer, short ones use api_key param
    const isBearer = TMDB_API_KEY.length > 40;

    const buildUrl = (base: string) => {
      if (!isBearer) {
        return base + (base.includes('?') ? '&' : '?') + `api_key=${TMDB_API_KEY}`;
      }
      return base;
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (isBearer) {
      headers['Authorization'] = `Bearer ${TMDB_API_KEY}`;
    }

    const latestUrl = buildUrl(
      `https://api.themoviedb.org/3/discover/movie?with_original_language=te&sort_by=release_date.desc&region=IN&primary_release_date.lte=${today}&page=1`
    );
    const upcomingUrl = buildUrl(
      `https://api.themoviedb.org/3/discover/movie?with_original_language=te&sort_by=release_date.asc&region=IN&primary_release_date.gte=${today}&page=1`
    );

    const [latestRes, upcomingRes] = await Promise.all([
      fetch(latestUrl, { headers }),
      fetch(upcomingUrl, { headers }),
    ]);

    if (!latestRes.ok) {
      const errText = await latestRes.text();
      console.error('TMDB latest error:', latestRes.status, errText);
      throw new Error(`TMDB latest request failed: ${latestRes.status}`);
    }
    if (!upcomingRes.ok) {
      const errText = await upcomingRes.text();
      console.error('TMDB upcoming error:', upcomingRes.status, errText);
      throw new Error(`TMDB upcoming request failed: ${upcomingRes.status}`);
    }

    const [latestData, upcomingData] = await Promise.all([
      latestRes.json(),
      upcomingRes.json(),
    ]);

    console.log(`Fetched ${latestData.results?.length || 0} latest, ${upcomingData.results?.length || 0} upcoming Telugu movies`);

    return new Response(
      JSON.stringify({
        latest: latestData.results || [],
        upcoming: upcomingData.results || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-telugu-movies:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
