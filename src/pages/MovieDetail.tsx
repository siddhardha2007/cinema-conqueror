import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { movieDataService } from "@/services/movieDataService";
import { Movie } from "@/contexts/BookingContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Calendar, Play, ArrowLeft, Heart, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MovieDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispatch } = useBooking();
  const { toast } = useToast();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovie = async () => {
      if (!id) return;
      
      try {
        const movieData = await movieDataService.getMovieDetails(id);
        setMovie(movieData);
      } catch (error) {
        console.error('Failed to load movie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMovie();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading movie details...</p>
        </div>
      </div>
    );
  }
  
  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Movie Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const handleBookTickets = () => {
    dispatch({ type: 'SELECT_MOVIE', payload: movie });
    navigate('/theaters');
  };

  const handleWishlist = () => {
    toast({
      title: "Added to Wishlist",
      description: `${movie.title} has been added to your wishlist.`,
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied",
      description: "Movie link has been copied to clipboard.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      {/* Movie Hero Section */}
      <section className="relative">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Movie Poster */}
            <div className="lg:col-span-1">
              <div className="cinema-card overflow-hidden">
                <img 
                  src={movie.image} 
                  alt={movie.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Movie Info */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center space-x-4 mb-4">
                  <Badge className="bg-cinema-red text-white">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {movie.rating}/10
                  </Badge>
                  <Badge variant="outline">{movie.language}</Badge>
                  <Badge variant="outline">{movie.genre}</Badge>
                </div>

                <h1 className="text-4xl font-bold mb-4">{movie.title}</h1>
                
                <div className="flex items-center space-x-6 text-muted-foreground mb-6">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    {movie.duration}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {movie.releaseDate}
                  </div>
                </div>

                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  {movie.description}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center space-x-4 mb-8">
                  <Button 
                    size="lg" 
                    className="cinema-gradient text-white font-semibold px-8 py-3 rounded-full"
                    onClick={handleBookTickets}
                  >
                    Book Tickets
                  </Button>
                  <Button variant="outline" size="lg" className="rounded-full">
                    <Play className="h-4 w-4 mr-2" />
                    Watch Trailer
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleWishlist}>
                    <Heart className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleShare}>
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>

                {/* Cast & Crew */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Director</h3>
                    <p className="text-muted-foreground">{movie.director}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Cast</h3>
                    <div className="flex flex-wrap gap-2">
                      {movie.cast.map((actor, index) => (
                        <Badge key={index} variant="secondary">
                          {actor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About the Movie */}
      <section className="py-12 bg-card/20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">About the Movie</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="cinema-card p-6">
              <h3 className="font-semibold mb-2">Genre</h3>
              <p className="text-muted-foreground">{movie.genre}</p>
            </div>
            <div className="cinema-card p-6">
              <h3 className="font-semibold mb-2">Duration</h3>
              <p className="text-muted-foreground">{movie.duration}</p>
            </div>
            <div className="cinema-card p-6">
              <h3 className="font-semibold mb-2">Release Date</h3>
              <p className="text-muted-foreground">{movie.releaseDate}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MovieDetail;