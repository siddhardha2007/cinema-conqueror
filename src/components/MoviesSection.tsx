import MovieCard from "./MovieCard";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import movie1 from "@/assets/movie1.jpg";
import movie2 from "@/assets/movie2.jpg";
import movie3 from "@/assets/movie3.jpg";
import movie4 from "@/assets/movie4.jpg";

const MoviesSection = () => {
  const movies = [
    {
      title: "The Dark Knight Returns",
      rating: 9.2,
      duration: "2h 45m",
      genre: "Action",
      language: "English",
      image: movie1,
      releaseDate: "Dec 15"
    },
    {
      title: "Stellar Odyssey",
      rating: 8.8,
      duration: "2h 20m",
      genre: "Sci-Fi",
      language: "English",
      image: movie2,
      releaseDate: "Dec 22"
    },
    {
      title: "Romance in Paris",
      rating: 8.1,
      duration: "1h 55m",
      genre: "Romance",
      language: "English",
      image: movie3,
      releaseDate: "Dec 18"
    },
    {
      title: "Thunder Road",
      rating: 8.5,
      duration: "2h 10m",
      genre: "Action",
      language: "English",
      image: movie4,
      releaseDate: "Dec 25"
    }
  ];

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
          {movies.map((movie, index) => (
            <MovieCard key={index} {...movie} />
          ))}
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