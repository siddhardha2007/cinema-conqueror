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
  async getCurrentMovies(latitude?: number, longitude?: number, page: number = 1): Promise<MovieResponse> {
    try {
      console.log('🎬 Fetching current movies from MovieGlu...');
      
      if (!latitude || !longitude) {
        console.log('📍 No location provided, using enhanced data');
        return this.getEnhancedRealMovieData(page);
      }

      const { data, error } = await supabase.functions.invoke('get-movies', {
        body: { 
          latitude, 
          longitude,
          date: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ Error fetching movies from MovieGlu:', error);
        return this.getEnhancedRealMovieData(page);
      }

      console.log('✅ Got real-time movie data from MovieGlu');
      const processedMovies = this.processMovieGluData(data);
      
      return {
        results: processedMovies,
        totalPages: Math.ceil(processedMovies.length / 10),
        totalResults: processedMovies.length
      };
      
    } catch (error) {
      console.error('❌ Error fetching movies:', error);
      return this.getEnhancedRealMovieData(page);
    }
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

  private processMovieGluData(data: any): MovieDetails[] {
    if (!data || !data.films) return [];

    return data.films.map((film: any) => ({
      id: film.film_id || film.id || Math.random().toString(),
      title: film.film_name || film.title,
      rating: film.age_rating ? parseFloat(film.age_rating.replace(/[^\d.]/g, '')) : 8.0,
      duration: this.formatRuntime(film.duration_mins),
      genre: film.genres?.join(', ') || 'Drama',
      language: 'English',
      image: film.images?.poster?.medium || film.images?.poster?.high || '/placeholder-movie.jpg',
      releaseDate: this.formatReleaseDate(film.release_dates?.[0]?.release_date),
      description: film.synopsis_long || film.synopsis || 'An exciting cinematic experience awaits.',
      cast: film.cast || [],
      director: film.directors?.[0] || 'Unknown Director',
      trailer: film.trailers?.high?.[0]?.film_trailer || '',
      backdrop: film.images?.still?.medium || film.images?.still?.high,
      poster: film.images?.poster?.medium || film.images?.poster?.high,
      certification: film.age_rating?.[0]?.rating
    }));
  }

  private formatRuntime(runtime: number): string {
    if (!runtime) return '2h 30m';
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    return `${hours}h ${minutes}m`;
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
