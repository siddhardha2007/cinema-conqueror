import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';
import { 
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera, 
  Grid3X3, Ticket, CreditCard, Star, Zap, Users, Info, 
  AlertCircle, X, Check, ArrowUp, ArrowDown, Maximize2
} from 'lucide-react';

// --- MOCK BUTTON COMPONENT (Replaces @/components/ui/button) ---
const Button = ({ children, onClick, className = '', variant = 'default', size = 'default', disabled = false }: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground"
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
      className={`${baseStyle} ${variants[variant as keyof typeof variants] || variants.default} ${sizes[size as keyof typeof sizes] || sizes.default} ${className}`}
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
    description: "Batman faces his greatest challenge yet as the Joker wreaks havoc on Gotham.",
    duration: "2h 32m",
    rating: "PG-13",
    genre: "Action, Crime, Drama"
  },
  {
    id: '2',
    title: "Big Buck Bunny",
    image: "https://images.unsplash.com/photo-1518066000714-58c45f1a2c0a?auto=format&fit=crop&w=800&q=80",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    description: "A giant rabbit meets three bullying rodents.",
    duration: "9m 56s",
    rating: "PG",
    genre: "Animation, Comedy"
  },
  {
    id: '3',
    title: "Elephants Dream",
    image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    description: "Two friends explore a strange machine world.",
    duration: "10m 53s",
    rating: "PG-13",
    genre: "Sci-Fi, Adventure"
  },
  {
    id: '4',
    title: "Tears of Steel",
    image: "https://images.unsplash.com/photo-1614726365723-49cfae927827?auto=format&fit=crop&w=800&q=80",
    video: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    description: "A group of warriors and scientists try to save the world.",
    duration: "12m 14s",
    rating: "R",
    genre: "Sci-Fi, Action"
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

// --- HELPER TO GET YOUTUBE ID ---
function getYouTubeId(url: string) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

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

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 22);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 2, 0);
const SCREEN_Z = -18;
const SCREEN_Y = 8;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- AUDIO CONTEXT ---
const useAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    if (typeof window === 'undefined') return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

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
  }, []);

  return { playSound };
};

// --- COMPONENTS ---

