import { Star, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MovieCardProps {
  title: string;
  rating: number;
  duration: string;
  genre: string;
  language: string;
  image: string;
  releaseDate: string;
}

const MovieCard = ({ title, rating, duration, genre, language, image, releaseDate }: MovieCardProps) => {
  return (
    <div className="cinema-card group cursor-pointer overflow-hidden">
      {/* Movie Poster */}
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title}
          className="w-full h-80 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Rating Badge */}
        <div className="absolute top-3 right-3">
          <Badge className="bg-black/70 text-white border-0">
            <Star className="h-3 w-3 mr-1 fill-current text-cinema-gold" />
            {rating}/10
          </Badge>
        </div>

        {/* Quick Book Button - appears on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button className="cinema-gradient text-white rounded-full font-semibold">
            Book Tickets
          </Button>
        </div>
      </div>

      {/* Movie Details */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            {duration}
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {releaseDate}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-x-2">
            <Badge variant="secondary">{genre}</Badge>
            <Badge variant="outline">{language}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;