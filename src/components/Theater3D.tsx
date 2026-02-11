import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Star, Zap, Users, Info,
  AlertCircle, X, Check, ArrowUp, ArrowDown, Maximize2
} from 'lucide-react';

// --- MOCK BUTTON COMPONENT ---
const Button = ({ children, onClick, className = '', variant = 'default', size = 'default', disabled = false }: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground"
  };
  const sizes: Record<string, string> = {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 rounded-md px-3 text-xs",
    icon: "h-9 w-9"
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}>
      {children}
    </button>
  );
};

// --- DATA ---
const movies = [
  {
    id: '1', title: "The Dark Knight",
    image: "https://tinyurl.com/2h8v6vs4",
    video: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
    description: "Batman faces his greatest challenge yet as the Joker wreaks havoc on Gotham.",
    duration: "2h 32m", rating: "PG-13", genre: "Action, Crime, Drama"
  },
  {
    id: '2', title: "Inception",
    image: "https://tinyurl.com/3prm5vj7",
    video: "https://www.youtube.com/watch?v=YoHD9XEInc0",
    description: "A thief who steals corporate secrets through dream-sharing technology.",
    duration: "2h 28m", rating: "PG-13", genre: "Action, Sci-Fi"
  },
  {
    id: '3', title: "Interstellar",
    image: "https://tinyurl.com/3aprbm25",
    video: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
    description: "A team of explorers travel through a wormhole in space.",
    duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi, Adventure"
  },
  {
    id: '4', title: "Oppenheimer",
    image: "https://tinyurl.com/4m2dv8x2",
    video: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    description: "The story of the creation of the atomic bomb.",
    duration: "3h 0m", rating: "R", genre: "Drama, History"
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

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- TYPES ---
export interface Seat {
  id: string; row: string; number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium' | 'vip' | 'accessible';
  price: number; isBooked?: boolean; isSelected?: boolean;
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

// --- LARGER SCREEN CONSTANTS ---
const SCREEN_WIDTH = 36;
const SCREEN_HEIGHT = 20.25; // 16:9 aspect ratio
const SCREEN_Z = -22;
const SCREEN_Y = 12;

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 12, 28);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 4, 0);

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- AUDIO ---
const useAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    const frequencies: Record<string, number> = { click: 600, select: 800, hover: 400, success: 1000, error: 200 };
    oscillator.frequency.value = frequencies[type];
    oscillator.type = type === 'error' ? 'sawtooth' : 'sine';
    gainNode.gain.value = 0.1;
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, []);
  return { playSound };
};

