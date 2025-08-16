// Theater discovery service with multiple API integrations

export interface TheaterLocation {
  lat: number;
  lng: number;
}

export interface Theater {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: number;
  amenities: string[];
  showtimes: Array<{
    id: string;
    time: string;
    type: string;
    price: number;
    availableSeats: number;
  }>;
  coordinates?: TheaterLocation;
  phone?: string;
  website?: string;
}

export class TheaterDiscoveryService {
  private readonly FOURSQUARE_API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY;
  private readonly GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  private readonly TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  async findNearbyTheaters(lat: number, lng: number): Promise<Theater[]> {
    // Try multiple APIs in order of preference
    try {
      // Method 1: Foursquare Places API (most reliable for venues)
      const foursquareTheaters = await this.searchFoursquare(lat, lng);
      if (foursquareTheaters.length > 0) {
        console.log('Found theaters using Foursquare API');
        return foursquareTheaters;
      }

      // Method 2: Use Google Places with proxy
      const googleTheaters = await this.searchGooglePlaces(lat, lng);
      if (googleTheaters.length > 0) {
        console.log('Found theaters using Google Places API');
        return googleTheaters;
      }

      // Method 3: Generate location-aware mock data
      console.log('Using location-aware mock data');
      return this.generateLocationBasedTheaters(lat, lng);
      
    } catch (error) {
      console.error('Error in theater discovery:', error);
      return this.generateLocationBasedTheaters(lat, lng);
    }
  }

  private async searchFoursquare(lat: number, lng: number): Promise<Theater[]> {
    if (!this.FOURSQUARE_API_KEY) return [];
    
    try {
      const response = await fetch(
        `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=10000&categories=10032&limit=20`,
        {
          headers: {
            'Authorization': this.FOURSQUARE_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.results?.map((place: any) => this.mapFoursquareToTheater(place, lat, lng)) || [];
    } catch {
      return [];
    }
  }

  private async searchGooglePlaces(lat: number, lng: number): Promise<Theater[]> {
    if (!this.GOOGLE_PLACES_API_KEY) return [];
    
    try {
      // Using a CORS proxy for Google Places API
      const response = await fetch(
        `https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=movie_theater&key=${this.GOOGLE_PLACES_API_KEY}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.results?.slice(0, 10).map((place: any) => this.mapGoogleToTheater(place, lat, lng)) || [];
    } catch {
      return [];
    }
  }

  private mapFoursquareToTheater(place: any, userLat: number, userLng: number): Theater {
    return {
      id: place.fsq_id,
      name: place.name,
      location: place.location?.formatted_address || place.location?.address || 'Address not available',
      distance: this.calculateDistance(userLat, userLng, place.geocodes?.main?.latitude, place.geocodes?.main?.longitude),
      rating: place.rating ? place.rating / 2 : 4.0, // Foursquare uses 10-point scale
      amenities: this.generateAmenities(),
      showtimes: this.generateShowtimes(),
      coordinates: {
        lat: place.geocodes?.main?.latitude,
        lng: place.geocodes?.main?.longitude
      },
      phone: place.tel,
      website: place.website
    };
  }

  private mapGoogleToTheater(place: any, userLat: number, userLng: number): Theater {
    return {
      id: place.place_id,
      name: place.name,
      location: place.vicinity,
      distance: this.calculateDistance(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng),
      rating: place.rating || 4.0,
      amenities: this.generateAmenities(),
      showtimes: this.generateShowtimes(),
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      }
    };
  }

  private generateLocationBasedTheaters(lat: number, lng: number): Theater[] {
    const theaterChains = [
      { name: "PVR Cinemas", locations: ["Phoenix Mall", "Forum Mall", "Central Mall"] },
      { name: "INOX Multiplex", locations: ["Metropolitan", "City Center", "Marina Mall"] },
      { name: "Cinepolis", locations: ["Cross Roads", "Downtown", "Riverside"] },
      { name: "Miraj Cinemas", locations: ["Grand Plaza", "Elite Mall", "Junction"] },
      { name: "Carnival Cinemas", locations: ["Celebration Mall", "Star Plaza", "Golden Gate"] }
    ];

    const theaters: Theater[] = [];
    
    theaterChains.forEach((chain, chainIndex) => {
      chain.locations.forEach((location, locIndex) => {
        // Generate coordinates around user location (within 15km radius)
        const offsetLat = (Math.random() - 0.5) * 0.15;
        const offsetLng = (Math.random() - 0.5) * 0.15;
        const theaterLat = lat + offsetLat;
        const theaterLng = lng + offsetLng;

        theaters.push({
          id: `${chainIndex}-${locIndex}`,
          name: `${chain.name} ${location}`,
          location: `${location}, ${this.getNearbyArea(lat, lng)}`,
          distance: this.calculateDistance(lat, lng, theaterLat, theaterLng),
          rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
          amenities: this.generateAmenities(),
          showtimes: this.generateShowtimes(),
          coordinates: { lat: theaterLat, lng: theaterLng }
        });
      });
    });

    return theaters.slice(0, 12);
  }

  private getNearbyArea(lat: number, lng: number): string {
    // Simple area name generation based on coordinates
    const areas = ["Central District", "Downtown", "Mall Road", "Park Street", "Main Street", "City Center"];
    const index = Math.floor((lat + lng) * 1000) % areas.length;
    return areas[index];
  }

  private generateAmenities(): string[] {
    const allAmenities = [
      "Parking", "Food Court", "AC", "Online Booking", "Dolby Atmos", 
      "IMAX", "4DX", "Recliner Seats", "Wheelchair Accessible", "Café"
    ];
    
    const count = 4 + Math.floor(Math.random() * 4);
    const shuffled = allAmenities.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private generateShowtimes() {
    const times = ["09:30", "12:45", "16:00", "19:15", "22:30"];
    const types = ["2D", "3D", "IMAX", "4DX"];
    const basePrices = [150, 200, 350, 450];
    
    return times.map((time, index) => ({
      id: `show-${index}`,
      time,
      type: types[index % types.length],
      price: basePrices[index % basePrices.length] + Math.floor(Math.random() * 50),
      availableSeats: Math.floor(Math.random() * 80) + 20
    }));
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return `${distance.toFixed(1)} km`;
  }
}

export const theaterService = new TheaterDiscoveryService();