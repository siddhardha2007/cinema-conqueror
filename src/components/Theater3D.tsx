import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button'; 
import { RotateCcw, Eye, Film, Calendar } from 'lucide-react';

// --- 1. DATA SETUP (Replace this with your actual import) ---
// import { movies } from '@/contexts/BookingContext';

// For this code to work immediately in the chat, I am recreating your data structure here.
// You can delete this block and uncomment the import above in your real file!
const movies = [
  {
    id: '1',
    title: "The Dark Knight",
    image: "https://tinyurl.com/nexwnkxk", // Using web URL for demo, your local import works too!
    description: "Batman faces his greatest challenge yet."
  },
  {
    id: '2',
    title: "Inception",
    image: "https://tinyurl.com/4jcj4ea4",
    description: "A skilled thief enters people's dreams."
  },
  {
    id: '3',
    title: "Interstellar",
    image: "https://tinyurl.com/43jfzkm6",
    description: "A team of explorers travel through a wormhole."
  },
  {
    id: '4',
    title: "Oppenheimer",
    image: "https://tinyurl.com/5n733yjd",
    description: "The story of American scientist J. Robert Oppenheimer."
  }
];

// --- Types ---
export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium';
  price: number;
  isBooked?: boolean;
  isSelected?: boolean;
}

interface Theater3DProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
}

interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

// --- Constants ---
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 8, 18);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 1, -5);
const SCREEN_Z = -15; 
const SCREEN_Y = 6;   

// --- Helper Functions ---
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Components ---

// 1. Camera Controller
function CameraController({ 
  target, 
  isAnimating, 
  onAnimationComplete, 
  controlsRef 
}: { 
  target: CameraTarget; 
  isAnimating: boolean; 
  onAnimationComplete: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    
    progressRef.current = Math.min(progressRef.current + delta * 1.5, 1);
    const t = easeInOutCubic(progressRef.current);
    
    camera.position.lerp(target.position, t * 0.1);
    
    if (controlsRef.current) {
        const currentTarget = controlsRef.current.target;
        currentTarget.lerp(target.lookAt, t * 0.1);
        controlsRef.current.update();
    }

    if (progressRef.current >= 1) {
      progressRef.current = 0;
      onAnimationComplete();
    }
  });

  return null;
}

// 2. Seat Component
function Seat3D({ 
  seat, 
  position, 
  onClick 
}: { 
  seat: Seat; 
  position: [number, number, number]; 
  onClick: (seat: Seat) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  const getSeatColor = () => {
    if (isBooked) return '#94a3b8'; // Lighter slate
    if (isSelected) return '#ef4444'; // Red
    if (hovered) return '#fbbf24';    // Gold
    if (seat.type === 'premium') return '#60a5fa'; // Blue
    return '#d1d5db'; // Standard Grey
  };

  return (
    <group position={position}>
      {/* Cushion */}
      <RoundedBox
        args={[0.8, 0.15, 0.7]}
        radius={0.05}
        smoothness={4}
        onClick={(e) => {
            e.stopPropagation();
            if (!isBooked) onClick(seat);
        }}
        onPointerEnter={(e) => {
            e.stopPropagation();
            if (!isBooked) {
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }
        }}
        onPointerLeave={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
        }}
        position={[0, 0.05, 0]}
        scale={hovered && !isBooked ? 1.05 : 1}
        castShadow 
        receiveShadow
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.5}
          metalness={0.2}
          emissive={getSeatColor()}
          emissiveIntensity={0.1}
        />
      </RoundedBox>
      {/* Back */}
      <RoundedBox
        args={[0.8, 0.55, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.35, 0.32]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.5}
          metalness={0.2}
          emissive={getSeatColor()}
          emissiveIntensity={0.1}
        />
      </RoundedBox>
      {/* Armrests */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]} castShadow>
        <meshStandardMaterial color="#64748b" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]} castShadow>
        <meshStandardMaterial color="#64748b" roughness={0.6} />
      </RoundedBox>
      {/* Number */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.12}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]} 
      >
        {seat.number}
      </Text>
    </group>
  );
}

