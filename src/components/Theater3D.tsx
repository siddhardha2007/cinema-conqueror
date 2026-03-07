import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Info,
  X, Check, Maximize2, ChevronDown, ChevronRight,
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

const SEAT_COLORS: Record<string, { base: string; hover: string; selected: string; booked: string }> = {
  standard: { base: '#8b95a5', hover: '#b0bcc9', selected: '#34d399', booked: '#4b5563' },
  premium: { base: '#5b9cf6', hover: '#7db5ff', selected: '#34d399', booked: '#4b5563' },
  vip: { base: '#b87af7', hover: '#d4a0ff', selected: '#34d399', booked: '#4b5563' },
  accessible: { base: '#3ecfb8', hover: '#5ee8d2', selected: '#34d399', booked: '#4b5563' },
};

// --- DATA ---
const movies = [
  { id: '1', title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911BTUgMe1YdBGm.jpg", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", description: "Batman faces the Joker who wants to plunge Gotham into anarchy.", duration: "2h 32m", rating: "PG-13", genre: "Action • Crime" },
  { id: '2', title: "Inception", image: "https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", description: "A thief steals secrets through dream-sharing technology.", duration: "2h 28m", rating: "PG-13", genre: "Sci-Fi • Action" },
  { id: '3', title: "Interstellar", image: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", description: "Explorers travel through a wormhole to ensure humanity's survival.", duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi • Adventure" },
  { id: '4', title: "Oppenheimer", image: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", description: "The story of J. Robert Oppenheimer and the atomic bomb.", duration: "3h 00m", rating: "R", genre: "Biography • Drama" }
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
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const freqs: Record<string, number> = { click: 550, select: 750, hover: 420, success: 880, error: 220 };
      osc.frequency.value = freqs[type];
      osc.type = type === 'error' ? 'sawtooth' : 'sine';
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch { /* silent */ }
  }, []);
  return { playSound };
};

// --- SCREEN POSITION TRACKER (optimized - throttled) ---
function ScreenPositionTracker({ onUpdate }: { onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void }) {
  const { camera, gl } = useThree();
  const lastRef = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return; // Only update every 3rd frame

    const hw = SCREEN_WIDTH / 2;
    const hh = SCREEN_HEIGHT / 2;
    const sz = SCREEN_Z + 0.05;

    const center3D = new THREE.Vector3(0, SCREEN_Y, sz);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toScreen = center3D.clone().sub(camera.position).normalize();
    const visible = camDir.dot(toScreen) > 0.1;

    if (!visible) {
      if (lastRef.current.visible) {
        lastRef.current = { left: 0, top: 0, width: 0, height: 0, visible: false };
        onUpdate(lastRef.current);
      }
      return;
    }

    const canvas = gl.domElement;
    const cRect = canvas.getBoundingClientRect();

    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * cRect.width, y: ((-v.y + 1) / 2) * cRect.height };
    };

    const tl = project(-hw, SCREEN_Y + hh, sz);
    const tr = project(hw, SCREEN_Y + hh, sz);
    const bl = project(-hw, SCREEN_Y - hh, sz);
    const br = project(hw, SCREEN_Y - hh, sz);

    const l = Math.min(tl.x, bl.x);
    const t = Math.min(tl.y, tr.y);
    const r = Math.max(tr.x, br.x);
    const b = Math.max(bl.y, br.y);

    const result = {
      left: l + cRect.left + 1,
      top: t + cRect.top + 1,
      width: Math.max(0, r - l - 2),
      height: Math.max(0, b - t - 2),
      visible: (r - l) > 40 && (b - t) > 25,
    };

    const prev = lastRef.current;
    if (Math.abs(prev.left - result.left) > 1 || Math.abs(prev.top - result.top) > 1 ||
      Math.abs(prev.width - result.width) > 1 || Math.abs(prev.height - result.height) > 1 ||
      prev.visible !== result.visible) {
      lastRef.current = result;
      onUpdate(result);
    }
  });
  return null;
}

// --- CAMERA CONTROLLER ---
function CameraController({ target, isAnimating, onDone, controlsRef }: {
  target: CameraTarget; isAnimating: boolean; onDone: () => void; controlsRef: React.MutableRefObject<any>;
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
    progressRef.current = Math.min(progressRef.current + delta * 1.5, 1);
    const t = easeInOutCubic(progressRef.current);
    camera.position.lerpVectors(startPosRef.current, target.position, t);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTargetRef.current, target.lookAt, t);
      controlsRef.current.update();
    }
    if (progressRef.current >= 1) { progressRef.current = 0; onDone(); }
  });
  return null;
}

