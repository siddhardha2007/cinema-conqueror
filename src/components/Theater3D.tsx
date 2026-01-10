import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Stars, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera, 
  ArrowUp, ArrowDown, Maximize2, Grid3X3, Ticket, CreditCard,
  Star, Zap, Users, Info, AlertCircle, X, Check
} from 'lucide-react';

// --- DATA ---
const movies = [
  {
    id: '1',
    title: "The Dark Knight",
    image: "https://upload.wikimedia.org/wikipedia/en/8/8a/Dark_Knight.jpg",
    description: "Batman faces his greatest challenge yet as the Joker wreaks havoc on Gotham.",
    duration: "2h 32m",
    rating: "PG-13",
    genre: "Action, Crime, Drama"
  },
  {
    id: '2',
    title: "Inception",
    image: "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg",
    description: "A skilled thief enters people's dreams to steal their secrets.",
    duration: "2h 28m",
    rating: "PG-13",
    genre: "Sci-Fi, Action, Thriller"
  },
  {
    id: '3',
    title: "Interstellar",
    image: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg",
    description: "A team of explorers travel through a wormhole in space.",
    duration: "2h 49m",
    rating: "PG-13",
    genre: "Sci-Fi, Adventure, Drama"
  },
  {
    id: '4',
    title: "Oppenheimer",
    image: "https://upload.wikimedia.org/wikipedia/en/4/4a/Oppenheimer_%28film%29.jpg",
    description: "The story of American scientist J. Robert Oppenheimer.",
    duration: "3h 0m",
    rating: "R",
    genre: "Biography, Drama, History"
  }
];

const showtimes = [
  { id: '1', time: '10:00 AM', period: 'morning' },
  { id: '2', time: '1:30 PM', period: 'afternoon' },
  { id: '3', time: '4:00 PM', period: 'afternoon' },
  { id: '4', time: '7:00 PM', period: 'evening' },
  { id: '5', time: '9:30 PM', period: 'night' },
  { id: '6', time: '11:45 PM', period: 'night' },
];

// --- TYPES ---
export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium' | 'vip' | 'accessible';
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

type ViewMode = 'default' | 'topdown' | 'front' | 'side';

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 8, 18);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 1, -5);
const SCREEN_Z = -15;
const SCREEN_Y = 6;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- AUDIO HOOK ---
const useAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const frequencies: Record<string, number> = {
        click: 600,
        select: 800,
        hover: 400,
        success: 1000,
        error: 200
      };

      oscillator.frequency.value = frequencies[type];
      oscillator.type = type === 'error' ? 'sawtooth' : 'sine';
      gainNode.gain.value = 0.1;
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio context may not be available
    }
  }, []);

  return { playSound };
};

// --- CAMERA CONTROLLER ---
function CameraController({
  target,
  isAnimating,
  onAnimationComplete,
  controlsRef,
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

// --- SEAT 3D COMPONENT ---
function Seat3D({
  seat,
  position,
  onClick,
  onHover,
  isHighlighted,
  soundEnabled,
  playSound
}: {
  seat: Seat;
  position: [number, number, number];
  onClick: (seat: Seat) => void;
  onHover: (seat: Seat | null, position?: [number, number, number]) => void;
  isHighlighted: boolean;
  soundEnabled: boolean;
  playSound: (type: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Group>(null);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  const getSeatColor = () => {
    if (isBooked) return '#64748b';
    if (isSelected) return '#22c55e';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#fbbf24';
    if (seat.type === 'vip') return '#a855f7';
    if (seat.type === 'premium') return '#3b82f6';
    if (seat.type === 'accessible') return '#14b8a6';
    return '#e2e8f0';
  };

  const getEmissiveIntensity = () => {
    if (isSelected) return 0.3;
    if (isHighlighted) return 0.2;
    if (hovered) return 0.15;
    return 0.05;
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isBooked) {
      if (soundEnabled) playSound('select');
      onClick(seat);
    } else {
      if (soundEnabled) playSound('error');
    }
  };

  const handlePointerEnter = (e: any) => {
    e.stopPropagation();
    if (soundEnabled && !isBooked) playSound('hover');
    setHovered(true);
    document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    onHover(seat, position);
  };

  const handlePointerLeave = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  const seatColor = getSeatColor();

  return (
    <group ref={meshRef} position={position}>
      {/* Seat Cushion */}
      <RoundedBox
        args={[0.8, 0.15, 0.7]}
        radius={0.05}
        smoothness={4}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        position={[0, 0.05, 0]}
        scale={hovered && !isBooked ? 1.05 : 1}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={seatColor}
          roughness={0.4}
          metalness={0.1}
          emissive={seatColor}
          emissiveIntensity={getEmissiveIntensity()}
        />
      </RoundedBox>

      {/* Seat Back */}
      <RoundedBox
        args={[0.8, 0.55, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.35, 0.32]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={seatColor}
          roughness={0.4}
          metalness={0.1}
          emissive={seatColor}
          emissiveIntensity={getEmissiveIntensity()}
        />
      </RoundedBox>

      {/* Armrests */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]} castShadow>
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]} castShadow>
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.3} />
      </RoundedBox>

      {/* Seat Number */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.12}
        color={isBooked ? '#94a3b8' : '#1e293b'}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {seat.number}
      </Text>

      {/* VIP Crown Icon */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.7, 0.32]}>
          <coneGeometry args={[0.08, 0.15, 5]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Accessible Icon */}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.7, 0.32]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Selection/Highlight Glow */}
      {isSelected && (
        <pointLight position={[0, 0.5, 0]} intensity={0.5} distance={2} color="#22c55e" />
      )}
      {isHighlighted && !isSelected && (
        <pointLight position={[0, 0.5, 0]} intensity={0.3} distance={1.5} color="#f59e0b" />
      )}
    </group>
  );
}