// 3. Screen Component (Dynamic & Safe)
function Screen3D({ posterUrl, movieTitle }: { posterUrl: string, movieTitle: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Safe Texture Loader - Won't crash your app if image fails
  useEffect(() => {
    setTexture(null); // Clear old poster immediately

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous"); // Important for web images
    
    // Convert local import (which might be an object in some bundlers) to string if needed
    const urlStr = typeof posterUrl === 'string' ? posterUrl : (posterUrl as any).src || posterUrl;

    loader.load(
      urlStr,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        setTexture(loadedTexture);
      },
      undefined,
      (err) => console.error("Poster load error:", err)
    );
  }, [posterUrl]);

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen Mesh */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[24, 10]} />
        {texture ? (
            <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
        )}
      </mesh>
      
      {/* Glow */}
      <pointLight position={[0, 0, 2]} intensity={2} distance={25} color="#bfdbfe" />

      {/* Curtains */}
      <group>
          <mesh position={[-13.5, 0, -0.5]} receiveShadow>
              <boxGeometry args={[3, 14, 1]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
          </mesh>
          <mesh position={[13.5, 0, -0.5]} receiveShadow>
              <boxGeometry args={[3, 14, 1]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
          </mesh>
           <mesh position={[0, 6, -0.5]} receiveShadow>
              <boxGeometry args={[30, 2, 1]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
          </mesh>
      </group>
      
      {/* Frame */}
      <mesh position={[0, 0, -0.6]}>
        <planeGeometry args={[32, 18]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>
      
      {/* Title Label */}
      <Text
        position={[0, -6.5, 0.1]}
        fontSize={0.8}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        NOW SHOWING: {movieTitle ? movieTitle.toUpperCase() : "SELECT A MOVIE"}
      </Text>
    </group>
  );
}

// 4. Stadium Steps
function StadiumSteps() {
  const steps = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      z: i * 1.2 + 2,
      y: i * 0.3
    }));
  }, []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[26, 0.4, 1.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[26, 0.02, 0.03]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 5. Environment
function TheaterEnvironment() {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog('#0f172a', 20, 60);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <group>
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      <StadiumSteps />
      
      <group position={[0, 8, 18]} rotation={[0.15, 0, 0]}>
         <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
            <cylinderGeometry args={[0.1, 4, 20, 32, 1, true]} />
            <meshBasicMaterial 
                color="#bae6fd" 
                opacity={0.08} 
                transparent={true} 
                side={THREE.DoubleSide} 
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
         </mesh>
      </group>
    </group>
  );
}

// --- Main Export ---
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ 
    position: DEFAULT_CAMERA_POS, 
    lookAt: DEFAULT_LOOK_AT 
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  
  // NEW: Store selected movie (Default to first one)
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  
  const controlsRef = useRef<any>(null);

  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const rows = Object.keys(seatsByRow).sort();
    
    rows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.2 + 2; 
      const rowY = (rowIndex * 0.3) + 0.3;
      
      rowSeats.forEach((seat, seatIndex) => {
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.0;
        positions.push({
          seat,
          position: [seatX, rowY, rowZ]
        });
      });
    });
    return positions;
  }, [seatsByRow]);

  const handleSeatClick = (seat: Seat) => {
    onSeatClick(seat);
    const seatData = seatPositions.find(s => s.seat.id === seat.id);
    if (seatData) {
      const [x, y, z] = seatData.position;
      setCameraTarget({
        position: new THREE.Vector3(x, y + 0.8, z),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  };

  const handleResetView = () => {
    setCameraTarget({
        position: DEFAULT_CAMERA_POS,
        lookAt: DEFAULT_LOOK_AT
    });
    setIsAnimating(true);
    setViewingSeatId(null);
  };

  return (
    <div className="relative w-full h-[700px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* --- MOVIE SELECTOR UI (Top Left) --- */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider bg-black/50 px-2 py-1 rounded backdrop-blur-sm">Now Playing</h3>
        <div className="flex flex-wrap gap-2 max-w-[400px]">
            {movies.map((movie) => (
                <button
                    key={movie.id}
                    onClick={() => setSelectedMovie(movie)}
                    className={`
                        px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        flex items-center gap-2 border
                        ${selectedMovie.id === movie.id 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                            : 'bg-black/60 border-white/10 text-gray-400 hover:text-white hover:bg-black/80'}
                    `}
                >
                    <Film className="w-3 h-3" />
                    {movie.title}
                </button>
            ))}
        </div>
        {/* Movie Info Box */}
        <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 mt-2 max-w-[300px]">
            <h4 className="text-blue-400 font-bold text-sm">{selectedMovie.title}</h4>
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{selectedMovie.description}</p>
        </div>
      </div>

      {/* View Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        {viewingSeatId && (
          <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg animate-in fade-in zoom-in">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Viewing from selected seat</span>
          </div>
        )}
        <div className="pointer-events-auto">
             <Button 
              onClick={handleResetView}
              variant="outline"
              size="sm"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset View
            </Button>
        </div>
      </div>
      
      {/* Color Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg pointer-events-none">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Seat Guide</h3>
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#d1d5db]"></div>
                <span className="text-gray-300 text-xs">Standard</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#60a5fa]"></div>
                <span className="text-gray-300 text-xs">Premium</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                <span className="text-gray-300 text-xs">Selected</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#94a3b8]"></div>
                <span className="text-gray-300 text-xs">Booked</span>
            </div>
        </div>
      </div>

      <Canvas
        shadows 
        camera={{ position: [0, 8, 18], fov: 50 }}
        gl={{ antialias: true }}
      >
        <CameraController 
          target={cameraTarget} 
          isAnimating={isAnimating}
          onAnimationComplete={() => setIsAnimating(false)}
          controlsRef={controlsRef}
        />

        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-10, 15, 10]} intensity={0.4} />
        <spotLight position={[0, 20, 5]} angle={0.5} penumbra={1} intensity={0.6} />

        {/* Pass Dynamic Movie Data to Screen */}
        <Screen3D 
          posterUrl={selectedMovie.image} 
          movieTitle={selectedMovie.title}
        />
        
        <TheaterEnvironment />
        
        {seatPositions.map(({ seat, position }) => (
          <Seat3D
            key={seat.id}
            seat={seat}
            position={position}
            onClick={handleSeatClick}
          />
        ))}

        <OrbitControls
          ref={controlsRef}
          minDistance={5}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2.1} 
          target={[0, 1, -5]}
          enableDamping={true}
        />
      </Canvas>
    </div>
  );
}
