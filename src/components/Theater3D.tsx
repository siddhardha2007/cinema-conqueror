import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Star, Zap, Users, Info,
  AlertCircle, X, Check, Maximize2, ChevronDown, ChevronRight,
  Armchair, Sparkles, Sun, SunDim
} from 'lucide-react';

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

// --- CONSTANTS ---
const SCREEN_Z = -14;
const SCREEN_Y = 6.5;
const SCREEN_WIDTH = 20;
const SCREEN_HEIGHT = 8.5;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 8, 20);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 3, 0);

const SEAT_COLORS = {
  standard: { base: '#6b7280', hover: '#9ca3af', selected: '#22c55e', booked: '#374151' },
  premium: { base: '#3b82f6', hover: '#60a5fa', selected: '#22c55e', booked: '#374151' },
  vip: { base: '#a855f7', hover: '#c084fc', selected: '#22c55e', booked: '#374151' },
  accessible: { base: '#14b8a6', hover: '#2dd4bf', selected: '#22c55e', booked: '#374151' },
};

// --- DATA ---
const movies = [
  {
    id: '1', title: "The Dark Knight",
    image: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911BTUgMe1YdBGm.jpg",
    video: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
    description: "Batman faces the Joker, a criminal mastermind who wants to plunge Gotham into anarchy.",
    duration: "2h 32m", rating: "PG-13", genre: "Action • Crime • Drama"
  },
  {
    id: '2', title: "Inception",
    image: "https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg",
    video: "https://www.youtube.com/watch?v=YoHD9XEInc0",
    description: "A thief who steals secrets through dream-sharing is given the task of planting an idea.",
    duration: "2h 28m", rating: "PG-13", genre: "Sci-Fi • Action"
  },
  {
    id: '3', title: "Interstellar",
    image: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    video: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
    description: "Explorers travel through a wormhole in an attempt to ensure humanity's survival.",
    duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi • Adventure"
  },
  {
    id: '4', title: "Oppenheimer",
    image: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    video: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    description: "The story of J. Robert Oppenheimer and his role in developing the atomic bomb.",
    duration: "3h 00m", rating: "R", genre: "Biography • Drama"
  }
];

const showtimes = [
  { id: '1', time: '10:00 AM', label: 'Morning' },
  { id: '2', time: '1:30 PM', label: 'Matinee' },
  { id: '3', time: '4:00 PM', label: 'Afternoon' },
  { id: '4', time: '7:00 PM', label: 'Evening' },
  { id: '5', time: '9:30 PM', label: 'Late Night' },
];

// --- HELPERS ---
function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([^#&?]{11})/);
  return m ? m[1] : null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- AUDIO ---
const useAudio = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freqs: Record<string, number[]> = {
      click: [500, 700], select: [600, 900], hover: [400],
      success: [523, 659, 784], error: [200, 150]
    };
    const f = freqs[type];
    osc.frequency.value = f[0];
    osc.type = type === 'error' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    if (f.length > 1) {
      f.slice(1).forEach((freq, i) => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = freq; o2.type = 'sine';
        g2.gain.setValueAtTime(0.06, ctx.currentTime + (i + 1) * 0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * 0.08 + 0.12);
        o2.start(ctx.currentTime + (i + 1) * 0.08);
        o2.stop(ctx.currentTime + (i + 1) * 0.08 + 0.12);
      });
    }
  }, []);
  return { playSound };
};

// --- SCREEN POSITION TRACKER ---
function ScreenPositionTracker({
  onUpdate
}: {
  onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void;
}) {
  const { camera, gl } = useThree();
  const lastRef = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });

  useFrame(() => {
    const hw = SCREEN_WIDTH / 2;
    const hh = SCREEN_HEIGHT / 2;
    const sz = SCREEN_Z + 0.05;
    const corners3D = [
      new THREE.Vector3(-hw, SCREEN_Y + hh, sz),
      new THREE.Vector3(hw, SCREEN_Y + hh, sz),
      new THREE.Vector3(-hw, SCREEN_Y - hh, sz),
      new THREE.Vector3(hw, SCREEN_Y - hh, sz),
    ];

    const center3D = new THREE.Vector3(0, SCREEN_Y, sz);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toScreen = center3D.clone().sub(camera.position).normalize();
    const visible = camDir.dot(toScreen) > 0.1;

    const canvas = gl.domElement;
    const cRect = canvas.getBoundingClientRect();

    const pts = corners3D.map(c => {
      const p = c.clone().project(camera);
      return {
        x: ((p.x + 1) / 2) * cRect.width,
        y: ((-p.y + 1) / 2) * cRect.height,
      };
    });

    const l = Math.min(...pts.map(p => p.x));
    const t = Math.min(...pts.map(p => p.y));
    const r = Math.max(...pts.map(p => p.x));
    const b = Math.max(...pts.map(p => p.y));

    const pad = 2;
    const result = {
      left: l + cRect.left + pad,
      top: t + cRect.top + pad,
      width: Math.max(0, r - l - pad * 2),
      height: Math.max(0, b - t - pad * 2),
      visible: visible && (r - l) > 40 && (b - t) > 25,
    };

    const prev = lastRef.current;
    if (
      Math.abs(prev.left - result.left) > 0.5 ||
      Math.abs(prev.top - result.top) > 0.5 ||
      Math.abs(prev.width - result.width) > 0.5 ||
      Math.abs(prev.height - result.height) > 0.5 ||
      prev.visible !== result.visible
    ) {
      lastRef.current = result;
      onUpdate(result);
    }
  });

  return null;
}

