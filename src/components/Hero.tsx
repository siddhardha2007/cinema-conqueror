import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Star, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { movieDataService } from "@/services/movieDataService";
import { Movie } from "@/contexts/BookingContext";
import heroImage from "@/assets/hero-bg.jpg";

const Hero = () => {
  const navigate = useNavigate();
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedMovie = async () => {
      try {
        const response = await movieDataService.getCurrentMovies();
        if (response.results.length > 0) {
          setFeaturedMovie(response.results[0]); // Use first movie as featured
        }
      } catch (error) {
        console.error('Failed to load featured movie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedMovie();
  }, []);

  const handleBookNow = () => {
    if (featuredMovie) {
      navigate(`/movie/${featuredMovie.id}`);
    }
  };
  return (
    <section className="relative h-[70vh] overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cinema-darker via-cinema-dark/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 h-full flex items-center">
        <div className="max-w-2xl text-white">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-white/20 rounded w-32"></div>
              <div className="h-16 bg-white/20 rounded w-full"></div>
              <div className="h-6 bg-white/20 rounded w-3/4"></div>
              <div className="flex space-x-4 mt-8">
                <div className="h-12 bg-white/20 rounded-full w-32"></div>
                <div className="h-12 bg-white/20 rounded-full w-32"></div>
              </div>
            </div>
          ) : featuredMovie ? (
            <>
              <div className="flex items-center space-x-4 mb-4">
                <Star className="h-5 w-5 text-cinema-gold fill-current" />
                <span className="text-cinema-gold font-semibold">NOW PLAYING</span>
                <Badge className="bg-cinema-red text-white">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  {featuredMovie.rating}/10
                </Badge>
              </div>
              
              <h1 className="text-6xl font-bold mb-4 leading-tight">
                {featuredMovie.title}
              </h1>
              
              <div className="flex items-center space-x-6 text-gray-300 mb-4">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  {featuredMovie.duration}
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  {featuredMovie.releaseDate}
                </div>
                <Badge variant="outline" className="border-white/30 text-white">
                  {featuredMovie.genre}
                </Badge>
              </div>
              
              <p className="text-xl text-gray-300 mb-8 max-w-lg line-clamp-3">
                {featuredMovie.description}
              </p>

              <div className="flex items-center space-x-4">
                <Button 
                  size="lg" 
                  className="cinema-gradient text-white font-semibold px-8 py-3 rounded-full"
                  onClick={handleBookNow}
                >
                  <Play className="h-5 w-5 mr-2 fill-current" />
                  Book Now
                </Button>
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-full">
                  Watch Trailer
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2 mb-4">
                <Star className="h-5 w-5 text-cinema-gold fill-current" />
                <span className="text-cinema-gold font-semibold">NOW PLAYING</span>
              </div>
              
              <h1 className="text-6xl font-bold mb-4 leading-tight">
                The Ultimate 
                <span className="text-gradient block">Entertainment</span>
                Experience
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 max-w-lg">
                Book tickets for the latest movies, live events, concerts, and sports. 
                Experience entertainment like never before.
              </p>

              <div className="flex items-center space-x-4">
                <Button size="lg" className="cinema-gradient text-white font-semibold px-8 py-3 rounded-full">
                  <Play className="h-5 w-5 mr-2 fill-current" />
                  Book Now
                </Button>
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-full">
                  Watch Trailer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;