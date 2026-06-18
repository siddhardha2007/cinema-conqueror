import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw, Eye, Film, Clock, Volume2, VolumeX, Camera,
  Grid3X3, Ticket, CreditCard, Info,
  X, Check, Maximize2, ChevronDown, ChevronRight,
  Armchair, Sparkles, Sun, SunDim, Sofa
} from 'lucide-react';

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

const SCREEN_Z = -14;
const SCREEN_Y = 7;
const SCREEN_WIDTH = 24;
const SCREEN_HEIGHT = 11;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 12, 26);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 4, 0);
const Rs = '₹';

const SEAT_COLORS = {
  standard: { base: '#2d3a4f', hover: '#3d4f6a', selected: '#059669', booked: '#111122' },
  premium:  { base: '#1e3a7a', hover: '#2952a3', selected: '#059669', booked: '#111122' },
  vip:      { base: '#5b21b6', hover: '#6d28d9', selected: '#059669', booked: '#111122' },
  accessible:{ base: '#0f766e', hover: '#0d9488', selected: '#059669', booked: '#111122' },
} as const;

const movies = [
  { id: '1', title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911BTUgMe1YdBGm.jpg", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", duration: "2h 32m", rating: "UA", genre: "Action • Crime" },
  { id: '2', title: "Inception",       image: "https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", duration: "2h 28m", rating: "UA", genre: "Sci-Fi • Action" },
  { id: '3', title: "Interstellar",    image: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", duration: "2h 49m", rating: "UA", genre: "Sci-Fi • Adventure" },
  { id: '4', title: "Oppenheimer",     image: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", duration: "3h 00m", rating: "A",  genre: "Biography • Drama" },
];

const showtimes = [
  { id: '1', time: '10:00 AM', label: 'Morning' },
  { id: '2', time: '1:30 PM',  label: 'Matinee' },
  { id: '3', time: '4:00 PM',  label: 'Afternoon' },
  { id: '4', time: '7:00 PM',  label: 'Evening' },
  { id: '5', time: '9:30 PM',  label: 'Late Night' },
];

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([^#&?]{11})/);
  return m ? m[1] : null;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── AUDIO ───────────────────────────────────────────────────────────────────
const useAudio = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((type: 'click' | 'select' | 'hover' | 'success' | 'error') => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const freqs: Record<string, number> = { click:550, select:750, hover:420, success:880, error:220 };
      osc.frequency.value = freqs[type];
      osc.type = type === 'error' ? 'sawtooth' : 'sine';
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* silent */ }
  }, []);
  return { playSound };
};

// ─── SCREEN POSITION TRACKER ──────────────────────────────────────────────────
function ScreenPositionTracker({ onUpdate }: {
  onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void
}) {
  const { camera, gl } = useThree();
  const lastRef   = useRef({ left:0, top:0, width:0, height:0, visible:false });
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 6 !== 0) return; // throttle more aggressively

    const hw = SCREEN_WIDTH / 2, hh = SCREEN_HEIGHT / 2, sz = SCREEN_Z + 0.05;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toScreen = new THREE.Vector3(0, SCREEN_Y, sz).sub(camera.position).normalize();
    const visible  = camDir.dot(toScreen) > 0.1;

    if (!visible) {
      if (lastRef.current.visible) { lastRef.current = { left:0, top:0, width:0, height:0, visible:false }; onUpdate(lastRef.current); }
      return;
    }

    const canvas = gl.domElement;
    const cRect  = canvas.getBoundingClientRect();
    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * cRect.width, y: ((-v.y + 1) / 2) * cRect.height };
    };

    const tl = project(-hw, SCREEN_Y + hh, sz), tr = project(hw, SCREEN_Y + hh, sz);
    const bl = project(-hw, SCREEN_Y - hh, sz), br = project(hw, SCREEN_Y - hh, sz);
    const l = Math.min(tl.x, bl.x), t = Math.min(tl.y, tr.y);
    const r = Math.max(tr.x, br.x), b = Math.max(bl.y, br.y);

    const result = {
      left: l + cRect.left + 1, top: t + cRect.top + 1,
      width: Math.max(0, r - l - 2), height: Math.max(0, b - t - 2),
      visible: (r - l) > 40 && (b - t) > 25,
    };

    const prev = lastRef.current;
    if (Math.abs(prev.left - result.left) > 2 || Math.abs(prev.top - result.top) > 2 ||
        Math.abs(prev.width - result.width) > 2 || Math.abs(prev.height - result.height) > 2 ||
        prev.visible !== result.visible) {
      lastRef.current = result;
      onUpdate(result);
    }
  });
  return null;
}

