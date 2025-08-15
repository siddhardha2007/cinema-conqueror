import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { theaters } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Star, Clock, Car, Coffee, Volume2, Armchair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TheaterSelection = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();

  if (!state.selectedMovie) {
    navigate('/');
    return null;
  }

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
          <h1 className="text-3xl font-bold mb-2">Select Cinema</h1>
          <p className="text-muted-foreground">Choose your preferred theater and showtime</p>
        </div>

        <div className="space-y-6">
          {theaters.map((theater) => (
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
                    4.2
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