import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, useVideoTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Star, Zap, Users, Info,
  AlertCircle, X, Check, ArrowUp, ArrowDown, Maximize2
} from 'lucide-react';

const Button = ({ children, onClick, className = '', variant = 'default', size = 'default', disabled = false }: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-white/20 bg-transparent shadow-sm hover:bg-white/10",
    ghost: "hover:bg-white/10"
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

const movies = [
  { id: '1', title: "The Dark Knight", image: "https://tinyurl.com/2h8v6vs4", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", description: "Batman faces his greatest challenge yet as the Joker wreaks havoc on Gotham.", duration: "2h 32m", rating: "PG-13", genre: "Action, Crime, Drama" },
  { id: '2', title: "Inception", image: "https://tinyurl.com/3prm5vj7", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", description: "A thief who steals corporate secrets through dream-sharing technology.", duration: "2h 28m", rating: "PG-13", genre: "Sci-Fi, Action" },
  { id: '3', title: "Interstellar", image: "https://tinyurl.com/3aprbm25", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", description: "A team of explorers travel through a wormhole in space.", duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi, Adventure" },
  { id: '4', title: "Oppenheimer", image: "https://tinyurl.com/4m2dv8x2", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", description: "The story of the creation of the atomic bomb.", duration: "3h 0m", rating: "R", genre: "Drama, History" }
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
  const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
}

export interface Seat {
  id: string; row: string; number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium' | 'vip' | 'accessible';
  price: number; isBooked?: boolean; isSelected?: boolean;
}

interface Theater3DProps { seats: Seat[]; onSeatClick: (seat: Seat) => void; }
interface CameraTarget { position: THREE.Vector3; lookAt: THREE.Vector3; }
type ViewMode = 'default' | 'topdown' | 'front' | 'side';

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 12, 26);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 3, 0);
const SCREEN_Z = -20;
const SCREEN_Y = 9;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const useAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const freqs: Record<string, number[]> = {
      click: [500, 700], select: [600, 900], hover: [400, 500], success: [800, 1200], error: [200, 150]
    };
    const [f1, f2] = freqs[type];
    osc.frequency.setValueAtTime(f1, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(f2, ctx.currentTime + 0.08);
    osc.type = type === 'error' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  }, []);
  return { playSound };
};

// --- DUST PARTICLES floating in projector beam ---
function DustParticles({ count = 200 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8,
      y: Math.random() * 8 + 4,
      z: (Math.random() - 0.5) * 40 + 2,
      speed: Math.random() * 0.3 + 0.05,
      drift: Math.random() * Math.PI * 2,
      scale: Math.random() * 0.03 + 0.01,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.drift) * 0.5,
        p.y + Math.sin(t * p.speed * 0.7 + p.drift) * 0.3,
        p.z + Math.cos(t * p.speed * 0.5) * 0.4
      );
      dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 2 + i) * 0.3));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#fef3c7" transparent opacity={0.15} toneMapped={false} />
    </instancedMesh>
  );
}

// --- PROJECTOR BEAM ---
function ProjectorBeam() {
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.02 + Math.sin(clock.getElapsedTime() * 0.5) * 0.008;
    }
  });

  return (
    <mesh ref={beamRef} position={[0, 11, 2]} rotation={[0.15, 0, 0]}>
      <coneGeometry args={[14, 45, 32, 1, true]} />
      <meshBasicMaterial color="#bfdbfe" transparent opacity={0.025} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// --- SCREEN POSITION TRACKER ---
function ScreenPositionTracker({ onPositionUpdate }: {
  onPositionUpdate: (rect: { left: number; top: number; width: number; height: number; visible: boolean }) => void;
}) {
  const { camera, gl } = useThree();
  const screenWidth3D = 26;
  const screenHeight3D = 11;
  const prevRect = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });

  useFrame(() => {
    const corners = [
      new THREE.Vector3(-screenWidth3D / 2, SCREEN_Y + screenHeight3D / 2, SCREEN_Z),
      new THREE.Vector3(screenWidth3D / 2, SCREEN_Y + screenHeight3D / 2, SCREEN_Z),
      new THREE.Vector3(-screenWidth3D / 2, SCREEN_Y - screenHeight3D / 2, SCREEN_Z),
      new THREE.Vector3(screenWidth3D / 2, SCREEN_Y - screenHeight3D / 2, SCREEN_Z),
    ];
    corners.forEach(c => c.project(camera));

    const center = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const toScreen = center.clone().sub(camera.position).normalize();
    const visible = dir.dot(toScreen) > 0.1;

    const rect = gl.domElement.getBoundingClientRect();
    const toPixel = (ndc: THREE.Vector3) => ({
      x: ((ndc.x + 1) / 2) * rect.width,
      y: ((-ndc.y + 1) / 2) * rect.height
    });

    const pixels = corners.map(toPixel);
    const left = Math.min(pixels[0].x, pixels[2].x);
    const top = Math.min(pixels[0].y, pixels[1].y);
    const right = Math.max(pixels[1].x, pixels[3].x);
    const bottom = Math.max(pixels[2].y, pixels[3].y);

    const newRect = {
      left: left + rect.left,
      top: top + rect.top,
      width: right - left,
      height: bottom - top,
      visible: visible && (right - left) > 30 && (bottom - top) > 20
    };

    const p = prevRect.current;
    if (Math.abs(p.left - newRect.left) > 0.5 || Math.abs(p.top - newRect.top) > 0.5 ||
      Math.abs(p.width - newRect.width) > 0.5 || Math.abs(p.height - newRect.height) > 0.5 ||
      p.visible !== newRect.visible) {
      prevRect.current = newRect;
      onPositionUpdate(newRect);
    }
  });

  return null;
}