// ─── CAMERA CONTROLLER ───────────────────────────────────────────────────────
function CameraController({ target, isAnimating, onDone, controlsRef }: {
  target: CameraTarget; isAnimating: boolean; onDone: () => void; controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progressRef    = useRef(0);
  const startPosRef    = useRef(new THREE.Vector3());
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
    progressRef.current = Math.min(progressRef.current + delta * 1.6, 1);
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

// ─── SEAT 3D (OPTIMISED) ─────────────────────────────────────────────────────
const SeatMesh = React.memo(function SeatMesh({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(1);

  const isBooked   = seat.status === 'booked'   || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors     = SEAT_COLORS[seat.type];

  // Single smooth scale animation — no per-frame material mutation
  useFrame((_, delta) => {
    const target = hovered && !isBooked ? 1.1 : 1;
    scaleRef.current += (target - scaleRef.current) * Math.min(delta * 12, 1);
    if (groupRef.current) groupRef.current.scale.setScalar(scaleRef.current);
  });

  const color = isBooked ? colors.booked : isSelected ? colors.selected :
                isHighlighted ? '#f59e0b' : hovered ? colors.hover : colors.base;
  const emInt = isBooked ? 0 : isSelected ? 0.9 : isHighlighted ? 0.7 : hovered ? 0.35 : 0.08;

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!isBooked) { if (soundEnabled) playSound('select'); onClick(seat); }
    else if (soundEnabled) playSound('error');
  }, [isBooked, soundEnabled, playSound, onClick, seat]);

  const handleEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
    if (soundEnabled && !isBooked) playSound('hover');
    document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    onHover(seat, position);
  }, [soundEnabled, isBooked, playSound, onHover, seat, position]);

  const handleLeave = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHover(null);
  }, [onHover]);

  return (
    <group ref={groupRef} position={position}>
      {/* Selected / highlighted glow — only when needed */}
      {(isSelected || isHighlighted) && (
        <pointLight
          position={[0, 0.6, 0]}
          intensity={isSelected ? 1.8 : 1.2}
          distance={2.2}
          color={isSelected ? '#10b981' : '#f59e0b'}
        />
      )}

      {/* Base platform */}
      <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.58, 0.64, 0.07, 10]} />
        <meshStandardMaterial color="#0a0a1c" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Cushion seat */}
      <RoundedBox
        args={[0.95, 0.2, 0.82]} radius={0.07} smoothness={3}
        position={[0, 0.1, 0]} castShadow receiveShadow
        onClick={handleClick} onPointerEnter={handleEnter} onPointerLeave={handleLeave}
      >
        <meshStandardMaterial color={color} roughness={0.65} metalness={0.05}
          emissive={color} emissiveIntensity={emInt} />
      </RoundedBox>

      {/* Back rest */}
      <RoundedBox
        args={[0.95, 0.88, 0.14]} radius={0.07} smoothness={3}
        position={[0, 0.6, 0.4]} castShadow receiveShadow
        onClick={handleClick} onPointerEnter={handleEnter} onPointerLeave={handleLeave}
      >
        <meshStandardMaterial color={color} roughness={0.65} metalness={0.05}
          emissive={color} emissiveIntensity={emInt * 0.7} />
      </RoundedBox>

      {/* Headrest */}
      <RoundedBox
        args={[seat.type === 'vip' ? 0.72 : 0.85, 0.26, 0.12]} radius={0.06} smoothness={2}
        position={[0, 1.1, 0.38]} castShadow
      >
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.06}
          emissive={color} emissiveIntensity={emInt * 0.45} />
      </RoundedBox>

      {/* Armrests */}
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * 0.555, 0.3, 0.06]}>
          <mesh castShadow>
            <boxGeometry args={[0.055, 0.2, 0.66]} />
            <meshStandardMaterial color="#aaaacc" roughness={0.15} metalness={0.95} />
          </mesh>
          <RoundedBox args={[0.1, 0.055, 0.52]} radius={0.02} smoothness={2} position={[0, 0.08, 0]}>
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.06} />
          </RoundedBox>
        </group>
      ))}

      {/* LED accent strip */}
      <mesh position={[0, 0.175, 0.42]}>
        <boxGeometry args={[0.65, 0.012, 0.012]} />
        <meshStandardMaterial
          color={isSelected ? '#10b981' : '#3b82f6'}
          emissive={isSelected ? '#10b981' : '#3b82f6'}
          emissiveIntensity={2.5}
        />
      </mesh>

      {/* Seat number */}
      <Text position={[0, 0.225, -0.04]} fontSize={0.1} color={isBooked ? '#333' : '#e2e8f0'}
        anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
        {seat.number}
      </Text>

      {/* VIP gem */}
      {seat.type === 'vip' && (
        <mesh position={[0, 1.38, 0.36]}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} metalness={1} roughness={0} />
        </mesh>
      )}
      {/* Premium gem */}
      {seat.type === 'premium' && (
        <mesh position={[0, 1.25, 0.36]}>
          <sphereGeometry args={[0.058, 10, 10]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.8} metalness={0.9} roughness={0.05} />
        </mesh>
      )}
      {/* Accessible ring */}
      {seat.type === 'accessible' && (
        <mesh position={[0, 1.25, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.02, 8, 16]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.5} metalness={0.8} roughness={0.1} />
        </mesh>
      )}
    </group>
  );
});

