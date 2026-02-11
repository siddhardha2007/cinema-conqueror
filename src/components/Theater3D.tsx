import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Star, Zap, Users, Info,
  AlertCircle, X, Check, ArrowUp, ArrowDown, Maximize2
} from 'lucide-react';

// ─── UI Button ───
const Button = ({ children, onClick, className = '', variant = 'default', size = 'default', disabled = false }: any) => {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
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
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}>
      {children}
    </button>
  );
};

// ─── DATA ───
const movies = [
  { id: '1', title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911BTUgMe1nEuEr.jpg", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", description: "Batman faces the Joker in Gotham.", duration: "2h 32m", rating: "PG-13", genre: "Action, Crime" },
  { id: '2', title: "Inception", image: "https://image.tmdb.org/t/p/w200/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", description: "A thief steals secrets through dreams.", duration: "2h 28m", rating: "PG-13", genre: "Sci-Fi, Action" },
  { id: '3', title: "Interstellar", image: "https://image.tmdb.org/t/p/w200/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", description: "Explorers travel through a wormhole.", duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi" },
  { id: '4', title: "Oppenheimer", image: "https://image.tmdb.org/t/p/w200/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", description: "The story of the atomic bomb.", duration: "3h 0m", rating: "R", genre: "Drama, History" }
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
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? m[2] : null;
}

// ─── TYPES ───
export interface Seat {
  id: string; row: string; number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium' | 'vip' | 'accessible';
  price: number; isBooked?: boolean; isSelected?: boolean;
}

interface Theater3DProps { seats: Seat[]; onSeatClick: (seat: Seat) => void; }
interface CameraTarget { position: THREE.Vector3; lookAt: THREE.Vector3; }
type ViewMode = 'default' | 'topdown' | 'front' | 'side';

// ─── CONSTANTS ───
const SCREEN_WIDTH = 24;
const SCREEN_HEIGHT = 10;
const SCREEN_Z = -12;
const SCREEN_Y = 8;
const THEATER_WIDTH = 32;
const DEFAULT_CAM = new THREE.Vector3(0, 14, 24);
const DEFAULT_LOOK = new THREE.Vector3(0, 4, 0);

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── AUDIO HOOK ───
const useAudio = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const f: Record<string, [number, number]> = { click: [500, 700], select: [600, 900], hover: [400, 500], success: [800, 1200], error: [200, 150] };
      const [f1, f2] = f[type] || f.click;
      osc.frequency.setValueAtTime(f1, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(f2, ctx.currentTime + 0.08);
      osc.type = type === 'error' ? 'sawtooth' : 'sine';
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    } catch { /* no audio */ }
  }, []);
  return { playSound };
};

// ─── DUST PARTICLES ───
function DustParticles({ count = 120 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 10,
    y: Math.random() * 10 + 3,
    z: (Math.random() - 0.5) * 30,
    speed: Math.random() * 0.2 + 0.05,
    phase: Math.random() * Math.PI * 2,
    s: Math.random() * 0.025 + 0.008,
  })), [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    data.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.phase) * 0.4,
        p.y + Math.sin(t * p.speed * 0.6 + p.phase) * 0.25,
        p.z + Math.cos(t * p.speed * 0.4) * 0.3
      );
      dummy.scale.setScalar(p.s * (1 + Math.sin(t * 1.5 + i) * 0.2));
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#fef3c7" transparent opacity={0.18} toneMapped={false} />
    </instancedMesh>
  );
}

// ─── PROJECTOR BEAM ───
function ProjectorBeam() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.025 + Math.sin(clock.getElapsedTime() * 0.4) * 0.008;
  });
  return (
    <mesh ref={ref} position={[0, 12, 6]} rotation={[0.22, 0, 0]}>
      <coneGeometry args={[12, 38, 32, 1, true]} />
      <meshBasicMaterial color="#93c5fd" transparent opacity={0.025} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ─── SCREEN POSITION TRACKER (for YouTube overlay) ───
function ScreenTracker({ onUpdate }: {
  onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void;
}) {
  const { camera, gl } = useThree();
  const prev = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });

  useFrame(() => {
    const hw = SCREEN_WIDTH / 2;
    const hh = SCREEN_HEIGHT / 2;
    const corners = [
      new THREE.Vector3(-hw, SCREEN_Y + hh, SCREEN_Z),
      new THREE.Vector3(hw, SCREEN_Y + hh, SCREEN_Z),
      new THREE.Vector3(-hw, SCREEN_Y - hh, SCREEN_Z),
      new THREE.Vector3(hw, SCREEN_Y - hh, SCREEN_Z),
    ];
    corners.forEach(c => c.project(camera));

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const toScr = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z).sub(camera.position).normalize();
    const visible = dir.dot(toScr) > 0.15;

    const r = gl.domElement.getBoundingClientRect();
    const px = (ndc: THREE.Vector3) => ({
      x: ((ndc.x + 1) / 2) * r.width,
      y: ((-ndc.y + 1) / 2) * r.height
    });
    const pts = corners.map(px);

    const left = Math.min(pts[0].x, pts[2].x);
    const top = Math.min(pts[0].y, pts[1].y);
    const right = Math.max(pts[1].x, pts[3].x);
    const bottom = Math.max(pts[2].y, pts[3].y);

    const nr = {
      left: left + r.left,
      top: top + r.top,
      width: right - left,
      height: bottom - top,
      visible: visible && (right - left) > 40 && (bottom - top) > 25
    };

    const p = prev.current;
    if (Math.abs(p.left - nr.left) > 1 || Math.abs(p.top - nr.top) > 1 ||
      Math.abs(p.width - nr.width) > 1 || Math.abs(p.height - nr.height) > 1 ||
      p.visible !== nr.visible) {
      prev.current = nr;
      onUpdate(nr);
    }
  });
  return null;
}