// --- SEAT 3D (Optimized - no pointLights, simpler geometry) ---
const Seat3D = React.memo(function Seat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const foldRef = useRef(0);
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors = SEAT_COLORS[seat.type];

  useFrame((_, delta) => {
    const targetFold = isSelected ? 1 : 0;
    foldRef.current += (targetFold - foldRef.current) * delta * 6;

    if (groupRef.current) {
      const targetScale = hovered && !isBooked ? 1.12 : 1;
      scaleRef.current.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);
      groupRef.current.scale.copy(scaleRef.current);
    }
  });

  const color = isBooked ? colors.booked : isSelected ? colors.selected :
    isHighlighted ? '#fbbf24' : hovered ? colors.hover : colors.base;

  const emissiveIntensity = isSelected ? 0.5 : isHighlighted ? 0.4 : hovered && !isBooked ? 0.3 : 0.1;

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); }
    else if (soundEnabled) playSound('error');
  }, [isBooked, soundEnabled, playSound, onClick, seat]);

  const handlePointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
    if (soundEnabled && !isBooked) playSound('hover');
    document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    onHover(seat, position);
  }, [soundEnabled, isBooked, playSound, onHover, seat, position]);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHover(null);
  }, [onHover]);

  return (
    <group ref={groupRef} position={position}>
      {/* Cushion */}
      <RoundedBox args={[0.88, 0.2, 0.72]} radius={0.06} smoothness={2}
        position={[0, 0.1 - foldRef.current * 0.06, -foldRef.current * 0.04]}
        rotation={[foldRef.current * 0.3, 0, 0]}
        castShadow receiveShadow
        onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}
      >
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.08} emissive={color} emissiveIntensity={emissiveIntensity} />
      </RoundedBox>

      {/* Back */}
      <RoundedBox args={[0.88, 0.7, 0.12]} radius={0.05} smoothness={2}
        position={[0, 0.45, 0.35]} castShadow receiveShadow
        onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}
      >
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.08} emissive={color} emissiveIntensity={emissiveIntensity} />
      </RoundedBox>

      {/* Armrests */}
      <mesh position={[-0.5, 0.24, 0.08]} castShadow>
        <boxGeometry args={[0.07, 0.15, 0.55]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0.5, 0.24, 0.08]} castShadow>
        <boxGeometry args={[0.07, 0.15, 0.55]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.35} metalness={0.55} />
      </mesh>

      {/* Seat number */}
      <Text position={[0, 0.24, -0.02]} fontSize={0.14} color={isBooked ? '#666' : '#fff'}
        anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
        {seat.number}
      </Text>

      {/* Type indicators */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.88, 0.35]}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} metalness={0.9} roughness={0.1} />
        </mesh>
      )}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.88, 0.35]}>
          <torusGeometry args={[0.07, 0.025, 6, 12]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}, (prev, next) =>
  prev.seat.status === next.seat.status &&
  prev.seat.isSelected === next.seat.isSelected &&
  prev.seat.isBooked === next.seat.isBooked &&
  prev.isHighlighted === next.isHighlighted &&
  prev.soundEnabled === next.soundEnabled &&
  prev.position[0] === next.position[0] &&
  prev.position[1] === next.position[1] &&
  prev.position[2] === next.position[2]
);

// --- SEAT TOOLTIP ---
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const typeLabel: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const typeBadge: Record<string, string> = { standard: 'bg-gray-500', premium: 'bg-blue-500', vip: 'bg-purple-500', accessible: 'bg-teal-500' };

  return (
    <Html position={[position[0], position[1] + 1.5, position[2]]} center distanceFactor={14}>
      <div className="bg-slate-900/95 backdrop-blur-lg text-white px-4 py-3 rounded-xl shadow-2xl border border-white/15 min-w-[180px] pointer-events-none select-none">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-sm">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeBadge[seat.type]} text-white`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-emerald-400">${seat.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
          </span>
        </div>
        {!isBooked && <p className="mt-1.5 pt-1.5 border-t border-white/10 text-center text-[10px] text-gray-500">Click to {isSelected ? 'deselect' : 'select'}</p>}
      </div>
    </Html>
  );
}

