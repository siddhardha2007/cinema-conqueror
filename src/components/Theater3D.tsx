import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';
import { 
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, 
  Grid3X3, Ticket, CreditCard, X, Check, Menu
} from 'lucide-react';

// --- BUTTON COMPONENT ---
const Button = ({ children, onClick, className, variant = 'default', size = 'default', disabled }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95",
    outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-95",
    ghost: "hover:bg-accent hover:text-accent-foreground active:scale-95"
  };
  const sizes = {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 rounded-md px-3 text-xs",
    icon: "h-9 w-9"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className || ''}`}
    >
      {children}
    </button>
  );
};

// --- DATA ---
const movies = [
  {
    id: '1',
    title: "The Dark Knight",
    image: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=800&q=80",
    video: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
    duration: "2h 32m",
    rating: "PG-13",
    genre: "Action"
  },
  {
    id: '2',
    title: "Big Buck Bunny",
    image: "https://images.unsplash.com/photo-1518066000714-58c45f1a2c0a?auto=format&fit=crop&w=800&q=80",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: "9m 56s",
    rating: "PG",
    genre: "Animation"
  }
];

const showtimes = [
  { id: '1', time: '10:00 AM' },
  { id: '2', time: '1:30 PM' },
  { id: '3', time: '4:00 PM' },
  { id: '4', time: '7:00 PM' },
];

function getYouTubeId(url) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- SIMPLIFIED SEAT COMPONENT ---
function Seat3D({ seat, position, onClick, onHover, soundEnabled }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  const getSeatColor = () => {
    if (isBooked) return '#475569';
    if (isSelected) return '#10b981';
    if (hovered) return '#fbbf24';
    if (seat.type === 'vip') return '#a855f7';
    if (seat.type === 'premium') return '#3b82f6';
    return '#94a3b8';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isBooked) onClick(seat);
  };

  const handlePointerEnter = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    onHover(seat, position);
  };

  const handlePointerLeave = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  return (
    <group ref={meshRef} position={position}>
      {/* Seat Base */}
      <RoundedBox
        args={[0.9, 0.2, 0.8]}
        radius={0.08}
        smoothness={4}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        position={[0, 0.1, 0]}
        scale={hovered && !isBooked ? 1.08 : 1}
        castShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.4}
          metalness={0.2}
          emissive={getSeatColor()}
          emissiveIntensity={isSelected ? 0.4 : hovered ? 0.2 : 0.1}
        />
      </RoundedBox>

      {/* Seat Back */}
      <RoundedBox
        args={[0.9, 0.7, 0.15]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.45, 0.38]}
        scale={hovered && !isBooked ? 1.08 : 1}
        castShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.4}
          metalness={0.2}
          emissive={getSeatColor()}
          emissiveIntensity={isSelected ? 0.4 : hovered ? 0.2 : 0.1}
        />
      </RoundedBox>

      {/* Seat Number */}
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.15}
        color={isBooked ? '#64748b' : '#0f172a'}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {seat.number}
      </Text>

      {isSelected && (
        <pointLight position={[0, 0.6, 0]} intensity={0.8} distance={2} color="#10b981" />
      )}
    </group>
  );
}

// --- SIMPLIFIED TOOLTIP ---
function SeatTooltip({ seat, position }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  return (
    <Html position={[position[0], position[1] + 1.5, position[2]]} center>
      <div className="bg-slate-900/95 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-xl border border-white/20 min-w-[140px] pointer-events-none">
        <div className="font-bold text-sm mb-1">Row {seat.row} - {seat.number}</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-400">Price:</span>
            <span className="text-green-400 font-semibold">${seat.price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={isBooked ? 'text-red-400' : isSelected ? 'text-green-400' : 'text-blue-400'}>
              {isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
}

// --- VIDEO SCREEN ---
function MovieScreenMaterial({ videoUrl }) {
  const texture = useVideoTexture(videoUrl, {
    unsuspend: 'canplay',
    muted: false,
    loop: true,
    start: true,
  });
  
  return <meshBasicMaterial map={texture} toneMapped={false} />;
}

function Screen3D({ videoUrl, movieTitle }) {
  const youtubeId = getYouTubeId(videoUrl);

  return (
    <group position={[0, 8, -18]}>
      {youtubeId ? (
        <Html transform position={[0, 0, 0.2]} scale={0.01875}>
          <div style={{ width: '1280px', height: '533px', background: 'black' }}>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1`}
              title="Movie"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </Html>
      ) : (
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[24, 10]} />
          <Suspense fallback={<meshBasicMaterial color="#1e293b" />}>
            <MovieScreenMaterial videoUrl={videoUrl} />
          </Suspense>
        </mesh>
      )}

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[25, 10.8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <pointLight position={[0, 0, 3]} intensity={2} distance={25} color="#60a5fa" />

      <Text position={[0, -6.5, 0.2]} fontSize={0.8} color="#cbd5e1" anchorX="center">
        {movieTitle.toUpperCase()}
      </Text>
    </group>
  );
}