// --- TOOLTIP COMPONENT ---
function SeatTooltip({
  seat,
  position
}: {
  seat: Seat;
  position: [number, number, number];
}) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  const typeLabels: Record<string, string> = {
    standard: 'Standard',
    premium: 'Premium',
    vip: 'VIP',
    accessible: 'Accessible'
  };

  const typeColors: Record<string, string> = {
    standard: 'bg-gray-500',
    premium: 'bg-blue-500',
    vip: 'bg-purple-500',
    accessible: 'bg-teal-500'
  };

  return (
    <Html position={[position[0], position[1] + 1.2, position[2]]} center>
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20 min-w-[180px] pointer-events-none">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg">Row {seat.row} - Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeColors[seat.type]}`}>
            {typeLabels[seat.type]}
          </span>
        </div>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Price:</span>
            <span className="font-semibold text-green-400">${seat.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={`font-medium ${isBooked ? 'text-red-400' : isSelected ? 'text-green-400' : 'text-blue-400'}`}>
              {isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}
            </span>
          </div>
        </div>

        {!isBooked && (
          <div className="mt-3 pt-2 border-t border-white/10 text-center text-xs text-gray-400">
            Click to {isSelected ? 'deselect' : 'select'}
          </div>
        )}
        
        {isBooked && (
          <div className="mt-3 pt-2 border-t border-white/10 text-center text-xs text-red-400 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            This seat is unavailable
          </div>
        )}
      </div>
    </Html>
  );
}

// --- SCREEN COMPONENT ---
function Screen3D({ posterUrl, movieTitle }: { posterUrl: string; movieTitle: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    loader.load(
      posterUrl,
      (loadedTexture) => {
        if (!isMounted) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        setTexture(loadedTexture);
      },
      undefined,
      (err) => console.error("Poster load error:", err)
    );

    return () => { isMounted = false; };
  }, [posterUrl]);

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[24, 10]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#1e293b" toneMapped={false} />
        )}
      </mesh>

      {/* Screen Frame */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[24.5, 10.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Screen Glow */}
      <pointLight position={[0, 0, 3]} intensity={3} distance={30} color="#60a5fa" />
      <pointLight position={[-8, 0, 2]} intensity={1.5} distance={15} color="#818cf8" />
      <pointLight position={[8, 0, 2]} intensity={1.5} distance={15} color="#818cf8" />

      {/* Curtains */}
      <mesh position={[-13.5, 0, -0.3]} receiveShadow>
        <boxGeometry args={[3, 14, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
      </mesh>
      <mesh position={[13.5, 0, -0.3]} receiveShadow>
        <boxGeometry args={[3, 14, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
      </mesh>
      <mesh position={[0, 6.5, -0.3]} receiveShadow>
        <boxGeometry args={[30, 3, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
      </mesh>

      {/* Background */}
      <mesh position={[0, 0, -0.6]}>
        <planeGeometry args={[35, 20]} />
        <meshStandardMaterial color="#020617" roughness={0.95} />
      </mesh>

      {/* Title */}
      <Text
        position={[0, -6.5, 0.1]}
        fontSize={0.8}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        NOW SHOWING: {movieTitle.toUpperCase()}
      </Text>
    </group>
  );
}

// --- ROW LABELS ---
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, index) => {
        const z = index * 1.2 + 2;
        const y = index * 0.3 + 0.5;
        return (
          <group key={row}>
            <Float speed={2} rotationIntensity={0.1} floatIntensity={0.1}>
              <Text
                position={[-14, y, z]}
                fontSize={0.5}
                color="#3b82f6"
                anchorX="center"
                anchorY="middle"
                rotation={[0, 0.3, 0]}
              >
                {row}
              </Text>
            </Float>
            <Float speed={2} rotationIntensity={0.1} floatIntensity={0.1}>
              <Text
                position={[14, y, z]}
                fontSize={0.5}
                color="#3b82f6"
                anchorX="center"
                anchorY="middle"
                rotation={[0, -0.3, 0]}
              >
                {row}
              </Text>
            </Float>
          </group>
        );
      })}
    </group>
  );
}

// --- EXIT SIGNS ---
function ExitSigns() {
  return (
    <group>
      <group position={[-14, 4, 8]}>
        <mesh>
          <boxGeometry args={[1.5, 0.5, 0.1]} />
          <meshBasicMaterial color="#22c55e" toneMapped={false} />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.25} color="#ffffff" anchorX="center">
          EXIT
        </Text>
        <pointLight position={[0, 0, 0.5]} intensity={0.5} distance={3} color="#22c55e" />
      </group>
      <group position={[14, 4, 8]}>
        <mesh>
          <boxGeometry args={[1.5, 0.5, 0.1]} />
          <meshBasicMaterial color="#22c55e" toneMapped={false} />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.25} color="#ffffff" anchorX="center">
          EXIT
        </Text>
        <pointLight position={[0, 0, 0.5]} intensity={0.5} distance={3} color="#22c55e" />
      </group>
    </group>
  );
}

// --- CEILING LIGHTS ---
function CeilingLights({ dimmed }: { dimmed: boolean }) {
  const lightPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let x = -10; x <= 10; x += 5) {
      for (let z = -5; z <= 15; z += 5) {
        positions.push([x, 10, z]);
      }
    }
    return positions;
  }, []);

  return (
    <group>
      {lightPositions.map((pos, index) => (
        <group key={index} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.4, 0.2, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.5} />
          </mesh>
          <pointLight intensity={dimmed ? 0.1 : 0.8} distance={8} color="#fef3c7" />
        </group>
      ))}
    </group>
  );
}

// --- SIMPLE PROJECTOR BEAM (Fixed) ---
function ProjectorBeam() {
  return (
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
  );
}

// --- STADIUM STEPS ---
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
            <boxGeometry args={[28, 0.4, 1.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[28, 0.02, 0.03]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --- AISLE MARKERS ---
function AisleMarkers() {
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i}>
          <mesh position={[-4.5, i * 0.3 + 0.35, i * 1.2 + 2]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
          </mesh>
          <mesh position={[4.5, i * 0.3 + 0.35, i * 1.2 + 2]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --- THEATER ENVIRONMENT ---
function TheaterEnvironment({ lightsEnabled }: { lightsEnabled: boolean }) {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog('#0a0a1a', 20, 60);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.95} />
      </mesh>

      {/* Walls */}
      <mesh position={[-16, 5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 15]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[16, 5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 15]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[35, 50]} />
        <meshStandardMaterial color="#020617" roughness={0.95} />
      </mesh>

      <StadiumSteps />
      <ExitSigns />
      <CeilingLights dimmed={!lightsEnabled} />
      <AisleMarkers />
      <ProjectorBeam />

      {/* Projector Booth */}
      <group position={[0, 10, 20]}>
        <mesh>
          <boxGeometry args={[3, 2, 3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.5, -1.5]}>
          <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>

      {/* Stars Background */}
      <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
    </group>
  );
}

// --- MINI MAP ---
function MiniMap({
  seats,
  selectedSeats,
  onSeatClick
}: {
  seats: Seat[];
  selectedSeats: string[];
  onSeatClick: (seat: Seat) => void;
}) {
  const rows = useMemo(() => {
    const rowMap: Record<string, Seat[]> = {};
    seats.forEach(seat => {
      if (!rowMap[seat.row]) rowMap[seat.row] = [];
      rowMap[seat.row].push(seat);
    });
    return Object.entries(rowMap).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const getSeatColor = (seat: Seat) => {
    if (seat.status === 'booked' || seat.isBooked) return 'bg-slate-600';
    if (selectedSeats.includes(seat.id)) return 'bg-green-500';
    if (seat.type === 'vip') return 'bg-purple-500';
    if (seat.type === 'premium') return 'bg-blue-500';
    if (seat.type === 'accessible') return 'bg-teal-500';
    return 'bg-gray-400';
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl">
      <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
        <Grid3X3 className="w-3 h-3" />
        Theater Overview
      </h4>

      <div className="w-full h-2 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full mb-4 relative">
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-500">SCREEN</span>
      </div>

      <div className="space-y-1.5 mt-6">
        {rows.map(([rowLetter, rowSeats]) => (
          <div key={rowLetter} className="flex items-center gap-1">
            <span className="text-[8px] text-gray-500 w-3">{rowLetter}</span>
            <div className="flex gap-0.5 flex-wrap">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button
                  key={seat.id}
                  onClick={() => onSeatClick(seat)}
                  disabled={seat.status === 'booked' || seat.isBooked}
                  className={`w-2 h-2 rounded-[2px] transition-all hover:scale-150 ${getSeatColor(seat)} ${
                    seat.status === 'booked' || seat.isBooked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  title={`${seat.row}${seat.number} - $${seat.price}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- BOOKING MODAL ---
function BookingModal({
  isOpen,
  onClose,
  onConfirm,
  selectedSeats,
  movie,
  showtime,
  totalPrice
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedSeats: Seat[];
  movie: typeof movies[0];
  showtime: typeof showtimes[0];
  totalPrice: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-400" />
            Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex gap-3">
              <img src={movie.image} alt={movie.title} className="w-16 h-24 object-cover rounded" />
              <div>
                <h4 className="text-white font-semibold">{movie.title}</h4>
                <p className="text-gray-400 text-sm">{movie.genre}</p>
                <p className="text-gray-500 text-xs mt-1">{movie.duration} • {movie.rating}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>{showtime.time}</span>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <h5 className="text-sm text-gray-400 mb-2">Selected Seats</h5>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(seat => (
                <span
                  key={seat.id}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    seat.type === 'vip' ? 'bg-purple-500/20 text-purple-300' :
                    seat.type === 'premium' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {seat.row}{seat.number}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Subtotal ({selectedSeats.length} tickets)</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Booking Fee</span>
              <span>$2.50</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white mt-2">
              <span>Total</span>
              <span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 3D SCENE CONTENT ---
function SceneContent({
  seats,
  seatPositions,
  rows,
  selectedMovie,
  lightsEnabled,
  highlightedSeats,
  hoveredSeat,
  soundEnabled,
  playSound,
  handleSeatClick,
  handleSeatHover,
  cameraTarget,
  isAnimating,
  setIsAnimating,
  controlsRef
}: {
  seats: Seat[];
  seatPositions: Array<{ seat: Seat; position: [number, number, number] }>;
  rows: string[];
  selectedMovie: typeof movies[0];
  lightsEnabled: boolean;
  highlightedSeats: string[];
  hoveredSeat: { seat: Seat; position: [number, number, number] } | null;
  soundEnabled: boolean;
  playSound: (type: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
  handleSeatClick: (seat: Seat) => void;
  handleSeatHover: (seat: Seat | null, position?: [number, number, number]) => void;
  cameraTarget: CameraTarget;
  isAnimating: boolean;
  setIsAnimating: (v: boolean) => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  return (
    <>
      <CameraController
        target={cameraTarget}
        isAnimating={isAnimating}
        onAnimationComplete={() => setIsAnimating(false)}
        controlsRef={controlsRef}
      />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 15, 10]} intensity={0.3} />
      <spotLight
        position={[0, 20, 5]}
        angle={0.5}
        penumbra={1}
        intensity={0.4}
        castShadow
      />

      {/* Screen */}
      <Screen3D
        posterUrl={selectedMovie.image}
        movieTitle={selectedMovie.title}
      />

      {/* Row Labels */}
      <RowLabels rows={rows} />

      {/* Environment */}
      <TheaterEnvironment lightsEnabled={lightsEnabled} />

      {/* Seats */}
      {seatPositions.map(({ seat, position }) => (
        <Seat3D
          key={seat.id}
          seat={seat}
          position={position}
          onClick={handleSeatClick}
          onHover={handleSeatHover}
          isHighlighted={highlightedSeats.includes(seat.id)}
          soundEnabled={soundEnabled}
          playSound={playSound}
        />
      ))}

      {/* Seat Tooltip */}
      {hoveredSeat && (
        <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />
      )}

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        minDistance={3}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1, -5]}
        enableDamping={true}
        dampingFactor={0.05}
      />
    </>
  );
}

// --- MAIN COMPONENT ---
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({
    position: DEFAULT_CAMERA_POS,
    lookAt: DEFAULT_LOOK_AT
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[3]);
  const [hoveredSeat, setHoveredSeat] = useState<{ seat: Seat; position: [number, number, number] } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [highlightedSeats, setHighlightedSeats] = useState<string[]>([]);
  const [lightsEnabled, setLightsEnabled] = useState(false);

  const controlsRef = useRef<any>(null);
  const { playSound } = useAudio();

  // Get selected seats
  const selectedSeats = useMemo(() => {
    return seats.filter(s => s.status === 'selected' || s.isSelected);
  }, [seats]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  }, [selectedSeats]);

  // Get unique rows
  const rows = useMemo(() => {
    return [...new Set(seats.map(s => s.row))].sort();
  }, [seats]);

  // Organize seats by row
  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  // Calculate seat positions with aisles
  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const sortedRows = Object.keys(seatsByRow).sort();

    sortedRows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.2 + 2;
      const rowY = (rowIndex * 0.3) + 0.3;

      rowSeats.forEach((seat, seatIndex) => {
        let aisleOffset = 0;
        const middleIndex = Math.floor(rowSeats.length / 2);
        if (seatIndex >= middleIndex) {
          aisleOffset = 1.0;
        }

        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.0 + aisleOffset * 0.5 - 0.25;
        positions.push({
          seat,
          position: [seatX, rowY, rowZ]
        });
      });
    });
    return positions;
  }, [seatsByRow]);

  // Find best seats
  const findBestSeats = useCallback((count: number = 2) => {
    const availableSeats = seatPositions.filter(
      ({ seat }) => seat.status === 'available' && !seat.isBooked
    );

    const scoredSeats = availableSeats.map(({ seat, position }) => {
      const centerScore = 10 - Math.abs(position[0]);
      const rowScore = 8 - Math.abs(3 - position[2] / 1.2);
      const typeBonus = seat.type === 'premium' ? 2 : seat.type === 'vip' ? 3 : 0;
      return { seat, position, score: centerScore + rowScore + typeBonus };
    });

    scoredSeats.sort((a, b) => b.score - a.score);
    return scoredSeats.slice(0, count).map(s => s.seat.id);
  }, [seatPositions]);

  // Handle seat click
  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
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
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  // Handle seat hover
  const handleSeatHover = useCallback((seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) {
      setHoveredSeat({ seat, position });
    } else {
      setHoveredSeat(null);
    }
  }, []);

  // Reset view
  const handleResetView = useCallback(() => {
    if (soundEnabled) playSound('click');
    setCameraTarget({
      position: DEFAULT_CAMERA_POS,
      lookAt: DEFAULT_LOOK_AT
    });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  }, [soundEnabled, playSound]);

  // Change view mode
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);

    const viewPositions: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 25, 5), lookAt: new THREE.Vector3(0, 0, 0) },
      front: { position: new THREE.Vector3(0, 5, -10), lookAt: new THREE.Vector3(0, 5, 0) },
      side: { position: new THREE.Vector3(25, 8, 5), lookAt: new THREE.Vector3(0, 2, 0) }
    };

    setCameraTarget(viewPositions[mode]);
    setIsAnimating(true);
  }, [soundEnabled, playSound]);

  // Recommend best seats
  const handleRecommendSeats = useCallback(() => {
    if (soundEnabled) playSound('success');
    const bestSeats = findBestSeats(4);
    setHighlightedSeats(bestSeats);
    setTimeout(() => setHighlightedSeats([]), 5000);
  }, [soundEnabled, playSound, findBestSeats]);

  // Screenshot
  const handleScreenshot = useCallback(() => {
    if (soundEnabled) playSound('success');
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `seat-view-${viewingSeatId || 'overview'}.png`;
      link.href = dataUrl;
      link.click();
    }
  }, [soundEnabled, playSound, viewingSeatId]);

  // Confirm booking
  const handleConfirmBooking = useCallback(() => {
    if (soundEnabled) playSound('success');
    setShowBookingModal(false);
    alert('Booking confirmed! Thank you for your purchase.');
  }, [soundEnabled, playSound]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewingSeatId) return;

      const currentSeat = seatPositions.find(s => s.seat.id === viewingSeatId);
      if (!currentSeat) return;

      const currentRow = currentSeat.seat.row;
      const currentNumber = currentSeat.seat.number;

      let targetSeat: Seat | undefined;

      switch (e.key) {
        case 'ArrowLeft':
          targetSeat = seats.find(s => s.row === currentRow && s.number === currentNumber - 1);
          break;
        case 'ArrowRight':
          targetSeat = seats.find(s => s.row === currentRow && s.number === currentNumber + 1);
          break;
        case 'ArrowUp':
          const prevRow = String.fromCharCode(currentRow.charCodeAt(0) - 1);
          targetSeat = seats.find(s => s.row === prevRow && s.number === currentNumber);
          break;
        case 'ArrowDown':
          const nextRow = String.fromCharCode(currentRow.charCodeAt(0) + 1);
          targetSeat = seats.find(s => s.row === nextRow && s.number === currentNumber);
          break;
        case 'Enter':
        case ' ':
          if (currentSeat.seat.status !== 'booked') {
            handleSeatClick(currentSeat.seat);
          }
          break;
        case 'Escape':
          handleResetView();
          break;
      }

      if (targetSeat) {
        e.preventDefault();
        const targetData = seatPositions.find(s => s.seat.id === targetSeat!.id);
        if (targetData) {
          const [x, y, z] = targetData.position;
          setCameraTarget({
            position: new THREE.Vector3(x, y + 0.8, z),
            lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
          });
          setIsAnimating(true);
          setViewingSeatId(targetSeat.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingSeatId, seats, seatPositions, handleSeatClick, handleResetView]);

  return (
    <div className="relative w-full h-[800px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* TOP LEFT: Movie & Showtime Selector */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 max-w-[420px]">
        {/* Movie Selector */}
        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Film className="w-3 h-3 text-blue-400" />
            Now Playing
          </h3>
          <div className="flex flex-wrap gap-2">
            {movies.map((movie) => (
              <button
                key={movie.id}
                onClick={() => {
                  if (soundEnabled) playSound('click');
                  setSelectedMovie(movie);
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  flex items-center gap-2 border
                  ${selectedMovie.id === movie.id
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white hover:bg-slate-700/80'}
                `}
              >
                {movie.title}
              </button>
            ))}
          </div>
        </div>

        {/* Showtime Selector */}
        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3 text-green-400" />
            Select Showtime
          </h3>
          <div className="flex flex-wrap gap-2">
            {showtimes.map((showtime) => (
              <button
                key={showtime.id}
                onClick={() => {
                  if (soundEnabled) playSound('click');
                  setSelectedShowtime(showtime);
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${selectedShowtime.id === showtime.id
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white hover:bg-slate-700/80'}
                `}
              >
                {showtime.time}
              </button>
            ))}
          </div>
        </div>

        {/* Movie Details */}
        <div className="bg-black/70 backdrop-blur-md p-3 rounded-xl border border-white/10">
          <div className="flex gap-3">
            <img
              src={selectedMovie.image}
              alt={selectedMovie.title}
              className="w-12 h-16 object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x64?text=Poster';
              }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-blue-400 font-bold text-sm truncate">{selectedMovie.title}</h4>
              <p className="text-gray-500 text-xs">{selectedMovie.duration} • {selectedMovie.rating}</p>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{selectedMovie.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScreenshot}
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white"
          >
            <Camera className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${showMiniMap ? 'ring-2 ring-blue-500' : ''}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLightsEnabled(!lightsEnabled)}
            className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${lightsEnabled ? 'ring-2 ring-yellow-500' : ''}`}
          >
            <Zap className="w-4 h-4" />
          </Button>
        </div>

        {/* View Modes */}
        <div className="flex gap-2">
          {[
            { mode: 'default' as ViewMode, icon: Eye, label: 'Default' },
            { mode: 'topdown' as ViewMode, icon: ArrowDown, label: 'Top' },
            { mode: 'front' as ViewMode, icon: Maximize2, label: 'Front' },
            { mode: 'side' as ViewMode, icon: ArrowUp, label: 'Side' }
          ].map(({ mode, icon: Icon }) => (
            <Button
              key={mode}
              variant="outline"
              size="sm"
              onClick={() => handleViewModeChange(mode)}
              className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${
                viewMode === mode ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {viewingSeatId && (
          <div className="bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">
              Viewing from Seat {seats.find(s => s.id === viewingSeatId)?.row}{seats.find(s => s.id === viewingSeatId)?.number}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleRecommendSeats}
            variant="outline"
            size="sm"
            className="bg-amber-600/50 hover:bg-amber-600/70 border-amber-500/50 text-white"
          >
            <Star className="w-4 h-4 mr-2" />
            Best Seats
          </Button>
          <Button
            onClick={handleResetView}
            variant="outline"
            size="sm"
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset View
          </Button>
        </div>

        {viewingSeatId && (
          <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg text-xs text-gray-400 border border-white/10">
            <span className="text-gray-500">Navigate: </span>
            <kbd className="px-1 bg-slate-700 rounded text-white">↑↓←→</kbd>
            <span className="text-gray-500 ml-2">Select: </span>
            <kbd className="px-1 bg-slate-700 rounded text-white">Enter</kbd>
          </div>
        )}
      </div>

      {/* BOTTOM LEFT: Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
          <Info className="w-3 h-3" />
          Seat Guide
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-gray-300 text-xs">Standard</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-300 text-xs">Premium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-gray-300 text-xs">VIP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-500"></div>
            <span className="text-gray-300 text-xs">Accessible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-300 text-xs">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-600"></div>
            <span className="text-gray-300 text-xs">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-gray-300 text-xs">Recommended</span>
          </div>
        </div>
      </div>

      {/* BOTTOM RIGHT: Selection Summary */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg min-w-[280px]">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
          <Ticket className="w-3 h-3 text-green-400" />
          Your Selection
        </h3>

        {selectedSeats.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedSeats.map(seat => (
                <span
                  key={seat.id}
                  className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
                    seat.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    seat.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    seat.type === 'accessible' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' :
                    'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}
                >
                  {seat.row}{seat.number}
                  <span className="text-gray-500">${seat.price}</span>
                </span>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{selectedSeats.length} ticket(s)</span>
                <span className="text-white font-medium">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Booking fee</span>
                <span className="text-white font-medium">$2.50</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-2">
                <span className="text-white">Total</span>
                <span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={() => setShowBookingModal(true)}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Proceed to Checkout
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No seats selected</p>
            <p className="text-gray-600 text-xs mt-1">Click on a seat to select it</p>
          </div>
        )}
      </div>

      {/* Mini Map */}
      {showMiniMap && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <MiniMap
            seats={seats}
            selectedSeats={selectedSeats.map(s => s.id)}
            onSeatClick={handleSeatClick}
          />
        </div>
      )}

      {/* 3D Canvas */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-full bg-slate-950">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading Theater...</p>
            <p className="text-gray-500 text-sm mt-2">Preparing your 3D experience</p>
          </div>
        </div>
      }>
        <Canvas
          shadows
          camera={{ position: [0, 8, 18], fov: 50 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a0a1a');
          }}
        >
          <SceneContent
            seats={seats}
            seatPositions={seatPositions}
            rows={rows}
            selectedMovie={selectedMovie}
            lightsEnabled={lightsEnabled}
            highlightedSeats={highlightedSeats}
            hoveredSeat={hoveredSeat}
            soundEnabled={soundEnabled}
            playSound={playSound}
            handleSeatClick={handleSeatClick}
            handleSeatHover={handleSeatHover}
            cameraTarget={cameraTarget}
            isAnimating={isAnimating}
            setIsAnimating={setIsAnimating}
            controlsRef={controlsRef}
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