// --- THEATER SCREEN ---
function TheaterScreen({ movieTitle }: { movieTitle: string }) {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Wall behind */}
      <mesh position={[0, 0, -0.8]}>
        <planeGeometry args={[38, 18]} />
        <meshStandardMaterial color="#0c0c20" roughness={0.95} />
      </mesh>

      {/* Screen frame */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[SCREEN_WIDTH + 1.4, SCREEN_HEIGHT + 1]} />
        <meshStandardMaterial color="#15152a" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.5, SCREEN_HEIGHT + 0.3]} />
        <meshStandardMaterial color="#1a1a35" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Screen surface */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#0e0e18" />
      </mesh>

      {/* Screen glow - only 1 main light */}
      <pointLight position={[0, 0, 5]} intensity={3} distance={35} color="#5577dd" />

      {/* Curtains - simplified: 4 panels per side */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 2.2), 0, 0]}>
          {[0, 1, 2, 3].map(i => (
            <mesh key={i} position={[side * (i * 0.65), 0, Math.sin(i * 0.9) * 0.12]} castShadow>
              <boxGeometry args={[0.7, SCREEN_HEIGHT + 3.5, 0.3 + Math.sin(i) * 0.08]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#8b2020' : '#a52828'} roughness={0.88} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Top pelmet */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 1.6, 0.15]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 9, 1.8, 0.7]} />
        <meshStandardMaterial color="#8b2020" roughness={0.88} />
      </mesh>

      {/* Title */}
      <Text position={[0, -SCREEN_HEIGHT / 2 - 1, 0.2]} fontSize={0.5} color="#5e6d8a" anchorX="center" letterSpacing={0.12}>
        {`NOW SHOWING — ${movieTitle.toUpperCase()}`}
      </Text>
    </group>
  );
}

// --- WALL SCONCE (no separate point light component) ---
function WallSconces() {
  const positions = useMemo(() => {
    const p: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 4; i++) {
      p.push({ pos: [-16.8, 5.5, -4 + i * 8], rot: [0, Math.PI / 2, 0] });
      p.push({ pos: [16.8, 5.5, -4 + i * 8], rot: [0, -Math.PI / 2, 0] });
    }
    return p;
  }, []);

  return (
    <group>
      {positions.map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
          <mesh>
            <boxGeometry args={[0.25, 0.35, 0.12]} />
            <meshStandardMaterial color="#c4982a" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.14, 0.1]}>
            <cylinderGeometry args={[0.12, 0.18, 0.25, 6, 1, true]} />
            <meshStandardMaterial color="#fff5e0" roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.9} emissive="#ffe8b0" emissiveIntensity={0.3} />
          </mesh>
          {/* Only 1 light per sconce with limited range */}
          <pointLight position={[0, 0.1, 0.18]} intensity={0.6} distance={4.5} color="#ffdd99" />
        </group>
      ))}
    </group>
  );
}

