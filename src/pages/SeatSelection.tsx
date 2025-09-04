import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { generateSeats } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, IndianRupee, Grid3X3, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Seat } from "@/contexts/BookingContext";
import Theater3D from "@/components/Theater3D";

const SeatSelection = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [view3D, setView3D] = useState(true); // Start with 3D view

  useEffect(() => {
    if (state.selectedShowtime) {
      const generatedSeats = generateSeats(state.selectedShowtime.availableSeats);
      setSeats(generatedSeats);
    }
  }, [state.selectedShowtime]);

  if (!state.selectedMovie || !state.selectedTheater || !state.selectedShowtime) {
    navigate('/');
    return null;
  }

  const handleSeatClick = (seat: Seat) => {
    if (seat.isBooked) return;
    
    const updatedSeat = { ...seat, isSelected: !seat.isSelected };
    setSeats(seats.map(s => s.id === seat.id ? updatedSeat : s));
    dispatch({ type: 'TOGGLE_SEAT', payload: updatedSeat });
  };

  const totalAmount = state.selectedSeats.reduce((total, seat) => total + seat.price, 0);
  const selectedSeatCount = state.selectedSeats.length;

  const handleProceed = () => {
    if (selectedSeatCount === 0) return;
    navigate('/payment');
  };

  const getSeatTypeColor = (seat: Seat) => {
    if (seat.isBooked) return 'bg-muted text-muted-foreground cursor-not-allowed';
    if (seat.isSelected) return 'bg-cinema-red text-white';
    
    switch (seat.type) {
      case 'vip': return 'bg-cinema-gold text-cinema-dark hover:bg-cinema-gold/80';
      case 'premium': return 'bg-primary text-primary-foreground hover:bg-primary/80';
      default: return 'bg-card hover:bg-accent';
    }
  };

  // Group seats by row
  const seatsByRow = seats.reduce((acc, seat) => {
    if (!acc[seat.row]) acc[seat.row] = [];
    acc[seat.row].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

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
            <p className="text-sm text-muted-foreground">
              {state.selectedTheater.name} • {state.selectedShowtime.time}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setView3D(!view3D)}
            className="flex items-center gap-2"
          >
            {view3D ? <Grid3X3 className="h-4 w-4" /> : <Box className="h-4 w-4" />}
            {view3D ? '2D View' : '3D View'}
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* View Toggle Info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Select Your Seats</h2>
          <p className="text-muted-foreground">
            {view3D 
              ? "Click and drag to rotate • Scroll to zoom • Click seats to select" 
              : "Click on available seats to select them"
            }
          </p>
        </div>

        {/* 3D Theater View */}
        {view3D ? (
          <div className="mb-8">
            <Theater3D seats={seats} onSeatClick={handleSeatClick} />
          </div>
        ) : (
          <>
            {/* Movie Screen */}
            <div className="mb-8">
              <div className="relative">
                <div className="w-full h-2 bg-gradient-to-r from-transparent via-cinema-gold to-transparent rounded-full mb-4"></div>
                <p className="text-center text-muted-foreground text-sm">SCREEN</p>
              </div>
            </div>

            {/* Traditional 2D Seat Map */}
            <div className="mb-8 overflow-x-auto">
              <div className="min-w-max mx-auto">
                {Object.entries(seatsByRow).map(([row, rowSeats]) => (
                  <div key={row} className="flex items-center justify-center mb-3">
                    <span className="w-8 text-center font-semibold text-muted-foreground mr-4">
                      {row}
                    </span>
                    <div className="flex gap-2">
                      {rowSeats.map((seat, index) => (
                        <button
                          key={seat.id}
                          onClick={() => handleSeatClick(seat)}
                          disabled={seat.isBooked}
                          className={cn(
                            "w-8 h-8 rounded-t-lg border-2 border-border/20 transition-all duration-200 text-xs font-medium",
                            getSeatTypeColor(seat),
                            seat.isSelected && "scale-110 shadow-lg",
                            !seat.isBooked && "hover:scale-105"
                          )}
                          title={`${seat.row}${seat.number} - ₹${seat.price} (${seat.type})`}
                        >
                          {seat.number}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mb-8 p-4 bg-card/20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-card border-2 border-border/20 rounded-t-sm"></div>
            <span className="text-sm">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cinema-red rounded-t-sm"></div>
            <span className="text-sm">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded-t-sm"></div>
            <span className="text-sm">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary rounded-t-sm"></div>
            <span className="text-sm">Premium (₹350)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cinema-gold rounded-t-sm"></div>
            <span className="text-sm">VIP (₹500)</span>
          </div>
        </div>

        {/* Selected Seats Summary */}
        {selectedSeatCount > 0 && (
          <div className="cinema-card p-6 mb-6 animate-slide-up">
            <h3 className="font-semibold text-lg mb-4">Selected Seats</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {state.selectedSeats.map((seat) => (
                <Badge key={seat.id} variant="secondary" className="text-sm">
                  {seat.row}{seat.number} - ₹{seat.price}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{selectedSeatCount} seat{selectedSeatCount > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-1 text-lg font-bold">
                <IndianRupee className="h-5 w-5" />
                {totalAmount}
              </div>
            </div>
          </div>
        )}

        {/* Proceed Button */}
        <div className="text-center">
          <Button
            size="lg"
            className="cinema-gradient text-white font-semibold px-12 py-3 rounded-full"
            onClick={handleProceed}
            disabled={selectedSeatCount === 0}
          >
            Proceed to Payment
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection;