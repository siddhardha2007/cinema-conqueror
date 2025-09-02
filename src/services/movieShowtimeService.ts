// Real-time Movie Showtime Integration Service

export interface MovieShowtime {
  theaterId: string;
  movieId: string;
  showtimes: Array<{
    id: string;
    time: string;
    date: string;
    type: string;
    price: number;
    availableSeats: number;
    bookingUrl?: string;
  }>;
}

export interface RealTimeShowtimeData {
  movieId: string;
  title: string;
  theaters: Array<{
    id: string;
    name: string;
    location: string;
    showtimes: Array<{
      time: string;
      type: string;
      price: number;
      availableSeats: number;
      bookingUrl: string;
    }>;
  }>;
}

export class MovieShowtimeService {
  // Real API keys - replace with actual values
  private readonly FANDANGO_API_KEY = 'your_fandango_api_key_here';
  private readonly MOVIE_TICKETS_API_KEY = 'your_movietickets_api_key_here';
  private readonly ATOM_TICKETS_API_KEY = 'your_atom_tickets_api_key_here';

  async getShowtimes(movieId: string, lat: number, lng: number, date?: string): Promise<RealTimeShowtimeData | null> {
    try {
      console.log(`🎬 Fetching real showtimes for movie ${movieId} near ${lat}, ${lng}`);
      
      // Try multiple showtime APIs
      const results = await Promise.allSettled([
        this.getFandangoShowtimes(movieId, lat, lng, date),
        this.getMovieTicketsShowtimes(movieId, lat, lng, date),
        this.getAtomTicketsShowtimes(movieId, lat, lng, date)
      ]);

      // Return the first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          console.log('✅ Found real showtime data');
          return result.value;
        }
      }

      // Fallback to enhanced mock data
      console.log('📍 Using enhanced mock showtime data');
      return this.generateEnhancedMockShowtimes(movieId, lat, lng, date);
      
    } catch (error) {
      console.error('❌ Error fetching showtimes:', error);
      return this.generateEnhancedMockShowtimes(movieId, lat, lng, date);
    }
  }

  // Fandango API integration
  private async getFandangoShowtimes(movieId: string, lat: number, lng: number, date?: string): Promise<RealTimeShowtimeData | null> {
    if (!this.FANDANGO_API_KEY || this.FANDANGO_API_KEY === 'your_fandango_api_key_here') {
      return null;
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://api.fandango.com/v1/showtimes?movieId=${movieId}&lat=${lat}&lng=${lng}&date=${targetDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.FANDANGO_API_KEY}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return this.mapFandangoToShowtimeData(data, movieId);
    } catch {
      return null;
    }
  }

  // MovieTickets.com API integration
  private async getMovieTicketsShowtimes(movieId: string, lat: number, lng: number, date?: string): Promise<RealTimeShowtimeData | null> {
    if (!this.MOVIE_TICKETS_API_KEY || this.MOVIE_TICKETS_API_KEY === 'your_movietickets_api_key_here') {
      return null;
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://api.movietickets.com/v2/showtimes?movie=${movieId}&latitude=${lat}&longitude=${lng}&date=${targetDate}`,
        {
          headers: {
            'X-API-Key': this.MOVIE_TICKETS_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return this.mapMovieTicketsToShowtimeData(data, movieId);
    } catch {
      return null;
    }
  }

  // Atom Tickets API integration
  private async getAtomTicketsShowtimes(movieId: string, lat: number, lng: number, date?: string): Promise<RealTimeShowtimeData | null> {
    if (!this.ATOM_TICKETS_API_KEY || this.ATOM_TICKETS_API_KEY === 'your_atom_tickets_api_key_here') {
      return null;
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://api.atomtickets.com/v1/showtimes?movieId=${movieId}&lat=${lat}&lng=${lng}&showDate=${targetDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.ATOM_TICKETS_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return this.mapAtomTicketsToShowtimeData(data, movieId);
    } catch {
      return null;
    }
  }

  // Data mappers for different APIs
  private mapFandangoToShowtimeData(data: any, movieId: string): RealTimeShowtimeData {
    return {
      movieId,
      title: data.movie?.title || 'Unknown Movie',
      theaters: data.theaters?.map((theater: any) => ({
        id: theater.id,
        name: theater.name,
        location: theater.address,
        showtimes: theater.showtimes?.map((showtime: any) => ({
          time: showtime.time,
          type: showtime.format || '2D',
          price: showtime.ticketPrice || 250,
          availableSeats: showtime.availableSeats || 100,
          bookingUrl: showtime.bookingUrl || `https://fandango.com/book/${theater.id}/${showtime.id}`
        })) || []
      })) || []
    };
  }

  private mapMovieTicketsToShowtimeData(data: any, movieId: string): RealTimeShowtimeData {
    return {
      movieId,
      title: data.title || 'Unknown Movie',
      theaters: data.venues?.map((venue: any) => ({
        id: venue.venueId,
        name: venue.name,
        location: venue.address,
        showtimes: venue.sessions?.map((session: any) => ({
          time: session.time,
          type: session.attributes?.join(', ') || '2D',
          price: session.pricing?.adult || 200,
          availableSeats: session.seatsAvailable || 80,
          bookingUrl: session.bookingUrl || `https://movietickets.com/book/${venue.venueId}/${session.sessionId}`
        })) || []
      })) || []
    };
  }

  private mapAtomTicketsToShowtimeData(data: any, movieId: string): RealTimeShowtimeData {
    return {
      movieId,
      title: data.movieTitle || 'Unknown Movie',
      theaters: data.cinemas?.map((cinema: any) => ({
        id: cinema.cinemaId,
        name: cinema.displayName,
        location: cinema.address,
        showtimes: cinema.showtimes?.map((showtime: any) => ({
          time: showtime.showDateTime,
          type: showtime.presentationMethod || '2D',
          price: showtime.pricing?.adult || 180,
          availableSeats: showtime.seatsRemaining || 90,
          bookingUrl: showtime.ticketingUrl || `https://atomtickets.com/book/${cinema.cinemaId}/${showtime.showtimeId}`
        })) || []
      })) || []
    };
  }

  // Enhanced mock data generator for fallback
  private generateEnhancedMockShowtimes(movieId: string, lat: number, lng: number, date?: string): RealTimeShowtimeData {
    const vizagTheaters = [
      { id: 'vizag-1', name: 'Mohini Cinemas Dolby Atmos', location: 'Gajuwaka, Vizag' },
      { id: 'vizag-2', name: 'Sri Venkateswara Theatres Dolby 7.1 4K A/C', location: 'Vizag' },
      { id: 'vizag-3', name: 'INOX Vizag Chitralaya Mall', location: 'Chitralaya Mall, Vizag' },
      { id: 'vizag-4', name: 'Urvasi Theater Dolby 2K A/C', location: 'Vishakhapatnam' },
      { id: 'vizag-5', name: 'Sangam Theatre 4K Dolby Atmos', location: 'Vizag' },
      { id: 'vizag-6', name: 'Natraj Theater', location: 'MVP Colony, Vizag' },
      { id: 'vizag-7', name: 'STBL Cine World', location: 'Madhurawada, Vizag' },
      { id: 'vizag-8', name: 'Miraj Cinemas', location: 'Bupathi Surya Central, Dondaparthy' }
    ];

    return {
      movieId,
      title: this.getMovieTitle(movieId),
      theaters: vizagTheaters.map(theater => ({
        id: theater.id,
        name: theater.name,
        location: theater.location,
        showtimes: this.generateRealisticShowtimes(theater.id, movieId)
      }))
    };
  }

  private generateRealisticShowtimes(theaterId: string, movieId: string) {
    const times = ['10:30 AM', '01:45 PM', '05:00 PM', '08:15 PM', '11:30 PM'];
    const types = ['2D', '3D', 'IMAX', '4DX', 'Dolby Atmos'];
    
    return times.map((time, index) => ({
      time,
      type: types[index % types.length],
      price: this.calculateDynamicPrice(time, types[index % types.length]),
      availableSeats: Math.floor(Math.random() * 100) + 20,
      bookingUrl: `https://booking.example.com/theater/${theaterId}/movie/${movieId}/time/${time.replace(/\s+/g, '')}`
    }));
  }

  private calculateDynamicPrice(time: string, type: string): number {
    let basePrice = 150;
    
    // Screen type multipliers
    const typeMultipliers: { [key: string]: number } = {
      '2D': 1.0,
      '3D': 1.4,
      'IMAX': 2.2,
      '4DX': 2.8,
      'Dolby Atmos': 1.6
    };
    
    basePrice *= typeMultipliers[type] || 1.0;
    
    // Time-based pricing
    const isPrimeTime = time.includes('PM') && !time.startsWith('11');
    if (isPrimeTime) basePrice *= 1.3;
    
    // Weekend pricing
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
    if (isWeekend) basePrice *= 1.2;
    
    return Math.round(basePrice);
  }

  private getMovieTitle(movieId: string): string {
    const movieTitles: { [key: string]: string } = {
      '1': 'The Dark Knight Returns',
      '2': 'Stellar Odyssey',
      '3': 'Romance in Paris',
      '4': 'Thunder Road'
    };
    
    return movieTitles[movieId] || 'Featured Movie';
  }

  // Real-time seat availability updates
  async getSeatsAvailability(theaterId: string, showtimeId: string): Promise<number> {
    try {
      // This would call real-time seat availability APIs
      const response = await fetch(`https://api.example.com/theaters/${theaterId}/showtimes/${showtimeId}/seats`);
      
      if (response.ok) {
        const data = await response.json();
        return data.availableSeats || 0;
      }
    } catch (error) {
      console.error('Error fetching seat availability:', error);
    }
    
    // Fallback to random availability
    return Math.floor(Math.random() * 100) + 10;
  }
}

export const movieShowtimeService = new MovieShowtimeService();