// --- CAMERA CONTROLLER ---
function CameraController({
  target, isAnimating, onDone, controlsRef
}: {
  target: CameraTarget; isAnimating: boolean; onDone: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  const startPosRef = useRef(new THREE.Vector3());
  const startTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (isAnimating) {
      progressRef.current = 0;
      startPosRef.current.copy(camera.position);
      if (controlsRef.current) startTargetRef.current.copy(controlsRef.current.target);
    }
  }, [isAnimating, target, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    progressRef.current = Math.min(progressRef.current + delta * 1.2, 1);
    const t = easeInOutCubic(progressRef.current);

    camera.position.lerpVectors(startPosRef.current, target.position, t);

    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTargetRef.current, target.lookAt, t);
      controlsRef.current.update();
    }

    if (progressRef.current >= 1) {
      progressRef.current = 0;
      onDone();
    }
  });

  return null;
}

// --- THEATER SEAT 3D ---
function Seat3D({
  seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound
}: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Group>(null);
  const foldRef = useRef(0);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors = SEAT_COLORS[seat.type];

  useFrame((_, delta) => {
    const targetFold = isSelected ? 1 : 0;
    foldRef.current += (targetFold - foldRef.current) * delta * 5;
    if (meshRef.current) {
      const s = hovered && !isBooked ? 1.06 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), delta * 8);
    }
  });

  const color = isBooked ? colors.booked : isSelected ? colors.selected :
    isHighlighted ? '#f59e0b' : hovered ? colors.hover : colors.base;
  const emissive = isSelected ? 0.35 : isHighlighted ? 0.25 : hovered && !isBooked ? 0.15 : 0.05;

  return (
    <group ref={meshRef} position={position}>
      {/* Seat base / cushion */}
      <RoundedBox
        args={[0.85, 0.18, 0.7]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.09 - foldRef.current * 0.08, -foldRef.current * 0.05]}
        rotation={[foldRef.current * 0.35, 0, 0]}
        castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); } else if (soundEnabled) playSound('error'); }}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); if (soundEnabled && !isBooked) playSound('hover'); document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer'; onHover(seat, position); }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; onHover(null); }}
      >
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} emissive={color} emissiveIntensity={emissive} />
      </RoundedBox>

      {/* Seat back */}
      <RoundedBox args={[0.85, 0.65, 0.12]} radius={0.05} smoothness={4}
        position={[0, 0.42, 0.34]} castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); } }}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer'; onHover(seat, position); }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; onHover(null); }}
      >
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} emissive={color} emissiveIntensity={emissive} />
      </RoundedBox>

      {/* Left armrest */}
      <mesh position={[-0.48, 0.22, 0.08]} castShadow>
        <boxGeometry args={[0.08, 0.14, 0.56]} />
        <meshStandardMaterial color="#1e1e2e" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Right armrest */}
      <mesh position={[0.48, 0.22, 0.08]} castShadow>
        <boxGeometry args={[0.08, 0.14, 0.56]} />
        <meshStandardMaterial color="#1e1e2e" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Cup holder */}
      <mesh position={[0.48, 0.3, -0.22]}>
        <cylinderGeometry args={[0.06, 0.05, 0.04, 12]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Seat number label */}
      <Text position={[0, 0.22, -0.05]} fontSize={0.12} color={isBooked ? '#555' : '#ddd'}
        anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}
        font={undefined}
      >
        {seat.number}
      </Text>

      {/* VIP crown indicator */}
      {seat.type === 'vip' && (
        <group position={[0, 0.82, 0.34]}>
          <mesh>
            <octahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      )}

      {/* Accessible indicator */}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.82, 0.34]}>
          <torusGeometry args={[0.07, 0.025, 8, 16]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>
      )}

      {/* Selection glow */}
      {isSelected && <pointLight position={[0, 0.5, 0.1]} intensity={0.6} distance={2} color="#22c55e" />}
      {isHighlighted && !isSelected && <pointLight position={[0, 0.5, 0.1]} intensity={0.4} distance={1.8} color="#f59e0b" />}
    </group>
  );
}

