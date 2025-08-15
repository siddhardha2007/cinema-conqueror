import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Calendar, MapPin, Clock, Ticket, Share2, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();

  if (!state.selectedMovie || state.bookings.length === 0) {
    navigate('/');
    return null;
  }

  const latestBooking = state.bookings[state.bookings.length - 1];

  const handleDownloadTicket = () => {
    toast({
      title: "Ticket Downloaded",
      description: "Your e-ticket has been downloaded successfully.",
    });
  };

  const handleShareBooking = () => {
    const shareText = `Just booked tickets for ${latestBooking.movieTitle} at ${latestBooking.theaterName}! 🎬`;
    navigator.clipboard.writeText(shareText);
    toast({
      title: "Booking Details Copied",
      description: "Booking details copied to clipboard for sharing.",
    });
  };

  const handleNewBooking = () => {
    dispatch({ type: 'CLEAR_BOOKING' });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Success Animation */}
        <div className="text-center mb-8 animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">Your tickets have been booked successfully</p>
        </div>

        {/* Booking Details Card */}
        <div className="cinema-card p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Booking Details</h2>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
              Confirmed
            </Badge>
          </div>

          <div className="space-y-6">
            {/* Movie Info */}
            <div className="flex gap-4">
              <img 
                src={state.selectedMovie.image} 
                alt={state.selectedMovie.title}
                className="w-20 h-28 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">{latestBooking.movieTitle}</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {latestBooking.theaterName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {latestBooking.bookingDate}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {latestBooking.showtime}
                  </div>
                </div>
              </div>
            </div>

            {/* Booking ID */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Booking ID</p>
                  <p className="font-mono font-semibold">BMS{latestBooking.id}</p>
                </div>
                <Ticket className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>

            {/* Seats & Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Seats</p>
                <div className="flex flex-wrap gap-1">
                  {latestBooking.seats.map((seat, index) => (
                    <Badge key={index} variant="secondary">
                      {seat}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Total Paid</p>
                <p className="text-2xl font-bold text-cinema-red">₹{latestBooking.totalAmount}</p>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-cinema-gold/10 border border-cinema-gold/20 p-4 rounded-lg">
              <h4 className="font-semibold text-cinema-gold mb-2">Important Information</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Please arrive 30 minutes before the show</li>
                <li>• Carry a valid ID proof for entry</li>
                <li>• Outside food is not allowed</li>
                <li>• No refunds or exchanges allowed</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full cinema-gradient text-white font-semibold py-3"
            onClick={handleDownloadTicket}
          >
            <Download className="h-5 w-5 mr-2" />
            Download E-Ticket
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleShareBooking}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={handleNewBooking}>
              <Home className="h-4 w-4 mr-2" />
              Book More
            </Button>
          </div>
        </div>

        {/* Help Section */}
        <div className="text-center mt-8 p-6 bg-card/20 rounded-lg">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Contact our customer support for any assistance
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <span className="text-cinema-red font-semibold">📞 1800-123-4567</span>
            <span className="text-cinema-red font-semibold">✉️ help@bookmyshow.com</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;