// --- THEATER ENVIRONMENT (Optimized - fewer lights, brighter materials) ---
const TheaterEnvironment = React.memo(function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();
  const ceilingGroupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#0a0a18', 0.007);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    if (ceilingGroupRef.current) {
      ceilingGroupRef.current.children.forEach(child => {
        child.traverse(obj => {
          if (obj instanceof THREE.PointLight) {
            const t = lightsOn ? 1.2 : 0.12;
            obj.intensity += (t - obj.intensity) * delta * 3;
          }
        });
      });
    }
  });

  const steps = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    z: i * 1.8 + 1.5,
    y: i * 0.4,
    index: i,
  })), []);

  const stars = useMemo(() => Array.from({ length: 20 }, () => ({
    x: (Math.random() - 0.5) * 28,
    z: (Math.random() - 0.5) * 30 + 5,
  })), []);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.01, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[45, 55]} />
        <meshStandardMaterial color="#1a1a30" roughness={0.85} metalness={0.08} />
      </mesh>
      {/* Carpet aisle */}
      <mesh position={[0, 0.005, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.2, 22]} />
        <meshStandardMaterial color="#2a1515" roughness={0.95} />
      </mesh>

      {/* Walls */}
      <mesh position={[-17, 6, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[48, 15]} />
        <meshStandardMaterial color="#161630" roughness={0.85} />
      </mesh>
      <mesh position={[17, 6, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[48, 15]} />
        <meshStandardMaterial color="#161630" roughness={0.85} />
      </mesh>
      <mesh position={[0, 6, 23]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[36, 15]} />
        <meshStandardMaterial color="#121228" roughness={0.88} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 13, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[36, 40]} />
        <meshStandardMaterial color="#0d0d20" roughness={0.95} />
      </mesh>

      {/* Wall sconces */}
      <WallSconces />

      {/* Stadium steps */}
      {steps.map(step => (
        <group key={step.index}>
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[31, 0.45, 1.8]} />
            <meshStandardMaterial color="#1e1e38" roughness={0.82} metalness={0.1} />
          </mesh>
          {/* Step riser */}
          <mesh position={[0, step.y + 0.22, step.z + 0.89]}>
            <boxGeometry args={[31, 0.44, 0.02]} />
            <meshStandardMaterial color="#181830" roughness={0.88} />
          </mesh>
          {/* LED strip */}
          <mesh position={[0, step.y + 0.24, step.z + 0.88]}>
            <boxGeometry args={[27, 0.02, 0.02]} />
            <meshBasicMaterial color="#2a4a7a" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Exit signs */}
      {[[-16, 5.5, 20], [16, 5.5, 20]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[1.5, 0.45, 0.06]} radius={0.04} smoothness={2}>
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </RoundedBox>
          <Text position={[0, 0, 0.04]} fontSize={0.2} color="#fff" anchorX="center">EXIT</Text>
        </group>
      ))}

      {/* Ceiling lights - only 4 for performance */}
      <group ref={ceilingGroupRef}>
        {[[-8, 12.8, 4], [8, 12.8, 4], [-8, 12.8, 14], [8, 12.8, 14]].map((pos, i) => (
          <group key={i} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.3, 0.4, 0.12, 8]} />
              <meshStandardMaterial color="#252540" roughness={0.5} metalness={0.5} />
            </mesh>
            <pointLight intensity={lightsOn ? 1.2 : 0.12} distance={12} color="#ffe8c8" />
          </group>
        ))}
      </group>

      {/* Projector booth */}
      <group position={[0, 11, 21]}>
        <mesh castShadow>
          <boxGeometry args={[3.5, 2.5, 3.5]} />
          <meshStandardMaterial color="#181830" roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.4, -1.8]}>
          <cylinderGeometry args={[0.18, 0.18, 0.25, 10]} />
          <meshStandardMaterial color="#445" roughness={0.3} metalness={0.7} />
        </mesh>
        <spotLight position={[0, -0.4, -1.85]} angle={0.18} penumbra={0.5} intensity={1.8} distance={38} color="#d4ddff" />
      </group>

      {/* Speakers */}
      {[-16.3, 16.3].map((x, si) => (
        <group key={si}>
          {[SCREEN_Y - 1.5, SCREEN_Y + 1.5].map((y, yi) => (
            <RoundedBox key={yi} args={[0.5, 1.6, 0.7]} radius={0.06} smoothness={2}
              position={[x, y, SCREEN_Z + 1.5]}>
              <meshStandardMaterial color="#1a1a2a" roughness={0.75} metalness={0.3} />
            </RoundedBox>
          ))}
        </group>
      ))}

      {/* Ceiling stars */}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, 12.6, s.z]}>
          <sphereGeometry args={[0.025, 4, 4]} />
          <meshBasicMaterial color="#4a5568" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

