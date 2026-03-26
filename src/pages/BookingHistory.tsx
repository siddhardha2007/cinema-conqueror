import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ticket, Calendar, MapPin, Clock } from "lucide-react";

interface BookingRow {
  id: string;
  movie_title: string;
  theater_name: string;
  showtime: string;
  seats: string[];
  total_amount: number;
  booking_date: string;
  status: string;
  created_at: string;
}

const BookingHistory = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      setBookings((data as BookingRow[]) || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="font-semibold ml-4">My Bookings</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {bookings.length === 0 ? (
          <div className="cinema-card p-12 text-center">
            <Ticket className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Bookings Yet</h2>
            <p className="text-muted-foreground mb-6">Start by booking your first movie!</p>
            <Button onClick={() => navigate("/")} className="cinema-gradient text-white">Browse Movies</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="cinema-card p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold">{booking.movie_title}</h3>
                  <Badge className={booking.status === "confirmed"
                    ? "bg-green-500/20 text-green-500 border-green-500/30"
                    : "bg-red-500/20 text-red-500 border-red-500/30"}>
                    {booking.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {booking.theater_name}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" /> {booking.booking_date}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" /> {booking.showtime}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Ticket className="h-4 w-4" /> {booking.seats.join(", ")}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                  <span className="font-bold text-primary">₹{booking.total_amount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingHistory;