function CameraController({
  target,
  isAnimating,
  onAnimationComplete,
  controlsRef,
  viewMode
}: {
  target: CameraTarget;
  isAnimating: boolean;
  onAnimationComplete: () => void;
  controlsRef: React.MutableRefObject<any>;
  viewMode: ViewMode;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useEffect(() => {
    if (viewMode !== 'default') {
      progressRef.current = 0;
    }
  }, [viewMode]);

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
  const [animationPhase, setAnimationPhase] = useState(0);
  const meshRef = useRef<THREE.Group>(null);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  useFrame((_, delta) => {
    if (meshRef.current) {
      if (isSelected && animationPhase < 1) {
        setAnimationPhase(prev => Math.min(prev + delta * 3, 1));
      } else if (!isSelected && animationPhase > 0) {
        setAnimationPhase(prev => Math.max(prev - delta * 3, 0));
      }
    }
  });

  const getSeatColor = () => {
    if (isBooked) return '#475569';
    if (isSelected) return '#10b981';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#fbbf24';
    if (seat.type === 'vip') return '#a855f7';
    if (seat.type === 'premium') return '#3b82f6';
    if (seat.type === 'accessible') return '#14b8a6';
    return '#94a3b8';
  };

  const getEmissiveIntensity = () => {
    if (isSelected) return 0.4;
    if (isHighlighted) return 0.25;
    if (hovered) return 0.2;
    return 0.08;
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

  const seatRotation = animationPhase * 0.25;
  const scaleMultiplier = hovered && !isBooked ? 1.08 : 1;

  return (
    <group ref={meshRef} position={position}>
      {/* Seat Base/Cushion */}
      <RoundedBox
        args={[0.9, 0.2, 0.8]}
        radius={0.08}
        smoothness={6}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        position={[0, 0.1 - seatRotation * 0.12, 0]}
        rotation={[seatRotation, 0, 0]}
        scale={scaleMultiplier}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.35}
          metalness={0.15}
          emissive={getSeatColor()}
          emissiveIntensity={getEmissiveIntensity()}
        />
      </RoundedBox>

      {/* Seat Backrest */}
      <RoundedBox
        args={[0.9, 0.7, 0.15]}
        radius={0.08}
        smoothness={6}
        position={[0, 0.45, 0.38]}
        scale={scaleMultiplier}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={getSeatColor()}
          roughness={0.35}
          metalness={0.15}
          emissive={getSeatColor()}
          emissiveIntensity={getEmissiveIntensity()}
        />
      </RoundedBox>

      {/* Left Armrest */}
      <RoundedBox 
        args={[0.1, 0.18, 0.55]} 
        radius={0.03} 
        smoothness={4} 
        position={[-0.45, 0.2, 0.1]} 
        castShadow
      >
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>

      {/* Right Armrest */}
      <RoundedBox 
        args={[0.1, 0.18, 0.55]} 
        radius={0.03} 
        smoothness={4} 
        position={[0.45, 0.2, 0.1]} 
        castShadow
      >
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>

      {/* Seat Number Label */}
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

      {/* VIP Crown Indicator */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.9, 0.38]}>
          <coneGeometry args={[0.1, 0.18, 6]} />
          <meshStandardMaterial 
            color="#fbbf24" 
            emissive="#fbbf24" 
            emissiveIntensity={0.6}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      )}

      {/* Accessible Indicator */}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.9, 0.38]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial 
            color="#14b8a6" 
            emissive="#14b8a6" 
            emissiveIntensity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}

      {/* Selected Glow */}
      {isSelected && (
        <pointLight position={[0, 0.6, 0]} intensity={0.8} distance={2.5} color="#10b981" />
      )}

      {/* Highlighted Glow */}
      {isHighlighted && !isSelected && (
        <pointLight position={[0, 0.6, 0]} intensity={0.5} distance={2} color="#f59e0b" />
      )}
    </group>
  );
}

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
    <Html position={[position[0], position[1] + 1.5, position[2]]} center>
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20 min-w-[180px] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
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

// --- VIDEO SCREEN MATERIAL COMPONENT ---
function MovieScreenMaterial({ videoUrl }: { videoUrl: string }) {
  const texture = useVideoTexture(videoUrl, {
    unsuspend: 'canplay',
    muted: false, 
    loop: true,
    start: true,
    crossOrigin: 'Anonymous'
  });
  
  return (
    <meshBasicMaterial 
      map={texture} 
      toneMapped={false} 
      side={THREE.DoubleSide} 
    />
  );
}