// ─── CAMERA CONTROLLER ───
function CameraController({ target, isAnimating, onDone, controlsRef }: {
  target: CameraTarget; isAnimating: boolean; onDone: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (isAnimating) {
      progress.current = 0;
      startPos.current.copy(camera.position);
      if (controlsRef.current) startTarget.current.copy(controlsRef.current.target);
    }
  }, [isAnimating, target, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    progress.current = Math.min(progress.current + delta * 1.5, 1);
    const t = easeInOutCubic(progress.current);

    camera.position.lerpVectors(startPos.current, target.position, t);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTarget.current, target.lookAt, t);
      controlsRef.current.update();
    }
    if (progress.current >= 1) onDone();
  });
  return null;
}

// ─── SEAT 3D ───
function Seat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  useFrame((state) => {
    if (groupRef.current) {
      const ty = hovered && !isBooked ? 0.06 : 0;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, ty, 0.12);
    }
    if (glowRef.current && isSelected) {
      glowRef.current.intensity = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  const color = useMemo(() => {
    if (isBooked) return '#4b5563';
    if (isSelected) return '#10b981';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#fbbf24';
    const m: Record<string, string> = { vip: '#a855f7', premium: '#3b82f6', accessible: '#14b8a6', standard: '#6b7280' };
    return m[seat.type] || m.standard;
  }, [isBooked, isSelected, isHighlighted, hovered, seat.type]);

  const cushion = useMemo(() => {
    if (isBooked) return '#374151';
    if (isSelected) return '#047857';
    const m: Record<string, string> = { vip: '#7c3aed', premium: '#2563eb', accessible: '#0d9488', standard: '#4b5563' };
    return m[seat.type] || m.standard;
  }, [isBooked, isSelected, seat.type]);

  const emissive = isSelected ? 0.5 : isHighlighted ? 0.35 : (hovered && !isBooked) ? 0.25 : 0.06;

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); }
    else if (soundEnabled) playSound('error');
  };

  const handleEnter = (e: any) => {
    e.stopPropagation();
    if (soundEnabled && !isBooked) playSound('hover');
    setHovered(true);
    document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    onHover(seat, position);
  };

  const handleLeave = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  const s = hovered && !isBooked ? 1.05 : 1;

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Legs */}
        {[[-0.3, -0.1], [0.3, -0.1], [-0.3, 0.25], [0.3, 0.25]].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.08, z]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
            <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

        {/* Seat bottom */}
        <RoundedBox args={[0.75, 0.1, 0.55]} radius={0.03} smoothness={3}
          position={[0, 0.08, 0.05]}
          onClick={handleClick} onPointerEnter={handleEnter} onPointerLeave={handleLeave}
          scale={s} castShadow receiveShadow>
          <meshStandardMaterial color={cushion} roughness={0.65} metalness={0.08}
            emissive={color} emissiveIntensity={emissive} />
        </RoundedBox>

        {/* Seat back */}
        <RoundedBox args={[0.75, 0.65, 0.08]} radius={0.03} smoothness={3}
          position={[0, 0.45, 0.3]} scale={s} castShadow receiveShadow
          onClick={handleClick} onPointerEnter={handleEnter} onPointerLeave={handleLeave}>
          <meshStandardMaterial color={cushion} roughness={0.65} metalness={0.08}
            emissive={color} emissiveIntensity={emissive} />
        </RoundedBox>

        {/* Back frame */}
        <RoundedBox args={[0.8, 0.7, 0.05]} radius={0.02} smoothness={3}
          position={[0, 0.44, 0.34]} castShadow>
          <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.5} />
        </RoundedBox>

        {/* Armrests */}
        {[-0.42, 0.42].map((x, i) => (
          <group key={i} position={[x, 0.18, 0.08]}>
            <RoundedBox args={[0.06, 0.04, 0.4]} radius={0.015} smoothness={3} castShadow>
              <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.6} />
            </RoundedBox>
          </group>
        ))}

        {/* Seat number */}
        <Text position={[0, 0.48, 0.36]} fontSize={0.1} color={isBooked ? '#6b7280' : '#e5e7eb'}
          anchorX="center" anchorY="middle" fontWeight={700}>
          {seat.number}
        </Text>

        {/* VIP indicator */}
        {seat.type === 'vip' && (
          <group position={[0, 0.88, 0.3]}>
            <mesh>
              <coneGeometry args={[0.06, 0.12, 5]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
            </mesh>
            <pointLight intensity={0.3} distance={1.2} color="#fbbf24" />
          </group>
        )}

        {/* Accessible icon */}
        {seat.type === 'accessible' && (
          <mesh position={[0, 0.88, 0.3]}>
            <torusGeometry args={[0.06, 0.02, 8, 16]} />
            <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.8} />
          </mesh>
        )}

        {/* Selection effects */}
        {isSelected && (
          <>
            <pointLight ref={glowRef} position={[0, 0.4, 0]} intensity={0.6} distance={2} color="#10b981" />
            <mesh position={[0, -0.02, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.25, 0.45, 24]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.2} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}

        {isHighlighted && !isSelected && (
          <pointLight position={[0, 0.4, 0]} intensity={0.5} distance={1.8} color="#f59e0b" />
        )}
      </group>
    </group>
  );
}

