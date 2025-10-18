import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Download, Calendar, MapPin, Clock, Ticket, Share2, Home, QrCode, Mail, Phone, Star, Users, Heart, MessageCircle, ExternalLink, Gift, Sparkles, Navigation, Utensils, Car, Camera, ThumbsUp, Send, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import confetti from 'canvas-confetti';
import Countdown from 'react-countdown';
import { supabase } from "@/integrations/supabase/client";

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  if (!state.selectedMovie || state.bookings.length === 0) {
    navigate('/');
    return null;
  }

  const latestBooking = state.bookings[state.bookings.length - 1];

  // Confetti celebration on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#dc2626', '#f59e0b', '#ffffff']
      });
      
      // Second burst
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 }
        });
      }, 200);
      
      // Third burst
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 }
        });
      }, 400);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Show review prompt after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReviewPrompt(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Send confirmation email on mount
  useEffect(() => {
    const sendConfirmationEmail = async () => {
      if (emailSent || emailSending) return;
      
      setEmailSending(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            email: 'customer@example.com', // In production, get from user profile
            name: 'Valued Customer', // In production, get from user profile
            bookingId: `BMS${latestBooking.id}`,
            movieTitle: latestBooking.movieTitle,
            theaterName: latestBooking.theaterName,
            showDate: latestBooking.bookingDate,
            showtime: latestBooking.showtime,
            seats: latestBooking.seats,
            totalAmount: latestBooking.totalAmount,
          }
        });

        if (error) throw error;

        setEmailSent(true);
        toast({
          title: "📧 Confirmation Email Sent",
          description: "Check your inbox for booking details!",
        });
      } catch (error) {
        console.error('Email error:', error);
        toast({
          title: "Email Failed",
          description: "Couldn't send confirmation email. Your booking is still confirmed!",
          variant: "destructive",
        });
      } finally {
        setEmailSending(false);
      }
    };

    sendConfirmationEmail();
  }, [latestBooking, emailSent, emailSending, toast]);

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

  const getShowDateTime = () => {
    const [datePart, timePart] = [latestBooking.bookingDate, latestBooking.showtime];
    const showDate = new Date(`${datePart} ${timePart}`);
    return showDate.getTime();
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (!isLiked) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#dc2626', '#f59e0b']
      });
    }
    toast({
      title: isLiked ? "Removed from favorites" : "Added to favorites",
      description: isLiked ? "Movie removed from your favorites" : "Movie added to your favorites ❤️",
    });
  };

  const handlePrintTicket = () => {
    window.print();
    toast({
      title: "Print Ticket",
      description: "Print dialog opened for your e-ticket.",
    });
  };

  const handleAddToCalendar = () => {
    const eventTitle = `${latestBooking.movieTitle} - ${latestBooking.theaterName}`;
    const eventDate = new Date(`${latestBooking.bookingDate} ${latestBooking.showtime}`);
    const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours later
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(`Movie: ${latestBooking.movieTitle}\nSeats: ${latestBooking.seats.join(', ')}\nBooking ID: BMS${latestBooking.id}`)}&location=${encodeURIComponent(latestBooking.theaterName)}`;
    
    window.open(googleCalendarUrl, '_blank');
    toast({
      title: "Calendar Event",
      description: "Movie added to your Google Calendar.",
    });
  };

  const shareToSocial = (platform: string) => {
    const shareText = `🎬 Just booked tickets for "${latestBooking.movieTitle}" at ${latestBooking.theaterName}! Can't wait for the show! 🍿`;
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${window.location.href}&quote=${encodeURIComponent(shareText)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      instagram: '#' // Instagram doesn't support direct URL sharing
    };
    
    if (platform === 'instagram') {
      navigator.clipboard.writeText(shareText);
      toast({
        title: "Copied to clipboard",
        description: "Share text copied! Open Instagram to post.",
      });
    } else {
      window.open(urls[platform as keyof typeof urls], '_blank');
    }
    setShowSocialShare(false);
  };

  const handleDownloadTicket = () => {
    // Trigger confetti for celebration
    confetti({
      particleCount: 50,
      spread: 45,
      origin: { y: 0.7 }
    });
    
    toast({
      title: "🎫 Ticket Downloaded",
      description: "Your premium e-ticket has been downloaded successfully.",
    });
  };

  const handleShareBooking = () => {
    setShowSocialShare(true);
  };

  const handleNewBooking = () => {
    dispatch({ type: 'CLEAR_BOOKING' });
    navigate('/');
  };

  const countdownRenderer = ({ days, hours, minutes, seconds, completed }: any) => {
    if (completed) {
      return <span className="text-green-500 font-semibold">Show Time! 🎬</span>;
    } else {
      return (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-cinema-red/20 rounded-lg p-2">
            <div className="text-lg font-bold text-cinema-red">{days}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
          <div className="bg-cinema-red/20 rounded-lg p-2">
            <div className="text-lg font-bold text-cinema-red">{hours}</div>
            <div className="text-xs text-muted-foreground">Hours</div>
          </div>
          <div className="bg-cinema-red/20 rounded-lg p-2">
            <div className="text-lg font-bold text-cinema-red">{minutes}</div>
            <div className="text-xs text-muted-foreground">Mins</div>
          </div>
          <div className="bg-cinema-red/20 rounded-lg p-2">
            <div className="text-lg font-bold text-cinema-red">{seconds}</div>
            <div className="text-xs text-muted-foreground">Secs</div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-cinema-dark/20 relative overflow-hidden">
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-cinema-gold rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-cinema-red rounded-full animate-ping"></div>
        <div className="absolute bottom-40 left-20 w-3 h-3 bg-cinema-gold/50 rounded-full animate-bounce"></div>
        <div className="absolute bottom-20 right-10 w-2 h-2 bg-cinema-red/50 rounded-full animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        {/* Enhanced Success Animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-28 h-28 mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="absolute inset-2 bg-green-500/30 rounded-full animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-green-400 to-green-600 rounded-full p-6 shadow-2xl">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-cinema-gold animate-spin" />
          </div>
          <h1 className="text-5xl font-bold mb-4 text-gradient animate-pulse">Booking Confirmed!</h1>
          <p className="text-xl text-muted-foreground mb-4">Your cinematic journey awaits</p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <Star className="h-6 w-6 text-cinema-gold fill-current animate-bounce" />
            <span className="text-cinema-gold font-bold text-lg">Premium Experience Unlocked</span>
            <Star className="h-6 w-6 text-cinema-gold fill-current animate-bounce" />
          </div>
          
          {/* Countdown Timer */}
          <div className="max-w-md mx-auto mb-6">
            <p className="text-sm text-muted-foreground mb-3">Show starts in:</p>
            <Countdown
              date={getShowDateTime()}
              renderer={countdownRenderer}
            />
          </div>
        </div>

        {/* Premium Digital Ticket with Enhanced Features */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          {/* Main Premium Ticket */}
          <Card className="xl:col-span-3 relative overflow-hidden cinema-card animate-fade-in shadow-2xl">
            {/* Premium Badge */}
            <div className="absolute top-4 right-4 bg-gradient-to-r from-cinema-gold to-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-10">
              PREMIUM TICKET
            </div>
            
            {/* Ticket Perforations */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-background/50">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="w-3 h-3 bg-background rounded-full absolute left-1/2 transform -translate-x-1/2" style={{ top: `${(i * 4) + 2}%` }} />
              ))}
            </div>
            
            <div className="p-8 pr-16">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-cinema-red to-cinema-gold rounded-full flex items-center justify-center shadow-lg">
                    <Ticket className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Premium E-Ticket</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                        Confirmed
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLike}
                        className={`p-1 h-auto ${isLiked ? 'text-red-500' : 'text-muted-foreground'} hover:text-red-500`}
                      >
                        <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Booking ID</p>
                  <p className="font-mono font-bold text-xl text-gradient">BMS{latestBooking.id}</p>
                </div>
              </div>

              {/* Enhanced Movie Details */}
              <div className="flex gap-6 mb-8">
                <div className="relative group">
                  <img 
                    src={state.selectedMovie.image} 
                    alt={state.selectedMovie.title}
                    className="w-32 h-48 object-cover rounded-xl shadow-xl group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Camera className="absolute bottom-2 right-2 h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-4 text-gradient">{latestBooking.movieTitle}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-3 p-3 bg-cinema-red/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-cinema-red" />
                      <div>
                        <p className="font-semibold">{latestBooking.theaterName}</p>
                        <p className="text-muted-foreground">Premium Theater</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-cinema-gold/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-cinema-gold" />
                      <div>
                        <p className="font-semibold">{latestBooking.bookingDate}</p>
                        <p className="text-muted-foreground">Show Date</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-semibold">{latestBooking.showtime}</p>
                        <p className="text-muted-foreground">Show Time</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
                      <Users className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-semibold">{latestBooking.seats.length} Ticket{latestBooking.seats.length > 1 ? 's' : ''}</p>
                        <p className="text-muted-foreground">Guests</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-2 mb-4">
                    <Button variant="outline" size="sm" onClick={handleAddToCalendar}>
                      <Calendar className="h-4 w-4 mr-1" />
                      Add to Calendar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrintTicket}>
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>
                  </div>
                </div>
              </div>

              {/* Premium Seats Display */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-lg font-bold text-cinema-gold">Premium Seats Selected</p>
                  <Badge variant="secondary" className="bg-cinema-gold/20 text-cinema-gold">
                    <Star className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {latestBooking.seats.map((seat, index) => (
                    <div key={index} className="relative group">
                      <div className="bg-gradient-to-br from-cinema-red to-cinema-red/80 border-2 border-cinema-red/30 text-white px-4 py-3 rounded-xl font-mono font-bold text-center shadow-lg group-hover:shadow-xl transition-all duration-300 hover:scale-105">
                        {seat}
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-cinema-gold rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Total Amount */}
              <div className="bg-gradient-to-r from-cinema-gold/20 via-cinema-red/20 to-cinema-gold/20 p-6 rounded-xl border border-cinema-gold/30 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-bold">Total Investment</span>
                  <span className="text-4xl font-bold text-gradient">₹{latestBooking.totalAmount}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Payment Method: UPI • •••• 9876</span>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Verified Payment</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Enhanced QR Code & Features Panel */}
          <div className="space-y-6">
            {/* QR Code */}
            <Card className="cinema-card p-6 text-center animate-fade-in">
              <div className="mb-4">
                <QrCode className="h-8 w-8 text-cinema-red mx-auto mb-3" />
                <h3 className="font-bold mb-2">Entry Pass</h3>
                <p className="text-sm text-muted-foreground mb-4">Scan at theater entrance</p>
              </div>
              
              <div className="bg-white p-4 rounded-lg mb-6 mx-auto w-fit shadow-inner">
                <canvas ref={qrCanvasRef} className="mx-auto" />
              </div>

              <div className="space-y-3 text-sm">
                <div className="bg-cinema-gold/10 border border-cinema-gold/20 p-3 rounded-lg">
                  <h4 className="font-semibold text-cinema-gold mb-2">Entry Guidelines</h4>
                  <ul className="text-left text-muted-foreground space-y-1">
                    <li>• Arrive 30 min early</li>
                    <li>• Bring valid ID proof</li>
                    <li>• No outside food allowed</li>
                    <li>• No refunds/exchanges</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Smart Recommendations */}
            <Card className="cinema-card p-6 animate-fade-in">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cinema-gold" />
                Smart Suggestions
              </h3>
              <div className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Utensils className="h-4 w-4 mr-2 text-orange-500" />
                  Nearby Restaurants
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Car className="h-4 w-4 mr-2 text-blue-500" />
                  Parking Options
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Navigation className="h-4 w-4 mr-2 text-green-500" />
                  Get Directions
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </div>
            </Card>

            {/* Loyalty Program */}
            <Card className="cinema-card p-6 animate-fade-in bg-gradient-to-br from-cinema-gold/10 to-cinema-red/10">
              <div className="text-center">
                <Gift className="h-8 w-8 text-cinema-gold mx-auto mb-2" />
                <h3 className="font-bold mb-2">Loyalty Rewards</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  You earned <span className="text-cinema-gold font-bold">250 points</span> with this booking!
                </p>
                <Button size="sm" className="cinema-gradient text-white">
                  View Rewards
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button 
            className="cinema-gradient text-white font-bold py-6 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover-scale group"
            onClick={handleDownloadTicket}
          >
            <Download className="h-6 w-6 mr-2 group-hover:animate-bounce" />
            Download Premium Ticket
          </Button>
          
          <Button 
            variant="outline" 
            className="py-6 text-lg border-cinema-red/30 hover:bg-cinema-red/10 hover:border-cinema-red transition-all duration-300 group"
            onClick={handleShareBooking}
          >
            <Share2 className="h-6 w-6 mr-2 group-hover:rotate-12 transition-transform" />
            Share Experience
          </Button>
          
          <Button 
            variant="outline" 
            className="py-6 text-lg border-cinema-gold/30 hover:bg-cinema-gold/10 hover:border-cinema-gold transition-all duration-300 group"
            onClick={handleNewBooking}
          >
            <Home className="h-6 w-6 mr-2 group-hover:scale-110 transition-transform" />
            Book More Movies
          </Button>
        </div>

        {/* Review Prompt (Appears after delay) */}
        {showReviewPrompt && (
          <Card className="cinema-card p-6 mb-8 animate-fade-in border-cinema-gold/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-6 w-6 text-cinema-gold hover:fill-current cursor-pointer transition-colors" />
                  ))}
                </div>
                <div>
                  <h3 className="font-bold">Rate Your Experience</h3>
                  <p className="text-sm text-muted-foreground">Help others discover great movies</p>
                </div>
              </div>
              <Button size="sm" className="cinema-gradient text-white">
                <MessageCircle className="h-4 w-4 mr-1" />
                Review
              </Button>
            </div>
          </Card>
        )}

        {/* Social Share Modal */}
        {showSocialShare && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="cinema-card p-6 max-w-md w-full animate-scale-in">
              <div className="text-center mb-6">
                <Share2 className="h-12 w-12 text-cinema-red mx-auto mb-3" />
                <h3 className="text-xl font-bold mb-2">Share Your Movie Experience</h3>
                <p className="text-muted-foreground">Let your friends know about your upcoming movie!</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { name: 'Twitter', icon: '🐦', color: 'bg-blue-500' },
                  { name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
                  { name: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
                  { name: 'Instagram', icon: '📷', color: 'bg-pink-500' }
                ].map((platform) => (
                  <Button
                    key={platform.name}
                    variant="outline"
                    className="h-16 flex-col gap-2 hover:scale-105 transition-transform"
                    onClick={() => shareToSocial(platform.name.toLowerCase())}
                  >
                    <span className="text-2xl">{platform.icon}</span>
                    <span className="text-sm">{platform.name}</span>
                  </Button>
                ))}
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowSocialShare(false)}
              >
                Close
              </Button>
            </Card>
          </div>
        )}
        {/* Premium Customer Support */}
        <Card className="cinema-card p-8 text-center shadow-2xl">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-cinema-red via-cinema-gold to-cinema-red rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Phone className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-3xl font-bold mb-3">VIP Support Available</h3>
            <p className="text-lg text-muted-foreground mb-8">
              Our premium support team is ready to assist you 24/7
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-cinema-red/10 border border-cinema-red/20 p-6 rounded-xl hover:scale-105 transition-transform duration-300">
              <Phone className="h-8 w-8 text-cinema-red mx-auto mb-3" />
              <p className="font-bold text-cinema-red mb-2">Instant Call Support</p>
              <p className="text-xl font-mono mb-2">1800-123-4567</p>
              <Badge className="bg-green-500/20 text-green-600">24/7 Available</Badge>
            </div>
            
            <div className="bg-cinema-gold/10 border border-cinema-gold/20 p-6 rounded-xl hover:scale-105 transition-transform duration-300">
              <Mail className="h-8 w-8 text-cinema-gold mx-auto mb-3" />
              <p className="font-bold text-cinema-gold mb-2">Priority Email</p>
              <p className="text-lg mb-2">vip@bookmyshow.com</p>
              <Badge className="bg-blue-500/20 text-blue-600">Quick Response</Badge>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-xl hover:scale-105 transition-transform duration-300">
              <MessageCircle className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <p className="font-bold text-blue-500 mb-2">Live Chat</p>
              <p className="text-lg mb-2">Instant Messaging</p>
              <Badge className="bg-purple-500/20 text-purple-600">Online Now</Badge>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-gradient-to-r from-cinema-gold/20 to-cinema-red/20 rounded-xl">
            <p className="text-sm text-muted-foreground">
              <strong>VIP Tip:</strong> Screenshot this confirmation for faster support assistance
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BookingConfirmation;