function Screen3D({ videoUrl, movieTitle }: { videoUrl: string; movieTitle: string }) {
  const youtubeId = getYouTubeId(videoUrl);

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      
      {/* Video Display Area */}
      {youtubeId ? (
        <>
          {/* Black screen background */}
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[24, 10]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          
          {/* YouTube Embed - Now with proper 3D positioning */}
          <Html
            position={[0, 0, 0.2]}
            transform={true}
            occlude={false}
            scale={0.01875}
            zIndexRange={[100, 0]}
          >
            <iframe
              width="1280"
              height="533"
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                border: 'none',
                display: 'block',
                backgroundColor: '#000',
              }}
            />
          </Html>
        </>
      ) : (
        /* MP4 VIDEO FILE */
        <Suspense fallback={
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[24, 10]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
        }>
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[24, 10]} />
            <MovieScreenMaterial videoUrl={videoUrl} />
          </mesh>
        </Suspense>
      )}

      {/* Screen Frame */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[25, 10.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Screen Border Accent */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[25.3, 11.1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Screen Glow */}
      <pointLight position={[0, 0, 3]} intensity={2.5} distance={28} color="#60a5fa" />
      <pointLight position={[-9, 0, 2]} intensity={1.2} distance={16} color="#818cf8" />
      <pointLight position={[9, 0, 2]} intensity={1.2} distance={16} color="#818cf8" />

      {/* Left Curtain */}
      <mesh position={[-14, 0, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[3.5, 15, 0.6]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Right Curtain */}
      <mesh position={[14, 0, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[3.5, 15, 0.6]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Top Curtain */}
      <mesh position={[0, 7, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[32, 3.5, 0.6]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Background Wall */}
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#020617" roughness={0.95} />
      </mesh>

      {/* Movie Title */}
      <Text
        position={[0, -7, 0.2]}
        fontSize={0.9}
        color="#cbd5e1"
        anchorX="center"
        anchorY="middle"
      >
        NOW SHOWING: {movieTitle.toUpperCase()}
      </Text>
    </group>
  );
}

function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, index) => {
        const z = index * 1.5 + 3;
        const y = index * 0.35 + 0.5;
        return (
          <group key={row}>
            <Text
              position={[-15, y, z]}
              fontSize={0.6}
              color="#3b82f6"
              anchorX="center"
              anchorY="middle"
              rotation={[0, 0.2, 0]}
            >
              {row}
            </Text>
            <Text
              position={[15, y, z]}
              fontSize={0.6}
              color="#3b82f6"
              anchorX="center"
              anchorY="middle"
              rotation={[0, -0.2, 0]}
            >
              {row}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function ExitSigns() {
  return (
    <group>
      <group position={[-15, 5, 10]}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.12]} />
          <meshBasicMaterial color="#22c55e" toneMapped={false} />
        </mesh>
        <Text position={[0, 0, 0.07]} fontSize={0.3} color="#ffffff" anchorX="center">
          EXIT
        </Text>
        <pointLight position={[0, 0, 0.5]} intensity={0.6} distance={3.5} color="#22c55e" />
      </group>
      <group position={[15, 5, 10]}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.12]} />
          <meshBasicMaterial color="#22c55e" toneMapped={false} />
        </mesh>
        <Text position={[0, 0, 0.07]} fontSize={0.3} color="#ffffff" anchorX="center">
          EXIT
        </Text>
        <pointLight position={[0, 0, 0.5]} intensity={0.6} distance={3.5} color="#22c55e" />
      </group>
    </group>
  );
}

