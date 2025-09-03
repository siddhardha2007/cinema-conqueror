import { useState, useEffect } from "react";
import MovieCard from "./MovieCard";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { movieDataService } from "@/services/movieDataService";
import { Movie } from "@/contexts/BookingContext";

const MoviesSection = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        const response = await movieDataService.getCurrentMovies();
        setMovies(response.results.slice(0, 8)); // Show first 8 movies
      } catch (error) {
        console.error('Failed to load movies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Recommended Movies</h2>
            <p className="text-muted-foreground">Trending movies in your city</p>
          </div>
          <Button variant="ghost" className="text-primary hover:text-primary/80">
            See All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Movies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="cinema-card overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-muted"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : (
            movies.map((movie) => (
              <MovieCard key={movie.id} {...movie} />
            ))
          )}
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