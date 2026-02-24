import { useState, useEffect } from "react";
import MovieCard from "./MovieCard";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  original_language: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const formatDate = (date: string) => {
  if (!date) return "TBA";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const MoviesSection = () => {
  const [latestMovies, setLatestMovies] = useState<TMDBMovie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeluguMovies = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-telugu-movies");

        if (error) {
          console.error("Failed to fetch Telugu movies:", error);
          return;
        }

        setLatestMovies((data.latest || []).slice(0, 8));
        setUpcomingMovies((data.upcoming || []).slice(0, 8));
      } catch (err) {
        console.error("Error fetching Telugu movies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeluguMovies();
  }, []);

  const renderSkeletons = () =>
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="cinema-card overflow-hidden animate-pulse">
        <div className="aspect-[2/3] bg-muted" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-muted rounded" />
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    ));

  const renderMovieGrid = (movies: TMDBMovie[]) =>
    movies.map((movie) => (
      <MovieCard
        key={movie.id}
        id={String(movie.id)}
        title={movie.title}
        rating={Math.round(movie.vote_average * 10) / 10}
        duration="—"
        genre="Telugu"
        language="Telugu"
        image={
          movie.poster_path
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : "/placeholder.svg"
        }
        releaseDate={formatDate(movie.release_date)}
      />
    ));

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        {/* Latest Telugu Movies */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Latest Telugu Movies</h2>
              <p className="text-muted-foreground">Recently released Telugu films</p>
            </div>
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              See All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? renderSkeletons() : renderMovieGrid(latestMovies)}
          </div>
        </div>

        {/* Upcoming Telugu Movies */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Upcoming Telugu Movies</h2>
              <p className="text-muted-foreground">Telugu movies coming soon to cinemas</p>
            </div>
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              See All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? renderSkeletons() : renderMovieGrid(upcomingMovies)}
          </div>
        </div>

        {/* Categories */}
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-6">Browse by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance"].map((category) => (
              <Button
                key={category}
                variant="outline"
                className="h-12 hover:border-primary hover:text-primary transition-colors"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MoviesSection;
