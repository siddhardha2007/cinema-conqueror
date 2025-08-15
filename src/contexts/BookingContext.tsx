import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface Movie {
  id: string;
  title: string;
  rating: number;
  duration: string;
  genre: string;
  language: string;
  image: string;
  releaseDate: string;
  description: string;
  cast: string[];
  director: string;
  trailer: string;
}

export interface Theater {
  id: string;
  name: string;
  location: string;
  distance: string;
  amenities: string[];
  showtimes: Showtime[];
}

export interface Showtime {
  id: string;
  time: string;
  type: string;
  price: number;
  availableSeats: number;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  type: 'regular' | 'premium' | 'vip';
  price: number;
  isBooked: boolean;
  isSelected: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isLoggedIn: boolean;
}

export interface BookingState {
  user: User | null;
  selectedMovie: Movie | null;
  selectedTheater: Theater | null;
  selectedShowtime: Showtime | null;
  selectedSeats: Seat[];
  bookingStep: 'movie' | 'theater' | 'seats' | 'payment' | 'confirmation';
  bookings: Booking[];
}

export interface Booking {
  id: string;
  movieTitle: string;
  theaterName: string;
  showtime: string;
  seats: string[];
  totalAmount: number;
  bookingDate: string;
  status: 'confirmed' | 'cancelled';
}

type BookingAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SELECT_MOVIE'; payload: Movie }
  | { type: 'SELECT_THEATER'; payload: Theater }
  | { type: 'SELECT_SHOWTIME'; payload: Showtime }
  | { type: 'TOGGLE_SEAT'; payload: Seat }
  | { type: 'SET_BOOKING_STEP'; payload: BookingState['bookingStep'] }
  | { type: 'CONFIRM_BOOKING'; payload: Booking }
  | { type: 'CLEAR_BOOKING' };

const initialState: BookingState = {
  user: null,
  selectedMovie: null,
  selectedTheater: null,
  selectedShowtime: null,
  selectedSeats: [],
  bookingStep: 'movie',
  bookings: []
};

const bookingReducer = (state: BookingState, action: BookingAction): BookingState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'LOGOUT':
      return { ...state, user: null };
    case 'SELECT_MOVIE':
      return { ...state, selectedMovie: action.payload, bookingStep: 'theater' };
    case 'SELECT_THEATER':
      return { ...state, selectedTheater: action.payload };
    case 'SELECT_SHOWTIME':
      return { ...state, selectedShowtime: action.payload, bookingStep: 'seats' };
    case 'TOGGLE_SEAT':
      const seatExists = state.selectedSeats.find(s => s.id === action.payload.id);
      return {
        ...state,
        selectedSeats: seatExists
          ? state.selectedSeats.filter(s => s.id !== action.payload.id)
          : [...state.selectedSeats, action.payload]
      };
    case 'SET_BOOKING_STEP':
      return { ...state, bookingStep: action.payload };
    case 'CONFIRM_BOOKING':
      return {
        ...state,
        bookings: [...state.bookings, action.payload],
        bookingStep: 'confirmation'
      };
    case 'CLEAR_BOOKING':
      return {
        ...state,
        selectedMovie: null,
        selectedTheater: null,
        selectedShowtime: null,
        selectedSeats: [],
        bookingStep: 'movie'
      };
    default:
      return state;
  }
};

const BookingContext = createContext<{
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
} | null>(null);

export const BookingProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  
  return (
    <BookingContext.Provider value={{ state, dispatch }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};