function CameraController({ target, isAnimating, onAnimationComplete, controlsRef, viewMode }: {
  target: CameraTarget; isAnimating: boolean; onAnimationComplete: () => void;
  controlsRef: React.MutableRefObject<any>; viewMode: ViewMode;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  useEffect(() => { progressRef.current = 0; }, [viewMode, target]);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    progressRef.current = Math.min(progressRef.current + delta * 1.2, 1);
    const t = easeInOutCubic(progressRef.current);
    camera.position.lerp(target.position, t * 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target.lookAt, t * 0.08);
      controlsRef.current.update();
    }
    if (progressRef.current >= 1) { progressRef.current = 0; onAnimationComplete(); }
  });
  return null;
}

// --- ENHANCED SEAT 3D ---
function Seat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (seat: Seat) => void;
  onHover: (seat: Seat | null, position?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (type: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  useFrame((state, delta) => {
    // Seat fold animation
    if (isSelected && animProgress < 1) setAnimProgress(p => Math.min(p + delta * 4, 1));
    else if (!isSelected && animProgress > 0) setAnimProgress(p => Math.max(p - delta * 4, 0));

    // Glow pulse for selected seats
    if (glowRef.current && isSelected) {
      glowRef.current.intensity = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }

    // Hover float
    if (groupRef.current) {
      const targetY = hovered && !isBooked ? 0.08 : 0;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.1);
    }
  });

  const getColor = () => {
    if (isBooked) return '#334155';
    if (isSelected) return '#10b981';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#fbbf24';
    switch (seat.type) {
      case 'vip': return '#a855f7';
      case 'premium': return '#3b82f6';
      case 'accessible': return '#14b8a6';
      default: return '#64748b';
    }
  };

  const getCushionColor = () => {
    if (isBooked) return '#1e293b';
    if (isSelected) return '#059669';
    if (seat.type === 'vip') return '#7c3aed';
    if (seat.type === 'premium') return '#2563eb';
    return '#475569';
  };

  const getEmissive = () => {
    if (isSelected) return 0.5;
    if (isHighlighted) return 0.3;
    if (hovered && !isBooked) return 0.25;
    return 0.05;
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); }
    else { if (soundEnabled) playSound('error'); }
  };

  const seatFold = animProgress * 0.35;
  const scale = hovered && !isBooked ? 1.06 : 1;

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Seat base / legs */}
        <mesh position={[-0.35, -0.05, -0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.35, -0.05, -0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.35, -0.05, 0.3]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.35, -0.05, 0.3]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Seat bottom cushion (folds up when selected) */}
        <group position={[0, 0.12, -0.05]} rotation={[seatFold, 0, 0]}>
          <RoundedBox args={[0.82, 0.12, 0.7]} radius={0.04} smoothness={4}
            onClick={handleClick}
            onPointerEnter={(e: any) => { e.stopPropagation(); if (soundEnabled && !isBooked) playSound('hover'); setHovered(true); document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer'; onHover(seat, position); }}
            onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; onHover(null); }}
            scale={scale} castShadow receiveShadow>
            <meshStandardMaterial color={getCushionColor()} roughness={0.7} metalness={0.05}
              emissive={getColor()} emissiveIntensity={getEmissive()} />
          </RoundedBox>
        </group>

        {/* Seat back */}
        <RoundedBox args={[0.82, 0.75, 0.1]} radius={0.04} smoothness={4}
          position={[0, 0.52, 0.35]} scale={scale} castShadow receiveShadow
          onClick={handleClick}
          onPointerEnter={(e: any) => { e.stopPropagation(); if (soundEnabled && !isBooked) playSound('hover'); setHovered(true); document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer'; onHover(seat, position); }}
          onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; onHover(null); }}>
          <meshStandardMaterial color={getCushionColor()} roughness={0.7} metalness={0.05}
            emissive={getColor()} emissiveIntensity={getEmissive()} />
        </RoundedBox>

        {/* Seat back frame */}
        <RoundedBox args={[0.88, 0.82, 0.06]} radius={0.03} smoothness={4}
          position={[0, 0.5, 0.39]} castShadow>
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.6} />
        </RoundedBox>

        {/* Armrests */}
        <group position={[-0.46, 0.22, 0.1]}>
          <RoundedBox args={[0.08, 0.06, 0.5]} radius={0.02} smoothness={4} castShadow>
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
          </RoundedBox>
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.06, 0.16, 0.06]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
        <group position={[0.46, 0.22, 0.1]}>
          <RoundedBox args={[0.08, 0.06, 0.5]} radius={0.02} smoothness={4} castShadow>
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
          </RoundedBox>
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.06, 0.16, 0.06]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>

        {/* Cup holder indentation on armrest */}
        <mesh position={[-0.46, 0.26, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.02, 0.035, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.46, 0.26, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.02, 0.035, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Seat number on back */}
        <Text position={[0, 0.52, 0.41]} fontSize={0.12} color={isBooked ? '#475569' : '#e2e8f0'}
          anchorX="center" anchorY="middle" fontWeight={700}>
          {seat.number}
        </Text>

        {/* VIP crown */}
        {seat.type === 'vip' && (
          <group position={[0, 1.0, 0.35]}>
            <mesh>
              <coneGeometry args={[0.08, 0.15, 5]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
            </mesh>
            <pointLight position={[0, 0.1, 0]} intensity={0.3} distance={1.5} color="#fbbf24" />
          </group>
        )}

        {/* Accessible marker */}
        {seat.type === 'accessible' && (
          <group position={[0, 1.0, 0.35]}>
            <mesh>
              <torusGeometry args={[0.07, 0.025, 8, 16]} />
              <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.8} metalness={0.7} roughness={0.2} />
            </mesh>
          </group>
        )}

        {/* Selection glow */}
        {isSelected && (
          <>
            <pointLight ref={glowRef} position={[0, 0.5, 0]} intensity={0.6} distance={2.5} color="#10b981" />
            <mesh position={[0, 0.01, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.55, 32]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.15} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}

        {isHighlighted && !isSelected && (
          <pointLight position={[0, 0.5, 0]} intensity={0.4} distance={2} color="#f59e0b" />
        )}
      </group>
    </group>
  );
}