// ─── THEATER SCREEN ───────────────────────────────────────────────────────────
function TheaterScreen({ movieTitle }: { movieTitle: string }) {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Back wall */}
      <mesh position={[0, 0, -1.5]} receiveShadow>
        <boxGeometry args={[50, 26, 0.4]} />
        <meshStandardMaterial color="#050510" roughness={0.98} />
      </mesh>

      {/* Gold outer frame */}
      <mesh position={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 3.5, SCREEN_HEIGHT + 3, 0.16]} />
        <meshStandardMaterial color="#b8902a" roughness={0.25} metalness={0.92} emissive="#b8902a" emissiveIntensity={0.15} />
      </mesh>

      {/* Dark inner frame */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[SCREEN_WIDTH + 1.4, SCREEN_HEIGHT + 1.2, 0.12]} />
        <meshStandardMaterial color="#0c0c20" roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Matte masking border */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.5, SCREEN_HEIGHT + 0.3, 0.05]} />
        <meshStandardMaterial color="#040408" roughness={0.99} metalness={0} />
      </mesh>

      {/* THE SCREEN SURFACE */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial color="#060610" roughness={0.12} metalness={0.1}
          emissive="#1a2860" emissiveIntensity={0.22} />
      </mesh>

      {/* Screen lighting — kept minimal to avoid blank-out */}
      <pointLight position={[0, 0, 5]} intensity={3} distance={35} color="#4466cc" />
      <pointLight position={[-9, 2, 3]} intensity={1.2} distance={20} color="#5577dd" />
      <pointLight position={[ 9, 2, 3]} intensity={1.2} distance={20} color="#5577dd" />

      {/* Curtains — static, no per-frame updates */}
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4), 0, 1]}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <mesh key={i} position={[side * i * 0.52, 0, Math.sin(i * 0.85) * 0.25]} castShadow>
              <boxGeometry args={[0.45, SCREEN_HEIGHT + 6, 0.16]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#7a1515' : '#961c1c'} roughness={0.98} />
            </mesh>
          ))}
          {/* Gold trim */}
          <mesh position={[side * -0.02, 0, -0.09]}>
            <boxGeometry args={[0.05, SCREEN_HEIGHT + 6, 0.18]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
              emissive="#c8a850" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}

      {/* Curtain rod */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 3.5, 1.35]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, SCREEN_WIDTH + 13, 12]} />
        <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.97} />
      </mesh>
      {([-1, 1] as const).map(side => (
        <mesh key={side} position={[side * (SCREEN_WIDTH / 2 + 7), SCREEN_HEIGHT / 2 + 3.5, 1.35]} castShadow>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={1} emissive="#ffd700" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Pelmet */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.2, 0.95]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 13, 2.5, 0.9]} />
        <meshStandardMaterial color="#6b0f0f" roughness={0.95} />
      </mesh>
      {/* Gold pelmet trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 1.0, 1.41]}>
        <boxGeometry args={[SCREEN_WIDTH + 13, 0.1, 0.04]} />
        <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9} emissive="#c8a850" emissiveIntensity={0.45} />
      </mesh>

      {/* NOW SHOWING */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 1.6, 0.4]}>
        <Text fontSize={0.52} color="#8899cc" anchorX="center" letterSpacing={0.18}>
          NOW SHOWING
        </Text>
        <Text position={[0, -0.78, 0]} fontSize={0.4} color="#b8ccee"
          anchorX="center" letterSpacing={0.08} maxWidth={SCREEN_WIDTH - 2}>
          {movieTitle.toUpperCase()}
        </Text>
      </group>

      {/* Spotlight from above */}
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 5, 3]}
        angle={0.65} penumbra={0.45} intensity={2}
        distance={28} color="#99aadd" castShadow={false} />
    </group>
  );
}

// ─── WALL SCONCES (reduced count) ────────────────────────────────────────────
function WallSconces() {
  const positions = useMemo(() => {
    const p: Array<{ pos: [number, number, number]; side: number }> = [];
    for (let i = 0; i < 4; i++) {
      p.push({ pos: [-18.4, 5.5, -4 + i * 8],  side: -1 });
      p.push({ pos: [ 18.4, 5.5, -4 + i * 8],  side:  1 });
    }
    return p;
  }, []);

  return (
    <group>
      {positions.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.side * -Math.PI / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.26, 0.06, 8]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.92} />
          </mesh>
          <mesh position={[0, 0, 0.3]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color="#fff9e0" transparent opacity={0.7}
              emissive="#ffdd88" emissiveIntensity={0.7} />
          </mesh>
          <pointLight position={[0, 0, 0.35]} intensity={0.7} distance={7} color="#ffcc66" />
        </group>
      ))}
    </group>
  );
}