// --- SCREEN POSITION TRACKER ---
function ScreenPositionTracker({
  onPositionUpdate
}: {
  onPositionUpdate: (rect: { left: number; top: number; width: number; height: number; visible: boolean }) => void;
}) {
  const { camera, gl } = useThree();
  const prevRect = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });

  useFrame(() => {
    const corners = [
      new THREE.Vector3(-SCREEN_WIDTH / 2, SCREEN_Y + SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(SCREEN_WIDTH / 2, SCREEN_Y + SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(-SCREEN_WIDTH / 2, SCREEN_Y - SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(SCREEN_WIDTH / 2, SCREEN_Y - SCREEN_HEIGHT / 2, SCREEN_Z),
    ];

    corners.forEach(c => c.project(camera));

    const centerPoint = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    const toScreen = centerPoint.clone().sub(camera.position).normalize();
    const dotProduct = cameraDir.dot(toScreen);
    const visible = dotProduct > 0;

    const canvasRect = gl.domElement.getBoundingClientRect();

    const ndcToPixel = (ndc: THREE.Vector3) => ({
      x: ((ndc.x + 1) / 2) * canvasRect.width,
      y: ((-ndc.y + 1) / 2) * canvasRect.height
    });

    const pixels = corners.map(ndcToPixel);
    const left = Math.min(pixels[0].x, pixels[2].x);
    const top = Math.min(pixels[0].y, pixels[1].y);
    const right = Math.max(pixels[1].x, pixels[3].x);
    const bottom = Math.max(pixels[2].y, pixels[3].y);

    const rect = {
      left: left + canvasRect.left,
      top: top + canvasRect.top,
      width: right - left,
      height: bottom - top,
      visible: visible && (right - left) > 30 && (bottom - top) > 20
    };

    const prev = prevRect.current;
    if (
      Math.abs(prev.left - rect.left) > 0.5 ||
      Math.abs(prev.top - rect.top) > 0.5 ||
      Math.abs(prev.width - rect.width) > 0.5 ||
      Math.abs(prev.height - rect.height) > 0.5 ||
      prev.visible !== rect.visible
    ) {
      prevRect.current = rect;
      onPositionUpdate(rect);
    }
  });

  return null;
}

// --- CAMERA CONTROLLER ---
function CameraController({
  target, isAnimating, onAnimationComplete, controlsRef, viewMode
}: {
  target: CameraTarget; isAnimating: boolean; onAnimationComplete: () => void;
  controlsRef: React.MutableRefObject<any>; viewMode: ViewMode;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useEffect(() => {
    if (viewMode !== 'default') progressRef.current = 0;
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

// --- SEAT 3D ---
function Seat3D({
  seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound
}: {
  seat: Seat; position: [number, number, number]; onClick: (seat: Seat) => void;
  onHover: (seat: Seat | null, position?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (type: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const meshRef = useRef<THREE.Group>(null);
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  useFrame((_, delta) => {
    if (meshRef.current) {
      if (isSelected && animationPhase < 1) setAnimationPhase(prev => Math.min(prev + delta * 3, 1));
      else if (!isSelected && animationPhase > 0) setAnimationPhase(prev => Math.max(prev - delta * 3, 0));
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
    if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); }
    else { if (soundEnabled) playSound('error'); }
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
      <RoundedBox args={[0.9, 0.2, 0.8]} radius={0.08} smoothness={6}
        onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}
        position={[0, 0.1 - seatRotation * 0.12, 0]} rotation={[seatRotation, 0, 0]}
        scale={scaleMultiplier} castShadow receiveShadow>
        <meshStandardMaterial color={getSeatColor()} roughness={0.35} metalness={0.15} emissive={getSeatColor()} emissiveIntensity={getEmissiveIntensity()} />
      </RoundedBox>
      <RoundedBox args={[0.9, 0.7, 0.15]} radius={0.08} smoothness={6}
        position={[0, 0.45, 0.38]} scale={scaleMultiplier} castShadow receiveShadow>
        <meshStandardMaterial color={getSeatColor()} roughness={0.35} metalness={0.15} emissive={getSeatColor()} emissiveIntensity={getEmissiveIntensity()} />
      </RoundedBox>
      <RoundedBox args={[0.1, 0.18, 0.55]} radius={0.03} smoothness={4} position={[-0.45, 0.2, 0.1]} castShadow>
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>
      <RoundedBox args={[0.1, 0.18, 0.55]} radius={0.03} smoothness={4} position={[0.45, 0.2, 0.1]} castShadow>
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>
      <Text position={[0, 0.25, 0]} fontSize={0.15} color={isBooked ? '#64748b' : '#0f172a'} anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
        {seat.number}
      </Text>
      {seat.type === 'vip' && (
        <mesh position={[0, 0.9, 0.38]}>
          <coneGeometry args={[0.1, 0.18, 6]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} metalness={0.8} roughness={0.2} />
        </mesh>
      )}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.9, 0.38]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {isSelected && <pointLight position={[0, 0.6, 0]} intensity={0.8} distance={2.5} color="#10b981" />}
      {isHighlighted && !isSelected && <pointLight position={[0, 0.6, 0]} intensity={0.5} distance={2} color="#f59e0b" />}
    </group>
  );
}

// --- SEAT TOOLTIP ---
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const typeLabels: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const typeColors: Record<string, string> = { standard: 'bg-gray-500', premium: 'bg-blue-500', vip: 'bg-purple-500', accessible: 'bg-teal-500' };

  return (
    <Html position={[position[0], position[1] + 1.5, position[2]]} center>
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20 min-w-[180px] pointer-events-none">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg">Row {seat.row} - Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeColors[seat.type]}`}>{typeLabels[seat.type]}</span>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Price:</span><span className="font-semibold text-green-400">${seat.price.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Status:</span>
            <span className={`font-medium ${isBooked ? 'text-red-400' : isSelected ? 'text-green-400' : 'text-blue-400'}`}>
              {isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}
            </span>
          </div>
        </div>
        {!isBooked && <div className="mt-3 pt-2 border-t border-white/10 text-center text-xs text-gray-400">Click to {isSelected ? 'deselect' : 'select'}</div>}
        {isBooked && <div className="mt-3 pt-2 border-t border-white/10 text-center text-xs text-red-400 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" />This seat is unavailable</div>}
      </div>
    </Html>
  );
}

// --- REALISTIC CINEMA SCREEN 3D ---
function CinemaScreen3D({ movieTitle }: { movieTitle: string }) {
  const glowRef = useRef<THREE.PointLight>(null);
  const [glowIntensity, setGlowIntensity] = useState(0);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Subtle pulsing glow to simulate screen light
    const pulse = Math.sin(t * 0.5) * 0.3 + 2.5;
    setGlowIntensity(pulse);
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Wall behind the screen - dark theater wall */}
      <mesh position={[0, 0, -1.5]}>
        <planeGeometry args={[60, 35]} />
        <meshStandardMaterial color="#020308" roughness={0.98} />
      </mesh>

      {/* Screen backing panel - slightly larger than screen */}
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[SCREEN_WIDTH + 2, SCREEN_HEIGHT + 1.5]} />
        <meshStandardMaterial color="#050510" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Screen bezel/frame - metallic border */}
      <mesh position={[0, 0, -0.15]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.8, SCREEN_HEIGHT + 0.6]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Thin silver trim around screen */}
      {/* Top trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.15, -0.1]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.6, 0.08, 0.05]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Bottom trim */}
      <mesh position={[0, -SCREEN_HEIGHT / 2 - 0.15, -0.1]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.6, 0.08, 0.05]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Left trim */}
      <mesh position={[-SCREEN_WIDTH / 2 - 0.15, 0, -0.1]}>
        <boxGeometry args={[0.08, SCREEN_HEIGHT + 0.4, 0.05]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Right trim */}
      <mesh position={[SCREEN_WIDTH / 2 + 0.15, 0, -0.1]}>
        <boxGeometry args={[0.08, SCREEN_HEIGHT + 0.4, 0.05]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Actual screen surface - dark for YouTube overlay */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#080810" />
      </mesh>

      {/* Screen ambient glow - simulates light bouncing off screen */}
      <pointLight
        ref={glowRef}
        position={[0, 0, 8]}
        intensity={glowIntensity}
        distance={40}
        color="#4060ff"
      />
      {/* Side glow lights */}
      <pointLight position={[-SCREEN_WIDTH / 3, 0, 5]} intensity={1.0} distance={20} color="#6080ff" />
      <pointLight position={[SCREEN_WIDTH / 3, 0, 5]} intensity={1.0} distance={20} color="#6080ff" />
      {/* Bottom glow on floor */}
      <pointLight position={[0, -SCREEN_HEIGHT / 2, 4]} intensity={1.5} distance={25} color="#3050dd" />
      {/* Top glow on ceiling */}
      <pointLight position={[0, SCREEN_HEIGHT / 2, 3]} intensity={0.8} distance={15} color="#5070ee" />

      {/* Velvet curtains - left */}
      <group position={[-SCREEN_WIDTH / 2 - 3.5, 0, -0.5]}>
        {/* Main curtain body */}
        <mesh receiveShadow castShadow>
          <boxGeometry args={[5, SCREEN_HEIGHT + 6, 0.8]} />
          <meshStandardMaterial color="#4a0e0e" roughness={0.92} metalness={0.02} />
        </mesh>
        {/* Curtain folds */}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-1.5 + i * 0.6, 0, 0.45]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, SCREEN_HEIGHT + 6, 8]} />
            <meshStandardMaterial color="#5c1515" roughness={0.88} />
          </mesh>
        ))}
      </group>

      {/* Velvet curtains - right */}
      <group position={[SCREEN_WIDTH / 2 + 3.5, 0, -0.5]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[5, SCREEN_HEIGHT + 6, 0.8]} />
          <meshStandardMaterial color="#4a0e0e" roughness={0.92} metalness={0.02} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-1.5 + i * 0.6, 0, 0.45]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, SCREEN_HEIGHT + 6, 8]} />
            <meshStandardMaterial color="#5c1515" roughness={0.88} />
          </mesh>
        ))}
      </group>

      {/* Top valance curtain */}
      <group position={[0, SCREEN_HEIGHT / 2 + 4, -0.3]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[SCREEN_WIDTH + 12, 5, 0.8]} />
          <meshStandardMaterial color="#4a0e0e" roughness={0.92} metalness={0.02} />
        </mesh>
        {/* Scalloped bottom edge */}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[-SCREEN_WIDTH / 2 - 3 + i * 3.5, -2.8, 0.2]} castShadow>
            <sphereGeometry args={[1.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#5c1515" roughness={0.88} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Gold trim rod at top */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 6.8, 0.2]}>
        <cylinderGeometry args={[0.12, 0.12, SCREEN_WIDTH + 14, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#b8860b" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Title display */}
      <Text position={[0, -SCREEN_HEIGHT / 2 - 1.8, 0.2]} fontSize={1.2} color="#8899bb"
        anchorX="center" anchorY="middle" letterSpacing={0.15}>
        NOW SHOWING
      </Text>
      <Text position={[0, -SCREEN_HEIGHT / 2 - 3.2, 0.2]} fontSize={1.8} color="#e2e8f0"
        anchorX="center" anchorY="middle" letterSpacing={0.08} font={undefined}>
        {movieTitle.toUpperCase()}
      </Text>
    </group>
  );
}

// --- ROW LABELS ---
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, index) => {
        const z = index * 1.8 + 4;
        const y = index * 0.45 + 0.5;
        return (
          <group key={row}>
            <Text position={[-17, y, z]} fontSize={0.7} color="#3b82f6" anchorX="center" anchorY="middle" rotation={[0, 0.2, 0]}>{row}</Text>
            <Text position={[17, y, z]} fontSize={0.7} color="#3b82f6" anchorX="center" anchorY="middle" rotation={[0, -0.2, 0]}>{row}</Text>
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
      {[[-20, 6, 12], [20, 6, 12], [-20, 6, -5], [20, 6, -5]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh><boxGeometry args={[1.8, 0.6, 0.12]} /><meshBasicMaterial color="#22c55e" toneMapped={false} /></mesh>
          <Text position={[0, 0, 0.07]} fontSize={0.3} color="#ffffff" anchorX="center">EXIT</Text>
          <pointLight position={[0, 0, 0.5]} intensity={0.6} distance={3.5} color="#22c55e" />
        </group>
      ))}
    </group>
  );
}

// --- CEILING LIGHTS ---
function CeilingLights({ dimmed }: { dimmed: boolean }) {
  const lightsRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (lightsRef.current) {
      lightsRef.current.children.forEach((light) => {
        if (light instanceof THREE.PointLight) {
          light.intensity = THREE.MathUtils.lerp(light.intensity, dimmed ? 0.08 : 0.8, 0.05);
        }
      });
    }
  });

  const lightPositions = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let x = -14; x <= 14; x += 7) for (let z = -10; z <= 20; z += 7) p.push([x, 16, z]);
    return p;
  }, []);

  return (
    <group ref={lightsRef}>
      {lightPositions.map((pos, i) => (
        <group key={i} position={new THREE.Vector3(...pos)}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.35, 0.2, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
          </mesh>
          {/* Recessed light housing */}
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.3} />
          </mesh>
          <pointLight intensity={dimmed ? 0.08 : 0.8} distance={10} color="#fef3c7" />
        </group>
      ))}
    </group>
  );
}

// --- STADIUM STEPS ---
function StadiumSteps() {
  const steps = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    index: i, z: i * 1.8 + 4, y: i * 0.45
  })), []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          {/* Step platform */}
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[34, 0.5, 1.8]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Step LED strip */}
          <mesh position={[0, step.y + 0.26, step.z + 0.89]}>
            <boxGeometry args={[34, 0.02, 0.03]} />
            <meshBasicMaterial color="#1e40af" toneMapped={false} />
          </mesh>
          {/* Carpet texture on steps */}
          <mesh position={[0, step.y + 0.26, step.z]} receiveShadow>
            <planeGeometry args={[34, 1.8]} />
            <meshStandardMaterial color="#16162a" roughness={0.95} metalness={0} rotation-x={-Math.PI / 2} />
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
          {[-6, 6].map((x, j) => (
            <group key={j}>
              <mesh position={[x, i * 0.45 + 0.35, i * 1.8 + 4]}>
                <sphereGeometry args={[0.05, 12, 12]} />
                <meshBasicMaterial color="#fbbf24" toneMapped={false} />
              </mesh>
              <pointLight position={[x, i * 0.45 + 0.35, i * 1.8 + 4]} intensity={0.2} distance={1} color="#fbbf24" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- FLOOR AISLE LIGHTING ---
function AisleFloorLights() {
  return (
    <group>
      {[-6, 6].map((x, xi) => (
        <group key={xi}>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[x, 0.01 + i * 0.45 * (8 / 12), i * 1.5 + 2]}>
              <circleGeometry args={[0.08, 12]} />
              <meshBasicMaterial color="#3b82f6" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- THEATER ENVIRONMENT ---
function TheaterEnvironment({ lightsEnabled }: { lightsEnabled: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog('#050510', 30, 80);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <group>
      {/* Floor - dark carpet */}
      <mesh position={[0, -0.5, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#070712" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-22, 8, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[70, 20]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh position={[22, 8, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[70, 20]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.92} metalness={0.03} />
      </mesh>

      {/* Acoustic wall panels - left */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`lp${i}`} position={[-21.8, 8, -8 + i * 7]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[3, 10]} />
          <meshStandardMaterial color="#101025" roughness={0.95} />
        </mesh>
      ))}
      {/* Acoustic wall panels - right */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`rp${i}`} position={[21.8, 8, -8 + i * 7]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[3, 10]} />
          <meshStandardMaterial color="#101025" roughness={0.95} />
        </mesh>
      ))}

      {/* Ceiling */}
      <mesh position={[0, 17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 70]} />
        <meshStandardMaterial color="#020308" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 8, 22]} receiveShadow>
        <planeGeometry args={[50, 20]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.92} />
      </mesh>

      <StadiumSteps />
      <ExitSigns />
      <CeilingLights dimmed={!lightsEnabled} />
      <AisleMarkers />
      <AisleFloorLights />

      {/* Projector booth */}
      <group position={[0, 14, 26]}>
        {/* Booth body */}
        <mesh castShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.3} />
        </mesh>
        {/* Projector window */}
        <mesh position={[0, -0.3, -2.1]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#1a1a3a" />
        </mesh>
        {/* Projector lens */}
        <mesh position={[0, -0.3, -2.2]}>
          <cylinderGeometry args={[0.25, 0.3, 0.5, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Lens glow */}
        <pointLight position={[0, -0.3, -2.5]} intensity={0.5} distance={6} color="#bfdbfe" />
        {/* Projector beam (subtle) */}
        <spotLight
          position={[0, -0.3, -2.5]}
          angle={0.25}
          penumbra={0.6}
          intensity={3}
          distance={60}
          color="#d4e4ff"
          target-position={[0, SCREEN_Y, SCREEN_Z]}
        />
      </group>

      {/* Wall sconces for ambient light */}
      {[-21.5, 21.5].map((x, xi) => (
        <group key={xi}>
          {Array.from({ length: 4 }, (_, i) => (
            <group key={i} position={[x, 5, -5 + i * 8]}>
              <mesh>
                <boxGeometry args={[0.3, 0.5, 0.15]} />
                <meshStandardMaterial color="#2a2a40" roughness={0.5} metalness={0.5} />
              </mesh>
              <pointLight intensity={lightsEnabled ? 0.4 : 0.05} distance={5} color="#ffeedd" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- MINIMAP ---
function MiniMap({ seats, selectedSeats, onSeatClick }: {
  seats: Seat[]; seatPositions: Array<{ seat: Seat; position: [number, number, number] }>;
  selectedSeats: string[]; onSeatClick: (seat: Seat) => void;
}) {
  const rows = useMemo(() => {
    const rowMap: Record<string, Seat[]> = {};
    seats.forEach(seat => { if (!rowMap[seat.row]) rowMap[seat.row] = []; rowMap[seat.row].push(seat); });
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
        <Grid3X3 className="w-3 h-3" />Theater Overview
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
                <button key={seat.id} onClick={() => onSeatClick(seat)}
                  disabled={seat.status === 'booked' || seat.isBooked}
                  className={`w-2 h-2 rounded-[2px] transition-all hover:scale-150 ${getSeatColor(seat)} ${seat.status === 'booked' || seat.isBooked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  title={`${seat.row}${seat.number} - $${seat.price}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- BOOKING MODAL ---
function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, totalPrice }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; selectedSeats: Seat[];
  movie: typeof movies[0]; showtime: typeof showtimes[0]; totalPrice: number;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Ticket className="w-5 h-5 text-blue-400" />Confirm Booking</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
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
          <div className="flex items-center gap-2 text-gray-300"><Clock className="w-4 h-4 text-blue-400" /><span>{showtime.time}</span></div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h5 className="text-sm text-gray-400 mb-2">Selected Seats</h5>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(seat => (
                <span key={seat.id} className={`px-2 py-1 rounded text-xs font-medium ${seat.type === 'vip' ? 'bg-purple-500/20 text-purple-300' : seat.type === 'premium' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-300'}`}>
                  {seat.row}{seat.number}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1"><span>Subtotal ({selectedSeats.length} tickets)</span><span>${totalPrice.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-400 mb-1"><span>Booking Fee</span><span>$2.50</span></div>
            <div className="flex justify-between text-lg font-bold text-white mt-2"><span>Total</span><span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700"><CreditCard className="w-4 h-4 mr-2" />Pay Now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- YOUTUBE OVERLAY ---
function YouTubeOverlay({
  videoId, screenRect
}: {
  videoId: string;
  screenRect: { left: number; top: number; width: number; height: number; visible: boolean };
}) {
  if (!screenRect.visible || screenRect.width < 50 || screenRect.height < 30) {
    return null;
  }

  // Calculate the exact 16:9 area within the projected screen rect
  const targetAspect = 16 / 9;
  const currentAspect = screenRect.width / screenRect.height;

  let videoWidth = screenRect.width;
  let videoHeight = screenRect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (currentAspect > targetAspect) {
    // Too wide - fit by height
    videoWidth = screenRect.height * targetAspect;
    offsetX = (screenRect.width - videoWidth) / 2;
  } else {
    // Too tall - fit by width
    videoHeight = screenRect.width / targetAspect;
    offsetY = (screenRect.height - videoHeight) / 2;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${screenRect.left + offsetX}px`,
        top: `${screenRect.top + offsetY}px`,
        width: `${videoWidth}px`,
        height: `${videoHeight}px`,
        zIndex: 5,
        pointerEvents: 'auto',
        overflow: 'hidden',
        borderRadius: '4px',
        backgroundColor: '#000',
        boxShadow: '0 0 60px 20px rgba(40, 80, 200, 0.15)',
      }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&iv_load_policy=3&fs=0&showinfo=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#000',
        }}
      />
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
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
  const [screenRect, setScreenRect] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });

  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSound } = useAudio();

  const youtubeId = useMemo(() => getYouTubeId(selectedMovie.video), [selectedMovie.video]);
  const isYouTube = !!youtubeId;

  const selectedSeats = useMemo(() => seats.filter(s => s.status === 'selected' || s.isSelected), [seats]);
  const totalPrice = useMemo(() => selectedSeats.reduce((sum, seat) => sum + seat.price, 0), [selectedSeats]);
  const rows = useMemo(() => [...new Set(seats.map(s => s.row))].sort(), [seats]);

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
      const rowZ = rowIndex * 1.8 + 4;
      const rowY = (rowIndex * 0.45) + 0.3;
      rowSeats.forEach((seat, seatIndex) => {
        let aisleOffset = 0;
        const middleIndex = Math.floor(rowSeats.length / 2);
        if (seatIndex >= middleIndex) aisleOffset = 1.4;
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.15 + aisleOffset * 0.5 - 0.35;
        positions.push({ seat, position: [seatX, rowY, rowZ] });
      });
    });
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count: number = 2) => {
    const availableSeats = seatPositions.filter(({ seat }) => seat.status === 'available' && !seat.isBooked);
    const scoredSeats = availableSeats.map(({ seat, position }) => {
      const centerScore = 14 - Math.abs(position[0]);
      const rowScore = 10 - Math.abs(5 - position[2] / 1.8);
      const typeBonus = seat.type === 'premium' ? 3 : seat.type === 'vip' ? 4 : 0;
      return { seat, score: centerScore + rowScore + typeBonus };
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
        position: new THREE.Vector3(x, y + 1.5, z + 3),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = (seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) setHoveredSeat({ seat, position });
    else setHoveredSeat(null);
  };

  const handleResetView = () => {
    if (soundEnabled) playSound('click');
    setCameraTarget({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);
    const viewPositions: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 35, 10), lookAt: new THREE.Vector3(0, 0, 5) },
      front: { position: new THREE.Vector3(0, SCREEN_Y, -16), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side: { position: new THREE.Vector3(32, 12, 8), lookAt: new THREE.Vector3(0, 5, 5) }
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

  const handleScreenPositionUpdate = useCallback((rect: { left: number; top: number; width: number; height: number; visible: boolean }) => {
    setScreenRect(rect);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewingSeatId) return;
      const currentSeat = seatPositions.find(s => s.seat.id === viewingSeatId);
      if (!currentSeat) return;
      const currentRow = currentSeat.seat.row;
      const currentNumber = currentSeat.seat.number;
      let targetSeat: Seat | undefined;

      switch (e.key) {
        case 'ArrowLeft': targetSeat = seats.find(s => s.row === currentRow && s.number === currentNumber - 1); break;
        case 'ArrowRight': targetSeat = seats.find(s => s.row === currentRow && s.number === currentNumber + 1); break;
        case 'ArrowUp': { const prevRow = String.fromCharCode(currentRow.charCodeAt(0) - 1); targetSeat = seats.find(s => s.row === prevRow && s.number === currentNumber); break; }
        case 'ArrowDown': { const nextRow = String.fromCharCode(currentRow.charCodeAt(0) + 1); targetSeat = seats.find(s => s.row === nextRow && s.number === currentNumber); break; }
        case 'Enter': case ' ': if (currentSeat.seat.status !== 'booked') handleSeatClick(currentSeat.seat); break;
        case 'Escape': handleResetView(); break;
      }
      if (targetSeat) {
        e.preventDefault();
        const targetData = seatPositions.find(s => s.seat.id === targetSeat!.id);
        if (targetData) {
          const [x, y, z] = targetData.position;
          setCameraTarget({ position: new THREE.Vector3(x, y + 1.5, z + 3), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
          setIsAnimating(true);
          setViewingSeatId(targetSeat.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingSeatId, seats, seatPositions, handleSeatClick]);

  return (
    <div ref={containerRef} className="relative w-full h-[900px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">

      {/* YouTube Overlay */}
      {isYouTube && youtubeId && (
        <YouTubeOverlay videoId={youtubeId} screenRect={screenRect} />
      )}

      {/* === UI PANELS === */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 max-w-[420px]">
        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Film className="w-3 h-3 text-blue-400" />Now Playing
          </h3>
          <div className="flex flex-wrap gap-2">
            {movies.map((movie) => (
              <button key={movie.id}
                onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${selectedMovie.id === movie.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white hover:bg-slate-700/80'}`}>
                {movie.title}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3 text-green-400" />Select Showtime
          </h3>
          <div className="flex flex-wrap gap-2">
            {showtimes.map((showtime) => (
              <button key={showtime.id}
                onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(showtime); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedShowtime.id === showtime.id ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800/80 border-white/10 text-gray-400 hover:text-white hover:bg-slate-700/80'}`}>
                {showtime.time}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/70 backdrop-blur-md p-3 rounded-xl border border-white/10">
          <div className="flex gap-3">
            <img src={selectedMovie.image} alt={selectedMovie.title} className="w-12 h-16 object-cover rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x64?text=Poster'; }} />
            <div className="flex-1 min-w-0">
              <h4 className="text-blue-400 font-bold text-sm truncate">{selectedMovie.title}</h4>
              <p className="text-gray-500 text-xs">{selectedMovie.duration} • {selectedMovie.rating}</p>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{selectedMovie.description}</p>
            </div>
          </div>
        </div>
      </div>

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

        <div className="flex gap-2">
          {([
            { mode: 'default' as ViewMode, icon: Eye, label: 'Default' },
            { mode: 'topdown' as ViewMode, icon: ArrowDown, label: 'Top' },
            { mode: 'front' as ViewMode, icon: Maximize2, label: 'Screen' },
            { mode: 'side' as ViewMode, icon: ArrowUp, label: 'Side' }
          ]).map(({ mode, icon: Icon }) => (
            <Button key={mode} variant="outline" size="sm"
              onClick={() => handleViewModeChange(mode)}
              className={`bg-black/50 hover:bg-black/70 border-white/20 text-white ${viewMode === mode ? 'ring-2 ring-blue-500' : ''}`}>
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
          <Button onClick={handleRecommendSeats} variant="outline" size="sm" className="bg-amber-600/50 hover:bg-amber-600/70 border-amber-500/50 text-white">
            <Star className="w-4 h-4 mr-2" />Best Seats
          </Button>
          <Button onClick={handleResetView} variant="outline" size="sm" className="bg-black/50 hover:bg-black/70 border-white/20 text-white">
            <RotateCcw className="w-4 h-4 mr-2" />Reset View
          </Button>
        </div>
      </div>

      {/* Seat Guide */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Info className="w-3 h-3" />Seat Guide</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            ['bg-gray-400', 'Standard'], ['bg-blue-500', 'Premium'], ['bg-purple-500', 'VIP'],
            ['bg-teal-500', 'Accessible'], ['bg-green-500', 'Selected'], ['bg-slate-600', 'Booked'], ['bg-amber-500', 'Recommended']
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${color}`}></div>
              <span className="text-gray-300 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection Panel */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg min-w-[280px]">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
          <Ticket className="w-3 h-3 text-green-400" />Your Selection
        </h3>
        {selectedSeats.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedSeats.map(seat => (
                <span key={seat.id} className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${seat.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : seat.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : seat.type === 'accessible' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'}`}>
                  {seat.row}{seat.number}<span className="text-gray-500">${seat.price}</span>
                </span>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">{selectedSeats.length} ticket(s)</span><span className="text-white font-medium">${totalPrice.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Booking fee</span><span className="text-white font-medium">$2.50</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-2"><span className="text-white">Total</span><span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
            </div>
            <Button onClick={() => setShowBookingModal(true)} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white">
              <Check className="w-4 h-4 mr-2" />Proceed to Checkout
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

      {showMiniMap && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} seatPositions={seatPositions} selectedSeats={selectedSeats.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* === 3D CANVAS === */}
      <Canvas
        ref={canvasRef}
        shadows
        camera={{ position: [0, 12, 28], fov: 55 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.8;
        }}
      >
        <CameraController
          target={cameraTarget}
          isAnimating={isAnimating}
          onAnimationComplete={() => setIsAnimating(false)}
          controlsRef={controlsRef}
          viewMode={viewMode}
        />

        {/* Reduced ambient for darker theater feel */}
        <ambientLight intensity={0.15} color="#1a1a3a" />
        <directionalLight position={[12, 25, 12]} intensity={0.6} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={30} shadow-camera-bottom={-30}
        />
        <directionalLight position={[-12, 20, 12]} intensity={0.2} />

        {/* Screen Position Tracker */}
        {isYouTube && (
          <ScreenPositionTracker onPositionUpdate={handleScreenPositionUpdate} />
        )}

        {/* Cinema Screen */}
        <CinemaScreen3D movieTitle={selectedMovie.title} />

        <RowLabels rows={rows} />
        <TheaterEnvironment lightsEnabled={lightsEnabled} />

        {seatPositions.map(({ seat, position }) => (
          <Seat3D key={seat.id} seat={seat} position={position} onClick={handleSeatClick}
            onHover={handleSeatHover} isHighlighted={highlightedSeats.includes(seat.id)}
            soundEnabled={soundEnabled} playSound={playSound} />
        ))}

        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        <OrbitControls ref={controlsRef} minDistance={4} maxDistance={50}
          maxPolarAngle={Math.PI / 2.05} target={[0, 4, 0]}
          enableDamping={true} dampingFactor={0.05} />
      </Canvas>

      <BookingModal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)}
        onConfirm={handleConfirmBooking} selectedSeats={selectedSeats}
        movie={selectedMovie} showtime={selectedShowtime} totalPrice={totalPrice} />
    </div>
  );
}
