import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { theaters } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Star, Clock, Car, Coffee, Volume2, Armchair, Loader2, Navigation, Phone, Globe, RefreshCw, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { theaterService, Theater } from "@/services/theaterService";
import { movieShowtimeService } from "@/services/movieShowtimeService";

const TheaterSelection = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [nearbyTheaters, setNearbyTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string>("");
  const [showtimeLoading, setShowtimeLoading] = useState(false);
  const [realTimeData, setRealTimeData] = useState<boolean>(false);

  if (!state.selectedMovie) {
    navigate('/');
    return null;
  }

  const getCurrentLocation = () => {
    setLoading(true);
    setLocationError("");
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        console.log('🎯 Location found:', latitude, longitude);
        
        try {
          // Enhanced theater discovery with movie-specific showtimes
          const foundTheaters = await theaterService.findNearbyTheaters(
            latitude, 
            longitude, 
            state.selectedMovie.id
          );
          setNearbyTheaters(foundTheaters);
          setRealTimeData(foundTheaters.length > 0);
          
          // Try to get real-time showtime data
          const showtimeData = await movieShowtimeService.getShowtimes(
            state.selectedMovie.id,
            latitude,
            longitude
          );
          
          if (showtimeData) {
            console.log('✨ Got real-time showtime data');
            // Update theaters with real showtime data
            const enhancedTheaters = foundTheaters.map(theater => {
              const realTheater = showtimeData.theaters.find(st => 
                st.name.toLowerCase().includes(theater.name.toLowerCase().split(' ')[0])
              );
              if (realTheater) {
                // Map showtime format to match Theater interface
                const mappedShowtimes = realTheater.showtimes.map((st, index) => ({
                  id: `${theater.id}-showtime-${index}`,
                  time: st.time,
                  type: st.type,
                  price: st.price,
                  availableSeats: st.availableSeats,
                  movieId: state.selectedMovie.id,
                  bookingUrl: st.bookingUrl
                }));
                return { ...theater, showtimes: mappedShowtimes };
              }
              return theater;
            });
            setNearbyTheaters(enhancedTheaters);
          }
          
          toast({
            title: realTimeData ? "🎬 Live Data!" : "📍 Location Found!",
            description: `Found ${foundTheaters.length} theaters ${realTimeData ? 'with real-time showtimes' : 'near you'}`,
          });
        } catch (error) {
          console.error('❌ Error finding theaters:', error);
          toast({
            title: "Using Default Theaters",
            description: "Couldn't fetch nearby theaters, showing defaults",
            variant: "destructive"
          });
        }
        
        setLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationError(`Error getting location: ${error.message}`);
        setLoading(false);
        toast({
          title: "Location Error",
          description: "Using default theaters. Please allow location access for nearby theaters.",
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  // Auto-fetch location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const displayTheaters = nearbyTheaters.length > 0 ? nearbyTheaters : theaters.map(t => ({
    ...t,
    rating: 4.2 // Ensure consistent rating type
  } as Theater));

  const handleShowtimeSelect = (theater: any, showtime: any) => {
    dispatch({ type: 'SELECT_THEATER', payload: theater });
    dispatch({ type: 'SELECT_SHOWTIME', payload: showtime });
    navigate('/seats');
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'parking': return <Car className="h-4 w-4" />;
      case 'food court':
      case 'café':
      case 'gourmet food': return <Coffee className="h-4 w-4" />;
      case 'dolby atmos': return <Volume2 className="h-4 w-4" />;
      case 'recliner seats':
      case 'premium seats': return <Armchair className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-center">
            <h1 className="font-semibold">{state.selectedMovie.title}</h1>
            <p className="text-sm text-muted-foreground">{state.selectedMovie.duration} • {state.selectedMovie.language}</p>
          </div>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Select Cinema</h1>
              <p className="text-muted-foreground">
                {location ? `Theaters near your location` : "Choose your preferred theater and showtime"}
              </p>
            </div>
            <Button 
              onClick={getCurrentLocation} 
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {loading ? "Finding..." : "Find Nearby"}
            </Button>
          </div>
          
          {locationError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
              <p className="text-destructive text-sm">{locationError}</p>
            </div>
          )}
          
          {location && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
              <p className="text-primary text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location found! Showing theaters within 10km radius
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Finding theaters near you...</p>
            </div>
          )}
          
          {!loading && displayTheaters.map((theater) => (
            <div key={theater.id} className="cinema-card p-6 animate-fade-in">
              {/* Theater Info */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{theater.name}</h3>
                    <div className="flex items-center text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-1" />
                      {theater.location} • {theater.distance}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-cinema-gold border-cinema-gold">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {theater.rating?.toFixed(1) || '4.0'}
                  </Badge>
                </div>

                {/* Amenities */}
                <div className="flex flex-wrap gap-2">
                  {theater.amenities.map((amenity, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {getAmenityIcon(amenity)}
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Showtimes */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Show Times
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {theater.showtimes.map((showtime) => (
                    <Button
                      key={showtime.id}
                      variant="outline"
                      className="flex flex-col h-auto p-3 hover:border-primary hover:bg-primary/5"
                      onClick={() => handleShowtimeSelect(theater, showtime)}
                    >
                      <span className="font-semibold text-lg">{showtime.time}</span>
                      <span className="text-xs text-muted-foreground">{showtime.type}</span>
                      <span className="text-sm font-medium text-cinema-red">₹{showtime.price}</span>
                      <span className="text-xs text-muted-foreground">
                        {showtime.availableSeats} seats available
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TheaterSelection;