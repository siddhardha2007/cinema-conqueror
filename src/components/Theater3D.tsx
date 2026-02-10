import React, { useState, useMemo, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  RoundedBox, 
  Html, 
  useVideoTexture 
} from '@react-three/drei';
import * as THREE from 'three';
import { 
  RotateCcw, Film, Clock, Volume2, VolumeX, 
  Ticket, CreditCard, X, Check, Menu, Play
} from 'lucide-react';

// --- DATA & UTILS ---
const movies = [
  {
    id: '1',
    title: "The Dark Knight",
    image: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=800&q=80",
    video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", // YouTube
    duration: "2h 32m",
    rating: "PG-13",
    genre: "Action"
  },
  {
    id: '2',
    title: "Big Buck Bunny",
    image: "https://images.unsplash.com/photo-1518066000714-58c45f1a2c0a?auto=format&fit=crop&w=800&q=80",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // Direct MP4
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

// Helper to generate dummy seats
const generateSeats = () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const seats = [];
  rows.forEach((row, rowIndex) => {
    const seatsInRow = 10 + (rowIndex * 2); // Stadium seating, wider at back
    for (let i = 1; i <= seatsInRow; i++) {
      const type = rowIndex > 4 ? 'vip' : rowIndex > 2 ? 'premium' : 'standard';
      const price = type === 'vip' ? 25 : type === 'premium' ? 18 : 12;
      
      // Randomly book some seats
      const status = Math.random() < 0.2 ? 'booked' : 'available';

      seats.push({
        id: `${row}${i}`,
        row,
        number: i,
        type,
        price,
        status, // 'available', 'booked', 'selected'
      });
    }
  });
  return seats;
};

function getYouTubeId(url) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- UI COMPONENTS ---
const Button = ({ children, onClick, className = "", variant = 'default', size = 'default', disabled }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95",
    outline: "border border-white/20 bg-black/50 text-white hover:bg-white/10 active:scale-95",
    ghost: "hover:bg-white/10 text-white active:scale-95",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm active:scale-95"
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
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- 3D COMPONENTS ---

function Seat3D({ seat, position, onClick, onHover }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  const isBooked = seat.status === 'booked';
  const isSelected = seat.status === 'selected';

  const getSeatColor = () => {
    if (isBooked) return '#334155'; // Dark Slate
    if (isSelected) return '#10b981'; // Emerald
    if (hovered) return '#f59e0b'; // Amber
    if (seat.type === 'vip') return '#a855f7'; // Purple
    if (seat.type === 'premium') return '#3b82f6'; // Blue
    return '#64748b'; // Slate
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isBooked) onClick(seat.id);
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
    <group position={position}>
      {/* Seat Base */}
      <RoundedBox
        args={[0.8, 0.15, 0.7]}
        radius={0.05}
        smoothness={4}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        position={[0, 0.1, 0]}
        scale={hovered && !isBooked ? 1.05 : 1}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>

      {/* Seat Back */}
      <RoundedBox
        args={[0.8, 0.8, 0.15]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.5, 0.3]}
        scale={hovered && !isBooked ? 1.05 : 1}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>

      {/* Armrests */}
      <mesh position={[-0.45, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.45, 0.3, 0]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Seat Number */}
      <Text
        position={[0, 0.95, 0.31]}
        fontSize={0.15}
        color={isBooked ? '#475569' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {seat.row}{seat.number}
      </Text>

      {isSelected && (
        <pointLight position={[0, 1, 0]} intensity={1} distance={2} color="#10b981" />
      )}
    </group>
  );
}

function SeatTooltip({ seat, position }) {
  if (!seat) return null;
  const isBooked = seat.status === 'booked';
  
  return (
    <Html position={[position[0], position[1] + 1.2, position[2]]} center zIndexRange={[100, 0]}>
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-xl border border-white/20 min-w-[140px] pointer-events-none transform transition-all select-none">
        <div className="font-bold text-sm border-b border-white/10 pb-1 mb-1">Row {seat.row} - {seat.number}</div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="capitalize">{seat.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price:</span>
            <span className="text-green-400 font-semibold">${seat.price}</span>
          </div>
          <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/10">
            <span className={isBooked ? 'text-red-400 font-bold' : 'text-blue-400'}>
              {isBooked ? 'Booked' : 'Available'}
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
}

function VideoMaterial({ url }) {
  const [play, setPlay] = useState(false);
  
  // Only try to load texture if we are playing
  const texture = useVideoTexture(url, {
    unsuspend: 'canplay',
    muted: false,
    loop: true,
    start: play,
  });

  return (
    <>
      <meshBasicMaterial map={texture} toneMapped={false} />
      {!play && (
        <Html center position={[0, 0, 0.1]}>
          <button 
            onClick={() => setPlay(true)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
          >
            <Play fill="white" className="w-8 h-8 ml-1" />
          </button>
        </Html>
      )}
    </>
  );
}

function Screen3D({ videoUrl, movieTitle }) {
  const youtubeId = getYouTubeId(videoUrl);

  return (
    <group position={[0, 7, -18]}>
      {/* Screen Frame */}
      <mesh position={[0, 0, -0.1]} receiveShadow>
        <boxGeometry args={[25, 12, 0.5]} />
        <meshStandardMaterial color="#020617" roughness={0.2} />
      </mesh>

      {youtubeId ? (
        <Html transform position={[0, 0, 0.1]} scale={0.018} occlude="blending">
          <div className="w-[1280px] h-[640px] bg-black rounded-lg overflow-hidden shadow-2xl">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}`}
              title="Movie"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              className="w-full h-full pointer-events-none" // Disable pointer events so OrbitControls works
            />
          </div>
        </Html>
      ) : (
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[23, 10]} />
          <Suspense fallback={<meshBasicMaterial color="#1e293b" />}>
            <VideoMaterial url={videoUrl} />
          </Suspense>
        </mesh>
      )}

      {/* Screen Glow */}
      <pointLight position={[0, 0, 5]} intensity={0.5} distance={30} color="#3b82f6" />

      <Text position={[0, -7, 0]} fontSize={0.8} color="#94a3b8" anchorX="center">
        {movieTitle.toUpperCase()}
      </Text>
    </group>
  );
}

function TheaterEnvironment() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -1, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      {/* Walls (Visual only) */}
      <mesh position={[-20, 10, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      <mesh position={[20, 10, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#020617" />
      </mesh>

      {/* Stadium Steps */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, i * 0.5, i * 2 + 2]} receiveShadow castShadow>
          <boxGeometry args={[35, 1, 2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// --- MAIN APPLICATION ---

export default function TheaterBooking() {
  const [seats, setSeats] = useState(generateSeats());
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[1]);
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const controlsRef = useRef();

  // Derived state
  const selectedSeats = useMemo(() => seats.filter(s => s.status === 'selected'), [seats]);
  const totalPrice = useMemo(() => selectedSeats.reduce((sum, seat) => sum + seat.price, 0), [selectedSeats]);

  // Calculate 3D positions for seats
  const seatPositions = useMemo(() => {
    return seats.map((seat) => {
      // Find row index based on char code (A=0, B=1...)
      const rowIndex = seat.row.charCodeAt(0) - 65;
      
      // Calculate Z (depth) and Y (height) based on row
      const rowZ = rowIndex * 2 + 2;
      const rowY = rowIndex * 0.5 + 1; // Sit on top of step
      
      // Calculate X (spread) - Center the row
      const seatsInThisRow = seats.filter(s => s.row === seat.row).length;
      const seatIndex = seat.number - 1;
      const middleIndex = (seatsInThisRow - 1) / 2;
      const aisleOffset = seatIndex >= middleIndex ? 0.8 : -0.8; // Simple aisle
      const seatX = (seatIndex - middleIndex) * 1.2; 

      return {
        ...seat,
        position: [seatX, rowY, rowZ]
      };
    });
  }, [seats]);

  const handleSeatClick = (seatId) => {
    setSeats(prev => prev.map(seat => {
      if (seat.id === seatId) {
        return {
          ...seat,
          status: seat.status === 'selected' ? 'available' : 'selected'
        };
      }
      return seat;
    }));
  };

  const handleSeatHover = (seat, position) => {
    if (seat && position) {
      setHoveredSeat({ seat, position });
    } else {
      setHoveredSeat(null);
    }
  };

  const handleConfirmBooking = () => {
    setSeats(prev => prev.map(seat => 
      seat.status === 'selected' ? { ...seat, status: 'booked' } : seat
    ));
    setShowBookingModal(false);
    alert(`Successfully booked ${selectedSeats.length} tickets for $${totalPrice}!`);
  };

  const resetView = () => {
    controlsRef.current?.reset();
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans">
      
      {/* --- HUD / OVERLAYS --- */}
      
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden absolute top-4 left-4 z-40 bg-black/60 backdrop-blur text-white p-2 rounded-lg border border-white/10"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Desktop Controls */}
      <div className="hidden md:flex absolute top-4 left-4 z-40 flex-col gap-4 max-w-[300px]">
        {/* Movie Selector */}
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-2xl">
          <h3 className="text-white text-xs font-bold uppercase mb-3 flex items-center gap-2 text-blue-400">
            <Film className="w-3 h-3" /> Now Showing
          </h3>
          <div className="space-y-2">
            {movies.map(movie => (
              <button
                key={movie.id}
                onClick={() => setSelectedMovie(movie)}
                className={`w-full text-left p-2 rounded-lg text-sm transition-all flex items-center gap-3 border ${
                  selectedMovie.id === movie.id 
                  ? 'bg-blue-600/20 border-blue-500/50 text-white' 
                  : 'border-transparent hover:bg-white/5 text-gray-400'
                }`}
              >
                <img src={movie.image} alt={movie.title} className="w-8 h-8 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{movie.title}</div>
                  <div className="text-[10px] opacity-60">{movie.duration} • {movie.genre}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Selector */}
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-2xl">
          <h3 className="text-white text-xs font-bold uppercase mb-3 flex items-center gap-2 text-green-400">
            <Clock className="w-3 h-3" /> Showtimes
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {showtimes.map(time => (
              <button
                key={time.id}
                onClick={() => setSelectedShowtime(time)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  selectedShowtime.id === time.id
                  ? 'bg-green-600/20 border-green-500/50 text-green-400'
                  : 'border-transparent bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {time.time}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Camera Controls */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
        <Button variant="outline" size="icon" onClick={resetView} title="Reset Camera">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Bottom Bar (Summary & Checkout) */}
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/90 to-transparent pt-12 pb-6 px-4">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
          <div className="flex-1">
             {selectedSeats.length > 0 ? (
               <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                 <div className="text-gray-400 text-sm mb-1">Total ({selectedSeats.length} seats)</div>
                 <div className="text-3xl font-bold text-white">${totalPrice}</div>
                 <div className="flex gap-1 mt-2 overflow-x-auto pb-2 scrollbar-hide">
                   {selectedSeats.map(s => (
                     <span key={s.id} className="text-xs bg-white/10 border border-white/10 text-white px-2 py-1 rounded whitespace-nowrap">
                       {s.row}{s.number}
                     </span>
                   ))}
                 </div>
               </div>
             ) : (
               <div className="text-gray-500 text-sm italic">
                 Select seats on the screen to proceed...
               </div>
             )}
          </div>
          
          <Button 
            onClick={() => setShowBookingModal(true)} 
            disabled={selectedSeats.length === 0}
            className="h-12 px-8 text-base bg-blue-600 hover:bg-blue-500"
          >
            Checkout <Ticket className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* --- 3D CANVAS --- */}
      
      <Canvas
        shadows
        camera={{ position: [0, 8, 25], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 50]} />
        
        <ambientLight intensity={0.2} />
        <spotLight 
          position={[10, 20, 10]} 
          angle={0.3} 
          penumbra={1} 
          intensity={1} 
          castShadow 
          shadow-mapSize={2048}
        />
        {/* Screen Glow Light */}
        <pointLight position={[0, 5, -10]} intensity={2} color="#60a5fa" distance={20} />

        <Screen3D videoUrl={selectedMovie.video} movieTitle={selectedMovie.title} />
        <TheaterEnvironment />

        {seatPositions.map((seatData) => (
          <Seat3D
            key={seatData.id}
            seat={seatData}
            position={seatData.position}
            onClick={handleSeatClick}
            onHover={handleSeatHover}
          />
        ))}

        {hoveredSeat && (
          <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />
        )}

        <OrbitControls
          ref={controlsRef}
          target={[0, 4, 0]}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={10}
          maxDistance={35}
          enablePan={false}
        />
      </Canvas>

      {/* --- MODALS --- */}

      {/* Booking Confirmation Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowBookingModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-500" /> Confirm Booking
            </h2>

            <div className="space-y-4">
              <div className="flex gap-4 bg-black/40 p-3 rounded-lg border border-white/5">
                <img src={selectedMovie.image} className="w-16 h-24 object-cover rounded-md" alt="" />
                <div>
                  <h3 className="text-white font-medium">{selectedMovie.title}</h3>
                  <div className="text-sm text-gray-400 mt-1">{selectedShowtime.time}</div>
                  <div className="text-sm text-gray-400">Hall 3 • {selectedMovie.rating}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Tickets ({selectedSeats.length})</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Service Fee</span>
                  <span>$2.50</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-lg font-bold text-white">
                  <span>Total</span>
                  <span className="text-blue-400">${(totalPrice + 2.50).toFixed(2)}</span>
                </div>
              </div>

              <Button onClick={handleConfirmBooking} className="w-full bg-green-600 hover:bg-green-700 mt-4">
                Pay Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 md:hidden p-4">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-white">Menu</h2>
             <button onClick={() => setMobileMenuOpen(false)}><X className="text-white" /></button>
           </div>
           {/* Re-render selectors for mobile here if needed */}
           <div className="text-gray-400 text-center mt-10">Select movies via the controls on desktop, or implement mobile list view here.</div>
        </div>
      )}

    </div>
  );
}
