import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, ChevronRight } from "lucide-react";

const EventsSection = () => {
  const events = [
    {
      title: "Rock Music Festival 2024",
      date: "Dec 20, 2024",
      time: "6:00 PM",
      venue: "Phoenix Marketcity",
      price: "₹1,299 onwards",
      category: "Music",
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop"
    },
    {
      title: "Stand-Up Comedy Night",
      date: "Dec 18, 2024", 
      time: "8:00 PM",
      venue: "Comedy Store Mumbai",
      price: "₹599 onwards",
      category: "Comedy",
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop"
    },
    {
      title: "Dance Workshop",
      date: "Dec 22, 2024",
      time: "4:00 PM", 
      venue: "Shiamak Davar Institute",
      price: "₹899 onwards",
      category: "Workshop",
      image: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=300&fit=crop"
    }
  ];

  return (
    <section className="py-16 bg-card/20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Live Events</h2>
            <p className="text-muted-foreground">Discover amazing events happening around you</p>
          </div>
          <Button variant="ghost" className="text-primary hover:text-primary/80">
            See All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event, index) => (
            <div key={index} className="cinema-card group cursor-pointer overflow-hidden">
              {/* Event Image */}
              <div className="relative overflow-hidden h-48">
                <img 
                  src={event.image} 
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Category Badge */}
                <div className="absolute top-3 right-3">
                  <Badge className="bg-accent text-accent-foreground">
                    {event.category}
                  </Badge>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-4">
                <h3 className="font-bold text-lg mb-3 group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {event.date}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    {event.time}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    {event.venue}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{event.price}</span>
                  <Button size="sm" className="cinema-gradient text-white">
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;