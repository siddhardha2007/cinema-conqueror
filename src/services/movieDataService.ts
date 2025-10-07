// Real-time Movie Data Service with MovieGlu API Integration
import { movies } from '@/data/mockData';
import { supabase } from "@/integrations/supabase/client";

export interface MovieDetails {
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
  backdrop?: string;
  poster?: string;
  budget?: number;
  revenue?: number;
  popularity?: number;
  voteCount?: number;
  status?: string;
  originalLanguage?: string;
  certification?: string;
}

export interface MovieResponse {
  results: MovieDetails[];
  totalPages: number;
  totalResults: number;
}

export class MovieDataService {
  private readonly TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
  private readonly TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

  async getCurrentMovies(latitude?: number, longitude?: number, page: number = 1): Promise<MovieResponse> {
    try {
      console.log('🎬 Fetching real movies from MovieGlu...');
      
      // Default to a location if not provided
      const lat = latitude || 28.6139; // Delhi
      const lng = longitude || 77.2090;

      const { data, error } = await supabase.functions.invoke('get-movies', {
        body: { 
          latitude: lat,
          longitude: lng,
          date: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ Error fetching movies from MovieGlu:', error);
        return this.getEnhancedRealMovieData(page);
      }

      if (!data || !data.films || data.films.length === 0) {
        console.log('📍 No MovieGlu data, using enhanced data');
        return this.getEnhancedRealMovieData(page);
      }

      console.log(`✅ Got ${data.films.length} real movies from MovieGlu`);
      const processedMovies = this.processMovieGluData(data.films);
      
      return {
        results: processedMovies,
        totalPages: 1,
        totalResults: processedMovies.length
      };
      
    } catch (error) {
      console.error('❌ Error fetching movies:', error);
      return this.getEnhancedRealMovieData(page);
    }
  }

  private getRegionFromLocation(lat?: number, lng?: number): string {
    // Simple region detection based on coordinates
    if (!lat || !lng) return 'IN'; // Default to India
    
    // India roughly: lat 8-37, lng 68-97
    if (lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97) return 'IN';
    
    // US roughly: lat 25-49, lng -125 to -66
    if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) return 'US';
    
    // UK roughly: lat 49-61, lng -8 to 2
    if (lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2) return 'GB';
    
    return 'IN'; // Default
  }

  private processMovieGluData(movies: any[]): MovieDetails[] {
    return movies.slice(0, 12).map((movie: any) => ({
      id: movie.film_id.toString(),
      title: movie.film_name,
      rating: movie.age_rating?.[0]?.rating || '12A',
      duration: `${movie.duration_mins}min`,
      genre: movie.genres?.map((g: any) => g.genre_name).join(', ') || 'Drama',
      language: 'English',
      image: movie.images?.poster?.['1']?.medium?.film_image || '/placeholder-movie.jpg',
      releaseDate: this.formatReleaseDate(movie.release_dates?.[0]?.release_date),
      description: movie.synopsis_long || 'An exciting cinematic experience awaits.',
      cast: movie.cast?.map((c: any) => c.cast_name) || [],
      director: movie.directors?.[0]?.director_name || 'Unknown Director',
      trailer: movie.trailers?.high?.[0]?.film_trailer || '',
      backdrop: movie.images?.still?.['1']?.medium?.film_image,
      poster: movie.images?.poster?.['1']?.medium?.film_image
    }));
  }

  async getMovieDetails(movieId: string): Promise<MovieDetails | null> {
    try {
      // First check if it's in our enhanced data
      const enhancedMovie = this.getEnhancedMovieDetails(movieId);
      if (enhancedMovie) return enhancedMovie;

      // Otherwise return null
      return null;
      
    } catch (error) {
      console.error('❌ Error fetching movie details:', error);
      return this.getEnhancedMovieDetails(movieId);
    }
  }

  async searchMovies(query: string, page: number = 1): Promise<MovieResponse> {
    try {
      return this.searchEnhancedMovies(query, page);
      
    } catch (error) {
      console.error('❌ Error searching movies:', error);
      return this.searchEnhancedMovies(query, page);
    }
  }

  private getGenreNames(genreIds: number[]): string {
    const genreMap: { [key: number]: string } = {
      28: 'Action', 35: 'Comedy', 18: 'Drama', 27: 'Horror',
      878: 'Sci-Fi', 53: 'Thriller', 10749: 'Romance', 16: 'Animation',
      99: 'Documentary', 14: 'Fantasy', 36: 'History', 10402: 'Music',
      9648: 'Mystery', 10751: 'Family', 10752: 'War', 37: 'Western',
      80: 'Crime', 12: 'Adventure'
    };
    
    const genres = genreIds.slice(0, 2).map(id => genreMap[id] || 'Drama');
    return genres.join(', ') || 'Drama';
  }

  private formatLanguage(langCode: string): string {
    const languages: { [key: string]: string } = {
      'en': 'English', 'hi': 'Hindi', 'te': 'Telugu', 'ta': 'Tamil',
      'ml': 'Malayalam', 'kn': 'Kannada', 'bn': 'Bengali', 'mr': 'Marathi'
    };
    return languages[langCode] || 'English';
  }

  private formatReleaseDate(date: string): string {
    if (!date) return 'Coming Soon';
    const releaseDate = new Date(date);
    return releaseDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  // Enhanced fallback data
  private getEnhancedRealMovieData(page: number): MovieResponse {
    const startIndex = (page - 1) * 6;
    const endIndex = startIndex + 6;
    
    return {
      results: movies.slice(startIndex, endIndex),
      totalPages: Math.ceil(movies.length / 6),
      totalResults: movies.length
    };
  }

  private getEnhancedMovieDetails(movieId: string): MovieDetails | null {
    return movies.find((movie: any) => movie.id === movieId) || null;
  }

  private searchEnhancedMovies(query: string, page: number): MovieResponse {
    const filtered = movies.filter((movie: any) => 
      movie.title.toLowerCase().includes(query.toLowerCase()) ||
      movie.genre.toLowerCase().includes(query.toLowerCase()) ||
      movie.description.toLowerCase().includes(query.toLowerCase())
    );
    
    const startIndex = (page - 1) * 6;
    const endIndex = startIndex + 6;
    
    return {
      results: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / 6),
      totalResults: filtered.length
    };
  }
}

export const movieDataService = new MovieDataService();