// --- SEAT TOOLTIP ---
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const typeLabel: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const typeBg: Record<string, string> = { standard: 'bg-gray-600', premium: 'bg-blue-600', vip: 'bg-purple-600', accessible: 'bg-teal-600' };

  return (
    <Html position={[position[0], position[1] + 1.6, position[2]]} center distanceFactor={12}>
      <div className="bg-gray-950/95 backdrop-blur-xl text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 min-w-[190px] pointer-events-none select-none"
        style={{ transform: 'translateY(-10px)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base tracking-tight">
            Row {seat.row} · Seat {seat.number}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeBg[seat.type]} text-white`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm mb-1">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-emerald-400 text-base">${seat.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
          </span>
        </div>
        {!isBooked && (
          <div className="mt-2 pt-2 border-t border-white/10 text-center text-[11px] text-gray-500">
            Click to {isSelected ? 'deselect' : 'select'}
          </div>
        )}
        <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-gray-950/95 rotate-45 border-r border-b border-white/10" />
      </div>
    </Html>
  );
}

// --- THEATER SCREEN ---
function TheaterScreen({ movieTitle }: { movieTitle: string }) {
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.intensity = 2 + Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Back wall behind screen */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[36, 18]} />
        <meshStandardMaterial color="#050510" roughness={0.98} />
      </mesh>

      {/* Screen frame outer */}
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[SCREEN_WIDTH + 1.6, SCREEN_HEIGHT + 1.2]} />
        <meshStandardMaterial color="#0a0a1f" roughness={0.7} metalness={0.4} />
      </mesh>

      {/* Screen frame inner bevel */}
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.6, SCREEN_HEIGHT + 0.4]} />
        <meshStandardMaterial color="#111133" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Screen surface - dark for YouTube overlay */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#0a0a0f" />
      </mesh>

      {/* Screen glow lights */}
      <pointLight ref={glowRef} position={[0, 0, 4]} intensity={2} distance={30} color="#4466cc" />
      <pointLight position={[-8, 0, 3]} intensity={0.8} distance={14} color="#6366f1" />
      <pointLight position={[8, 0, 3]} intensity={0.8} distance={14} color="#6366f1" />

      {/* === CURTAINS === */}
      {/* Left curtain */}
      <group position={[-SCREEN_WIDTH / 2 - 2.5, 0, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={`cl${i}`} position={[i * 0.7 - 1.5, 0, Math.sin(i * 0.8) * 0.15]} castShadow>
            <boxGeometry args={[0.75, SCREEN_HEIGHT + 4, 0.35 + Math.sin(i * 1.2) * 0.1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#7f1d1d' : '#991b1b'}
              roughness={0.92} metalness={0.02}
            />
          </mesh>
        ))}
      </group>

      {/* Right curtain */}
      <group position={[SCREEN_WIDTH / 2 + 2.5, 0, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={`cr${i}`} position={[-i * 0.7 + 1.5, 0, Math.sin(i * 0.8) * 0.15]} castShadow>
            <boxGeometry args={[0.75, SCREEN_HEIGHT + 4, 0.35 + Math.sin(i * 1.2) * 0.1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#7f1d1d' : '#991b1b'}
              roughness={0.92} metalness={0.02}
            />
          </mesh>
        ))}
      </group>

      {/* Top valance / pelmet */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 1.8, 0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 10, 2.2, 0.8]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Valance bottom scallop trim */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={`sc${i}`} position={[(i - 5.5) * 2.3, SCREEN_HEIGHT / 2 + 0.6, 0.35]}>
          <sphereGeometry args={[0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#991b1b" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Title text */}
      <Text position={[0, -SCREEN_HEIGHT / 2 - 1.2, 0.3]} fontSize={0.55} color="#475569"
        anchorX="center" anchorY="middle" letterSpacing={0.15}>
        {`NOW SHOWING — ${movieTitle.toUpperCase()}`}
      </Text>
    </group>
  );
}

// --- WALL SCONCE LIGHT ---
function WallSconce({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Bracket */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.4, 0.15]} />
        <meshStandardMaterial color="#b8860b" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Shade */}
      <mesh position={[0, 0.15, 0.12]}>
        <cylinderGeometry args={[0.15, 0.22, 0.3, 8, 1, true]} />
        <meshStandardMaterial color="#f5e6d3" roughness={0.7} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Light */}
      <pointLight position={[0, 0.1, 0.2]} intensity={0.5} distance={6} color="#ffcc88" />
    </group>
  );
}

// --- ACOUSTIC WALL PANEL ---
function AcousticPanel({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0], size[1], 0.15]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// --- THEATER ENVIRONMENT ---
function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();
  const ceilingLightsRef = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#06060f', 0.012);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    if (ceilingLightsRef.current) {
      ceilingLightsRef.current.children.forEach(child => {
        child.traverse(obj => {
          if (obj instanceof THREE.PointLight) {
            const target = lightsOn ? 0.8 : 0.08;
            obj.intensity += (target - obj.intensity) * delta * 3;
          }
        });
      });
    }
  });

  return (
    <group>
      {/* === FLOOR === */}
      <mesh position={[0, -0.01, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 60]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Carpet strip down the aisle */}
      <mesh position={[0, 0.001, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.5, 25]} />
        <meshStandardMaterial color="#1a0a0a" roughness={0.98} />
      </mesh>

      {/* === WALLS === */}
      {/* Left wall */}
      <mesh position={[-17, 6, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 16]} />
        <meshStandardMaterial color="#0e0e1e" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Right wall */}
      <mesh position={[17, 6, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 16]} />
        <meshStandardMaterial color="#0e0e1e" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 6, 24]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[36, 16]} />
        <meshStandardMaterial color="#0a0a18" roughness={0.92} />
      </mesh>

      {/* === CEILING === */}
      <mesh position={[0, 13, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[36, 42]} />
        <meshStandardMaterial color="#050510" roughness={0.98} />
      </mesh>

      {/* === ACOUSTIC PANELS ON WALLS === */}
      {[-17, 17].map((x, wi) => (
        <group key={`wall${wi}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <AcousticPanel
              key={`ap${wi}_${i}`}
              position={[x + (wi === 0 ? 0.1 : -0.1), 5.5, -8 + i * 7]}
              size={[0.1, 5]}
            />
          ))}
        </group>
      ))}

      {/* === WALL SCONCES === */}
      {Array.from({ length: 5 }, (_, i) => (
        <React.Fragment key={`sconce${i}`}>
          <WallSconce position={[-16.8, 6, -6 + i * 7]} rotation={[0, Math.PI / 2, 0]} />
          <WallSconce position={[16.8, 6, -6 + i * 7]} rotation={[0, -Math.PI / 2, 0]} />
        </React.Fragment>
      ))}

      {/* === STADIUM STEPS === */}
      {Array.from({ length: 10 }, (_, i) => {
        const z = i * 1.8 + 1.5;
        const y = i * 0.4;
        return (
          <group key={`step${i}`}>
            {/* Step platform */}
            <mesh position={[0, y, z]} receiveShadow castShadow>
              <boxGeometry args={[32, 0.45, 1.8]} />
              <meshStandardMaterial color="#12121f" roughness={0.88} metalness={0.08} />
            </mesh>
            {/* Step riser face */}
            <mesh position={[0, y + 0.22, z + 0.9]} receiveShadow>
              <boxGeometry args={[32, 0.45, 0.02]} />
              <meshStandardMaterial color="#0e0e1a" roughness={0.9} />
            </mesh>
            {/* LED step light strip */}
            <mesh position={[0, y + 0.24, z + 0.88]}>
              <boxGeometry args={[28, 0.015, 0.02]} />
              <meshBasicMaterial color="#1e3a5f" toneMapped={false} />
            </mesh>
            {/* Aisle marker lights */}
            {[-1.2, 1.2].map((ax, j) => (
              <group key={`am${i}_${j}`} position={[ax, y + 0.25, z + 0.6]}>
                <mesh>
                  <sphereGeometry args={[0.03, 8, 8]} />
                  <meshBasicMaterial color="#3b82f6" toneMapped={false} />
                </mesh>
                <pointLight intensity={0.15} distance={1.2} color="#3b82f6" />
              </group>
            ))}
          </group>
        );
      })}

      {/* === EXIT SIGNS === */}
      {[[-16, 5.5, 20], [16, 5.5, 20]].map((pos, i) => (
        <group key={`exit${i}`} position={pos as [number, number, number]}>
          <RoundedBox args={[1.6, 0.5, 0.08]} radius={0.05}>
            <meshBasicMaterial color="#16a34a" toneMapped={false} />
          </RoundedBox>
          <Text position={[0, 0, 0.05]} fontSize={0.22} color="#ffffff" anchorX="center" fontWeight="bold">
            EXIT
          </Text>
          <pointLight position={[0, 0, 0.4]} intensity={0.3} distance={3} color="#22c55e" />
        </group>
      ))}

      {/* === CEILING LIGHTS === */}
      <group ref={ceilingLightsRef}>
        {[
          [-10, 12.8, 0], [0, 12.8, 0], [10, 12.8, 0],
          [-10, 12.8, 8], [0, 12.8, 8], [10, 12.8, 8],
          [-10, 12.8, 16], [0, 12.8, 16], [10, 12.8, 16],
        ].map((pos, i) => (
          <group key={`cl${i}`} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.25, 0.35, 0.15, 12]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.5} />
            </mesh>
            <pointLight intensity={lightsOn ? 0.8 : 0.08} distance={10} color="#ffe4b5" />
          </group>
        ))}
      </group>

      {/* === PROJECTOR BOOTH === */}
      <group position={[0, 11.5, 22]}>
        <mesh castShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#111122" roughness={0.7} metalness={0.3} />
        </mesh>
        {/* Projector window */}
        <mesh position={[0, -0.5, -2.01]}>
          <planeGeometry args={[2, 0.8]} />
          <meshBasicMaterial color="#0a1628" />
        </mesh>
        {/* Projector lens */}
        <mesh position={[0, -0.5, -2.05]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Projector beam */}
        <spotLight
          position={[0, -0.5, -2.1]}
          angle={0.2}
          penumbra={0.6}
          intensity={1.5}
          distance={40}
          color="#c7d2fe"
          target-position={[0, SCREEN_Y, SCREEN_Z]}
        />
      </group>

      {/* === SPEAKER GRILLS === */}
      {[-16.5, 16.5].map((x, si) => (
        <group key={`spk${si}`}>
          {[SCREEN_Y - 2, SCREEN_Y + 2].map((y, yi) => (
            <group key={`sp${si}_${yi}`} position={[x, y, SCREEN_Z + 2]}>
              <RoundedBox args={[0.6, 1.8, 0.8]} radius={0.08}>
                <meshStandardMaterial color="#111" roughness={0.8} metalness={0.3} />
              </RoundedBox>
              {/* Speaker grill dots */}
              {Array.from({ length: 3 }, (_, di) => (
                <mesh key={di} position={[si === 0 ? 0.31 : -0.31, -0.5 + di * 0.5, 0]}>
                  <circleGeometry args={[0.12, 16]} />
                  <meshStandardMaterial color="#222" roughness={0.6} metalness={0.4} side={si === 0 ? THREE.FrontSide : THREE.BackSide} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* === SUBTLE CEILING STARS === */}
      {useMemo(() => Array.from({ length: 40 }, (_, i) => {
        const x = (Math.random() - 0.5) * 30;
        const z = (Math.random() - 0.5) * 35 + 5;
        return (
          <mesh key={`star${i}`} position={[x, 12.7, z]}>
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshBasicMaterial color="#334155" toneMapped={false} />
          </mesh>
        );
      }), [])}
    </group>
  );
}

// --- ROW LABELS ---
function RowLabels({ rows, seatsByRow }: { rows: string[]; seatsByRow: Record<string, Seat[]> }) {
  return (
    <group>
      {rows.map((row, index) => {
        const z = index * 1.8 + 1.5;
        const y = index * 0.4 + 0.5;
        return (
          <group key={row}>
            <Text position={[-14.5, y, z]} fontSize={0.5} color="#3b82f6"
              anchorX="center" anchorY="middle" rotation={[0, 0.15, 0]}
            >
              {row}
            </Text>
            <Text position={[14.5, y, z]} fontSize={0.5} color="#3b82f6"
              anchorX="center" anchorY="middle" rotation={[0, -0.15, 0]}
            >
              {row}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// --- YOUTUBE OVERLAY ---
function YouTubeOverlay({ videoId, rect }: { videoId: string; rect: { left: number; top: number; width: number; height: number; visible: boolean } }) {
  if (!rect.visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: 5,
        pointerEvents: 'auto',
        overflow: 'hidden',
        borderRadius: 3,
        backgroundColor: '#000',
      }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0&showinfo=0`}
        title="Movie trailer"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// --- MINIMAP ---
function MiniMap({ seats, selectedIds, onSeatClick }: {
  seats: Seat[]; selectedIds: string[]; onSeatClick: (s: Seat) => void;
}) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const dotColor = (s: Seat) => {
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-700';
    if (selectedIds.includes(s.id)) return 'bg-emerald-500 ring-1 ring-emerald-300';
    if (s.type === 'vip') return 'bg-purple-500';
    if (s.type === 'premium') return 'bg-blue-500';
    if (s.type === 'accessible') return 'bg-teal-500';
    return 'bg-slate-400';
  };

  return (
    <div className="bg-black/80 backdrop-blur-xl p-3 rounded-xl border border-white/10">
      <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full mb-3" />
      <p className="text-[9px] text-center text-slate-500 mb-2 tracking-widest uppercase">Screen</p>
      <div className="space-y-1">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-0.5">
            <span className="text-[7px] text-slate-600 w-2.5 text-right">{row}</span>
            <div className="flex gap-[2px]">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={seat.status === 'booked' || seat.isBooked}
                  className={`w-[6px] h-[6px] rounded-[1px] transition-all hover:scale-[2] ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, total }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; selectedSeats: Seat[];
  movie: typeof movies[0]; showtime: typeof showtimes[0]; total: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-emerald-400" />
            </div>
            Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Movie info */}
          <div className="bg-white/5 rounded-xl p-3 flex gap-3">
            <img src={movie.image} alt={movie.title}
              className="w-14 h-20 object-cover rounded-lg shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex-1">
              <h4 className="text-white font-semibold">{movie.title}</h4>
              <p className="text-gray-500 text-xs mt-0.5">{movie.genre}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{movie.duration}</span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">{movie.rating}</span>
              </div>
            </div>
          </div>

          {/* Showtime */}
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm font-medium">{showtime.time}</span>
            <span className="text-gray-500 text-xs">· {showtime.label}</span>
          </div>

          {/* Seats */}
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Selected Seats</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedSeats.map(seat => (
                <span key={seat.id}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    seat.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                    seat.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                    seat.type === 'accessible' ? 'bg-teal-500/15 text-teal-300 border-teal-500/30' :
                    'bg-white/5 text-gray-300 border-white/10'
                  }`}>
                  {seat.row}{seat.number}
                  <span className="text-gray-500 ml-1">${seat.price}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Price breakdown */}
          <div className="border-t border-white/10 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{selectedSeats.length} × Ticket{selectedSeats.length > 1 ? 's' : ''}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Service fee</span><span>$2.50</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/10">
              <span>Total</span>
              <span className="text-emerald-400">${(total + 2.5).toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
              <CreditCard className="w-4 h-4" /> Pay Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[3]);
  const [hoveredSeat, setHoveredSeat] = useState<{ seat: Seat; position: [number, number, number] } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [highlightedSeats, setHighlightedSeats] = useState<string[]>([]);
  const [lightsOn, setLightsOn] = useState(false);
  const [screenRect, setScreenRect] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });
  const [showGuide, setShowGuide] = useState(false);
  const [showMoviePanel, setShowMoviePanel] = useState(true);

  const controlsRef = useRef<any>(null);
  const { playSound } = useAudio();

  const youtubeId = useMemo(() => getYouTubeId(selectedMovie.video), [selectedMovie.video]);
  const selectedSeats = useMemo(() => seats.filter(s => s.status === 'selected' || s.isSelected), [seats]);
  const totalPrice = useMemo(() => selectedSeats.reduce((sum, s) => sum + s.price, 0), [selectedSeats]);
  const rows = useMemo(() => [...new Set(seats.map(s => s.row))].sort(), [seats]);

  const seatsByRow = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return m;
  }, [seats]);

  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const sortedRows = Object.keys(seatsByRow).sort();
    sortedRows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.8 + 1.5;
      const rowY = rowIndex * 0.4 + 0.25;
      const totalWidth = rowSeats.length * 1.05;

      rowSeats.forEach((seat, seatIndex) => {
        // Slight curve: seats at edges are pushed back slightly
        const normalizedX = (seatIndex - (rowSeats.length - 1) / 2) / (rowSeats.length / 2);
        const curvePush = Math.abs(normalizedX) * Math.abs(normalizedX) * 0.4;

        // Aisle gap in the middle
        let aisleOffset = 0;
        const mid = Math.floor(rowSeats.length / 2);
        if (seatIndex >= mid) aisleOffset = 1.4;

        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.05 + (seatIndex >= mid ? 0.7 : -0.7);
        positions.push({ seat, position: [seatX, rowY, rowZ + curvePush] });
      });
    });
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count: number = 4) => {
    const available = seatPositions.filter(({ seat }) => seat.status === 'available' && !seat.isBooked);
    const scored = available.map(({ seat, position }) => {
      const centerScore = 14 - Math.abs(position[0]);
      const rowScore = 10 - Math.abs(3 - position[2] / 1.8);
      const typeBonus = seat.type === 'premium' ? 3 : seat.type === 'vip' ? 5 : 0;
      return { seat, score: centerScore + rowScore + typeBonus };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.seat.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);
    const sd = seatPositions.find(s => s.seat.id === seat.id);
    if (sd) {
      const [x, y, z] = sd.position;
      setCameraTarget({
        position: new THREE.Vector3(x * 0.3, y + 2, z + 3.5),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = useCallback((seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) setHoveredSeat({ seat, position });
    else setHoveredSeat(null);
  }, []);

  const resetView = () => {
    if (soundEnabled) playSound('click');
    setCameraTarget({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  };

  const changeView = (mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);
    const views: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 26, 8), lookAt: new THREE.Vector3(0, 0, 6) },
      front: { position: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z + 6), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side: { position: new THREE.Vector3(26, 8, 6), lookAt: new THREE.Vector3(0, 3, 4) },
    };
    setCameraTarget(views[mode]);
    setIsAnimating(true);
  };

  const recommendSeats = () => {
    if (soundEnabled) playSound('success');
    const best = findBestSeats(4);
    setHighlightedSeats(best);
    setTimeout(() => setHighlightedSeats([]), 6000);
  };

  const takeScreenshot = () => {
    if (soundEnabled) playSound('success');
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `theater-view-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleScreenUpdate = useCallback((r: { left: number; top: number; width: number; height: number; visible: boolean }) => {
    setScreenRect(prev => {
      if (Math.abs(prev.left - r.left) > 0.8 || Math.abs(prev.top - r.top) > 0.8 ||
        Math.abs(prev.width - r.width) > 0.8 || Math.abs(prev.height - r.height) > 0.8 ||
        prev.visible !== r.visible) return r;
      return prev;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!viewingSeatId) return;
      const current = seatPositions.find(s => s.seat.id === viewingSeatId);
      if (!current) return;
      let target: Seat | undefined;
      switch (e.key) {
        case 'ArrowLeft': target = seats.find(s => s.row === current.seat.row && s.number === current.seat.number - 1); break;
        case 'ArrowRight': target = seats.find(s => s.row === current.seat.row && s.number === current.seat.number + 1); break;
        case 'ArrowUp': target = seats.find(s => s.row === String.fromCharCode(current.seat.row.charCodeAt(0) - 1) && s.number === current.seat.number); break;
        case 'ArrowDown': target = seats.find(s => s.row === String.fromCharCode(current.seat.row.charCodeAt(0) + 1) && s.number === current.seat.number); break;
        case 'Escape': resetView(); return;
      }
      if (target) {
        e.preventDefault();
        const td = seatPositions.find(s => s.seat.id === target!.id);
        if (td) {
          const [x, y, z] = td.position;
          setCameraTarget({ position: new THREE.Vector3(x * 0.3, y + 2, z + 3.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
          setIsAnimating(true);
          setViewingSeatId(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingSeatId, seats, seatPositions]);

  const viewingSeat = viewingSeatId ? seats.find(s => s.id === viewingSeatId) : null;

  return (
    <div className="relative w-full h-[850px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800/50">

      {/* YouTube overlay */}
      {youtubeId && <YouTubeOverlay videoId={youtubeId} rect={screenRect} />}

      {/* ======= TOP BAR ======= */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-3 pb-8 px-4">
          <div className="flex items-start justify-between gap-4">

            {/* Left: Movie + Showtime selection */}
            <div className="flex-1 max-w-[520px]">
              <button
                onClick={() => setShowMoviePanel(!showMoviePanel)}
                className="flex items-center gap-2 text-white mb-2 group"
              >
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors">
                  Select Movie & Showtime
                </span>
                {showMoviePanel
                  ? <ChevronDown className="w-3 h-3 text-gray-500" />
                  : <ChevronRight className="w-3 h-3 text-gray-500" />
                }
              </button>

              {showMoviePanel && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Movie carousel */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {movies.map(movie => (
                      <button key={movie.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                        className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border
                          ${selectedMovie.id === movie.id
                            ? 'bg-blue-600/30 border-blue-500/50 text-white shadow-lg shadow-blue-500/10'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        <img src={movie.image} alt="" className="w-6 h-8 object-cover rounded"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="whitespace-nowrap">{movie.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Showtime pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {showtimes.map(st => (
                      <button key={st.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(st); }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border
                          ${selectedShowtime.id === st.id
                            ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        <span>{st.time}</span>
                      </button>
                    ))}
                  </div>

                  {/* Now playing info strip */}
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                    <img src={selectedMovie.image} alt="" className="w-8 h-11 object-cover rounded-md shadow"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{selectedMovie.title}</p>
                      <p className="text-gray-500 text-[10px]">{selectedMovie.genre} · {selectedMovie.duration}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold flex-shrink-0">
                      {selectedMovie.rating}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                {[
                  { icon: soundEnabled ? Volume2 : VolumeX, onClick: () => setSoundEnabled(!soundEnabled), active: soundEnabled, tip: 'Sound' },
                  { icon: Camera, onClick: takeScreenshot, tip: 'Screenshot' },
                  { icon: Grid3X3, onClick: () => setShowMiniMap(!showMiniMap), active: showMiniMap, tip: 'Map' },
                  { icon: lightsOn ? Sun : SunDim, onClick: () => setLightsOn(!lightsOn), active: lightsOn, tip: 'Lights' },
                ].map(({ icon: Icon, onClick, active, tip }, i) => (
                  <button key={i} onClick={onClick} title={tip}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border text-xs
                      ${active ? 'bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* View modes */}
              <div className="flex gap-1.5">
                {([
                  { mode: 'default' as ViewMode, label: 'Free', icon: Eye },
                  { mode: 'topdown' as ViewMode, label: 'Top', icon: Maximize2 },
                  { mode: 'front' as ViewMode, label: 'Front', icon: Film },
                  { mode: 'side' as ViewMode, label: 'Side', icon: Armchair },
                ]).map(({ mode, label, icon: Icon }) => (
                  <button key={mode} onClick={() => changeView(mode)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all border flex items-center gap-1
                      ${viewMode === mode
                        ? 'bg-white/15 border-white/20 text-white'
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                      }`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5">
                <button onClick={recommendSeats}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Best Seats
                </button>
                <button onClick={resetView}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======= VIEWING INDICATOR ======= */}
      {viewingSeat && (
        <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-20">
          <div className="bg-blue-600/20 backdrop-blur-xl text-white px-5 py-2 rounded-full flex items-center gap-2 border border-blue-500/30 shadow-lg">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold">
              Viewing from <span className="text-blue-300">Row {viewingSeat.row} · Seat {viewingSeat.number}</span>
            </span>
            <span className="text-gray-500 text-[10px]">· Use arrow keys to navigate</span>
          </div>
        </div>
      )}

      {/* ======= LEFT: SEAT GUIDE ======= */}
      <div className="absolute left-3 bottom-3 z-10">
        <button onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all text-[11px] font-medium mb-2">
          <Info className="w-3 h-3" /> Seat Guide
          {showGuide ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {showGuide && (
          <div className="bg-black/80 backdrop-blur-xl p-3 rounded-xl border border-white/10 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
              {[
                ['#6b7280', 'Standard'],
                ['#3b82f6', 'Premium'],
                ['#a855f7', 'VIP'],
                ['#14b8a6', 'Accessible'],
                ['#22c55e', 'Selected'],
                ['#374151', 'Booked'],
                ['#f59e0b', 'Recommended'],
              ].map(([color, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-400 text-[11px]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ======= MINIMAP ======= */}
      {showMiniMap && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} selectedIds={selectedSeats.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* ======= RIGHT: BOOKING PANEL ======= */}
      <div className="absolute right-3 bottom-3 z-10">
        <div className="bg-black/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-xl w-[260px]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
            <Ticket className="w-3 h-3 text-emerald-500" /> Your Tickets
          </h3>
          {selectedSeats.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedSeats.map(seat => (
                  <span key={seat.id}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border
                      ${seat.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                        seat.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                        seat.type === 'accessible' ? 'bg-teal-500/15 text-teal-300 border-teal-500/25' :
                        'bg-white/5 text-gray-300 border-white/10'}`}>
                    {seat.row}{seat.number}
                    <span className="text-gray-500 ml-1 text-[10px]">${seat.price}</span>
                  </span>
                ))}
              </div>

              <div className="space-y-1 text-xs border-t border-white/10 pt-2.5">
                <div className="flex justify-between text-gray-400">
                  <span>{selectedSeats.length} ticket{selectedSeats.length > 1 ? 's' : ''}</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Service fee</span><span>$2.50</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-emerald-400">${(totalPrice + 2.5).toFixed(2)}</span>
                </div>
              </div>

              <button onClick={() => setShowBookingModal(true)}
                className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                <Check className="w-4 h-4" /> Checkout
              </button>
            </>
          ) : (
            <div className="text-center py-5">
              <Armchair className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">No seats selected</p>
              <p className="text-gray-600 text-[10px] mt-1">Click on an available seat to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* ======= 3D CANVAS ======= */}
      <Canvas
        shadows
        camera={{ position: [DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z], fov: 50, near: 0.5, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        style={{ background: '#050508' }}
      >
        <CameraController
          target={cameraTarget}
          isAnimating={isAnimating}
          onDone={() => setIsAnimating(false)}
          controlsRef={controlsRef}
        />

        {/* Ambient fill - very low for theater darkness */}
        <ambientLight intensity={0.15} color="#b0c4de" />

        {/* Main directional (simulates general overhead) */}
        <directionalLight
          position={[0, 15, 5]}
          intensity={0.3}
          color="#e8d5b7"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.001}
        />

        {/* Fill from screen direction */}
        <directionalLight position={[0, SCREEN_Y, SCREEN_Z + 5]} intensity={0.15} color="#6366f1" />

        {/* Track 3D screen position for YouTube overlay */}
        {youtubeId && <ScreenPositionTracker onUpdate={handleScreenUpdate} />}

        {/* Theater screen */}
        <TheaterScreen movieTitle={selectedMovie.title} />

        {/* Row labels */}
        <RowLabels rows={rows} seatsByRow={seatsByRow} />

        {/* Theater environment */}
        <TheaterEnvironment lightsOn={lightsOn} />

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

        {/* Hovered seat tooltip */}
        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        {/* Orbit controls */}
        <OrbitControls
          ref={controlsRef}
          minDistance={3}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.1}
          target={[DEFAULT_LOOK_AT.x, DEFAULT_LOOK_AT.y, DEFAULT_LOOK_AT.z]}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
      </Canvas>

      {/* Booking modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={() => {
          if (soundEnabled) playSound('success');
          setShowBookingModal(false);
          alert('🎬 Booking confirmed! Enjoy the movie!');
        }}
        selectedSeats={selectedSeats}
        movie={selectedMovie}
        showtime={selectedShowtime}
        total={totalPrice}
      />

      {/* Bottom gradient for depth */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-[1]" />
    </div>
  );
}