function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const labels: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const colors: Record<string, string> = { standard: 'bg-gray-500', premium: 'bg-blue-500', vip: 'bg-purple-500', accessible: 'bg-teal-500' };

  return (
    <Html position={[position[0], position[1] + 1.8, position[2]]} center>
      <div className="bg-slate-900/95 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl border border-white/15 min-w-[190px] pointer-events-none"
        style={{ transform: 'translateY(-10px)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${colors[seat.type]}`}>{labels[seat.type]}</span>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Price</span><span className="font-bold text-green-400">${seat.price.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Status</span>
            <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-green-400' : 'text-blue-400'}`}>
              {isBooked ? '● Booked' : isSelected ? '● Selected' : '● Available'}
            </span>
          </div>
        </div>
        {!isBooked && <div className="mt-2.5 pt-2 border-t border-white/10 text-center text-xs text-gray-400">Click to {isSelected ? 'deselect' : 'select'}</div>}
        {isBooked && <div className="mt-2.5 pt-2 border-t border-white/10 text-center text-xs text-red-400 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" />Unavailable</div>}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-slate-900/95 rotate-45 border-r border-b border-white/15" />
      </div>
    </Html>
  );
}

// --- CINEMA SCREEN ---
function Screen3D({ movieTitle, isYouTube }: { movieTitle: string; isYouTube: boolean; videoUrl: string }) {
  const screenWidth = 26;
  const screenHeight = 11;
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.intensity = 3 + Math.sin(clock.getElapsedTime() * 0.3) * 0.5;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Deep frame recess */}
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[screenWidth + 2.5, screenHeight + 2, 0.5]} />
        <meshStandardMaterial color="#020617" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* Silver screen border - metallic */}
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[screenWidth + 0.6, screenHeight + 0.4]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Screen surface */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshStandardMaterial color={isYouTube ? "#0f172a" : "#000"} roughness={0.95} metalness={0} />
      </mesh>

      {/* Screen glow lights */}
      <pointLight ref={glowRef} position={[0, 0, 4]} intensity={3} distance={35} color="#60a5fa" />
      <pointLight position={[-10, 0, 3]} intensity={1.5} distance={20} color="#818cf8" />
      <pointLight position={[10, 0, 3]} intensity={1.5} distance={20} color="#818cf8" />
      <pointLight position={[0, -6, 2]} intensity={0.8} distance={12} color="#3b82f6" />

      {/* Velvet curtains - left */}
      <group position={[-15.5, 0, -0.15]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`cl-${i}`} position={[Math.sin(i * 0.8) * 0.15, 0, i * 0.05]} castShadow>
            <boxGeometry args={[0.8, 16, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
      </group>

      {/* Velvet curtains - right */}
      <group position={[15.5, 0, -0.15]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`cr-${i}`} position={[-Math.sin(i * 0.8) * 0.15, 0, i * 0.05]} castShadow>
            <boxGeometry args={[0.8, 16, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
      </group>

      {/* Curtain valance - top */}
      <group position={[0, 8.5, -0.1]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`ct-${i}`} position={[(i - 4.5) * 3.5, Math.sin(i * 1.2) * 0.15, 0]} castShadow>
            <boxGeometry args={[3.5, 2.5 + Math.sin(i * 0.7) * 0.3, 0.35]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
        {/* Valance trim - gold */}
        <mesh position={[0, -1.2, 0.1]}>
          <boxGeometry args={[35, 0.12, 0.1]} />
          <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Back wall */}
      <mesh position={[0, 0, -0.8]}>
        <planeGeometry args={[50, 28]} />
        <meshStandardMaterial color="#020617" roughness={0.98} />
      </mesh>

      {/* Movie title */}
      <Text position={[0, -7.5, 0.3]} fontSize={0.7} color="#94a3b8" anchorX="center" anchorY="middle"
        font={undefined} letterSpacing={0.15}>
        ★ NOW SHOWING: {movieTitle.toUpperCase()} ★
      </Text>
    </group>
  );
}

function Screen3DWithVideo({ videoUrl, movieTitle }: { videoUrl: string; movieTitle: string }) {
  const screenWidth = 26;
  const screenHeight = 11;
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[screenWidth + 2.5, screenHeight + 2, 0.5]} />
        <meshStandardMaterial color="#020617" roughness={0.95} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[screenWidth + 0.6, screenHeight + 0.4]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
      </mesh>
      <Suspense fallback={<mesh position={[0, 0, 0.05]}><planeGeometry args={[screenWidth, screenHeight]} /><meshBasicMaterial color="#1e293b" /></mesh>}>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[screenWidth, screenHeight]} />
          <MovieScreenMaterial videoUrl={videoUrl} />
        </mesh>
      </Suspense>
      <pointLight position={[0, 0, 4]} intensity={3} distance={35} color="#60a5fa" />
      <pointLight position={[-10, 0, 3]} intensity={1.5} distance={20} color="#818cf8" />
      <pointLight position={[10, 0, 3]} intensity={1.5} distance={20} color="#818cf8" />

      {/* Curtains for video screen too */}
      <group position={[-15.5, 0, -0.15]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`cl-${i}`} position={[Math.sin(i * 0.8) * 0.15, 0, i * 0.05]} castShadow>
            <boxGeometry args={[0.8, 16, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
      </group>
      <group position={[15.5, 0, -0.15]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`cr-${i}`} position={[-Math.sin(i * 0.8) * 0.15, 0, i * 0.05]} castShadow>
            <boxGeometry args={[0.8, 16, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
      </group>
      <group position={[0, 8.5, -0.1]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`ct-${i}`} position={[(i - 4.5) * 3.5, Math.sin(i * 1.2) * 0.15, 0]} castShadow>
            <boxGeometry args={[3.5, 2.5 + Math.sin(i * 0.7) * 0.3, 0.35]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#7f1d1d" : "#991b1b"} roughness={0.9} metalness={0.02} />
          </mesh>
        ))}
        <mesh position={[0, -1.2, 0.1]}>
          <boxGeometry args={[35, 0.12, 0.1]} />
          <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.2} />
        </mesh>
      </group>
      <mesh position={[0, 0, -0.8]}>
        <planeGeometry args={[50, 28]} />
        <meshStandardMaterial color="#020617" roughness={0.98} />
      </mesh>
      <Text position={[0, -7.5, 0.3]} fontSize={0.7} color="#94a3b8" anchorX="center" anchorY="middle" letterSpacing={0.15}>
        ★ NOW SHOWING: {movieTitle.toUpperCase()} ★
      </Text>
    </group>
  );
}

