import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { theaters } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Star, Clock, Car, Coffee, Volume2, Armchair, Loader2, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const TheaterSelection = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [nearbyTheaters, setNearbyTheaters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string>("");

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
        await fetchNearbyTheaters(latitude, longitude);
        setLoading(false);
      },
      (error) => {
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

  const fetchNearbyTheaters = async (lat: number, lng: number) => {
    try {
      // Using Google Places API to find movie theaters
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=movie_theater&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`,
        {
          mode: 'cors',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch theaters');
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const theatersWithShowtimes = data.results.slice(0, 8).map((place: any, index: number) => ({
          id: place.place_id,
          name: place.name,
          location: place.vicinity,
          distance: calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
          rating: place.rating || 4.0,
          amenities: ["Parking", "Food Court", "AC", "Online Booking"],
          showtimes: generateShowtimes() // Generate mock showtimes for real theaters
        }));
        
        setNearbyTheaters(theatersWithShowtimes);
        toast({
          title: "Theaters Found",
          description: `Found ${theatersWithShowtimes.length} theaters near you!`,
        });
      } else {
        setNearbyTheaters(theaters); // Fallback to mock data
        toast({
          title: "No nearby theaters found",
          description: "Showing default theaters instead.",
        });
      }
    } catch (error) {
      console.error('Error fetching theaters:', error);
      setNearbyTheaters(theaters); // Fallback to mock data
      toast({
        title: "Error fetching theaters",
        description: "Using default theaters. Please check your internet connection.",
        variant: "destructive"
      });
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return `${distance.toFixed(1)} km`;
  };

  const generateShowtimes = () => {
    const times = ["09:30", "12:45", "16:00", "19:15", "22:30"];
    const types = ["2D", "3D", "IMAX", "4DX"];
    const prices = [150, 200, 350, 450];
    
    return times.map((time, index) => ({
      id: `show-${index}`,
      time,
      type: types[index % types.length],
      price: prices[index % prices.length],
      availableSeats: Math.floor(Math.random() * 50) + 20
    }));
  };

  useEffect(() => {
    // Auto-fetch location on component mount
    getCurrentLocation();
  }, []);

  const displayTheaters = nearbyTheaters.length > 0 ? nearbyTheaters : theaters;

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
                    {theater.rating || 4.2}
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