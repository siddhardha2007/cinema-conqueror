// Real-time Movie Data Service with TMDB Integration
import { movies } from '@/data/mockData';

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
  private readonly TMDB_API_KEY = 'your_tmdb_api_key_here'; // Replace with real TMDB API key
  private readonly TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  private readonly TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
  private readonly TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

  async getCurrentMovies(page: number = 1): Promise<MovieResponse> {
    try {
      console.log('🎬 Fetching current movies from TMDB...');
      
      if (!this.TMDB_API_KEY || this.TMDB_API_KEY === 'your_tmdb_api_key_here') {
        console.log('📍 Using enhanced real movie data (mock)');
        return this.getEnhancedRealMovieData(page);
      }

      // Get currently playing movies
      const currentResponse = await this.fetchFromTMDB('/movie/now_playing', { page });
      
      // Get popular movies as backup
      const popularResponse = await this.fetchFromTMDB('/movie/popular', { page });
      
      // Combine and process results
      const allMovies = [...(currentResponse?.results || []), ...(popularResponse?.results || [])];
      const processedMovies = await this.processMovieList(allMovies.slice(0, 20));
      
      return {
        results: processedMovies,
        totalPages: Math.max(currentResponse?.total_pages || 1, popularResponse?.total_pages || 1),
        totalResults: Math.max(currentResponse?.total_results || 0, popularResponse?.total_results || 0)
      };
      
    } catch (error) {
      console.error('❌ Error fetching movies from TMDB:', error);
      return this.getEnhancedRealMovieData(page);
    }
  }

  async getMovieDetails(movieId: string): Promise<MovieDetails | null> {
    try {
      if (!this.TMDB_API_KEY || this.TMDB_API_KEY === 'your_tmdb_api_key_here') {
        return this.getEnhancedMovieDetails(movieId);
      }

      const [movieData, creditsData, videosData] = await Promise.all([
        this.fetchFromTMDB(`/movie/${movieId}`),
        this.fetchFromTMDB(`/movie/${movieId}/credits`),
        this.fetchFromTMDB(`/movie/${movieId}/videos`)
      ]);

      if (!movieData) return null;

      return this.processMovieData(movieData, creditsData, videosData);
      
    } catch (error) {
      console.error('❌ Error fetching movie details:', error);
      return this.getEnhancedMovieDetails(movieId);
    }
  }

  async searchMovies(query: string, page: number = 1): Promise<MovieResponse> {
    try {
      if (!this.TMDB_API_KEY || this.TMDB_API_KEY === 'your_tmdb_api_key_here') {
        return this.searchEnhancedMovies(query, page);
      }

      const response = await this.fetchFromTMDB('/search/movie', { query, page });
      const processedMovies = await this.processMovieList(response?.results || []);
      
      return {
        results: processedMovies,
        totalPages: response?.total_pages || 1,
        totalResults: response?.total_results || 0
      };
      
    } catch (error) {
      console.error('❌ Error searching movies:', error);
      return this.searchEnhancedMovies(query, page);
    }
  }

  private async fetchFromTMDB(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(`${this.TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', this.TMDB_API_KEY);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }
    
    return response.json();
  }

  private async processMovieList(movies: any[]): Promise<MovieDetails[]> {
    return Promise.all(movies.map(movie => this.processMovieData(movie)));
  }

  private async processMovieData(movieData: any, creditsData?: any, videosData?: any): Promise<MovieDetails> {
    // Get trailer URL
    const trailer = this.extractTrailerUrl(videosData?.results || []);
    
    // Get cast and director
    const cast = this.extractCast(creditsData?.cast || []);
    const director = this.extractDirector(creditsData?.crew || []);
    
    // Process genres
    const genres = movieData.genres?.map((g: any) => g.name).join(', ') || 
                  movieData.genre_ids?.map((id: number) => this.getGenreName(id)).join(', ') || 
                  'Drama';

    return {
      id: movieData.id.toString(),
      title: movieData.title || movieData.original_title,
      rating: movieData.vote_average ? parseFloat((movieData.vote_average).toFixed(1)) : 8.0,
      duration: this.formatRuntime(movieData.runtime),
      genre: genres,
      language: this.formatLanguage(movieData.original_language),
      image: movieData.poster_path ? `${this.TMDB_IMAGE_BASE}${movieData.poster_path}` : '/placeholder-movie.jpg',
      releaseDate: this.formatReleaseDate(movieData.release_date),
      description: movieData.overview || 'An exciting cinematic experience awaits.',
      cast,
      director,
      trailer,
      backdrop: movieData.backdrop_path ? `${this.TMDB_BACKDROP_BASE}${movieData.backdrop_path}` : undefined,
      poster: movieData.poster_path ? `${this.TMDB_IMAGE_BASE}${movieData.poster_path}` : undefined,
      budget: movieData.budget,
      revenue: movieData.revenue,
      popularity: movieData.popularity,
      voteCount: movieData.vote_count,
      status: movieData.status,
      originalLanguage: movieData.original_language,
      certification: await this.getMovieCertification(movieData.id)
    };
  }

  private extractTrailerUrl(videos: any[]): string {
    const trailer = videos.find(video => 
      video.type === 'Trailer' && 
      video.site === 'YouTube' && 
      video.official
    ) || videos.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
  }

  private extractCast(cast: any[]): string[] {
    return cast.slice(0, 4).map(actor => actor.name);
  }

  private extractDirector(crew: any[]): string {
    const director = crew.find(person => person.job === 'Director');
    return director?.name || 'Unknown Director';
  }

  private formatRuntime(runtime: number): string {
    if (!runtime) return '2h 30m';
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    return `${hours}h ${minutes}m`;
  }

  private formatLanguage(langCode: string): string {
    const languages: { [key: string]: string } = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'ml': 'Malayalam',
      'kn': 'Kannada',
      'bn': 'Bengali',
      'mr': 'Marathi',
      'gu': 'Gujarati',
      'pa': 'Punjabi',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese'
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

  private getGenreName(genreId: number): string {
    const genres: { [key: number]: string } = {
      28: 'Action', 35: 'Comedy', 18: 'Drama', 27: 'Horror',
      878: 'Sci-Fi', 53: 'Thriller', 10749: 'Romance', 16: 'Animation',
      99: 'Documentary', 14: 'Fantasy', 36: 'History', 10402: 'Music',
      9648: 'Mystery', 10751: 'Family', 10752: 'War', 37: 'Western'
    };
    return genres[genreId] || 'Drama';
  }

  private async getMovieCertification(movieId: string): Promise<string> {
    try {
      const response = await this.fetchFromTMDB(`/movie/${movieId}/release_dates`);
      const usRelease = response?.results?.find((r: any) => r.iso_3166_1 === 'US');
      return usRelease?.release_dates?.[0]?.certification || 'PG-13';
    } catch {
      return 'PG-13';
    }
  }

  // Enhanced fallback data with Christopher Nolan classics
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