import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Download, Calendar, MapPin, Clock, Ticket, Share2, Home, QrCode, Mail, Phone, Star, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  if (!state.selectedMovie || state.bookings.length === 0) {
    navigate('/');
    return null;
  }

  const latestBooking = state.bookings[state.bookings.length - 1];

  useEffect(() => {
    if (qrCanvasRef.current && latestBooking) {
      const qrData = JSON.stringify({
        bookingId: `BMS${latestBooking.id}`,
        movie: latestBooking.movieTitle,
        theater: latestBooking.theaterName,
        showtime: latestBooking.showtime,
        seats: latestBooking.seats,
        amount: latestBooking.totalAmount
      });
      
      QRCode.toCanvas(qrCanvasRef.current, qrData, {
        width: 120,
        margin: 2,
        color: {
          dark: '#dc2626',
          light: '#ffffff'
        }
      });
    }
  }, [latestBooking]);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-cinema-dark/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Animation with Confetti Effect */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="relative bg-gradient-to-r from-green-400 to-green-600 rounded-full p-4 shadow-lg">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 text-gradient">Booking Confirmed!</h1>
          <p className="text-lg text-muted-foreground">Your movie experience awaits you</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Star className="h-5 w-5 text-cinema-gold fill-current" />
            <span className="text-cinema-gold font-semibold">Premium Experience</span>
            <Star className="h-5 w-5 text-cinema-gold fill-current" />
          </div>
        </div>

        {/* Digital Ticket */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Ticket */}
          <Card className="lg:col-span-2 relative overflow-hidden cinema-card animate-fade-in">
            {/* Ticket Perforations */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-background/50">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-3 h-3 bg-background rounded-full absolute left-1/2 transform -translate-x-1/2" style={{ top: `${(i * 5) + 2.5}%` }} />
              ))}
            </div>
            
            <div className="p-6 pr-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-cinema-red to-cinema-gold rounded-full flex items-center justify-center">
                    <Ticket className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">E-Ticket</h2>
                    <Badge className="bg-green-500/20 text-green-600 border-green-500/30 mt-1">
                      Confirmed
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Booking ID</p>
                  <p className="font-mono font-bold text-cinema-red">BMS{latestBooking.id}</p>
                </div>
              </div>

              {/* Movie Details */}
              <div className="flex gap-4 mb-6">
                <img 
                  src={state.selectedMovie.image} 
                  alt={state.selectedMovie.title}
                  className="w-24 h-36 object-cover rounded-lg shadow-lg"
                />
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-gradient">{latestBooking.movieTitle}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cinema-red" />
                      <span className="font-medium">{latestBooking.theaterName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-cinema-red" />
                      <span>{latestBooking.bookingDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-cinema-red" />
                      <span>{latestBooking.showtime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-cinema-red" />
                      <span>{latestBooking.seats.length} Ticket{latestBooking.seats.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seats */}
              <div className="mb-6">
                <p className="text-sm font-semibold mb-3 text-cinema-gold">Selected Seats</p>
                <div className="flex flex-wrap gap-2">
                  {latestBooking.seats.map((seat, index) => (
                    <div key={index} className="bg-cinema-red/20 border border-cinema-red/30 text-cinema-red px-3 py-2 rounded-lg font-mono font-bold">
                      {seat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Amount */}
              <div className="bg-gradient-to-r from-cinema-gold/20 to-cinema-red/20 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount Paid</span>
                  <span className="text-3xl font-bold text-gradient">₹{latestBooking.totalAmount}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* QR Code & Instructions */}
          <Card className="cinema-card p-6 text-center animate-fade-in">
            <div className="mb-4">
              <QrCode className="h-8 w-8 text-cinema-red mx-auto mb-3" />
              <h3 className="font-bold mb-2">QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">Show this at the theater entrance</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg mb-6 mx-auto w-fit">
              <canvas ref={qrCanvasRef} className="mx-auto" />
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-cinema-gold/10 border border-cinema-gold/20 p-3 rounded-lg">
                <h4 className="font-semibold text-cinema-gold mb-2">Important</h4>
                <ul className="text-left text-muted-foreground space-y-1">
                  <li>• Arrive 30 min early</li>
                  <li>• Bring valid ID</li>
                  <li>• No outside food</li>
                  <li>• No refunds/exchanges</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button 
            className="cinema-gradient text-white font-semibold py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover-scale"
            onClick={handleDownloadTicket}
          >
            <Download className="h-5 w-5 mr-2" />
            Download E-Ticket
          </Button>
          
          <Button 
            variant="outline" 
            className="py-4 text-lg border-cinema-red/30 hover:bg-cinema-red/10 hover:border-cinema-red transition-all duration-300"
            onClick={handleShareBooking}
          >
            <Share2 className="h-5 w-5 mr-2" />
            Share Booking
          </Button>
          
          <Button 
            variant="outline" 
            className="py-4 text-lg border-cinema-gold/30 hover:bg-cinema-gold/10 hover:border-cinema-gold transition-all duration-300"
            onClick={handleNewBooking}
          >
            <Home className="h-5 w-5 mr-2" />
            Book More Movies
          </Button>
        </div>

        {/* Enhanced Help Section */}
        <Card className="cinema-card p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-cinema-red to-cinema-gold rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Need Assistance?</h3>
            <p className="text-muted-foreground mb-6">
              Our 24/7 customer support team is here to help you
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-cinema-red/10 border border-cinema-red/20 p-4 rounded-lg">
              <Phone className="h-6 w-6 text-cinema-red mx-auto mb-2" />
              <p className="font-semibold text-cinema-red">Call Support</p>
              <p className="text-lg font-mono">1800-123-4567</p>
              <p className="text-sm text-muted-foreground">24/7 Available</p>
            </div>
            
            <div className="bg-cinema-gold/10 border border-cinema-gold/20 p-4 rounded-lg">
              <Mail className="h-6 w-6 text-cinema-gold mx-auto mb-2" />
              <p className="font-semibold text-cinema-gold">Email Support</p>
              <p className="text-lg">help@bookmyshow.com</p>
              <p className="text-sm text-muted-foreground">Quick Response</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BookingConfirmation;