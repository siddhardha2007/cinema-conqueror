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

    const today = new Date().toISOString().split('T')[0];

    // Fetch latest and upcoming in parallel
    const [latestRes, upcomingRes] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/discover/movie?with_original_language=te&sort_by=release_date.desc&region=IN&primary_release_date.lte=${today}&page=1`,
        {
          headers: { Authorization: `Bearer ${TMDB_API_KEY}`, 'Content-Type': 'application/json' },
        }
      ),
      fetch(
        `https://api.themoviedb.org/3/discover/movie?with_original_language=te&sort_by=release_date.asc&region=IN&primary_release_date.gte=${today}&page=1`,
        {
          headers: { Authorization: `Bearer ${TMDB_API_KEY}`, 'Content-Type': 'application/json' },
        }
      ),
    ]);

    if (!latestRes.ok || !upcomingRes.ok) {
      const errText = !latestRes.ok ? await latestRes.text() : await upcomingRes.text();
      console.error('TMDB API error:', errText);
      throw new Error('TMDB API request failed');
    }

    const [latestData, upcomingData] = await Promise.all([
      latestRes.json(),
      upcomingRes.json(),
    ]);

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
