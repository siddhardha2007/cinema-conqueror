import { useState } from "react";
import MovieCard from "./MovieCard";
import { Button } from "@/components/ui/button";
import { movies } from "@/data/mockData";

interface MoviesSectionProps {
  searchQuery?: string;
}

const MoviesSection = ({ searchQuery = "" }: MoviesSectionProps) => {
  const filteredMovies = movies.filter((movie) =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movie.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movie.director.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                {searchQuery ? `Results for "${searchQuery}"` : "Now Showing"}
              </h2>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `${filteredMovies.length} movie${filteredMovies.length !== 1 ? "s" : ""} found`
                  : "Book tickets for the latest movies"}
              </p>
            </div>
          </div>

          {filteredMovies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  id={movie.id}
                  title={movie.title}
                  rating={movie.rating}
                  duration={movie.duration}
                  genre={movie.genre}
                  language={movie.language}
                  image={movie.image}
                  releaseDate={movie.releaseDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground">No movies found matching your search.</p>
            </div>
          )}
        </div>

        {!searchQuery && (
          <div className="mt-12">
            <h3 className="text-xl font-semibold mb-6">Browse by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance"].map((category) => (
                <Button key={category} variant="outline"
                  className="h-12 hover:border-primary hover:text-primary transition-colors">
                  {category}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default MoviesSection;
