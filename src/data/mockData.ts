import { Movie, Theater, Seat } from '@/contexts/BookingContext';
import movie1 from "@/assets/movie1.jpg";
import movie2 from "@/assets/movie2.jpg";
import movie3 from "@/assets/movie3.jpg";
import movie4 from "@/assets/movie4.jpg";

export const movies: Movie[] = [
  {
    id: '1',
    title: "The Dark Knight Returns",
    rating: 9.2,
    duration: "2h 45m",
    genre: "Action",
    language: "English",
    image: movie1,
    releaseDate: "Dec 15, 2024",
    description: "When Gotham City is threatened by a new villain, Batman must come out of retirement to save the city he once protected. An epic conclusion to the Dark Knight trilogy.",
    cast: ["Christian Bale", "Tom Hardy", "Anne Hathaway", "Gary Oldman"],
    director: "Christopher Nolan",
    trailer: "https://example.com/trailer1"
  },
  {
    id: '2',
    title: "Stellar Odyssey",
    rating: 8.8,
    duration: "2h 20m",
    genre: "Sci-Fi",
    language: "English",
    image: movie2,
    releaseDate: "Dec 22, 2024",
    description: "A crew of astronauts embark on a dangerous mission to explore a distant galaxy, facing unknown challenges and cosmic mysteries.",
    cast: ["Matthew McConaughey", "Jessica Chastain", "Anne Hathaway", "Matt Damon"],
    director: "Denis Villeneuve",
    trailer: "https://example.com/trailer2"
  },
  {
    id: '3',
    title: "Romance in Paris",
    rating: 8.1,
    duration: "1h 55m",
    genre: "Romance",
    language: "English",
    image: movie3,
    releaseDate: "Dec 18, 2024",
    description: "A heartwarming tale of love found in the beautiful streets of Paris, where two strangers discover their perfect match.",
    cast: ["Emma Stone", "Ryan Gosling", "Marion Cotillard", "Jean Dujardin"],
    director: "Woody Allen",
    trailer: "https://example.com/trailer3"
  },
  {
    id: '4',
    title: "Thunder Road",
    rating: 8.5,
    duration: "2h 10m",
    genre: "Action",
    language: "English",
    image: movie4,
    releaseDate: "Dec 25, 2024",
    description: "High-octane action thriller featuring spectacular car chases and explosive stunts across dangerous highways.",
    cast: ["Tom Cruise", "Charlize Theron", "Jason Statham", "Michelle Rodriguez"],
    director: "George Miller",
    trailer: "https://example.com/trailer4"
  }
];

export const theaters: Theater[] = [
  {
    id: '1',
    name: "PVR Phoenix Mills",
    location: "Lower Parel, Mumbai",
    distance: "2.3 km",
    amenities: ["Dolby Atmos", "Recliner Seats", "Food Court", "Parking"],
    showtimes: [
      { id: '1', time: "10:30 AM", type: "2D", price: 250, availableSeats: 120 },
      { id: '2', time: "1:45 PM", type: "2D", price: 300, availableSeats: 95 },
      { id: '3', time: "5:00 PM", type: "IMAX", price: 450, availableSeats: 80 },
      { id: '4', time: "8:30 PM", type: "IMAX", price: 500, availableSeats: 45 },
      { id: '5', time: "11:45 PM", type: "2D", price: 200, availableSeats: 150 }
    ]
  },
  {
    id: '2',
    name: "INOX Megaplex",
    location: "Andheri West, Mumbai",
    distance: "5.1 km",
    amenities: ["4DX", "Premium Seats", "Café", "VIP Lounge"],
    showtimes: [
      { id: '6', time: "11:00 AM", type: "2D", price: 280, availableSeats: 110 },
      { id: '7', time: "2:15 PM", type: "4DX", price: 600, availableSeats: 30 },
      { id: '8', time: "5:45 PM", type: "2D", price: 320, availableSeats: 75 },
      { id: '9', time: "9:15 PM", type: "4DX", price: 650, availableSeats: 25 }
    ]
  },
  {
    id: '3',
    name: "Cinepolis Fun Republic",
    location: "Bandra West, Mumbai",
    distance: "7.8 km",
    amenities: ["Premium Cinema", "Gourmet Food", "Valet Parking", "Lounge"],
    showtimes: [
      { id: '10', time: "12:30 PM", type: "2D", price: 350, availableSeats: 90 },
      { id: '11', time: "3:45 PM", type: "Premium", price: 550, availableSeats: 60 },
      { id: '12', time: "7:00 PM", type: "Premium", price: 600, availableSeats: 40 },
      { id: '13', time: "10:30 PM", type: "2D", price: 300, availableSeats: 100 }
    ]
  }
];

export const generateSeats = (totalSeats: number = 150): Seat[] => {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = Math.ceil(totalSeats / rows.length);
  
  rows.forEach((row, rowIndex) => {
    for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
      let seatType: 'regular' | 'premium' | 'vip' = 'regular';
      let price = 250;
      
      // VIP seats (first 2 rows)
      if (rowIndex < 2) {
        seatType = 'vip';
        price = 500;
      }
      // Premium seats (middle rows)
      else if (rowIndex < 6) {
        seatType = 'premium';
        price = 350;
      }
      
      seats.push({
        id: `${row}${seatNum}`,
        row,
        number: seatNum,
        type: seatType,
        price,
        isBooked: Math.random() < 0.3, // 30% chance of being booked
        isSelected: false
      });
    }
  });
  
  return seats.slice(0, totalSeats);
};