function CeilingLights({ dimmed }: { dimmed: boolean }) {
  const lightsRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (lightsRef.current) {
      lightsRef.current.children.forEach((light) => {
        if (light instanceof THREE.PointLight) {
          const targetIntensity = dimmed ? 0.15 : 1.0;
          light.intensity = THREE.MathUtils.lerp(light.intensity, targetIntensity, 0.05);
        }
      });
    }
  });

  const lightPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let x = -12; x <= 12; x += 6) {
      for (let z = -8; z <= 16; z += 6) {
        positions.push([x, 12, z]);
      }
    }
    return positions;
  }, []);

  return (
    <group ref={lightsRef}>
      {lightPositions.map((pos, index) => (
        <group key={index} position={new THREE.Vector3(...pos)}>
          <mesh>
            <cylinderGeometry args={[0.35, 0.45, 0.25, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
          </mesh>
          <pointLight intensity={dimmed ? 0.15 : 1.0} distance={10} color="#fef3c7" />
        </group>
      ))}
    </group>
  );
}

function StadiumSteps() {
  const steps = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      z: i * 1.5 + 3,
      y: i * 0.35
    }));
  }, []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          {/* Main Step Platform */}
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[30, 0.5, 1.5]} />
            <meshStandardMaterial color="#1e293b" roughness={0.85} metalness={0.1} />
          </mesh>
          
          {/* LED Step Edge */}
          <mesh position={[0, step.y + 0.26, step.z + 0.74]}>
            <boxGeometry args={[30, 0.03, 0.04]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function AisleMarkers() {
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i}>
          <mesh position={[-5, i * 0.35 + 0.4, i * 1.5 + 3]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
            <pointLight position={[0, 0, 0]} intensity={0.3} distance={1} color="#fbbf24" />
          </mesh>
          <mesh position={[5, i * 0.35 + 0.4, i * 1.5 + 3]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
            <pointLight position={[0, 0, 0]} intensity={0.3} distance={1} color="#fbbf24" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TheaterEnvironment({ lightsEnabled }: { lightsEnabled: boolean }) {
  const { scene } = useThree();
  
  useEffect(() => {
    scene.fog = new THREE.Fog('#0a0a1a', 25, 70);
    return () => { 
      scene.fog = null; 
    };
  }, [scene]);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Left Wall */}
      <mesh position={[-18, 6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[60, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Right Wall */}
      <mesh position={[18, 6, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[60, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 60]} />
        <meshStandardMaterial color="#020617" roughness={0.95} metalness={0.05} />
      </mesh>

      <StadiumSteps />
      <ExitSigns />
      <CeilingLights dimmed={!lightsEnabled} />
      <AisleMarkers />

      {/* Projector Booth */}
      <group position={[0, 11, 24]}>
        <mesh castShadow>
          <boxGeometry args={[3.5, 2.5, 3.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.6, -1.8]}>
          <cylinderGeometry args={[0.35, 0.35, 0.6, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.6} />
        </mesh>
        <spotLight 
          position={[0, -0.6, -1.8]} 
          angle={0.15} 
          penumbra={0.4} 
          intensity={2.5} 
          distance={55} 
          color="#bfdbfe"
          target-position={[0, SCREEN_Y, SCREEN_Z]}
        />
      </group>
    </group>
  );
}

function MiniMap({
  seats,
  selectedSeats,
  onSeatClick
}: {
  seats: Seat[];
  seatPositions: Array<{ seat: Seat; position: [number, number, number] }>;
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95">
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playSound } = useAudio();

  const selectedSeats = useMemo(() => {
    return seats.filter(s => s.status === 'selected' || s.isSelected);
  }, [seats]);

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  }, [selectedSeats]);

  const rows = useMemo(() => {
    return [...new Set(seats.map(s => s.row))].sort();
  }, [seats]);

  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const sortedRows = Object.keys(seatsByRow).sort();
    
    sortedRows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.5 + 3;
      const rowY = (rowIndex * 0.35) + 0.3;
      
      rowSeats.forEach((seat, seatIndex) => {
        let aisleOffset = 0;
        const middleIndex = Math.floor(rowSeats.length / 2);
        
        if (seatIndex >= middleIndex) {
          aisleOffset = 1.2;
        }
        
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.1 + aisleOffset * 0.5 - 0.3;
        
        positions.push({
          seat,
          position: [seatX, rowY, rowZ]
        });
      });
    });
    
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count: number = 2) => {
    const availableSeats = seatPositions.filter(
      ({ seat }) => seat.status === 'available' && !seat.isBooked
    );
    
    const scoredSeats = availableSeats.map(({ seat, position }) => {
      const centerScore = 12 - Math.abs(position[0]);
      const rowScore = 10 - Math.abs(4 - position[2] / 1.5);
      const typeBonus = seat.type === 'premium' ? 3 : seat.type === 'vip' ? 4 : 0;
      return { seat, position, score: centerScore + rowScore + typeBonus };
    });
    
    scoredSeats.sort((a, b) => b.score - a.score);
    return scoredSeats.slice(0, count).map(s => s.seat.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);
    
    const seatData = seatPositions.find(s => s.seat.id === seat.id);
    if (seatData) {
      const [x, y, z] = seatData.position;
      setCameraTarget({
        position: new THREE.Vector3(x, y + 1, z + 2),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = (seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) {
      setHoveredSeat({ seat, position });
    } else {
      setHoveredSeat(null);
    }
  };

  const handleResetView = () => {
    if (soundEnabled) playSound('click');
    setCameraTarget({
      position: DEFAULT_CAMERA_POS,
      lookAt: DEFAULT_LOOK_AT
    });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);
    
    const viewPositions: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 28, 8), lookAt: new THREE.Vector3(0, 0, 5) },
      front: { position: new THREE.Vector3(0, 6, -14), lookAt: new THREE.Vector3(0, 6, 0) },
      side: { position: new THREE.Vector3(28, 10, 8), lookAt: new THREE.Vector3(0, 3, 5) }
    };
    
    setCameraTarget(viewPositions[mode]);
    setIsAnimating(true);
  };

  const handleRecommendSeats = () => {
    if (soundEnabled) playSound('success');
    const bestSeats = findBestSeats(4);
    setHighlightedSeats(bestSeats);
    setTimeout(() => setHighlightedSeats([]), 5000);
  };

  const handleScreenshot = async () => {
    if (soundEnabled) playSound('success');
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `seat-view-${viewingSeatId || 'overview'}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleConfirmBooking = () => {
    if (soundEnabled) playSound('success');
    setShowBookingModal(false);
    alert('Booking confirmed! Thank you for your purchase.');
  };

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
        case 'ArrowUp': {
          const prevRow = String.fromCharCode(currentRow.charCodeAt(0) - 1);
          targetSeat = seats.find(s => s.row === prevRow && s.number === currentNumber); 
          break;
        }
        case 'ArrowDown': {
          const nextRow = String.fromCharCode(currentRow.charCodeAt(0) + 1);
          targetSeat = seats.find(s => s.row === nextRow && s.number === currentNumber);
          break;
        }
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
            position: new THREE.Vector3(x, y + 1, z + 2),
            lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
          });
          setIsAnimating(true);
          setViewingSeatId(targetSeat.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingSeatId, seats, seatPositions, handleSeatClick]);

  return (
    <div className="relative w-full h-[800px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Movie Selection Panel */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 max-w-[420px]">
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

        {/* Showtime Selection */}
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

        {/* Movie Info */}
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

      {/* Control Panel */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} className="bg-black/50 hover:bg-black/70 border-white/20 text-white">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleScreenshot} className="bg-black/50 hover:bg-black/70 border-white/20 text-white">
            <Camera className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMiniMap(!showMiniMap)} className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${showMiniMap ? 'ring-2 ring-blue-500' : ''}`}>
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLightsEnabled(!lightsEnabled)} className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${lightsEnabled ? 'ring-2 ring-yellow-500' : ''}`}>
            <Zap className="w-4 h-4" />
          </Button>
        </div>

        {/* View Mode Controls */}
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
              className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${viewMode === mode ? 'ring-2 ring-blue-500' : ''}`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Viewing Indicator */}
        {viewingSeatId && (
          <div className="bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg animate-in fade-in zoom-in">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">
              Viewing from Seat {seats.find(s => s.id === viewingSeatId)?.row}{seats.find(s => s.id === viewingSeatId)?.number}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleRecommendSeats} variant="outline" size="sm" className="bg-amber-600/50 hover:bg-amber-600/70 border-amber-500/50 text-white">
            <Star className="w-4 h-4 mr-2" />
            Best Seats
          </Button>
          <Button onClick={handleResetView} variant="outline" size="sm" className="bg-black/50 hover:bg-black/70 border-white/20 text-white">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset View
          </Button>
        </div>
      </div>

      {/* Seat Guide */}
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

      {/* Selection Summary */}
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
            <Button onClick={() => setShowBookingModal(true)} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white">
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
            seatPositions={seatPositions}
            selectedSeats={selectedSeats.map(s => s.id)}
            onSeatClick={handleSeatClick}
          />
        </div>
      )}

      {/* 3D Canvas - NO Suspense wrapper here! */}
      <Canvas
        ref={canvasRef}
        shadows
        camera={{ position: [0, 10, 22], fov: 55 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <CameraController
          target={cameraTarget}
          isAnimating={isAnimating}
          onAnimationComplete={() => setIsAnimating(false)}
          controlsRef={controlsRef}
          viewMode={viewMode}
        />

        {/* Lighting */}
        <ambientLight intensity={0.35} />
        <directionalLight 
          position={[12, 22, 12]} 
          intensity={1.0} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <directionalLight position={[-12, 18, 12]} intensity={0.4} />
        <spotLight position={[0, 22, 8]} angle={0.6} penumbra={1} intensity={0.5} castShadow />

        {/* Scene Components */}
        <Screen3D
          videoUrl={selectedMovie.video}
          movieTitle={selectedMovie.title}
        />

        <RowLabels rows={rows} />
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

        {/* Tooltip */}
        {hoveredSeat && (
          <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />
        )}

        {/* Camera Controls */}
        <OrbitControls
          ref={controlsRef}
          minDistance={4}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 2, 0]}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>

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