// --- ROW LABELS ---
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, i) => {
        const z = i * 1.8 + 1.5;
        const y = i * 0.4 + 0.5;
        return (
          <group key={row}>
            <Text position={[-14, y, z]} fontSize={0.45} color="#5b8af6" anchorX="center" anchorY="middle">{row}</Text>
            <Text position={[14, y, z]} fontSize={0.45} color="#5b8af6" anchorX="center" anchorY="middle">{row}</Text>
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
    <div style={{
      position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      zIndex: 5, pointerEvents: 'auto', overflow: 'hidden', borderRadius: 2, backgroundColor: '#000',
    }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0`}
        title="Trailer" frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// --- MINIMAP ---
function MiniMap({ seats, selectedIds, onSeatClick }: { seats: Seat[]; selectedIds: string[]; onSeatClick: (s: Seat) => void }) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const dotColor = (s: Seat) => {
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-600';
    if (selectedIds.includes(s.id)) return 'bg-emerald-400 ring-1 ring-emerald-300';
    if (s.type === 'vip') return 'bg-purple-400';
    if (s.type === 'premium') return 'bg-blue-400';
    if (s.type === 'accessible') return 'bg-teal-400';
    return 'bg-slate-300';
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-lg p-3 rounded-xl border border-white/10">
      <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full mb-2" />
      <p className="text-[8px] text-center text-slate-400 mb-1.5 tracking-widest uppercase">Screen</p>
      <div className="space-y-1">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-0.5">
            <span className="text-[7px] text-slate-500 w-2.5 text-right">{row}</span>
            <div className="flex gap-[3px]">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={!!(seat.status === 'booked' || seat.isBooked)}
                  className={`w-[7px] h-[7px] rounded-sm transition-transform hover:scale-[2.5] ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-400" /> Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="bg-white/5 rounded-lg p-3 flex gap-3">
            <img src={movie.image} alt="" className="w-12 h-[68px] object-cover rounded-md shadow"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="text-white font-semibold text-sm">{movie.title}</p>
              <p className="text-gray-500 text-[11px]">{movie.genre}</p>
              <div className="flex gap-2 mt-1 text-[11px] text-gray-400">
                <span>{movie.duration}</span>
                <span className="px-1 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold">{movie.rating}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-white">{showtime.time}</span>
            <span className="text-gray-500 text-xs">· {showtime.label}</span>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Seats</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-2 py-0.5 rounded text-[11px] font-semibold border
                  ${s.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                    s.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                    'bg-white/5 text-gray-300 border-white/10'}`}>
                  {s.row}{s.number} <span className="text-gray-500">${s.price}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-2.5 space-y-1">
            <div className="flex justify-between text-xs text-gray-400"><span>{selectedSeats.length}× Tickets</span><span>${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-gray-500"><span>Service fee</span><span>$2.50</span></div>
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10"><span>Total</span><span className="text-emerald-400">${(total + 2.5).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20">
              <CreditCard className="w-3.5 h-3.5" /> Pay Now
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
      const mid = Math.floor(rowSeats.length / 2);
      rowSeats.forEach((seat, seatIndex) => {
        const normalizedX = (seatIndex - (rowSeats.length - 1) / 2) / Math.max(rowSeats.length / 2, 1);
        const curvePush = normalizedX * normalizedX * 0.35;
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.08 + (seatIndex >= mid ? 0.65 : -0.65);
        positions.push({ seat, position: [seatX, rowY, rowZ + curvePush] });
      });
    });
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count: number = 4) => {
    const available = seatPositions.filter(({ seat }) => seat.status === 'available' && !seat.isBooked);
    const scored = available.map(({ seat, position }) => ({
      seat,
      score: (14 - Math.abs(position[0])) + (10 - Math.abs(3 - position[2] / 1.8)) + (seat.type === 'vip' ? 5 : seat.type === 'premium' ? 3 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.seat.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);
    const sd = seatPositions.find(s => s.seat.id === seat.id);
    if (sd) {
      const [x, y, z] = sd.position;
      setCameraTarget({ position: new THREE.Vector3(x * 0.3, y + 2, z + 3.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = useCallback((seat: Seat | null, position?: [number, number, number]) => {
    if (seat && position) setHoveredSeat({ seat, position });
    else setHoveredSeat(null);
  }, []);

  const resetView = useCallback(() => {
    if (soundEnabled) playSound('click');
    setCameraTarget({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  }, [soundEnabled, playSound]);

  const changeView = useCallback((mode: ViewMode) => {
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
  }, [soundEnabled, playSound]);

  const handleScreenUpdate = useCallback((r: { left: number; top: number; width: number; height: number; visible: boolean }) => {
    setScreenRect(prev => {
      if (Math.abs(prev.left - r.left) > 1 || Math.abs(prev.top - r.top) > 1 ||
        Math.abs(prev.width - r.width) > 1 || Math.abs(prev.height - r.height) > 1 ||
        prev.visible !== r.visible) return r;
      return prev;
    });
  }, []);

  // Keyboard nav
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
  }, [viewingSeatId, seats, seatPositions, resetView]);

  const viewingSeat = viewingSeatId ? seats.find(s => s.id === viewingSeatId) : null;

  return (
    <div className="relative w-full h-[850px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800/60">

      {youtubeId && <YouTubeOverlay videoId={youtubeId} rect={screenRect} />}

      {/* ===== TOP CONTROLS ===== */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-3 pb-10 px-4">
          <div className="flex items-start justify-between gap-4">

            {/* Left: Movie & Showtime */}
            <div className="flex-1 max-w-[520px]">
              <button onClick={() => setShowMoviePanel(!showMoviePanel)} className="flex items-center gap-2 mb-2 group">
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors">
                  Movie & Showtime
                </span>
                {showMoviePanel ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
              </button>

              {showMoviePanel && (
                <div className="space-y-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {movies.map(movie => (
                      <button key={movie.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                        className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border
                          ${selectedMovie.id === movie.id
                            ? 'bg-blue-600/30 border-blue-400/50 text-white'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}>
                        <img src={movie.image} alt="" className="w-5 h-7 object-cover rounded"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="whitespace-nowrap">{movie.title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {showtimes.map(st => (
                      <button key={st.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(st); }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all border
                          ${selectedShowtime.id === st.id
                            ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-300'
                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/8'
                          }`}>
                        {st.time}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5 bg-white/5 rounded-lg px-3 py-1.5">
                    <img src={selectedMovie.image} alt="" className="w-7 h-10 object-cover rounded shadow"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{selectedMovie.title}</p>
                      <p className="text-gray-500 text-[9px]">{selectedMovie.genre} · {selectedMovie.duration}</p>
                    </div>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold ml-auto flex-shrink-0">{selectedMovie.rating}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex gap-1">
                {[
                  { icon: soundEnabled ? Volume2 : VolumeX, fn: () => setSoundEnabled(!soundEnabled), on: soundEnabled },
                  { icon: Camera, fn: () => { if (soundEnabled) playSound('success'); const c = document.querySelector('canvas'); if (c) { const l = document.createElement('a'); l.download = `view-${Date.now()}.png`; l.href = c.toDataURL('image/png'); l.click(); } } },
                  { icon: Grid3X3, fn: () => setShowMiniMap(!showMiniMap), on: showMiniMap },
                  { icon: lightsOn ? Sun : SunDim, fn: () => setLightsOn(!lightsOn), on: lightsOn },
                ].map(({ icon: Icon, fn, on }, i) => (
                  <button key={i} onClick={fn} className={`w-7 h-7 rounded-md flex items-center justify-center transition-all border
                    ${on ? 'bg-blue-500/25 border-blue-400/40 text-blue-300' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([
                  { m: 'default' as ViewMode, l: 'Free', I: Eye },
                  { m: 'topdown' as ViewMode, l: 'Top', I: Maximize2 },
                  { m: 'front' as ViewMode, l: 'Front', I: Film },
                  { m: 'side' as ViewMode, l: 'Side', I: Armchair },
                ]).map(({ m, l, I }) => (
                  <button key={m} onClick={() => changeView(m)}
                    className={`px-2 py-1 rounded-md text-[9px] font-semibold transition-all border flex items-center gap-1
                      ${viewMode === m ? 'bg-white/12 border-white/20 text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <I className="w-2.5 h-2.5" />{l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { if (soundEnabled) playSound('success'); setHighlightedSeats(findBestSeats(4)); setTimeout(() => setHighlightedSeats([]), 6000); }}
                  className="px-2.5 py-1 rounded-md text-[9px] font-semibold bg-amber-500/20 border border-amber-500/25 text-amber-400 hover:bg-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Best
                </button>
                <button onClick={resetView}
                  className="px-2.5 py-1 rounded-md text-[9px] font-semibold bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-1">
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Viewing indicator */}
      {viewingSeat && (
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 z-20">
          <div className="bg-blue-600/20 backdrop-blur-lg text-white px-4 py-1.5 rounded-full flex items-center gap-2 border border-blue-500/25">
            <Eye className="w-3 h-3 text-blue-400" />
            <span className="text-[11px] font-semibold">Row {viewingSeat.row} · Seat {viewingSeat.number}</span>
            <span className="text-gray-500 text-[9px]">· Arrow keys to navigate</span>
          </div>
        </div>
      )}

      {/* Seat guide */}
      <div className="absolute left-3 bottom-3 z-10">
        <button onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1 bg-black/60 backdrop-blur-lg px-2.5 py-1 rounded-md border border-white/10 text-gray-400 hover:text-white text-[10px] font-medium mb-1.5">
          <Info className="w-2.5 h-2.5" /> Guide
          {showGuide ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        </button>
        {showGuide && (
          <div className="bg-black/75 backdrop-blur-lg p-2.5 rounded-lg border border-white/10">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[['#8b95a5', 'Standard'], ['#5b9cf6', 'Premium'], ['#b87af7', 'VIP'], ['#3ecfb8', 'Accessible'], ['#34d399', 'Selected'], ['#4b5563', 'Booked'], ['#fbbf24', 'Recommended']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                  <span className="text-gray-400 text-[10px]">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Minimap */}
      {showMiniMap && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} selectedIds={selectedSeats.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* Booking panel */}
      <div className="absolute right-3 bottom-3 z-10">
        <div className="bg-slate-900/90 backdrop-blur-lg p-3.5 rounded-xl border border-white/10 w-[240px]">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2.5 flex items-center gap-1.5">
            <Ticket className="w-3 h-3 text-emerald-400" /> Your Tickets
          </h3>
          {selectedSeats.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mb-2.5">
                {selectedSeats.map(seat => (
                  <span key={seat.id} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border
                    ${seat.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/20' :
                      seat.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border-blue-500/20' :
                      'bg-white/5 text-gray-300 border-white/8'}`}>
                    {seat.row}{seat.number} <span className="text-gray-500">${seat.price}</span>
                  </span>
                ))}
              </div>
              <div className="space-y-0.5 text-[11px] border-t border-white/10 pt-2">
                <div className="flex justify-between text-gray-400"><span>{selectedSeats.length} ticket{selectedSeats.length > 1 ? 's' : ''}</span><span>${totalPrice.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Fee</span><span>$2.50</span></div>
                <div className="flex justify-between text-xs font-bold text-white pt-1 border-t border-white/10"><span>Total</span><span className="text-emerald-400">${(totalPrice + 2.5).toFixed(2)}</span></div>
              </div>
              <button onClick={() => setShowBookingModal(true)}
                className="w-full mt-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-colors">
                <Check className="w-3.5 h-3.5" /> Checkout
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <Armchair className="w-7 h-7 text-gray-700 mx-auto mb-1.5" />
              <p className="text-gray-500 text-[11px]">No seats selected</p>
              <p className="text-gray-600 text-[9px] mt-0.5">Click a seat to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== 3D CANVAS ===== */}
      <Canvas
        shadows
        camera={{ position: [DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z], fov: 50, near: 0.5, far: 80 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
          powerPreference: 'high-performance',
        }}
        style={{ background: '#0a0a18' }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
      >
        <CameraController target={cameraTarget} isAnimating={isAnimating} onDone={() => setIsAnimating(false)} controlsRef={controlsRef} />

        {/* Lighting - brighter for visibility */}
        <ambientLight intensity={0.55} color="#c8d4e8" />
        <directionalLight
          position={[5, 18, 8]} intensity={0.8} color="#f0e6d0"
          castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-18} shadow-camera-right={18}
          shadow-camera-top={18} shadow-camera-bottom={-18}
          shadow-bias={-0.002}
        />
        <directionalLight position={[-8, 12, -5]} intensity={0.25} color="#8888cc" />
        <hemisphereLight args={['#3344668', '#1a1a30', 0.3]} />

        {/* Screen tracking */}
        {youtubeId && <ScreenPositionTracker onUpdate={handleScreenUpdate} />}

        <TheaterScreen movieTitle={selectedMovie.title} />
        <RowLabels rows={rows} />
        <TheaterEnvironment lightsOn={lightsOn} />

        {seatPositions.map(({ seat, position }) => (
          <Seat3D key={seat.id} seat={seat} position={position} onClick={handleSeatClick}
            onHover={handleSeatHover} isHighlighted={highlightedSeats.includes(seat.id)}
            soundEnabled={soundEnabled} playSound={playSound} />
        ))}

        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        <OrbitControls ref={controlsRef} minDistance={3} maxDistance={35}
          maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.1}
          target={[DEFAULT_LOOK_AT.x, DEFAULT_LOOK_AT.y, DEFAULT_LOOK_AT.z]}
          enableDamping dampingFactor={0.06} rotateSpeed={0.5} zoomSpeed={0.8} />
      </Canvas>

      <BookingModal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)}
        onConfirm={() => { if (soundEnabled) playSound('success'); setShowBookingModal(false); alert('🎬 Booking confirmed!'); }}
        selectedSeats={selectedSeats} movie={selectedMovie} showtime={selectedShowtime} total={totalPrice} />

      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-[1]" />
    </div>
  );
}