// ─── SEAT TOOLTIP ───
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const labels: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const colors: Record<string, string> = { standard: 'bg-gray-500', premium: 'bg-blue-500', vip: 'bg-purple-500', accessible: 'bg-teal-500' };

  return (
    <Html position={[position[0], position[1] + 1.6, position[2]]} center distanceFactor={12}>
      <div className="bg-gray-900/95 backdrop-blur-lg text-white px-3 py-2.5 rounded-lg shadow-xl border border-white/10 min-w-[170px] pointer-events-none select-none">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-sm">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${colors[seat.type]}`}>{labels[seat.type]}</span>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-400">Price</span><span className="font-bold text-green-400">${seat.price.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Status</span>
            <span className={isBooked ? 'text-red-400' : isSelected ? 'text-green-400' : 'text-blue-400'}>
              {isBooked ? '● Booked' : isSelected ? '● Selected' : '● Available'}
            </span>
          </div>
        </div>
        {!isBooked && <p className="mt-1.5 pt-1.5 border-t border-white/10 text-center text-[10px] text-gray-500">Click to {isSelected ? 'deselect' : 'select'}</p>}
        {isBooked && <p className="mt-1.5 pt-1.5 border-t border-white/10 text-center text-[10px] text-red-400 flex items-center justify-center gap-1"><AlertCircle className="w-2.5 h-2.5" />Unavailable</p>}
      </div>
    </Html>
  );
}

// ─── CINEMA SCREEN ───
function CinemaScreen({ movieTitle }: { movieTitle: string }) {
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) glowRef.current.intensity = 3.5 + Math.sin(clock.getElapsedTime() * 0.3) * 0.5;
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen recess */}
      <mesh position={[0, 0, -0.25]}>
        <boxGeometry args={[SCREEN_WIDTH + 2, SCREEN_HEIGHT + 1.5, 0.4]} />
        <meshStandardMaterial color="#111827" roughness={0.92} />
      </mesh>

      {/* Silver frame */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.5, SCREEN_HEIGHT + 0.3]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Screen surface - visible dark blue glow */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial color="#0f172a" emissive="#1e3a5f" emissiveIntensity={0.12} roughness={0.95} />
      </mesh>

      {/* Screen glow */}
      <pointLight ref={glowRef} position={[0, 0, 5]} intensity={3.5} distance={35} color="#60a5fa" />
      <pointLight position={[-8, 0, 3]} intensity={1.5} distance={18} color="#818cf8" />
      <pointLight position={[8, 0, 3]} intensity={1.5} distance={18} color="#818cf8" />

      {/* Curtains - LEFT */}
      <group position={[-(SCREEN_WIDTH / 2 + 2.5), 0, 0]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[Math.sin(i * 0.7) * 0.12, 0, i * 0.04]} castShadow>
            <boxGeometry args={[0.7, SCREEN_HEIGHT + 4, 0.25]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#991b1b" : "#b91c1c"} roughness={0.82} />
          </mesh>
        ))}
      </group>

      {/* Curtains - RIGHT */}
      <group position={[SCREEN_WIDTH / 2 + 2.5, 0, 0]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[-Math.sin(i * 0.7) * 0.12, 0, i * 0.04]} castShadow>
            <boxGeometry args={[0.7, SCREEN_HEIGHT + 4, 0.25]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#991b1b" : "#b91c1c"} roughness={0.82} />
          </mesh>
        ))}
      </group>

      {/* Curtain valance - TOP */}
      <group position={[0, SCREEN_HEIGHT / 2 + 2.5, 0]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[(i - 3.5) * (SCREEN_WIDTH + 5) / 8, Math.sin(i) * 0.1, 0]} castShadow>
            <boxGeometry args={[(SCREEN_WIDTH + 5) / 8 + 0.1, 2 + Math.sin(i * 0.6) * 0.2, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#991b1b" : "#b91c1c"} roughness={0.82} />
          </mesh>
        ))}
        {/* Gold trim */}
        <mesh position={[0, -0.9, 0.08]}>
          <boxGeometry args={[SCREEN_WIDTH + 5, 0.1, 0.06]} />
          <meshStandardMaterial color="#d4a537" metalness={0.85} roughness={0.2} emissive="#d4a537" emissiveIntensity={0.25} />
        </mesh>
      </group>

      {/* Movie title text */}
      <Text position={[0, -(SCREEN_HEIGHT / 2 + 1.5), 0.2]} fontSize={0.55} color="#9ca3af"
        anchorX="center" anchorY="middle" letterSpacing={0.12}>
        ★ NOW SHOWING: {movieTitle.toUpperCase()} ★
      </Text>
    </group>
  );
}

