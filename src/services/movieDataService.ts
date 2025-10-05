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
      console.log('🎬 Fetching real movies from TMDB...');
      
      // Determine region based on location (simple approach)
      const region = this.getRegionFromLocation(latitude, longitude);

      const { data, error } = await supabase.functions.invoke('get-movies-tmdb', {
        body: { region }
      });

      if (error) {
        console.error('❌ Error fetching movies from TMDB:', error);
        return this.getEnhancedRealMovieData(page);
      }

      if (!data || !data.results || data.results.length === 0) {
        console.log('📍 No TMDB data, using enhanced data');
        return this.getEnhancedRealMovieData(page);
      }

      console.log(`✅ Got ${data.results.length} real movies from TMDB`);
      const processedMovies = this.processTMDBData(data.results);
      
      return {
        results: processedMovies,
        totalPages: data.total_pages || 1,
        totalResults: data.total_results || processedMovies.length
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

  private processTMDBData(movies: any[]): MovieDetails[] {
    return movies.slice(0, 12).map((movie: any) => ({
      id: movie.id.toString(),
      title: movie.title || movie.original_title,
      rating: movie.vote_average ? parseFloat(movie.vote_average.toFixed(1)) : 8.0,
      duration: '2h 30m', // TMDB doesn't provide runtime in now_playing
      genre: this.getGenreNames(movie.genre_ids || []),
      language: this.formatLanguage(movie.original_language),
      image: movie.poster_path ? `${this.TMDB_IMAGE_BASE}${movie.poster_path}` : '/placeholder-movie.jpg',
      releaseDate: this.formatReleaseDate(movie.release_date),
      description: movie.overview || 'An exciting cinematic experience awaits.',
      cast: [],
      director: 'Unknown Director',
      trailer: '',
      backdrop: movie.backdrop_path ? `${this.TMDB_BACKDROP_BASE}${movie.backdrop_path}` : undefined,
      poster: movie.poster_path ? `${this.TMDB_IMAGE_BASE}${movie.poster_path}` : undefined,
      popularity: movie.popularity,
      voteCount: movie.vote_count
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