function MovieScreenMaterial({ videoUrl }: { videoUrl: string }) {
  const texture = useVideoTexture(videoUrl, { unsuspend: 'canplay', muted: false, loop: true, start: true, crossOrigin: 'Anonymous' });
  useEffect(() => { if (texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = true; texture.needsUpdate = true; } }, [texture]);
  return <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} />;
}

function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, i) => {
        const z = i * 1.6 + 3;
        const y = i * 0.4 + 0.6;
        return (
          <group key={row}>
            <Text position={[-16, y, z]} fontSize={0.5} color="#3b82f6" anchorX="center" anchorY="middle"
              rotation={[0, 0.15, 0]} fontWeight={700}>{row}</Text>
            <Text position={[16, y, z]} fontSize={0.5} color="#3b82f6" anchorX="center" anchorY="middle"
              rotation={[0, -0.15, 0]} fontWeight={700}>{row}</Text>
          </group>
        );
      })}
    </group>
  );
}

function ExitSigns() {
  return (
    <group>
      {[[-17, 5.5, 12], [17, 5.5, 12]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[2, 0.7, 0.15]} radius={0.05} smoothness={4}>
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </RoundedBox>
          <Text position={[0, 0, 0.09]} fontSize={0.32} color="#ffffff" anchorX="center" fontWeight={900}>EXIT</Text>
          <pointLight position={[0, 0, 0.5]} intensity={0.8} distance={4} color="#22c55e" />
        </group>
      ))}
    </group>
  );
}

// --- ENHANCED CEILING LIGHTS with housing ---
function CeilingLights({ dimmed }: { dimmed: boolean }) {
  const lightsRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!lightsRef.current) return;
    lightsRef.current.traverse((child) => {
      if (child instanceof THREE.PointLight) {
        child.intensity = THREE.MathUtils.lerp(child.intensity, dimmed ? 0.08 : 0.7, 0.03);
      }
    });
  });

  const positions = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let x = -14; x <= 14; x += 7) for (let z = -6; z <= 18; z += 6) p.push([x, 14, z]);
    return p;
  }, []);

  return (
    <group ref={lightsRef}>
      {positions.map((pos, i) => (
        <group key={i} position={new THREE.Vector3(...pos)}>
          {/* Light housing */}
          <mesh>
            <cylinderGeometry args={[0.25, 0.4, 0.3, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.7} />
          </mesh>
          {/* Light bulb */}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.12, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={dimmed ? "#1e293b" : "#fef3c7"} toneMapped={false} />
          </mesh>
          <pointLight intensity={dimmed ? 0.08 : 0.7} distance={8} color="#fef3c7" />
        </group>
      ))}
    </group>
  );
}

