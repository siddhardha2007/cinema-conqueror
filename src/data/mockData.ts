import { Movie, Theater, Seat } from '@/contexts/BookingContext';
import movie1 from "@/assets/movie1.jpg";
import movie2 from "@/assets/movie2.jpg";
import movie3 from "@/assets/movie3.jpg";
import movie4 from "@/assets/movie4.jpg";

export const movies: Movie[] = [
  {
    id: '1',
    title: "Mahavatar Narasimha",
    rating: 8.9,
    duration: "2h 55m",
    genre: "Action",
    language: "Telugu",
    image: movie1,
    releaseDate: "Dec 12, 2024",
    description: "A powerful devotional action drama featuring Lord Narasimha's divine intervention to protect his devotees from evil forces.",
    cast: ["Kalyan Ram", "Ashika Ranganath", "Vennela Kishore", "Brahmanandam"],
    director: "Mahesh Surapaneni",
    trailer: "https://example.com/trailer1"
  },
  {
    id: '2',
    title: "Coolie",
    rating: 8.7,
    duration: "2h 30m",
    genre: "Action",
    language: "Telugu",
    image: movie2,
    releaseDate: "Dec 20, 2024",
    description: "Rajinikanth returns in an action-packed thriller about a railway coolie who fights against corruption and injustice in the system.",
    cast: ["Rajinikanth", "Nagarjuna", "Upendra", "Shruti Haasan"],
    director: "Lokesh Kanagaraj",
    trailer: "https://example.com/trailer2"
  },
  {
    id: '3',
    title: "Game Changer",
    rating: 8.6,
    duration: "2h 45m",
    genre: "Political Thriller",
    language: "Telugu",
    image: movie3,
    releaseDate: "Dec 25, 2024",
    description: "Ram Charan plays an IAS officer who takes on the corrupt political system to bring about positive change in society.",
    cast: ["Ram Charan", "Kiara Advani", "SJ Suryah", "Anjali"],
    director: "S. Shankar",
    trailer: "https://example.com/trailer3"
  },
  {
    id: '4',
    title: "Pushpa 2: The Rule",
    rating: 9.1,
    duration: "3h 05m",
    genre: "Action Drama",
    language: "Telugu",
    image: movie4,
    releaseDate: "Dec 6, 2024",
    description: "Allu Arjun returns as Pushpa Raj in this highly anticipated sequel, expanding his red sandalwood smuggling empire while facing new challenges.",
    cast: ["Allu Arjun", "Rashmika Mandanna", "Fahadh Faasil", "Jagapathi Babu"],
    director: "Sukumar",
    trailer: "https://example.com/trailer4"
  }
];