// --- THEATER ENVIRONMENT ---
function TheaterEnvironment() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a0a1a" />
      </mesh>

      {/* Stadium Steps */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, i * 0.35, i * 1.5 + 3]} receiveShadow castShadow>
          <boxGeometry args={[30, 0.5, 1.5]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
    </group>
  );
}

// --- BOOKING MODAL ---
function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, totalPrice }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-400" />
            Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex gap-3">
              <img src={movie.image} alt={movie.title} className="w-12 sm:w-16 h-16 sm:h-24 object-cover rounded" />
              <div>
                <h4 className="text-white font-semibold text-sm sm:text-base">{movie.title}</h4>
                <p className="text-gray-400 text-xs sm:text-sm">{movie.genre}</p>
                <p className="text-gray-500 text-xs mt-1">{movie.duration} • {movie.rating}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>{showtime.time}</span>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <h5 className="text-xs sm:text-sm text-gray-400 mb-2">Selected Seats</h5>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(seat => (
                <span key={seat.id} className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {seat.row}{seat.number}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{selectedSeats.length} ticket(s)</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Booking Fee</span>
              <span>$2.50</span>
            </div>
            <div className="flex justify-between text-base sm:text-lg font-bold text-white pt-2 border-t border-white/10">
              <span>Total</span>
              <span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 text-sm">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700 text-sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MOBILE MENU ---
function MobileMenu({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 md:hidden">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-bold">Menu</h2>
          <button onClick={onClose} className="text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function Theater3D({ seats, onSeatClick }) {
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[3]);
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const controlsRef = useRef();

  const selectedSeats = useMemo(() => {
    return seats.filter(s => s.status === 'selected' || s.isSelected);
  }, [seats]);

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  }, [selectedSeats]);

  const seatPositions = useMemo(() => {
    const positions = [];
    const seatsByRow = seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {});

    const sortedRows = Object.keys(seatsByRow).sort();
    
    sortedRows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.5 + 3;
      const rowY = rowIndex * 0.35 + 0.3;
      
      rowSeats.forEach((seat, seatIndex) => {
        const middleIndex = Math.floor(rowSeats.length / 2);
        const aisleOffset = seatIndex >= middleIndex ? 0.6 : 0;
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.1 + aisleOffset;
        
        positions.push({ seat, position: [seatX, rowY, rowZ] });
      });
    });
    
    return positions;
  }, [seats]);

  const handleSeatClick = (seat) => {
    onSeatClick(seat);
  };

  const handleSeatHover = (seat, position) => {
    if (seat && position) {
      setHoveredSeat({ seat, position });
    } else {
      setHoveredSeat(null);
    }
  };

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleConfirmBooking = () => {
    setShowBookingModal(false);
    alert('Booking confirmed! Check your email for tickets.');
  };

  return (
    <div className="relative w-full h-screen md:h-[800px] bg-slate-950 overflow-hidden">
      
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-md text-white p-2 rounded-lg border border-white/10"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Desktop Controls - Top Left */}
      <div className="hidden md:flex absolute top-4 left-4 z-20 flex-col gap-3 max-w-[400px]">
        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Film className="w-3 h-3 text-blue-400" />
            Select Movie
          </h3>
          <div className="flex flex-wrap gap-2">
            {movies.map((movie) => (
              <button
                key={movie.id}
                onClick={() => setSelectedMovie(movie)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedMovie.id === movie.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {movie.title}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3 text-green-400" />
            Select Time
          </h3>
          <div className="flex flex-wrap gap-2">
            {showtimes.map((showtime) => (
              <button
                key={showtime.id}
                onClick={() => setSelectedShowtime(showtime)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedShowtime.id === showtime.id
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {showtime.time}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <div className="space-y-4">
          <div>
            <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-400" />
              Select Movie
            </h3>
            <div className="space-y-2">
              {movies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => {
                    setSelectedMovie(movie);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    selectedMovie.id === movie.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-white/10 text-gray-300'
                  }`}
                >
                  <div className="font-medium">{movie.title}</div>
                  <div className="text-xs opacity-75">{movie.duration} • {movie.genre}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-400" />
              Select Time
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {showtimes.map((showtime) => (
                <button
                  key={showtime.id}
                  onClick={() => {
                    setSelectedShowtime(showtime);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-4 py-3 rounded-lg border transition-all ${
                    selectedShowtime.id === showtime.id
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-slate-800 border-white/10 text-gray-300'
                  }`}
                >
                  {showtime.time}
                </button>
              ))}
            </div>
          </div>
        </div>
      </MobileMenu>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSoundEnabled(!soundEnabled)} 
          className="bg-black/70 hover:bg-black/80 border-white/20 text-white"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResetView} 
          className="hidden md:flex bg-black/70 hover:bg-black/80 border-white/20 text-white"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Bottom Selection Summary - Mobile Optimized */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/90 backdrop-blur-md border-t border-white/10 p-3 md:p-4">
        {selectedSeats.length > 0 ? (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedSeats.slice(0, 4).map(seat => (
                    <span
                      key={seat.id}
                      className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30"
                    >
                      {seat.row}{seat.number}
                    </span>
                  ))}
                  {selectedSeats.length > 4 && (
                    <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300">
                      +{selectedSeats.length - 4} more
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-400 text-xs">{selectedSeats.length} seat(s)</span>
                  <span className="text-white font-bold text-lg">
                    ${(totalPrice + 2.5).toFixed(2)}
                  </span>
                </div>
              </div>
              <Button 
                onClick={() => setShowBookingModal(true)} 
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
              >
                <Check className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Book Now</span>
                <span className="sm:hidden">Book</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-gray-400 text-sm">Select seats to continue</p>
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-full bg-slate-950">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading Theater...</p>
          </div>
        </div>
      }>
        <Canvas
          shadows
          camera={{ position: [0, 10, 22], fov: 60 }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
          <pointLight position={[0, 10, 8]} intensity={0.5} />

          <Screen3D videoUrl={selectedMovie.video} movieTitle={selectedMovie.title} />
          <TheaterEnvironment />

          {seatPositions.map(({ seat, position }) => (
            <Seat3D
              key={seat.id}
              seat={seat}
              position={position}
              onClick={handleSeatClick}
              onHover={handleSeatHover}
              soundEnabled={soundEnabled}
            />
          ))}

          {hoveredSeat && (
            <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />
          )}

          <OrbitControls
            ref={controlsRef}
            minDistance={8}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.1}
            enableDamping
            dampingFactor={0.05}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          />
        </Canvas>
      </Suspense>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={handleConfirmBooking}
        selectedSeats={selectedSeats}
        movie={selectedMovie}
        showtime={selectedShowtime}
        totalPrice={totalPrice}
      />
    </div>
  );
}
