import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Smartphone, Building, IndianRupee, Shield, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const Payment = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useBooking();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  if (!state.selectedMovie || !state.selectedTheater || !state.selectedShowtime || state.selectedSeats.length === 0) {
    navigate('/');
    return null;
  }

  const totalAmount = state.selectedSeats.reduce((total, seat) => total + seat.price, 0);
  const convenienceFee = Math.round(totalAmount * 0.02); // 2% convenience fee
  const taxes = Math.round((totalAmount + convenienceFee) * 0.18); // 18% GST
  const finalAmount = totalAmount + convenienceFee + taxes;

  const handlePayment = async () => {
    if (!userEmail || !userName) {
      toast({
        title: "Contact Details Required",
        description: "Please enter your name and email address.",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      const booking = {
        id: Date.now().toString(),
        movieTitle: state.selectedMovie!.title,
        theaterName: state.selectedTheater!.name,
        showtime: state.selectedShowtime!.time,
        seats: state.selectedSeats.map(seat => `${seat.row}${seat.number}`),
        totalAmount: finalAmount,
        bookingDate: new Date().toLocaleDateString(),
        status: 'confirmed' as const,
        userEmail: userEmail,
        userName: userName
      };

      dispatch({ type: 'CONFIRM_BOOKING', payload: booking });
      setIsProcessing(false);
      navigate('/confirmation');
      
      toast({
        title: "Booking Confirmed!",
        description: "Your tickets have been booked successfully.",
      });
    }, 3000);
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
            <h1 className="font-semibold">Payment</h1>
            <p className="text-sm text-muted-foreground">Secure checkout</p>
          </div>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Security Notice */}
            <div className="cinema-card p-4 bg-cinema-gold/10 border-cinema-gold/20">
              <div className="flex items-center gap-2 text-cinema-gold">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Secure Payment</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your payment information is encrypted and secure
              </p>
            </div>

            {/* Contact Details */}
            <div className="cinema-card p-6 space-y-4">
              <h3 className="text-lg font-semibold">Contact Details</h3>
              <p className="text-sm text-muted-foreground">We'll send booking confirmation to this email</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="userName">Full Name *</Label>
                  <Input 
                    id="userName" 
                    placeholder="John Doe" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="userEmail">Email Address *</Label>
                  <Input 
                    id="userEmail" 
                    type="email"
                    placeholder="john@example.com" 
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="cinema-card p-6">
              <h3 className="text-lg font-semibold mb-4">Select Payment Method</h3>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Credit/Debit Card</p>
                        <p className="text-sm text-muted-foreground">Visa, Mastercard, Rupay</p>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Smartphone className="h-5 w-5" />
                      <div>
                        <p className="font-medium">UPI</p>
                        <p className="text-sm text-muted-foreground">GPay, PhonePe, Paytm</p>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                    <RadioGroupItem value="netbanking" id="netbanking" />
                    <Label htmlFor="netbanking" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Building className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Net Banking</p>
                        <p className="text-sm text-muted-foreground">All major banks</p>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Payment Details Form */}
            {paymentMethod === 'card' && (
              <div className="cinema-card p-6 space-y-4">
                <h3 className="text-lg font-semibold">Card Details</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cardName">Cardholder Name</Label>
                    <Input id="cardName" placeholder="John Doe" />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'upi' && (
              <div className="cinema-card p-6">
                <h3 className="text-lg font-semibold mb-4">UPI Payment</h3>
                <div>
                  <Label htmlFor="upiId">UPI ID</Label>
                  <Input id="upiId" placeholder="yourname@paytm" />
                </div>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="cinema-card p-6">
                <h3 className="text-lg font-semibold mb-4">Select Your Bank</h3>
                <select className="w-full p-3 rounded-lg border bg-background">
                  <option>State Bank of India</option>
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>Axis Bank</option>
                  <option>Punjab National Bank</option>
                </select>
              </div>
            )}
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="cinema-card p-6 sticky top-24">
              <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
              
              {/* Movie Details */}
              <div className="space-y-3 mb-6">
                <div>
                  <h4 className="font-medium">{state.selectedMovie.title}</h4>
                  <p className="text-sm text-muted-foreground">{state.selectedMovie.language}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">{state.selectedTheater.name}</p>
                  <p className="text-sm text-muted-foreground">{state.selectedTheater.location}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{state.selectedShowtime.time}</span>
                  <Badge variant="outline">{state.selectedShowtime.type}</Badge>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Selected Seats */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Selected Seats</h4>
                <div className="flex flex-wrap gap-1">
                  {state.selectedSeats.map((seat) => (
                    <Badge key={seat.id} variant="secondary" className="text-xs">
                      {seat.row}{seat.number}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Price Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Tickets ({state.selectedSeats.length})</span>
                  <span>₹{totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Convenience Fee</span>
                  <span>₹{convenienceFee}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Taxes</span>
                  <span>₹{taxes}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span className="flex items-center">
                    <IndianRupee className="h-4 w-4" />
                    {finalAmount}
                  </span>
                </div>
              </div>

              <Button
                className="w-full mt-6 cinema-gradient text-white font-semibold py-3"
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  `Pay ₹${finalAmount}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;