export const theaters: Theater[] = [
  {
    id: '1',
    name: "Mohini Cinemas Dolby Atmos",
    location: "Gajuwaka, Vizag",
    distance: "2.1 km",
    amenities: ["Dolby Atmos", "Air Conditioning", "Online Booking", "Parking"],
    showtimes: [
      { id: '1', time: "06:20 PM", type: "2D", price: 150, availableSeats: 120 },
      { id: '2', time: "09:45 PM", type: "2D", price: 180, availableSeats: 95 },
      { id: '3', time: "10:30 AM", type: "2D", price: 120, availableSeats: 140 },
      { id: '4', time: "02:15 PM", type: "2D", price: 150, availableSeats: 85 }
    ]
  },
  {
    id: '2',
    name: "Sri Venkateswara Theatres Dolby 7.1 4K A/C",
    location: "Vizag",
    distance: "3.5 km",
    amenities: ["Dolby 7.1", "4K Projection", "Air Conditioning", "Digital Sound"],
    showtimes: [
      { id: '5', time: "06:30 PM", type: "2D", price: 160, availableSeats: 110 },
      { id: '6', time: "10:00 PM", type: "2D", price: 190, availableSeats: 75 },
      { id: '7', time: "11:00 AM", type: "2D", price: 130, availableSeats: 130 },
      { id: '8', time: "03:00 PM", type: "2D", price: 160, availableSeats: 90 }
    ]
  },
  {
    id: '3',
    name: "INOX Vizag Chitralaya Mall",
    location: "Chitralaya Mall, Vizag",
    distance: "4.2 km",
    amenities: ["Premium Seats", "Food Court", "Mall Shopping", "Valet Parking"],
    showtimes: [
      { id: '9', time: "10:40 PM", type: "2D", price: 250, availableSeats: 60 },
      { id: '10', time: "12:30 PM", type: "2D", price: 220, availableSeats: 80 },
      { id: '11', time: "04:15 PM", type: "Premium", price: 350, availableSeats: 45 },
      { id: '12', time: "07:45 PM", type: "Premium", price: 380, availableSeats: 30 }
    ]
  },
  {
    id: '4',
    name: "Urvasi Theater Dolby 2K A/C",
    location: "Vishakhapatnam",
    distance: "5.8 km",
    amenities: ["Dolby 2K", "Air Conditioning", "Digital Projection", "Comfortable Seating"],
    showtimes: [
      { id: '13', time: "06:00 PM", type: "2D", price: 140, availableSeats: 100 },
      { id: '14', time: "09:15 PM", type: "2D", price: 170, availableSeats: 85 },
      { id: '15', time: "01:00 PM", type: "2D", price: 140, availableSeats: 120 }
    ]
  },
  {
    id: '5',
    name: "Sangam Theatre 4K Dolby Atmos",
    location: "Vizag",
    distance: "3.9 km",
    amenities: ["4K Projection", "Dolby Atmos", "Recliner Seats", "Cafeteria"],
    showtimes: [
      { id: '16', time: "06:30 PM", type: "4K", price: 200, availableSeats: 70 },
      { id: '17', time: "10:00 PM", type: "4K", price: 230, availableSeats: 50 },
      { id: '18', time: "02:30 PM", type: "4K", price: 180, availableSeats: 90 }
    ]
  },
  {
    id: '6',
    name: "Natraj Theater",
    location: "MVP Colony, Vizag",
    distance: "2.8 km",
    amenities: ["Classic Cinema", "Air Conditioning", "Traditional Seating", "Snacks Counter"],
    showtimes: [
      { id: '19', time: "06:45 PM", type: "2D", price: 120, availableSeats: 150 },
      { id: '20', time: "09:30 PM", type: "2D", price: 140, availableSeats: 130 },
      { id: '21', time: "12:00 PM", type: "2D", price: 100, availableSeats: 180 },
      { id: '22', time: "03:15 PM", type: "2D", price: 120, availableSeats: 160 }
    ]
  },
  {
    id: '7',
    name: "STBL Cine World Madhurawada",
    location: "Madhurawada, Vizag",
    distance: "6.7 km",
    amenities: ["Digital Projection", "Surround Sound", "Online Booking", "Parking"],
    showtimes: [
      { id: '23', time: "09:15 PM", type: "2D", price: 160, availableSeats: 95 },
      { id: '24', time: "01:30 PM", type: "2D", price: 140, availableSeats: 110 },
      { id: '25', time: "05:45 PM", type: "2D", price: 160, availableSeats: 80 }
    ]
  },
  {
    id: '8',
    name: "Miraj Cinemas Bupathi Surya Central",
    location: "Dondaparthy, Vizag",
    distance: "8.1 km",
    amenities: ["Premium Experience", "Food Court", "Reserved Parking", "VIP Lounge"],
    showtimes: [
      { id: '26', time: "10:40 PM", type: "Premium", price: 280, availableSeats: 40 },
      { id: '27', time: "02:00 PM", type: "Premium", price: 250, availableSeats: 55 },
      { id: '28', time: "06:15 PM", type: "Premium", price: 280, availableSeats: 35 }
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