// ─── THEATER ENVIRONMENT ─────────────────────────────────────────────────────
const TheaterEnvironment = React.memo(function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();
  // Shared mutable ref for ceiling light intensity target
  const intensityRef = useRef(lightsOn ? 2.5 : 0.1);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#05050d', 0.006);
    return () => { scene.fog = null; };
  }, [scene]);

  useEffect(() => { intensityRef.current = lightsOn ? 2.5 : 0.1; }, [lightsOn]);

  const steps = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ z: i * 1.9 + 1, y: i * 0.42 })),
  []);

  // Stable star positions
  const stars = useMemo(() =>
    Array.from({ length: 60 }, () => ({
      x: (Math.random() - 0.5) * 36,
      z: (Math.random() - 0.5) * 44 + 5,
      s: 0.014 + Math.random() * 0.018,
      gold: Math.random() > 0.85,
    })),
  []);

  const ceilingLightPositions: [number, number, number][] = useMemo(() => [
    [-11, 15, -1], [11, 15, -1],
    [-11, 15, 7],  [11, 15, 7],
    [-11, 15, 15], [11, 15, 15],
    [0, 15, 7],
  ], []);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.01, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[55, 65]} />
        <meshStandardMaterial color="#0d0d1c" roughness={0.35} metalness={0.3} />
      </mesh>

      {/* Center aisle carpet */}
      <mesh position={[0, 0.006, 9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.5, 26]} />
        <meshStandardMaterial color="#3d0a0a" roughness={0.99} />
      </mesh>

      {/* Walls */}
      <mesh position={[-19.5, 7, 4]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[55, 16]} />
        <meshStandardMaterial color="#0c0c1e" roughness={0.92} />
      </mesh>
      <mesh position={[19.5, 7, 4]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[55, 16]} />
        <meshStandardMaterial color="#0c0c1e" roughness={0.92} />
      </mesh>
      <mesh position={[0, 7, 27]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[42, 16]} />
        <meshStandardMaterial color="#09091a" roughness={0.96} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 15.5, 6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 48]} />
        <meshStandardMaterial color="#070715" roughness={0.96} />
      </mesh>

      {/* Gold wall chair-rail */}
      {([-19.3, 19.3] as const).map((xp, i) => (
        <mesh key={i} position={[xp, 3.2, 4]}>
          <boxGeometry args={[0.07, 0.1, 55]} />
          <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.92}
            emissive="#c8a850" emissiveIntensity={0.18} />
        </mesh>
      ))}

      <WallSconces />

      {/* Tiered steps */}
      {steps.map((step, i) => (
        <group key={i}>
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[36, 0.46, 1.9]} />
            <meshStandardMaterial color="#181830" roughness={0.72} />
          </mesh>
          <mesh position={[0, step.y + 0.24, step.z + 0.94]}>
            <boxGeometry args={[36, 0.46, 0.04]} />
            <meshStandardMaterial color="#0f0f26" roughness={0.85} />
          </mesh>
          {/* LED strip */}
          <mesh position={[0, step.y + 0.252, step.z + 0.93]}>
            <boxGeometry args={[32, 0.022, 0.022]} />
            <meshBasicMaterial color="#3a55aa" />
          </mesh>
          <pointLight position={[0, step.y + 0.3, step.z + 0.95]}
            intensity={0.22} distance={4} color="#3a55aa" />
        </group>
      ))}

      {/* Side aisle LED strips */}
      {([-14.5, 14.5] as const).map((xp, i) => (
        <mesh key={i} position={[xp, 0.008, 9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 26]} />
          <meshStandardMaterial color="#c8a850" emissive="#c8a850" emissiveIntensity={1.4} />
        </mesh>
      ))}

      {/* Exit signs */}
      {([[-17, 6.8, 23], [17, 6.8, 23]] as const).map((pos, i) => (
        <group key={i} position={pos}>
          <RoundedBox args={[1.9, 0.58, 0.1]} radius={0.05} smoothness={2} castShadow>
            <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={1.8} />
          </RoundedBox>
          <Text position={[0, 0, 0.06]} fontSize={0.25} color="#fff" anchorX="center">EXIT</Text>
          <pointLight position={[0, 0, 0.4]} intensity={0.9} distance={5} color="#059669" />
        </group>
      ))}

      {/* Ceiling lights — no per-frame material mutation, use pointLight intensity directly */}
      <CeilingLights positions={ceilingLightPositions} lightsOn={lightsOn} />

      {/* Projector booth */}
      <group position={[0, 12.5, 25]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5, 3.2, 4.5]} />
          <meshStandardMaterial color="#0c0c1e" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.3, -2.27]}>
          <planeGeometry args={[3.2, 1.6]} />
          <meshStandardMaterial color="#1a1a3e" transparent opacity={0.5} />
        </mesh>
        <group position={[0, -0.25, -1.8]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.88, 12]} />
            <meshStandardMaterial color="#252538" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.15, 0.1, 12]} />
            <meshStandardMaterial color="#88aacc" transparent opacity={0.8}
              emissive="#88aacc" emissiveIntensity={0.5} />
          </mesh>
          <spotLight position={[0, 0, -0.55]} angle={0.22} penumbra={0.35}
            intensity={3} distance={48} color="#c8d8ff" castShadow={false} />
        </group>
      </group>

      {/* Speakers */}
      {([
        [-19, SCREEN_Y - 2.5, SCREEN_Z + 2.5],
        [ 19, SCREEN_Y - 2.5, SCREEN_Z + 2.5],
        [-19, SCREEN_Y + 1.8, SCREEN_Z + 2.5],
        [ 19, SCREEN_Y + 1.8, SCREEN_Z + 2.5],
      ] as const).map((pos, i) => (
        <group key={i} position={pos}>
          <RoundedBox args={[0.65, 2.1, 0.85]} radius={0.08} smoothness={2} castShadow>
            <meshStandardMaterial color="#080818" roughness={0.75} />
          </RoundedBox>
          <mesh position={[0, 0.5, 0.44]}>
            <circleGeometry args={[0.055, 10]} />
            <meshStandardMaterial color="#c8a850" emissive="#c8a850" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}

      {/* Stars */}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, 15.3, s.z]}>
          <sphereGeometry args={[s.s, 5, 5]} />
          <meshBasicMaterial color={s.gold ? '#ffe8a0' : '#e8eeff'} />
        </mesh>
      ))}

      {/* Simple chandelier */}
      <group position={[0, 15.1, 6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.4, 8]} />
          <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.98} />
        </mesh>
        <mesh position={[0, -1.1, 0]}>
          <torusGeometry args={[1.7, 0.055, 8, 36]} />
          <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.98}
            emissive="#c8a850" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, -1.1, 0]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#fff9e0" transparent opacity={0.45}
            emissive="#ffe8a0" emissiveIntensity={1} />
        </mesh>
        <pointLight position={[0, -1.1, 0]} intensity={3} distance={16} color="#ffe8b0" castShadow />
      </group>
    </group>
  );
});

// Separate ceiling lights component so lightsOn can drive it without re-rendering entire environment
function CeilingLights({ positions, lightsOn }: { positions: [number, number, number][]; lightsOn: boolean }) {
  const lightsRef = useRef<THREE.PointLight[]>([]);
  useFrame((_, delta) => {
    const target = lightsOn ? 2.2 : 0.08;
    lightsRef.current.forEach(l => {
      if (l) l.intensity += (target - l.intensity) * Math.min(delta * 4, 1);
    });
  });

  return (
    <group>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.36, 0.46, 0.13, 12]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.65} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.04, 12]} />
            <meshStandardMaterial color="#fff5e0" transparent opacity={0.35}
              emissive="#ffe8c0" emissiveIntensity={0.5} />
          </mesh>
          <pointLight ref={(el) => { if (el) lightsRef.current[i] = el; }}
            intensity={0.08} distance={14} color="#ffe8c0" />
        </group>
      ))}
    </group>
  );
}