// --- ENHANCED STADIUM with carpet texture ---
function StadiumSteps() {
  const steps = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ i, z: i * 1.6 + 3, y: i * 0.4 })), []);
  return (
    <group>
      {steps.map((step) => (
        <group key={step.i}>
          {/* Main step */}
          <mesh position={[0, step.y - 0.05, step.z]} receiveShadow castShadow>
            <boxGeometry args={[34, 0.5, 1.6]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.92} metalness={0.05} />
          </mesh>
          {/* Carpet strip */}
          <mesh position={[0, step.y + 0.21, step.z]}>
            <boxGeometry args={[33.5, 0.02, 1.55]} />
            <meshStandardMaterial color="#1e1e3a" roughness={0.95} metalness={0} />
          </mesh>
          {/* Step edge - subtle LED strip */}
          <mesh position={[0, step.y + 0.21, step.z + 0.79]}>
            <boxGeometry args={[33.5, 0.015, 0.03]} />
            <meshBasicMaterial color="#1e40af" toneMapped={false} transparent opacity={0.6} />
          </mesh>
          {/* Aisle markers */}
          {[-5.5, 5.5].map((x, j) => (
            <group key={j} position={[x, step.y + 0.25, step.z]}>
              <mesh>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color="#fbbf24" toneMapped={false} />
              </mesh>
              <pointLight intensity={0.15} distance={0.8} color="#fbbf24" />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- ENHANCED THEATER ENVIRONMENT ---
function TheaterEnvironment({ lightsEnabled }: { lightsEnabled: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#050510', 0.012);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <group>
      {/* Floor - dark carpet */}
      <mesh position={[0, -0.5, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0a0a18" roughness={0.98} metalness={0.02} />
      </mesh>

      {/* Aisle carpet */}
      <mesh position={[-5.5, -0.48, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 40]} />
        <meshStandardMaterial color="#1e1e3a" roughness={0.95} />
      </mesh>
      <mesh position={[5.5, -0.48, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 40]} />
        <meshStandardMaterial color="#1e1e3a" roughness={0.95} />
      </mesh>

      {/* Walls with wainscoting effect */}
      {/* Left wall */}
      <group>
        <mesh position={[-20, 7, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[60, 18]} />
          <meshStandardMaterial color="#0c0c20" roughness={0.9} metalness={0.05} />
        </mesh>
        {/* Wall panel strips */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`lwp-${i}`} position={[-19.9, 4 + i * 2.5, 5]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[40, 0.06, 0.05]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Right wall */}
      <group>
        <mesh position={[20, 7, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[60, 18]} />
          <meshStandardMaterial color="#0c0c20" roughness={0.9} metalness={0.05} />
        </mesh>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`rwp-${i}`} position={[19.9, 4 + i * 2.5, 5]} rotation={[0, -Math.PI / 2, 0]}>
            <boxGeometry args={[40, 0.06, 0.05]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Ceiling */}
      <mesh position={[0, 15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44, 60]} />
        <meshStandardMaterial color="#050510" roughness={0.98} metalness={0.05} />
      </mesh>

      {/* Acoustic panels on ceiling */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`ap-${i}`} position={[(i - 3.5) * 5, 14.8, 5]}>
          <boxGeometry args={[4, 0.15, 30]} />
          <meshStandardMaterial color="#0f0f25" roughness={0.95} metalness={0.05} />
        </mesh>
      ))}

      {/* Back wall */}
      <mesh position={[0, 7, 20]} receiveShadow>
        <planeGeometry args={[44, 18]} />
        <meshStandardMaterial color="#0c0c20" roughness={0.9} />
      </mesh>

      <StadiumSteps />
      <ExitSigns />
      <CeilingLights dimmed={!lightsEnabled} />

      {/* Wall sconces */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={`sconce-${i}`}>
          <group position={[-19.5, 6, -5 + i * 7]}>
            <mesh>
              <boxGeometry args={[0.3, 0.5, 0.15]} />
              <meshStandardMaterial color="#b8860b" metalness={0.8} roughness={0.3} />
            </mesh>
            <pointLight position={[0.3, 0, 0]} intensity={lightsEnabled ? 0.4 : 0.08} distance={4} color="#fef3c7" />
          </group>
          <group position={[19.5, 6, -5 + i * 7]}>
            <mesh>
              <boxGeometry args={[0.3, 0.5, 0.15]} />
              <meshStandardMaterial color="#b8860b" metalness={0.8} roughness={0.3} />
            </mesh>
            <pointLight position={[-0.3, 0, 0]} intensity={lightsEnabled ? 0.4 : 0.08} distance={4} color="#fef3c7" />
          </group>
        </group>
      ))}

      {/* Projector room */}
      <group position={[0, 12, 22]}>
        <mesh castShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Projector lens */}
        <mesh position={[0, -0.3, -2.1]}>
          <cylinderGeometry args={[0.4, 0.5, 0.8, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Projector glass */}
        <mesh position={[0, -0.3, -2.5]}>
          <circleGeometry args={[0.35, 24]} />
          <meshBasicMaterial color="#93c5fd" toneMapped={false} transparent opacity={0.4} />
        </mesh>
        {/* Projection window */}
        <mesh position={[0, -0.3, -2.01]}>
          <planeGeometry args={[1.5, 1]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
      </group>

      {/* Projector beam */}
      <ProjectorBeam />
      {/* Dust particles */}
      <DustParticles count={150} />
    </group>
  );
}

function MiniMap({ seats, selectedSeats, onSeatClick }: {
  seats: Seat[]; seatPositions: Array<{ seat: Seat; position: [number, number, number] }>;
  selectedSeats: string[]; onSeatClick: (seat: Seat) => void;
}) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const getColor = (s: Seat) => {
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-700';
    if (selectedSeats.includes(s.id)) return 'bg-green-500 shadow-green-500/50 shadow-sm';
    if (s.type === 'vip') return 'bg-purple-500';
    if (s.type === 'premium') return 'bg-blue-500';
    if (s.type === 'accessible') return 'bg-teal-500';
    return 'bg-gray-500';
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-2xl">
      <h4 className="text-white text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
        <Grid3X3 className="w-3 h-3 text-blue-400" />Theater Map
      </h4>
      <div className="w-full h-1.5 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full mb-1 relative shadow-blue-500/30 shadow-sm">
        <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] text-blue-400 font-bold tracking-widest">SCREEN</span>
      </div>
      <div className="space-y-1 mt-5">
        {rows.map(([r, rs]) => (
          <div key={r} className="flex items-center gap-1">
            <span className="text-[7px] text-blue-400 w-3 font-bold">{r}</span>
            <div className="flex gap-[3px]">
              {rs.sort((a, b) => a.number - b.number).map(s => (
                <button key={s.id} onClick={() => onSeatClick(s)} disabled={s.status === 'booked' || s.isBooked}
                  className={`w-[7px] h-[7px] rounded-[2px] transition-all duration-200 hover:scale-[2] ${getColor(s)} ${s.status === 'booked' || s.isBooked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  title={`${s.row}${s.number} · $${s.price}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, totalPrice }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; selectedSeats: Seat[];
  movie: typeof movies[0]; showtime: typeof showtimes[0]; totalPrice: number;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Ticket className="w-5 h-5 text-blue-400" />Confirm Booking</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
            <div className="flex gap-3">
              <img src={movie.image} alt={movie.title} className="w-16 h-24 object-cover rounded-lg shadow-lg" />
              <div>
                <h4 className="text-white font-bold">{movie.title}</h4>
                <p className="text-gray-400 text-sm">{movie.genre}</p>
                <p className="text-gray-500 text-xs mt-1">{movie.duration} · {movie.rating}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-300 bg-slate-800/30 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-blue-400" /><span className="font-medium">{showtime.time}</span>
          </div>
          <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
            <h5 className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-bold">Selected Seats</h5>
            <div className="flex flex-wrap gap-1.5">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${s.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : s.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'}`}>
                  {s.row}{s.number}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-400"><span>Subtotal ({selectedSeats.length} tickets)</span><span>${totalPrice.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-400"><span>Booking Fee</span><span>$2.50</span></div>
            <div className="flex justify-between text-lg font-bold text-white mt-3 pt-2 border-t border-white/10"><span>Total</span><span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 text-gray-300">Cancel</Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold">
              <CreditCard className="w-4 h-4 mr-2" />Pay Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function YouTubeOverlay({ videoId, screenRect }: {
  videoId: string;
  screenRect: { left: number; top: number; width: number; height: number; visible: boolean };
}) {
  if (!screenRect.visible || screenRect.width < 50 || screenRect.height < 30) return null;

  // Add slight padding inward for perfect fit within the screen border
  const padding = 2;

  return (
    <div style={{
      position: 'fixed',
      left: `${screenRect.left + padding}px`,
      top: `${screenRect.top + padding}px`,
      width: `${screenRect.width - padding * 2}px`,
      height: `${screenRect.height - padding * 2}px`,
      zIndex: 5,
      pointerEvents: 'auto',
      overflow: 'hidden',
      borderRadius: '3px',
      backgroundColor: '#000',
      boxShadow: '0 0 40px rgba(96, 165, 250, 0.15)',
    }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&iv_load_policy=3&fs=0`}
        title="YouTube video player" frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block', backgroundColor: '#000' }}
      />
    </div>
  );
}

// --- MAIN ---
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
  const { playSound } = useAudio();

  const youtubeId = useMemo(() => getYouTubeId(selectedMovie.video), [selectedMovie.video]);
  const isYouTube = !!youtubeId;

  const selectedSeats = useMemo(() => seats.filter(s => s.status === 'selected' || s.isSelected), [seats]);
  const totalPrice = useMemo(() => selectedSeats.reduce((sum, s) => sum + s.price, 0), [selectedSeats]);
  const rows = useMemo(() => [...new Set(seats.map(s => s.row))].sort(), [seats]);

  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, s) => { if (!acc[s.row]) acc[s.row] = []; acc[s.row].push(s); return acc; }, {} as Record<string, Seat[]>);
  }, [seats]);

  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    Object.keys(seatsByRow).sort().forEach((row, ri) => {
      const rs = seatsByRow[row].sort((a, b) => a.number - b.number);
      const z = ri * 1.6 + 3;
      const y = ri * 0.4 + 0.3;
      rs.forEach((seat, si) => {
        const mid = Math.floor(rs.length / 2);
        const aisle = si >= mid ? 1.4 : 0;
        const x = (si - (rs.length - 1) / 2) * 1.15 + aisle * 0.5 - 0.35;
        positions.push({ seat, position: [x, y, z] });
      });
    });
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count = 4) => {
    const avail = seatPositions.filter(({ seat: s }) => s.status === 'available' && !s.isBooked);
    const scored = avail.map(({ seat: s, position: p }) => ({
      id: s.id,
      score: (14 - Math.abs(p[0])) + (12 - Math.abs(5 - p[2] / 1.6)) + (s.type === 'premium' ? 3 : s.type === 'vip' ? 5 : 0)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);
    const data = seatPositions.find(s => s.seat.id === seat.id);
    if (data) {
      const [x, y, z] = data.position;
      setCameraTarget({ position: new THREE.Vector3(x, y + 1.5, z + 3), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = (seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) setHoveredSeat({ seat, position }); else setHoveredSeat(null);
  };

  const handleResetView = () => {
    if (soundEnabled) playSound('click');
    setCameraTarget({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
    setIsAnimating(true); setViewingSeatId(null); setViewMode('default');
  };

  const handleViewMode = (mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);
    const views: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 32, 8), lookAt: new THREE.Vector3(0, 0, 5) },
      front: { position: new THREE.Vector3(0, 7, -15), lookAt: new THREE.Vector3(0, 7, 0) },
      side: { position: new THREE.Vector3(30, 12, 8), lookAt: new THREE.Vector3(0, 4, 5) }
    };
    setCameraTarget(views[mode]); setIsAnimating(true);
  };

  const handleScreenPositionUpdate = useCallback((rect: typeof screenRect) => {
    setScreenRect(prev => {
      if (Math.abs(prev.left - rect.left) > 0.5 || Math.abs(prev.top - rect.top) > 0.5 ||
        Math.abs(prev.width - rect.width) > 0.5 || Math.abs(prev.height - rect.height) > 0.5 ||
        prev.visible !== rect.visible) return rect;
      return prev;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!viewingSeatId) return;
      const cur = seatPositions.find(s => s.seat.id === viewingSeatId);
      if (!cur) return;
      let target: Seat | undefined;
      switch (e.key) {
        case 'ArrowLeft': target = seats.find(s => s.row === cur.seat.row && s.number === cur.seat.number - 1); break;
        case 'ArrowRight': target = seats.find(s => s.row === cur.seat.row && s.number === cur.seat.number + 1); break;
        case 'ArrowUp': { const r = String.fromCharCode(cur.seat.row.charCodeAt(0) - 1); target = seats.find(s => s.row === r && s.number === cur.seat.number); break; }
        case 'ArrowDown': { const r = String.fromCharCode(cur.seat.row.charCodeAt(0) + 1); target = seats.find(s => s.row === r && s.number === cur.seat.number); break; }
        case 'Enter': case ' ': if (cur.seat.status !== 'booked') handleSeatClick(cur.seat); break;
        case 'Escape': handleResetView(); break;
      }
      if (target) {
        e.preventDefault();
        const d = seatPositions.find(s => s.seat.id === target!.id);
        if (d) {
          const [x, y, z] = d.position;
          setCameraTarget({ position: new THREE.Vector3(x, y + 1.5, z + 3), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
          setIsAnimating(true); setViewingSeatId(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingSeatId, seats, seatPositions, handleSeatClick]);

  return (
    <div className="relative w-full h-[850px] bg-[#050510] rounded-2xl overflow-hidden shadow-2xl border border-slate-800/50">

      {isYouTube && youtubeId && <YouTubeOverlay videoId={youtubeId} screenRect={screenRect} />}

      {/* TOP LEFT - Movie & Showtime Selection */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5 max-w-[400px]">
        <div className="bg-black/60 backdrop-blur-xl rounded-xl p-3 border border-white/[0.08] shadow-xl">
          <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <Film className="w-3 h-3 text-blue-400" />Now Playing
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {movies.map((m) => (
              <button key={m.id}
                onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(m); }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${selectedMovie.id === m.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]'}`}>
                {m.title}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-xl rounded-xl p-3 border border-white/[0.08] shadow-xl">
          <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3 text-green-400" />Showtime
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {showtimes.map((s) => (
              <button key={s.id}
                onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(s); }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${selectedShowtime.id === s.id
                  ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]'}`}>
                {s.time}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-xl p-3 rounded-xl border border-white/[0.08] shadow-xl">
          <div className="flex gap-3">
            <img src={selectedMovie.image} alt={selectedMovie.title} className="w-14 h-20 object-cover rounded-lg shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/56x80?text=...'; }} />
            <div className="flex-1 min-w-0">
              <h4 className="text-blue-400 font-bold text-sm truncate">{selectedMovie.title}</h4>
              <p className="text-gray-500 text-[11px]">{selectedMovie.duration} · {selectedMovie.rating}</p>
              <p className="text-gray-500 text-[11px]">{selectedMovie.genre}</p>
              <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">{selectedMovie.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP RIGHT - Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} className="bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl">
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (soundEnabled) playSound('success');
            const canvas = document.querySelector('canvas');
            if (canvas) { const a = document.createElement('a'); a.download = `theater-${Date.now()}.png`; a.href = canvas.toDataURL('image/png'); a.click(); }
          }} className="bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl">
            <Camera className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMiniMap(!showMiniMap)}
            className={`bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl ${showMiniMap ? 'ring-1 ring-blue-500' : ''}`}>
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLightsEnabled(!lightsEnabled)}
            className={`bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl ${lightsEnabled ? 'ring-1 ring-yellow-500' : ''}`}>
            <Zap className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex gap-1.5">
          {([
            { mode: 'default' as ViewMode, icon: Eye, tip: 'Default' },
            { mode: 'topdown' as ViewMode, icon: ArrowDown, tip: 'Top' },
            { mode: 'front' as ViewMode, icon: Maximize2, tip: 'Front' },
            { mode: 'side' as ViewMode, icon: ArrowUp, tip: 'Side' }
          ]).map(({ mode, icon: Icon }) => (
            <Button key={mode} variant="outline" size="sm" onClick={() => handleViewMode(mode)}
              className={`bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl ${viewMode === mode ? 'ring-1 ring-blue-500' : ''}`}>
              <Icon className="w-3.5 h-3.5" />
            </Button>
          ))}
        </div>

        {viewingSeatId && (
          <div className="bg-black/60 backdrop-blur-xl text-white px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold">
              Seat {seats.find(s => s.id === viewingSeatId)?.row}{seats.find(s => s.id === viewingSeatId)?.number} View
            </span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Button onClick={() => { if (soundEnabled) playSound('success'); setHighlightedSeats(findBestSeats(4)); setTimeout(() => setHighlightedSeats([]), 5000); }}
            variant="outline" size="sm" className="bg-amber-600/30 hover:bg-amber-600/50 border-amber-500/30 text-amber-200 backdrop-blur-xl">
            <Star className="w-3.5 h-3.5 mr-1.5" />Best Seats
          </Button>
          <Button onClick={handleResetView} variant="outline" size="sm" className="bg-black/40 hover:bg-black/60 border-white/10 text-white backdrop-blur-xl">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
          </Button>
        </div>
      </div>

      {/* BOTTOM LEFT - Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-xl p-3.5 rounded-xl border border-white/[0.08] shadow-xl">
        <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-2"><Info className="w-3 h-3 text-gray-400" />Legend</h3>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
          {[
            ['bg-gray-500', 'Standard'], ['bg-blue-500', 'Premium'], ['bg-purple-500', 'VIP'],
            ['bg-teal-500', 'Accessible'], ['bg-green-500', 'Selected'], ['bg-slate-700', 'Booked'], ['bg-amber-500', 'Recommended']
          ].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
              <span className="text-gray-400 text-[10px]">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM RIGHT - Selection Panel */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/70 backdrop-blur-xl p-4 rounded-xl border border-white/[0.08] shadow-xl min-w-[270px]">
        <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <Ticket className="w-3 h-3 text-green-400" />Your Tickets
        </h3>
        {selectedSeats.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${s.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25' : s.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25' : s.type === 'accessible' ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25' : 'bg-white/[0.06] text-gray-300 border border-white/10'}`}>
                  {s.row}{s.number}<span className="text-gray-500 ml-0.5">${s.price}</span>
                </span>
              ))}
            </div>
            <div className="border-t border-white/[0.08] pt-2.5 space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500">{selectedSeats.length} ticket(s)</span><span className="text-gray-300">${totalPrice.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Fee</span><span className="text-gray-300">$2.50</span></div>
              <div className="flex justify-between text-base font-bold border-t border-white/[0.08] pt-2 mt-1"><span className="text-white">Total</span><span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
            </div>
            <Button onClick={() => setShowBookingModal(true)} className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-bold text-sm">
              <Check className="w-4 h-4 mr-1.5" />Checkout
            </Button>
          </>
        ) : (
          <div className="text-center py-3">
            <Users className="w-7 h-7 text-gray-700 mx-auto mb-1.5" />
            <p className="text-gray-500 text-xs">No seats selected</p>
            <p className="text-gray-600 text-[10px] mt-0.5">Click seats to select</p>
          </div>
        )}
      </div>

      {showMiniMap && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} seatPositions={seatPositions} selectedSeats={selectedSeats.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas ref={canvasRef} shadows camera={{ position: [0, 12, 26], fov: 52 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; }}>

        <CameraController target={cameraTarget} isAnimating={isAnimating} onAnimationComplete={() => setIsAnimating(false)} controlsRef={controlsRef} viewMode={viewMode} />

        <color attach="background" args={['#050510']} />

        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 20, 10]} intensity={0.6} castShadow
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-25} shadow-camera-right={25}
          shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.0001} />
        <directionalLight position={[-10, 16, 10]} intensity={0.25} />

        {/* Subtle ambient fill from screen direction */}
        <rectAreaLight position={[0, SCREEN_Y, SCREEN_Z + 1]} width={20} height={8} intensity={0.8} color="#3b82f6" />

        {isYouTube && <ScreenPositionTracker onPositionUpdate={handleScreenPositionUpdate} />}

        {isYouTube ? (
          <Screen3D videoUrl={selectedMovie.video} movieTitle={selectedMovie.title} isYouTube={true} />
        ) : (
          <Screen3DWithVideo videoUrl={selectedMovie.video} movieTitle={selectedMovie.title} />
        )}

        <RowLabels rows={rows} />
        <TheaterEnvironment lightsEnabled={lightsEnabled} />

        {seatPositions.map(({ seat, position }) => (
          <Seat3D key={seat.id} seat={seat} position={position} onClick={handleSeatClick} onHover={handleSeatHover}
            isHighlighted={highlightedSeats.includes(seat.id)} soundEnabled={soundEnabled} playSound={playSound} />
        ))}

        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        <OrbitControls ref={controlsRef} minDistance={3} maxDistance={50} maxPolarAngle={Math.PI / 2.05}
          target={[0, 3, 0]} enableDamping dampingFactor={0.04} rotateSpeed={0.5} />
      </Canvas>

      <BookingModal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)} onConfirm={() => {
        if (soundEnabled) playSound('success'); setShowBookingModal(false); alert('Booking confirmed!');
      }} selectedSeats={selectedSeats} movie={selectedMovie} showtime={selectedShowtime} totalPrice={totalPrice} />
    </div>
  );
}
