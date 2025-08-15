import { Button } from "@/components/ui/button";
import { Play, Star } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative h-[70vh] overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cinema-darker via-cinema-dark/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 h-full flex items-center">
        <div className="max-w-2xl text-white">
          <div className="flex items-center space-x-2 mb-4">
            <Star className="h-5 w-5 text-cinema-gold fill-current" />
            <span className="text-cinema-gold font-semibold">NOW PLAYING</span>
          </div>
          
          <h1 className="text-6xl font-bold mb-4 leading-tight">
            The Ultimate 
            <span className="text-gradient block">Entertainment</span>
            Experience
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-lg">
            Book tickets for the latest movies, live events, concerts, and sports. 
            Experience entertainment like never before.
          </p>

          <div className="flex items-center space-x-4">
            <Button size="lg" className="cinema-gradient text-white font-semibold px-8 py-3 rounded-full">
              <Play className="h-5 w-5 mr-2 fill-current" />
              Book Now
            </Button>
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-full">
              Watch Trailer
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;