// ─── ROW LABELS ───
function RowLabels({ rows, getRowPosition }: { rows: string[]; getRowPosition: (i: number) => { z: number; y: number } }) {
  return (
    <group>
      {rows.map((row, i) => {
        const { z, y } = getRowPosition(i);
        return (
          <group key={row}>
            <Text position={[-THEATER_WIDTH / 2 + 1, y + 0.5, z]} fontSize={0.45} color="#60a5fa"
              anchorX="center" anchorY="middle" fontWeight={700}>{row}</Text>
            <Text position={[THEATER_WIDTH / 2 - 1, y + 0.5, z]} fontSize={0.45} color="#60a5fa"
              anchorX="center" anchorY="middle" fontWeight={700}>{row}</Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── EXIT SIGNS ───
function ExitSigns() {
  return (
    <group>
      {[[-THEATER_WIDTH / 2 + 1, 6, 10], [THEATER_WIDTH / 2 - 1, 6, 10]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[1.8, 0.6, 0.12]} radius={0.04} smoothness={3}>
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </RoundedBox>
          <Text position={[0, 0, 0.08]} fontSize={0.28} color="#fff" anchorX="center" fontWeight={900}>EXIT</Text>
          <pointLight position={[0, 0, 0.4]} intensity={0.8} distance={4} color="#22c55e" />
        </group>
      ))}
    </group>
  );
}

// ─── CEILING LIGHTS ───
function CeilingLights({ on }: { on: boolean }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.traverse(c => {
      if (c instanceof THREE.PointLight) {
        c.intensity = THREE.MathUtils.lerp(c.intensity, on ? 1.0 : 0.12, 0.04);
      }
    });
  });

  const positions = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let x = -12; x <= 12; x += 8) for (let z = -4; z <= 16; z += 5) p.push([x, 13.8, z]);
    return p;
  }, []);

  return (
    <group ref={ref}>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.35, 0.25, 10]} />
            <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <sphereGeometry args={[0.1, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={on ? "#fef9c3" : "#374151"} toneMapped={false} />
          </mesh>
          <pointLight intensity={on ? 1.0 : 0.12} distance={8} color="#fef3c7" />
        </group>
      ))}
    </group>
  );
}