// ─── ROW LABELS ───────────────────────────────────────────────────────────────
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, i) => {
        const z = i * 1.9 + 1, y = i * 0.42 + 0.6;
        return (
          <React.Fragment key={row}>
            {([-1, 1] as const).map(side => (
              <group key={side} position={[side * 16.2, y, z]}>
                <RoundedBox args={[0.62, 0.62, 0.09]} radius={0.06} smoothness={2}>
                  <meshStandardMaterial color="#12102a" roughness={0.4} metalness={0.3}
                    emissive="#c8a850" emissiveIntensity={0.1} />
                </RoundedBox>
                <Text position={[0, 0, 0.06]} fontSize={0.34} color="#e8c87a"
                  anchorX="center" anchorY="middle">{row}
                </Text>
              </group>
            ))}
          </React.Fragment>
        );
      })}
    </group>
  );
}

// ─── SEAT TOOLTIP ─────────────────────────────────────────────────────────────
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked   = seat.status === 'booked'   || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const typeLabel  = { standard:'Standard', premium:'Premium', vip:'VIP', accessible:'Accessible' };
  const typeBadge  = { standard:'bg-slate-500', premium:'bg-blue-600', vip:'bg-purple-600', accessible:'bg-teal-600' };
  return (
    <Html position={[position[0], position[1] + 2, position[2]]} center distanceFactor={14}>
      <div className="bg-slate-950/98 backdrop-blur-2xl text-white px-5 py-4 rounded-2xl shadow-2xl border border-amber-500/30 min-w-[200px] pointer-events-none select-none"
        style={{ boxShadow:'0 0 30px rgba(200,168,80,0.12), 0 16px 32px rgba(0,0,0,0.85)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-bold text-sm">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${typeBadge[seat.type]} text-white`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent mb-2.5" />
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-emerald-400">{Rs}{seat.price.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
          </span>
        </div>
        {!isBooked && (
          <p className="mt-2 pt-2 border-t border-white/10 text-center text-[10px] text-amber-400/70">
            Click to {isSelected ? 'deselect' : 'select'}
          </p>
        )}
      </div>
    </Html>
  );
}

// ─── YOUTUBE OVERLAY ──────────────────────────────────────────────────────────
function YouTubeOverlay({ videoId, rect }: {
  videoId: string;
  rect: { left: number; top: number; width: number; height: number; visible: boolean };
}) {
  if (!rect.visible) return null;
  return (
    <div style={{
      position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      zIndex: 5, pointerEvents: 'auto', overflow: 'hidden', borderRadius: 4, backgroundColor: '#000',
      boxShadow: '0 0 60px rgba(99,102,241,0.5)',
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

// ─── MINIMAP ──────────────────────────────────────────────────────────────────
function MiniMap({ seats, selectedIds, onSeatClick }: { seats: Seat[]; selectedIds: string[]; onSeatClick: (s: Seat) => void }) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const dotColor = (s: Seat) => {
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-700';
    if (selectedIds.includes(s.id))          return 'bg-emerald-400 ring-1 ring-emerald-300';
    if (s.type === 'vip')       return 'bg-purple-500';
    if (s.type === 'premium')   return 'bg-blue-500';
    if (s.type === 'accessible') return 'bg-teal-500';
    return 'bg-slate-400';
  };

  return (
    <div className="bg-slate-950/98 backdrop-blur-2xl p-4 rounded-2xl border border-amber-500/25 shadow-2xl">
      <div className="w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full mb-2.5" />
      <p className="text-[9px] text-center text-amber-400/70 mb-2 tracking-[0.2em] uppercase font-bold">Screen</p>
      <div className="space-y-1.5">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-1">
            <span className="text-[8px] text-amber-400/60 w-3 text-right font-bold">{row}</span>
            <div className="flex gap-1">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={!!(seat.status === 'booked' || seat.isBooked)}
                  className={`w-2 h-2 rounded-sm transition-all hover:scale-[2.5] ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BOOKING MODAL ────────────────────────────────────────────────────────────
function BookingModal({ isOpen, onClose, onConfirm, selectedSeats, movie, showtime, total }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; selectedSeats: Seat[];
  movie: typeof movies[0]; showtime: typeof showtimes[0]; total: number;
}) {
  if (!isOpen) return null;
  const gst = Math.round(total * 0.18);
  const convenience = 50;
  return (
    <div className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        style={{ boxShadow: '0 0 50px rgba(200,168,80,0.12), 0 30px 60px rgba(0,0,0,0.9)' }}
        onClick={e => e.stopPropagation()}>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-400" /> Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4 flex gap-3 border border-amber-500/15">
            <img src={movie.image} alt="" className="w-14 h-20 object-cover rounded-lg shadow-lg"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="text-white font-bold text-base">{movie.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">{movie.genre}</p>
              <div className="flex gap-2 mt-1.5 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{movie.duration}</span>
                <span className="px-1.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">{movie.rating}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3 text-sm border border-amber-500/15">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-white font-semibold">{showtime.time}</span>
            <span className="text-gray-400 text-xs">· {showtime.label}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-amber-500/15">
            <p className="text-[11px] text-amber-400/70 uppercase tracking-wider mb-2 font-semibold">Selected Seats</p>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-3 py-1.5 rounded-lg text-xs font-bold border
                  ${s.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    s.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    'bg-white/5 text-gray-300 border-white/10'}`}>
                  {s.row}{s.number} <span className="text-gray-400 ml-1">{Rs}{s.price.toLocaleString('en-IN')}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-amber-500/15 pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>{selectedSeats.length}× Tickets</span><span>{Rs}{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Convenience fee</span><span>{Rs}{convenience}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>GST (18%)</span><span>{Rs}{gst.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-amber-500/15">
              <span>Total</span>
              <span className="text-emerald-400 text-base">{Rs}{(total + convenience + gst).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-semibold transition-all">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 transition-all">
              <CreditCard className="w-4 h-4" /> Pay Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({
    position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT,
  });
  const [isAnimating,     setIsAnimating]     = useState(false);
  const [viewingSeatId,   setViewingSeatId]   = useState<string | null>(null);
  const [selectedMovie,   setSelectedMovie]   = useState(movies[0]);
  const [selectedShowtime,setSelectedShowtime]= useState(showtimes[3]);
  const [hoveredSeat,     setHoveredSeat]     = useState<{ seat: Seat; position: [number, number, number] } | null>(null);
  const [soundEnabled,    setSoundEnabled]    = useState(true);
  const [showMiniMap,     setShowMiniMap]     = useState(false);
  const [viewMode,        setViewMode]        = useState<ViewMode>('default');
  const [showBookingModal,setShowBookingModal]= useState(false);
  const [highlightedSeats,setHighlightedSeats]= useState<string[]>([]);
  const [lightsOn,        setLightsOn]        = useState(false);
  const [screenRect,      setScreenRect]      = useState({ left:0, top:0, width:0, height:0, visible:false });
  const [showGuide,       setShowGuide]       = useState(false);
  const [showMoviePanel,  setShowMoviePanel]  = useState(true);

  const controlsRef = useRef<any>(null);
  const { playSound } = useAudio();

  const youtubeId    = useMemo(() => getYouTubeId(selectedMovie.video), [selectedMovie.video]);
  const selectedSeats = useMemo(() => seats.filter(s => s.status === 'selected' || s.isSelected), [seats]);
  const totalPrice    = useMemo(() => selectedSeats.reduce((sum, s) => sum + s.price, 0), [selectedSeats]);
  const rows          = useMemo(() => [...new Set(seats.map(s => s.row))].sort(), [seats]);

  const seatsByRow = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach(s => { if (!m[s.row]) m[s.row] = []; m[s.row].push(s); });
    return m;
  }, [seats]);

  const seatPositions = useMemo(() => {
    const out: Array<{ seat: Seat; position: [number, number, number] }> = [];
    Object.keys(seatsByRow).sort().forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.9 + 1, rowY = rowIndex * 0.42 + 0.3;
      const mid  = Math.floor(rowSeats.length / 2);
      rowSeats.forEach((seat, si) => {
        const norm    = (si - (rowSeats.length - 1) / 2) / Math.max(rowSeats.length / 2, 1);
        const seatX   = (si - (rowSeats.length - 1) / 2) * 1.15 + (si >= mid ? 0.7 : -0.7);
        const curvePush = norm * norm * 0.4;
        out.push({ seat, position: [seatX, rowY, rowZ + curvePush] });
      });
    });
    return out;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count = 4) => {
    const available = seatPositions.filter(({ seat }) => seat.status === 'available' && !seat.isBooked);
    return available
      .map(({ seat, position }) => ({
        seat,
        score: (15 - Math.abs(position[0])) + (12 - Math.abs(4 - position[2] / 1.9)) +
               (seat.type === 'vip' ? 8 : seat.type === 'premium' ? 5 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(x => x.seat.id);
  }, [seatPositions]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);
    const sd = seatPositions.find(s => s.seat.id === seat.id);
    if (sd) {
      const [x, y, z] = sd.position;
      setCameraTarget({ position: new THREE.Vector3(x * 0.3, y + 2.6, z + 4.2), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [soundEnabled, playSound, onSeatClick, seatPositions]);

  const handleSeatHover = useCallback((seat: Seat | null, position?: [number, number, number]) => {
    setHoveredSeat(seat && position ? { seat, position } : null);
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
      topdown: { position: new THREE.Vector3(0, 32, 12), lookAt: new THREE.Vector3(0, 0, 8) },
      front:   { position: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z + 9), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side:    { position: new THREE.Vector3(30, 12, 9), lookAt: new THREE.Vector3(0, 4, 6) },
    };
    setCameraTarget(views[mode]);
    setIsAnimating(true);
  }, [soundEnabled, playSound]);

  const handleScreenUpdate = useCallback((r: typeof screenRect) => {
    setScreenRect(prev =>
      Math.abs(prev.left - r.left) > 2 || Math.abs(prev.top - r.top) > 2 ||
      Math.abs(prev.width - r.width) > 2 || Math.abs(prev.height - r.height) > 2 ||
      prev.visible !== r.visible ? r : prev
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!viewingSeatId) return;
      const cur = seatPositions.find(s => s.seat.id === viewingSeatId);
      if (!cur) return;
      let target: Seat | undefined;
      if (e.key === 'ArrowLeft')  target = seats.find(s => s.row === cur.seat.row && s.number === cur.seat.number - 1);
      if (e.key === 'ArrowRight') target = seats.find(s => s.row === cur.seat.row && s.number === cur.seat.number + 1);
      if (e.key === 'ArrowUp')    target = seats.find(s => s.row === String.fromCharCode(cur.seat.row.charCodeAt(0) - 1) && s.number === cur.seat.number);
      if (e.key === 'ArrowDown')  target = seats.find(s => s.row === String.fromCharCode(cur.seat.row.charCodeAt(0) + 1) && s.number === cur.seat.number);
      if (e.key === 'Escape')     { resetView(); return; }
      if (target) {
        e.preventDefault();
        const td = seatPositions.find(s => s.seat.id === target!.id);
        if (td) {
          const [x, y, z] = td.position;
          setCameraTarget({ position: new THREE.Vector3(x * 0.3, y + 2.6, z + 4.2), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
          setIsAnimating(true);
          setViewingSeatId(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingSeatId, seats, seatPositions, resetView]);

  const viewingSeat = viewingSeatId ? seats.find(s => s.id === viewingSeatId) : null;
  const gst = Math.round(totalPrice * 0.18);

  return (
    <div className="relative w-full h-[900px] rounded-2xl overflow-hidden shadow-2xl border border-amber-500/20"
      style={{ background: 'linear-gradient(to bottom, #04040c, #080814, #04040c)' }}>

      {/* Subtle inner glow border */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none z-30"
        style={{ boxShadow: 'inset 0 0 1px rgba(200,168,80,0.25)' }} />

      {youtubeId && <YouTubeOverlay videoId={youtubeId} rect={screenRect} />}

      {/* TOP CONTROLS */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="bg-gradient-to-b from-black/92 via-black/65 to-transparent pt-4 pb-14 px-5 pointer-events-auto">
          <div className="flex items-start justify-between gap-5">

            {/* Left: movie + showtime */}
            <div className="flex-1 max-w-[560px]">
              <button onClick={() => setShowMoviePanel(!showMoviePanel)}
                className="flex items-center gap-2.5 mb-3 group">
                <Film className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400/80 group-hover:text-amber-300 transition-colors">
                  Movie & Showtime
                </span>
                {showMoviePanel
                  ? <ChevronDown className="w-3.5 h-3.5 text-amber-400/50" />
                  : <ChevronRight className="w-3.5 h-3.5 text-amber-400/50" />}
              </button>

              {showMoviePanel && (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    {movies.map(movie => (
                      <button key={movie.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                        className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border shadow-lg
                          ${selectedMovie.id === movie.id
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-amber-500/20'}`}>
                        <img src={movie.image} alt="" className="w-6 h-9 object-cover rounded shadow-md"
                          onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="whitespace-nowrap">{movie.title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {showtimes.map(st => (
                      <button key={st.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(st); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-md
                          ${selectedShowtime.id === st.id
                            ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/8 hover:border-amber-500/20'}`}>
                        {st.time}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-amber-500/20">
                    <img src={selectedMovie.image} alt="" className="w-8 h-12 object-cover rounded shadow-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-bold truncate">{selectedMovie.title}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">{selectedMovie.genre} · {selectedMovie.duration}</p>
                    </div>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold flex-shrink-0">
                      {selectedMovie.rating}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: controls */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                {[
                  { icon: soundEnabled ? Volume2 : VolumeX, fn: () => setSoundEnabled(!soundEnabled), on: soundEnabled },
                  { icon: Camera, fn: () => {
                      if (soundEnabled) playSound('success');
                      const c = document.querySelector('canvas');
                      if (c) { const a = document.createElement('a'); a.download = `cineplex-${Date.now()}.png`; a.href = c.toDataURL(); a.click(); }
                    }
                  },
                  { icon: Grid3X3, fn: () => setShowMiniMap(!showMiniMap), on: showMiniMap },
                  { icon: lightsOn ? Sun : SunDim, fn: () => setLightsOn(!lightsOn), on: lightsOn },
                ].map(({ icon: Icon, fn, on }, i) => (
                  <button key={i} onClick={fn}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border shadow-lg
                      ${on ? 'bg-amber-500/25 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10 hover:border-amber-500/20'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {([
                  { m: 'default' as ViewMode, l: 'Free',  I: Eye },
                  { m: 'topdown' as ViewMode, l: 'Top',   I: Maximize2 },
                  { m: 'front'   as ViewMode, l: 'Front', I: Film },
                  { m: 'side'    as ViewMode, l: 'Side',  I: Armchair },
                ]).map(({ m, l, I }) => (
                  <button key={m} onClick={() => changeView(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1 shadow-md
                      ${viewMode === m ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <I className="w-3 h-3" />{l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => {
                    if (soundEnabled) playSound('success');
                    setHighlightedSeats(findBestSeats(4));
                    setTimeout(() => setHighlightedSeats([]), 6000);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/22 border border-amber-500/38 text-amber-300 hover:bg-amber-500/32 flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3 h-3" /> Best Seats
                </button>
                <button onClick={resetView}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-1.5 shadow-md">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Viewing seat indicator */}
      {viewingSeat && (
        <div className="absolute top-[125px] left-1/2 -translate-x-1/2 z-20">
          <div className="bg-amber-500/15 backdrop-blur-xl text-white px-5 py-2 rounded-full flex items-center gap-2.5 border border-amber-500/30 shadow-xl">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-200">Row {viewingSeat.row} · Seat {viewingSeat.number}</span>
            <span className="text-amber-400/50 text-[10px]">· Arrow keys to navigate</span>
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="absolute left-4 bottom-4 z-10">
        <button onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-400/70 hover:text-amber-300 text-xs font-medium mb-2 shadow-lg transition-colors">
          <Info className="w-3 h-3" /> Guide
          {showGuide ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {showGuide && (
          <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-xl border border-amber-500/20 shadow-2xl">
            <div className="h-px bg-gradient-to-r from-transparent via-amber-400/38 to-transparent mb-3" />
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              {[
                ['#2d3a4f','Standard'], ['#1e3a7a','Premium'], ['#5b21b6','VIP'],
                ['#0f766e','Accessible'], ['#059669','Selected'], ['#111122','Booked'],
                ['#f59e0b','Best Seats'],
              ].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-white/10" style={{ backgroundColor: c }} />
                  <span className="text-gray-300 text-xs font-medium">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MiniMap */}
      {showMiniMap && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <MiniMap seats={seats} selectedIds={selectedSeats.map(s => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* Ticket panel */}
      <div className="absolute right-4 bottom-4 z-10">
        <div className="bg-slate-950/98 backdrop-blur-2xl p-4 rounded-2xl border border-amber-500/25 w-[265px] shadow-2xl">
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/38 to-transparent mb-3" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
            <Ticket className="w-3.5 h-3.5 text-amber-400" /> Your Tickets
          </h3>
          {selectedSeats.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedSeats.map(seat => (
                  <span key={seat.id} className={`px-2.5 py-1 rounded-lg text-xs font-bold border shadow-md
                    ${seat.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border-purple-500/25' :
                      seat.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border-blue-500/25' :
                      'bg-white/5 text-gray-300 border-white/10'}`}>
                    {seat.row}{seat.number} <span className="text-gray-400">{Rs}{seat.price.toLocaleString('en-IN')}</span>
                  </span>
                ))}
              </div>
              <div className="space-y-1.5 text-xs border-t border-amber-500/15 pt-2.5">
                <div className="flex justify-between text-gray-400">
                  <span>{selectedSeats.length} ticket{selectedSeats.length > 1 ? 's' : ''}</span>
                  <span>{Rs}{totalPrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-500"><span>Convenience fee</span><span>{Rs}50</span></div>
                <div className="flex justify-between text-gray-500"><span>GST (18%)</span><span>{Rs}{gst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-amber-500/15">
                  <span>Total</span>
                  <span className="text-emerald-400 text-base">{Rs}{(totalPrice + 50 + gst).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(true)}
                className="w-full mt-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/22 transition-all">
                <Check className="w-4 h-4" /> Checkout
              </button>
            </>
          ) : (
            <div className="text-center py-7">
              <Sofa className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-xs font-medium">No seats selected</p>
              <p className="text-gray-600 text-[10px] mt-1">Click a seat to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3D CANVAS ── */}
      <Canvas
        shadows="soft"
        camera={{ position: [DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z], fov: 52, near: 0.5, far: 110 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'linear-gradient(to bottom, #04040c, #080814)' }}
        dpr={[1, 1.5]}           // capped at 1.5 to stop blank-out on high-DPI
        frameloop="demand"       // only re-render when state changes — except for animation
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        {/* frameloop demand means animations need an explicit invalidate — swap to "always" for smooth animations */}
        <FrameLoopFixer />

        <CameraController
          target={cameraTarget} isAnimating={isAnimating}
          onDone={() => setIsAnimating(false)} controlsRef={controlsRef}
        />

        {/* ── LIGHTING (balanced — not too bright, not too dim) ── */}
        {/* Global ambient — warm, medium */}
        <ambientLight intensity={0.55} color="#c8d0e8" />
        {/* Sky dome fill */}
        <hemisphereLight args={['#3a4878', '#0a0a1e', 0.5]} />
        {/* Main key light — slightly warm, casts shadows */}
        <directionalLight
          position={[8, 20, 14]} intensity={1.4} color="#f0e8d8"
          castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-24} shadow-camera-right={24}
          shadow-camera-top={24} shadow-camera-bottom={-24}
          shadow-bias={-0.0002}
        />
        {/* Cool fill from back-left */}
        <directionalLight position={[-10, 14, -8]} intensity={0.45} color="#6677cc" />
        {/* Screen-bounce fill — brings up seats near screen */}
        <directionalLight position={[0, 6, -18]} intensity={0.6} color="#4466bb" />
        {/* Warm floor bounce */}
        <pointLight position={[0, 1, 14]} intensity={0.5} distance={28} color="#c8a850" />

        {youtubeId && <ScreenPositionTracker onUpdate={handleScreenUpdate} />}

        <TheaterScreen movieTitle={selectedMovie.title} />
        <RowLabels rows={rows} />
        <TheaterEnvironment lightsOn={lightsOn} />

        {seatPositions.map(({ seat, position }) => (
          <SeatMesh
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

        {hoveredSeat && <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />}

        <OrbitControls
          ref={controlsRef}
          minDistance={5} maxDistance={44}
          maxPolarAngle={Math.PI / 2.08} minPolarAngle={0.12}
          target={[DEFAULT_LOOK_AT.x, DEFAULT_LOOK_AT.y, DEFAULT_LOOK_AT.z]}
          enableDamping dampingFactor={0.05}
          rotateSpeed={0.55} zoomSpeed={0.9}
        />
      </Canvas>

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onConfirm={() => {
          if (soundEnabled) playSound('success');
          setShowBookingModal(false);
          alert('🎬 Booking confirmed! Enjoy the show!');
        }}
        selectedSeats={selectedSeats}
        movie={selectedMovie}
        showtime={selectedShowtime}
        total={totalPrice}
      />
    </div>
  );
}

// Forces continuous rendering so camera animations and seat hover work with frameloop="demand"
function FrameLoopFixer() {
  const { invalidate } = useThree();
  useFrame(() => invalidate());
  return null;
}