// ─── STADIUM STEPS ───
function StadiumSteps({ rowCount, getRowPosition }: { rowCount: number; getRowPosition: (i: number) => { z: number; y: number } }) {
  return (
    <group>
      {Array.from({ length: rowCount }).map((_, i) => {
        const { z, y } = getRowPosition(i);
        return (
          <group key={i}>
            <mesh position={[0, y - 0.15, z]} receiveShadow castShadow>
              <boxGeometry args={[THEATER_WIDTH - 2, 0.4, 1.5]} />
              <meshStandardMaterial color="#1e1e38" roughness={0.88} metalness={0.06} />
            </mesh>
            {/* Carpet */}
            <mesh position={[0, y + 0.06, z]}>
              <boxGeometry args={[THEATER_WIDTH - 2.5, 0.015, 1.45]} />
              <meshStandardMaterial color="#252548" roughness={0.94} />
            </mesh>
            {/* LED edge */}
            <mesh position={[0, y + 0.06, z + 0.72]}>
              <boxGeometry args={[THEATER_WIDTH - 2.5, 0.012, 0.025]} />
              <meshBasicMaterial color="#3b82f6" toneMapped={false} transparent opacity={0.6} />
            </mesh>
            {/* Aisle dots */}
            {[-4.5, 4.5].map((x, j) => (
              <group key={j} position={[x, y + 0.1, z]}>
                <mesh>
                  <sphereGeometry args={[0.03, 6, 6]} />
                  <meshBasicMaterial color="#fbbf24" toneMapped={false} />
                </mesh>
                <pointLight intensity={0.15} distance={0.7} color="#fbbf24" />
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ─── THEATER ROOM ───
function TheaterRoom({ lightsOn, rowCount, getRowPosition }: { lightsOn: boolean; rowCount: number; getRowPosition: (i: number) => { z: number; y: number } }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#0c0c1e', 0.005);
    return () => { scene.fog = null; };
  }, [scene]);

  const hw = THEATER_WIDTH / 2;

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#151528" roughness={0.94} metalness={0.04} />
      </mesh>

      {/* Aisles */}
      {[-4.5, 4.5].map((x, i) => (
        <mesh key={i} position={[x, -0.48, 4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.0, 35]} />
          <meshStandardMaterial color="#1e1e40" roughness={0.92} />
        </mesh>
      ))}

      {/* Walls */}
      <mesh position={[-hw, 7, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 16]} />
        <meshStandardMaterial color="#171730" roughness={0.88} metalness={0.06} />
      </mesh>
      <mesh position={[hw, 7, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[50, 16]} />
        <meshStandardMaterial color="#171730" roughness={0.88} metalness={0.06} />
      </mesh>

      {/* Wall trim lines */}
      {[-hw + 0.05, hw - 0.05].map((x, wi) => (
        <group key={wi}>
          {[3, 5.5, 8, 10.5].map((y, yi) => (
            <mesh key={yi} position={[x, y, 2]} rotation={[0, wi === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              <boxGeometry args={[35, 0.04, 0.03]} />
              <meshStandardMaterial color="#2a2a55" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Ceiling */}
      <mesh position={[0, 14.5, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[THEATER_WIDTH + 4, 50]} />
        <meshStandardMaterial color="#0e0e24" roughness={0.96} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 7, 20]} receiveShadow>
        <planeGeometry args={[THEATER_WIDTH + 4, 16]} />
        <meshStandardMaterial color="#171730" roughness={0.9} />
      </mesh>

      {/* Screen back wall */}
      <mesh position={[0, SCREEN_Y, SCREEN_Z - 1]}>
        <planeGeometry args={[THEATER_WIDTH + 8, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.96} />
      </mesh>

      <StadiumSteps rowCount={rowCount} getRowPosition={getRowPosition} />
      <ExitSigns />
      <CeilingLights on={lightsOn} />

      {/* Wall sconces */}
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={i}>
          {[-hw + 0.2, hw - 0.2].map((x, j) => (
            <group key={j} position={[x, 5.5, -3 + i * 5.5]}>
              <mesh>
                <boxGeometry args={[0.2, 0.4, 0.1]} />
                <meshStandardMaterial color="#d4a537" metalness={0.8} roughness={0.3} emissive="#d4a537" emissiveIntensity={0.12} />
              </mesh>
              <pointLight position={[j === 0 ? 0.3 : -0.3, 0, 0]} intensity={lightsOn ? 0.6 : 0.12} distance={5} color="#fef3c7" />
            </group>
          ))}
        </group>
      ))}

      {/* Projector */}
      <group position={[0, 12.5, 19]}>
        <mesh castShadow>
          <boxGeometry args={[3, 2.5, 3]} />
          <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.2, -1.6]}>
          <cylinderGeometry args={[0.3, 0.4, 0.6, 12]} />
          <meshStandardMaterial color="#4b5563" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.2, -1.9]}>
          <circleGeometry args={[0.28, 20]} />
          <meshBasicMaterial color="#93c5fd" toneMapped={false} transparent opacity={0.4} />
        </mesh>
      </group>

      <ProjectorBeam />
      <DustParticles count={100} />
    </group>
  );
}

// ─── MINIMAP ───
function MiniMap({ seats, selectedIds, onSeatClick }: {
  seats: Seat[]; selectedIds: string[]; onSeatClick: (s: Seat) => void;
}) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { (m[s.row] ||= []).push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const dotColor = (s: Seat) => {
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-700';
    if (selectedIds.includes(s.id)) return 'bg-green-500 shadow-green-500/50 shadow-sm';
    const m: Record<string, string> = { vip: 'bg-purple-500', premium: 'bg-blue-500', accessible: 'bg-teal-500', standard: 'bg-gray-500' };
    return m[s.type] || m.standard;
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl p-3.5 rounded-xl border border-white/10 shadow-2xl">
      <h4 className="text-white text-[10px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
        <Grid3X3 className="w-3 h-3 text-blue-400" />Map
      </h4>
      <div className="w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full mb-1 relative">
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] text-blue-400 font-bold tracking-widest">SCREEN</span>
      </div>
      <div className="space-y-0.5 mt-4">
        {rows.map(([r, rs]) => (
          <div key={r} className="flex items-center gap-0.5">
            <span className="text-[7px] text-blue-400 w-2.5 font-bold">{r}</span>
            <div className="flex gap-[2px]">
              {rs.sort((a, b) => a.number - b.number).map(s => (
                <button key={s.id} onClick={() => onSeatClick(s)} disabled={s.status === 'booked' || s.isBooked}
                  className={`w-[6px] h-[6px] rounded-[1px] transition-all hover:scale-[2] ${dotColor(s)} ${(s.status === 'booked' || s.isBooked) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  title={`${s.row}${s.number} $${s.price}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BOOKING MODAL ───
function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, total }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; selectedSeats: Seat[];
  movie: typeof movies[0]; showtime: typeof showtimes[0]; total: number;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Ticket className="w-5 h-5 text-blue-400" />Confirm Booking</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="bg-slate-800/40 rounded-lg p-3 flex gap-3 border border-white/5">
            <img src={movie.image} alt={movie.title} className="w-14 h-20 object-cover rounded-md"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h4 className="text-white font-bold text-sm">{movie.title}</h4>
              <p className="text-gray-400 text-xs">{movie.genre}</p>
              <p className="text-gray-500 text-xs">{movie.duration} · {movie.rating}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-300 bg-slate-800/30 rounded-lg px-3 py-2 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />{showtime.time}
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3 border border-white/5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5">Seats</p>
            <div className="flex flex-wrap gap-1">
              {selectedSeats.map(s => (
                <span key={s.id} className="px-2 py-0.5 rounded text-xs font-bold bg-white/5 text-gray-300 border border-white/10">
                  {s.row}{s.number}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-400"><span>{selectedSeats.length} ticket(s)</span><span>${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Fee</span><span>$2.50</span></div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10"><span>Total</span><span className="text-green-400">${(total + 2.5).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={onClose} className="flex-1 text-gray-300">Cancel</Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700 font-bold">
              <CreditCard className="w-4 h-4 mr-1.5" />Pay Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── YOUTUBE OVERLAY ───
function YouTubeOverlay({ videoId, rect }: {
  videoId: string;
  rect: { left: number; top: number; width: number; height: number; visible: boolean };
}) {
  if (!rect.visible || rect.width < 60 || rect.height < 35) return null;

  const pad = 4;
  return (
    <div style={{
      position: 'fixed',
      left: `${rect.left + pad}px`,
      top: `${rect.top + pad}px`,
      width: `${Math.max(rect.width - pad * 2, 0)}px`,
      height: `${Math.max(rect.height - pad * 2, 0)}px`,
      zIndex: 5,
      pointerEvents: 'auto',
      overflow: 'hidden',
      borderRadius: '2px',
      backgroundColor: '#000',
    }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
        title="Trailer" frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [camTarget, setCamTarget] = useState<CameraTarget>({ position: DEFAULT_CAM, lookAt: DEFAULT_LOOK });
  const [animating, setAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  const [movie, setMovie] = useState(movies[0]);
  const [showtime, setShowtime] = useState(showtimes[3]);
  const [hoveredSeat, setHoveredSeat] = useState<{ seat: Seat; position: [number, number, number] } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [miniMap, setMiniMap] = useState(true);
  const [view, setView] = useState<ViewMode>('default');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [lightsOn, setLightsOn] = useState(true);
  const [screenRect, setScreenRect] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });

  const controlsRef = useRef<any>(null);
  const { playSound } = useAudio();

  const ytId = useMemo(() => getYouTubeId(movie.video), [movie.video]);
  const isYT = !!ytId;

  const selected = useMemo(() => seats.filter(s => s.status === 'selected' || s.isSelected), [seats]);
  const totalPrice = useMemo(() => selected.reduce((a, s) => a + s.price, 0), [selected]);
  const rows = useMemo(() => [...new Set(seats.map(s => s.row))].sort(), [seats]);

  const getRowPosition = useCallback((rowIndex: number) => ({
    z: rowIndex * 1.5 + 2,
    y: rowIndex * 0.35 + 0.2,
  }), []);

  const seatsByRow = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { (m[s.row] ||= []).push(s); });
    return m;
  }, [seats]);

  const seatPositions = useMemo(() => {
    const result: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const sortedRows = Object.keys(seatsByRow).sort();

    sortedRows.forEach((row, ri) => {
      const rs = seatsByRow[row].sort((a, b) => a.number - b.number);
      const { z, y } = getRowPosition(ri);
      const totalSeats = rs.length;
      const seatSpacing = 0.95;
      const aisleGap = 1.0;

      rs.forEach((seat, si) => {
        const half = Math.floor(totalSeats / 2);
        let x: number;

        if (totalSeats % 2 === 0) {
          if (si < half) {
            x = (si - half) * seatSpacing - aisleGap / 2 + seatSpacing / 2;
          } else {
            x = (si - half) * seatSpacing + aisleGap / 2 + seatSpacing / 2;
          }
        } else {
          const center = Math.floor(totalSeats / 2);
          if (si < center) {
            x = (si - center) * seatSpacing - aisleGap / 2;
          } else if (si === center) {
            x = 0;
          } else {
            x = (si - center) * seatSpacing + aisleGap / 2;
          }
        }

        result.push({ seat, position: [x, y, z] });
      });
    });

    return result;
  }, [seatsByRow, getRowPosition]);

  const findBest = useCallback((n = 4) => {
    const avail = seatPositions.filter(({ seat: s }) => s.status === 'available' && !s.isBooked);
    const scored = avail.map(({ seat: s, position: p }) => ({
      id: s.id,
      score: (15 - Math.abs(p[0])) + (10 - Math.abs(4 - p[2] / 1.5)) + (s.type === 'vip' ? 5 : s.type === 'premium' ? 3 : 0)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map(s => s.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundOn) playSound('click');
    onSeatClick(seat);
    const d = seatPositions.find(s => s.seat.id === seat.id);
    if (d) {
      const [x, y, z] = d.position;
      setCamTarget({ position: new THREE.Vector3(x, y + 1.5, z + 2.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
      setAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundOn, playSound, onSeatClick, seatPositions]);

  const handleHover = useCallback((seat: Seat | null, pos?: [number, number, number]) => {
    if (seat && pos) setHoveredSeat({ seat, position: pos });
    else setHoveredSeat(null);
  }, []);

  const resetView = useCallback(() => {
    if (soundOn) playSound('click');
    setCamTarget({ position: DEFAULT_CAM, lookAt: DEFAULT_LOOK });
    setAnimating(true); setViewingSeatId(null); setView('default');
  }, [soundOn, playSound]);

  const changeView = useCallback((mode: ViewMode) => {
    if (soundOn) playSound('click');
    setView(mode);
    const views: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAM, lookAt: DEFAULT_LOOK },
      topdown: { position: new THREE.Vector3(0, 30, 6), lookAt: new THREE.Vector3(0, 0, 4) },
      front: { position: new THREE.Vector3(0, 8, SCREEN_Z + 3), lookAt: new THREE.Vector3(0, 8, 0) },
      side: { position: new THREE.Vector3(28, 12, 6), lookAt: new THREE.Vector3(0, 4, 4) }
    };
    setCamTarget(views[mode]); setAnimating(true);
  }, [soundOn, playSound]);

  const handleScreenUpdate = useCallback((r: typeof screenRect) => {
    setScreenRect(r);
  }, []);

  // Keyboard navigation
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
        case 'Escape': resetView(); break;
      }
      if (target) {
        e.preventDefault();
        const d = seatPositions.find(s => s.seat.id === target!.id);
        if (d) {
          const [x, y, z] = d.position;
          setCamTarget({ position: new THREE.Vector3(x, y + 1.5, z + 2.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
          setAnimating(true); setViewingSeatId(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingSeatId, seats, seatPositions, handleSeatClick, resetView]);

  return (
    <div className="relative w-full h-[850px] bg-[#0a0a1a] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">

      {/* YouTube overlay */}
      {isYT && ytId && <YouTubeOverlay videoId={ytId} rect={screenRect} />}

      {/* ─── TOP LEFT: Movie / Showtime ─── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[380px]">
        <div className="bg-black/65 backdrop-blur-xl rounded-xl p-2.5 border border-white/[0.08]">
          <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Film className="w-3 h-3 text-blue-400" />Now Playing
          </h3>
          <div className="flex flex-wrap gap-1">
            {movies.map(m => (
              <button key={m.id}
                onClick={() => { if (soundOn) playSound('click'); setMovie(m); }}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${movie.id === m.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]'}`}>
                {m.title}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/65 backdrop-blur-xl rounded-xl p-2.5 border border-white/[0.08]">
          <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-green-400" />Showtime
          </h3>
          <div className="flex flex-wrap gap-1">
            {showtimes.map(s => (
              <button key={s.id}
                onClick={() => { if (soundOn) playSound('click'); setShowtime(s); }}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${showtime.id === s.id
                  ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-500/20'
                  : 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]'}`}>
                {s.time}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/65 backdrop-blur-xl p-2.5 rounded-xl border border-white/[0.08]">
          <div className="flex gap-2.5">
            <img src={movie.image} alt={movie.title} className="w-12 h-18 object-cover rounded-md shadow"
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="72"><rect fill="%23334155" width="48" height="72" rx="4"/></svg>'; }} />
            <div className="flex-1 min-w-0">
              <h4 className="text-blue-400 font-bold text-xs truncate">{movie.title}</h4>
              <p className="text-gray-500 text-[10px]">{movie.duration} · {movie.rating}</p>
              <p className="text-gray-500 text-[10px]">{movie.genre}</p>
              <p className="text-gray-400 text-[10px] mt-0.5 line-clamp-2">{movie.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TOP RIGHT: Controls ─── */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setSoundOn(!soundOn)} className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl">
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const c = document.querySelector('canvas');
            if (c) { const a = document.createElement('a'); a.download = `theater.png`; a.href = c.toDataURL(); a.click(); }
          }} className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl">
            <Camera className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMiniMap(!miniMap)}
            className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${miniMap ? 'ring-1 ring-blue-500' : ''}`}>
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLightsOn(!lightsOn)}
            className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${lightsOn ? 'ring-1 ring-yellow-500' : ''}`}>
            <Zap className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex gap-1">
          {([
            ['default', Eye], ['topdown', ArrowDown], ['front', Maximize2], ['side', ArrowUp]
          ] as [ViewMode, any][]).map(([m, Icon]) => (
            <Button key={m} variant="outline" size="sm" onClick={() => changeView(m)}
              className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${view === m ? 'ring-1 ring-blue-500' : ''}`}>
              <Icon className="w-3.5 h-3.5" />
            </Button>
          ))}
        </div>

        {viewingSeatId && (
          <div className="bg-black/60 backdrop-blur-xl text-white px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10 text-xs">
            <Eye className="w-3 h-3 text-blue-400" />
            Seat {seats.find(s => s.id === viewingSeatId)?.row}{seats.find(s => s.id === viewingSeatId)?.number}
          </div>
        )}

        <div className="flex gap-1">
          <Button onClick={() => {
            if (soundOn) playSound('success');
            setHighlighted(findBest(4));
            setTimeout(() => setHighlighted([]), 5000);
          }} variant="outline" size="sm" className="bg-amber-600/25 hover:bg-amber-600/40 border-amber-500/25 text-amber-200 backdrop-blur-xl">
            <Star className="w-3.5 h-3.5 mr-1" />Best
          </Button>
          <Button onClick={resetView} variant="outline" size="sm" className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset
          </Button>
        </div>
      </div>

      {/* ─── BOTTOM LEFT: Legend ─── */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-xl p-3 rounded-xl border border-white/[0.08]">
        <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-gray-400" />Legend
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            ['bg-gray-500', 'Standard'], ['bg-blue-500', 'Premium'], ['bg-purple-500', 'VIP'],
            ['bg-teal-500', 'Accessible'], ['bg-green-500', 'Selected'], ['bg-slate-700', 'Booked'], ['bg-amber-500', 'Recommended']
          ].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${c}`} />
              <span className="text-gray-400 text-[9px]">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── BOTTOM RIGHT: Tickets ─── */}
      <div className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-xl p-3 rounded-xl border border-white/[0.08] min-w-[240px]">
        <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Ticket className="w-3 h-3 text-green-400" />Your Tickets
        </h3>
        {selected.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1 mb-2">
              {selected.map(s => (
                <span key={s.id} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/[0.05] text-gray-300 border border-white/10">
                  {s.row}{s.number} <span className="text-gray-500">${s.price}</span>
                </span>
              ))}
            </div>
            <div className="border-t border-white/[0.08] pt-2 space-y-1">
              <div className="flex justify-between text-[11px]"><span className="text-gray-500">{selected.length} ticket(s)</span><span className="text-gray-300">${totalPrice.toFixed(2)}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-gray-500">Fee</span><span className="text-gray-300">$2.50</span></div>
              <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/[0.08]"><span>Total</span><span className="text-green-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
            </div>
            <Button onClick={() => setBookingOpen(true)} className="w-full mt-2 bg-green-600 hover:bg-green-700 font-bold text-xs">
              <Check className="w-3.5 h-3.5 mr-1" />Checkout
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <Users className="w-6 h-6 text-gray-700 mx-auto mb-1" />
            <p className="text-gray-500 text-[10px]">No seats selected</p>
            <p className="text-gray-600 text-[9px]">Click seats to select</p>
          </div>
        )}
      </div>

      {/* MiniMap */}
      {miniMap && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} selectedIds={selected.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* ─── 3D CANVAS ─── */}
      <Canvas
        shadows
        camera={{ position: [DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z], fov: 50 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8,
        }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; }}
      >
        <CameraController target={camTarget} isAnimating={animating}
          onDone={() => setAnimating(false)} controlsRef={controlsRef} />

        <color attach="background" args={['#0c0c1e']} />

        {/* ─── LIGHTING ─── */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#2d4a7a', '#0c0c1e', 0.45]} />
        <directionalLight position={[8, 18, 12]} intensity={1.0} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20} shadow-camera-right={20}
          shadow-camera-top={20} shadow-camera-bottom={-20}
          shadow-bias={-0.0002} />
        <directionalLight position={[-8, 14, 8]} intensity={0.5} />
        <directionalLight position={[0, 6, 18]} intensity={0.35} />

        {/* Screen position tracker */}
        {isYT && <ScreenTracker onUpdate={handleScreenUpdate} />}

        {/* Screen */}
        <CinemaScreen movieTitle={movie.title} />

        {/* Row labels */}
        <RowLabels rows={rows} getRowPosition={getRowPosition} />

        {/* Theater environment */}
        <TheaterRoom lightsOn={lightsOn} rowCount={rows.length} getRowPosition={getRowPosition} />

        {/* Seats */}
        {seatPositions.map(({ seat, position }) => (
          <Seat3D key={seat.id} seat={seat} position={position}
            onClick={handleSeatClick} onHover={handleHover}
            isHighlighted={highlighted.includes(seat.id)}
            soundEnabled={soundOn} playSound={playSound} />
        ))}

        {/* Tooltip */}
        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        {/* Controls */}
        <OrbitControls ref={controlsRef}
          minDistance={3} maxDistance={45}
          maxPolarAngle={Math.PI / 2.05}
          target={[DEFAULT_LOOK.x, DEFAULT_LOOK.y, DEFAULT_LOOK.z]}
          enableDamping dampingFactor={0.05} rotateSpeed={0.5} />
      </Canvas>

      {/* Booking modal */}
      <BookingModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)}
        onConfirm={() => { if (soundOn) playSound('success'); setBookingOpen(false); alert('Booking confirmed!'); }}
        selectedSeats={selected} movie={movie} showtime={showtime} total={totalPrice} />
    </div>
  );
}
