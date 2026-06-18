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
const SCREEN_Y = 7;
const SCREEN_WIDTH = 24;
const SCREEN_HEIGHT = 11;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 12, 26);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 4, 0);

const SEAT_COLORS: Record<string, { base: string; hover: string; selected: string; booked: string }> = {
  standard: { base: '#2d3a4f', hover: '#3d4f6a', selected: '#059669', booked: '#111122' },
  premium: { base: '#1e3a7a', hover: '#2952a3', selected: '#059669', booked: '#111122' },
  vip: { base: '#5b21b6', hover: '#6d28d9', selected: '#059669', booked: '#111122' },
  accessible: { base: '#0f766e', hover: '#0d9488', selected: '#059669', booked: '#111122' },
};

// --- DATA ---
const movies = [
  { id: '1', title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911BTUgMe1YdBGm.jpg", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", description: "Batman faces the Joker who wants to plunge Gotham into anarchy.", duration: "2h 32m", rating: "UA", genre: "Action • Crime" },
  { id: '2', title: "Inception", image: "https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", description: "A thief steals secrets through dream-sharing technology.", duration: "2h 28m", rating: "UA", genre: "Sci-Fi • Action" },
  { id: '3', title: "Interstellar", image: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", description: "Explorers travel through a wormhole to ensure humanity's survival.", duration: "2h 49m", rating: "UA", genre: "Sci-Fi • Adventure" },
  { id: '4', title: "Oppenheimer", image: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", description: "The story of J. Robert Oppenheimer and the atomic bomb.", duration: "3h 00m", rating: "A", genre: "Biography • Drama" }
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

// Rupee symbol helper
const Rs = '₹';

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

// --- SCREEN POSITION TRACKER ---
function ScreenPositionTracker({ onUpdate }: { onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void }) {
  const { camera, gl } = useThree();
  const lastRef = useRef({ left: 0, top: 0, width: 0, height: 0, visible: false });
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;
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

// --- LUXURY SEAT 3D ---
const LuxurySeat3D = React.memo(function LuxurySeat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const foldRef = useRef(0);
  const scaleRef = useRef(1);
  const bobRef = useRef(0);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors = SEAT_COLORS[seat.type];

  useFrame((state, delta) => {
    const targetFold = isSelected ? 1 : 0;
    foldRef.current += (targetFold - foldRef.current) * delta * 8;
    const targetScale = hovered && !isBooked ? 1.12 : 1;
    scaleRef.current += (targetScale - scaleRef.current) * delta * 14;
    bobRef.current = isSelected ? Math.sin(state.clock.elapsedTime * 2.5) * 0.015 : 0;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
      groupRef.current.position.y = position[1] + bobRef.current;
    }
    if (glowRef.current) {
      const targetIntensity = isSelected ? 3.5 : isHighlighted ? 2.5 : hovered ? 1.5 : 0;
      glowRef.current.intensity += (targetIntensity - glowRef.current.intensity) * delta * 10;
    }
  });

  const color = isBooked ? colors.booked : isSelected ? colors.selected :
    isHighlighted ? '#f59e0b' : hovered ? colors.hover : colors.base;
  const emissiveIntensity = isSelected ? 1.2 : isHighlighted ? 0.8 : hovered && !isBooked ? 0.5 : 0.12;

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
      <pointLight ref={glowRef} position={[0, 0.8, 0]} intensity={0} distance={3}
        color={isSelected ? '#059669' : isHighlighted ? '#f59e0b' : '#8b5cf6'} />

      {/* Marble base platform */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.68, 0.08, 16]} />
        <meshStandardMaterial color="#0a0a1e" roughness={0.1} metalness={0.95}
          emissive="#1a1a3e" emissiveIntensity={0.1} />
      </mesh>

      {/* Chrome legs */}
      {[[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, -0.06, lz]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 8]} />
          <meshStandardMaterial color="#c0c0d0" roughness={0.1} metalness={1} />
        </mesh>
      ))}

      {/* Seat cushion – main body */}
      <group>
        {/* Cushion */}
        <RoundedBox args={[0.98, 0.22, 0.84]} radius={0.09} smoothness={6}
          position={[0, 0.11, 0]} castShadow receiveShadow
          onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
          <meshStandardMaterial color={color} roughness={0.65} metalness={0.08}
            emissive={color} emissiveIntensity={emissiveIntensity} />
        </RoundedBox>

        {/* Tufted pattern on cushion */}
        {[[-0.22, 0.22, 0], [0.22, 0.22, 0], [0, 0.22, -0.22], [0, 0.22, 0.22]].map(([tx, ty, tz], i) => (
          <mesh key={i} position={[tx, ty, tz]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.06, 8]} />
            <meshStandardMaterial color="#000" transparent opacity={0.2} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Backrest */}
      <group>
        <RoundedBox args={[0.98, 0.92, 0.16]} radius={0.09} smoothness={6}
          position={[0, 0.62, 0.4]} castShadow receiveShadow
          onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
          <meshStandardMaterial color={color} roughness={0.65} metalness={0.08}
            emissive={color} emissiveIntensity={emissiveIntensity * 0.7} />
        </RoundedBox>

        {/* Tufted rows on back */}
        {[[-0.22, 0.45, 0.49], [0.22, 0.45, 0.49], [-0.22, 0.75, 0.49], [0.22, 0.75, 0.49], [0, 0.6, 0.49]].map(([bx, by, bz], i) => (
          <mesh key={i} position={[bx, by, bz]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#000" transparent opacity={0.3} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Premium headrest */}
      <RoundedBox args={[seat.type === 'vip' ? 0.76 : 0.88, 0.28, 0.14]} radius={0.07} smoothness={5}
        position={[0, 1.13, 0.38]} castShadow>
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.12}
          emissive={color} emissiveIntensity={emissiveIntensity * 0.5} />
      </RoundedBox>

      {/* VIP extra wing headrest */}
      {seat.type === 'vip' && (
        <>
          {[-1, 1].map(side => (
            <RoundedBox key={side} args={[0.18, 0.26, 0.1]} radius={0.05} smoothness={4}
              position={[side * 0.47, 1.12, 0.37]} castShadow>
              <meshStandardMaterial color={color} roughness={0.6} metalness={0.12}
                emissive={color} emissiveIntensity={emissiveIntensity * 0.5} />
            </RoundedBox>
          ))}
        </>
      )}

      {/* Luxury armrests */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * 0.57, 0.32, 0.06]}>
          {/* Metal spine */}
          <mesh castShadow>
            <boxGeometry args={[0.06, 0.22, 0.7]} />
            <meshStandardMaterial color="#b0b0c8" roughness={0.1} metalness={0.98} />
          </mesh>
          {/* Padded top */}
          <RoundedBox args={[0.11, 0.06, 0.55]} radius={0.025} smoothness={3} position={[0, 0.09, 0]}>
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.08}
              emissive={color} emissiveIntensity={emissiveIntensity * 0.3} />
          </RoundedBox>
          {/* Chrome end cap */}
          <mesh position={[0, 0.09, -0.3]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#d0d0e0" roughness={0.1} metalness={1} />
          </mesh>
        </group>
      ))}

      {/* Cupholder (premium + vip) */}
      {(seat.type === 'premium' || seat.type === 'vip') && (
        <group position={[0.7, 0.14, -0.32]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.07, 0.14, 14]} />
            <meshStandardMaterial color="#1a1a30" roughness={0.2} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <torusGeometry args={[0.08, 0.012, 8, 20]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
              emissive="#c8a850" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}

      {/* USB/tray light strip on back */}
      <mesh position={[0, 0.18, 0.42]}>
        <boxGeometry args={[0.7, 0.015, 0.015]} />
        <meshStandardMaterial color={isSelected ? '#10b981' : '#3b82f6'}
          emissive={isSelected ? '#10b981' : '#3b82f6'} emissiveIntensity={2.5} />
      </mesh>

      {/* Seat number plate */}
      <group position={[0, 0.245, -0.06]}>
        <RoundedBox args={[0.28, 0.14, 0.02]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#0a0a1a" roughness={0.3} metalness={0.9} />
        </RoundedBox>
        <Text position={[0, 0, 0.015]} fontSize={0.1} color={isBooked ? '#444' : '#e2e8f0'}
          anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
          {seat.number}
        </Text>
      </group>

      {/* VIP diamond gem */}
      {seat.type === 'vip' && (
        <group position={[0, 1.45, 0.36]}>
          <mesh>
            <octahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24"
              emissiveIntensity={2.5} metalness={1} roughness={0.0} />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={1.5} distance={1.5} color="#fbbf24" />
        </group>
      )}

      {/* Premium gem */}
      {seat.type === 'premium' && (
        <group position={[0, 1.28, 0.36]}>
          <mesh>
            <sphereGeometry args={[0.065, 14, 14]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa"
              emissiveIntensity={2} metalness={0.9} roughness={0.05} />
          </mesh>
        </group>
      )}

      {/* Accessible ring */}
      {seat.type === 'accessible' && (
        <group position={[0, 1.28, 0.36]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.075, 0.022, 10, 18]} />
            <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.8}
              metalness={0.9} roughness={0.05} />
          </mesh>
        </group>
      )}
    </group>
  );
});

// --- PREMIUM THEATER SCREEN ---
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const scanlineRef = useRef(0);

  useFrame((state) => {
    scanlineRef.current = (state.clock.elapsedTime * 0.12) % 1;
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.18 + Math.sin(state.clock.elapsedTime * 0.4) * 0.04;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Deep back wall */}
      <mesh position={[0, 0, -2]} receiveShadow>
        <boxGeometry args={[50, 28, 0.4]} />
        <meshStandardMaterial color="#050510" roughness={0.98} />
      </mesh>

      {/* Ornate side columns */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 3.5), 0, -0.5]}>
          {/* Column body */}
          <mesh castShadow>
            <cylinderGeometry args={[0.55, 0.65, SCREEN_HEIGHT + 6, 18]} />
            <meshStandardMaterial color="#1a1628" roughness={0.5} metalness={0.5} />
          </mesh>
          {/* Gold capital */}
          <mesh position={[0, (SCREEN_HEIGHT + 6) / 2 + 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.85, 0.55, 0.6, 14]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.95}
              emissive="#c8a850" emissiveIntensity={0.3} />
          </mesh>
          {/* Gold base */}
          <mesh position={[0, -(SCREEN_HEIGHT + 6) / 2 - 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.85, 0.7, 0.5, 14]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.95} />
          </mesh>
          {/* LED edge strip */}
          <mesh position={[side * -0.56, 0, 0.1]}>
            <boxGeometry args={[0.04, SCREEN_HEIGHT + 6, 0.05]} />
            <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}

      {/* Outermost ornate frame – gold */}
      <mesh position={[0, 0, -0.22]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 4, SCREEN_HEIGHT + 3.5, 0.18]} />
        <meshStandardMaterial color="#b8902a" roughness={0.2} metalness={0.95}
          emissive="#b8902a" emissiveIntensity={0.2} />
      </mesh>
      {/* Pattern insets on gold frame */}
      {[-1, 0, 1].map(xp => (
        <group key={xp} position={[xp * (SCREEN_WIDTH / 2 + 0.8), SCREEN_HEIGHT / 2 + 1.2, -0.12]}>
          <mesh>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.8}
              metalness={1} roughness={0} />
          </mesh>
        </group>
      ))}

      {/* Dark inner frame */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[SCREEN_WIDTH + 1.8, SCREEN_HEIGHT + 1.4, 0.14]} />
        <meshStandardMaterial color="#0c0c20" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Masking border – matte black */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.6, SCREEN_HEIGHT + 0.4, 0.06]} />
        <meshStandardMaterial color="#040408" roughness={0.98} metalness={0.1} />
      </mesh>

      {/* THE SCREEN */}
      <mesh ref={screenRef} position={[0, 0, 0.04]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial color="#080810" roughness={0.1} metalness={0.15}
          emissive="#1e2a5e" emissiveIntensity={0.18} />
      </mesh>

      {/* Perforated screen texture overlay */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial color="#101828" transparent opacity={0.08} roughness={1} />
      </mesh>

      {/* Screen glow strip at bottom */}
      <mesh position={[0, -SCREEN_HEIGHT / 2 + 0.08, 0.06]}>
        <planeGeometry args={[SCREEN_WIDTH * 0.85, 0.12]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} transparent opacity={0.6} />
      </mesh>

      {/* Key screen lights */}
      <pointLight position={[0, 0, 6]} intensity={6} distance={50} color="#4466cc" castShadow />
      <pointLight position={[-10, 3, 4]} intensity={2.5} distance={25} color="#5577dd" />
      <pointLight position={[10, 3, 4]} intensity={2.5} distance={25} color="#5577dd" />
      <rectAreaLight position={[0, 0, 2]} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
        intensity={3} color="#334488" rotation={[0, Math.PI, 0]} />

      {/* Luxury velvet curtains */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4.5), 0, 1.2]}>
          {[...Array(8)].map((_, i) => {
            const foldX = side * (i * 0.55);
            const foldZ = Math.sin(i * 0.9) * 0.3;
            const shade = 0.55 + (i % 3) * 0.07;
            return (
              <mesh key={i} position={[foldX, 0, foldZ]} castShadow receiveShadow>
                <boxGeometry args={[0.5, SCREEN_HEIGHT + 7, 0.18]} />
                <meshStandardMaterial color={`rgb(${Math.floor(130 * shade)},${Math.floor(8 * shade)},${Math.floor(8 * shade)})`}
                  roughness={0.98} metalness={0.0} />
              </mesh>
            );
          })}
          {/* Curtain gold border */}
          <mesh position={[side * -0.05, 0, -0.1]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 7, 0.2]} />
            <meshStandardMaterial color="#c8a850" roughness={0.3} metalness={0.9}
              emissive="#c8a850" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Ornate curtain rod */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 3.8, 1.4]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, SCREEN_WIDTH + 14, 14]} />
        <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.97}
          emissive="#c8a850" emissiveIntensity={0.2} />
      </mesh>
      {/* Finials */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 7.5), SCREEN_HEIGHT / 2 + 3.8, 1.4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.3, 14, 14]} />
            <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={1}
              emissive="#ffd700" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={1.2} distance={4} color="#ffd700" />
        </group>
      ))}

      {/* Valance / pelmet with gold trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.5, 1]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 14, 2.8, 1.0]} />
        <meshStandardMaterial color="#6b0f0f" roughness={0.95} />
      </mesh>
      <mesh position={[0, SCREEN_HEIGHT / 2 + 1.2, 1.51]}>
        <boxGeometry args={[SCREEN_WIDTH + 14, 0.12, 0.04]} />
        <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
          emissive="#c8a850" emissiveIntensity={0.5} />
      </mesh>

      {/* NOW SHOWING text */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 1.8, 0.4]}>
        <Text fontSize={0.55} color="#8899cc" anchorX="center" letterSpacing={0.2}>
          NOW SHOWING
        </Text>
        <Text position={[0, -0.85, 0]} fontSize={0.42} color="#b8ccee"
          anchorX="center" letterSpacing={0.1} maxWidth={SCREEN_WIDTH - 2}>
          {movieTitle.toUpperCase()}
        </Text>
      </group>

      {/* Screen spotlight from above */}
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 5, 3]}
        angle={0.7} penumbra={0.4} intensity={2.5} distance={30}
        color="#99aadd" castShadow />
    </group>
  );
}

// --- FLOATING PARTICLES ---
function FloatingParticles() {
  const particleCount = 60;
  const positions = useMemo(() => {
    return Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 36,
      y: Math.random() * 14 + 1,
      z: (Math.random() - 0.5) * 40,
      speed: 0.2 + Math.random() * 0.4,
      offset: Math.random() * Math.PI * 2,
      size: 0.015 + Math.random() * 0.025,
    }));
  }, []);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    positions.forEach((p, i) => {
      const m = meshRefs.current[i];
      if (m) {
        m.position.y = p.y + Math.sin(state.clock.elapsedTime * p.speed + p.offset) * 0.4;
        m.position.x = p.x + Math.cos(state.clock.elapsedTime * p.speed * 0.5 + p.offset) * 0.2;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * p.speed * 2 + p.offset) * 0.4;
      }
    });
  });

  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el; }}
          position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.8}
            transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// --- WALL SCONCES ---
function WallSconces() {
  const positions = useMemo(() => {
    const p: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 5; i++) {
      p.push({ pos: [-18.5, 5.5, -6 + i * 7.5], rot: [0, Math.PI / 2, 0] });
      p.push({ pos: [18.5, 5.5, -6 + i * 7.5], rot: [0, -Math.PI / 2, 0] });
    }
    return p;
  }, []);

  return (
    <group>
      {positions.map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
          {/* Ornate backplate */}
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.06, 8]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.95}
              emissive="#c8a850" emissiveIntensity={0.15} />
          </mesh>
          {/* Arm */}
          <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.95} />
          </mesh>
          {/* Ornate shade */}
          <mesh position={[0, 0, 0.44]}>
            <coneGeometry args={[0.18, 0.28, 14, 1, true]} />
            <meshStandardMaterial color="#f5e6c8" transparent opacity={0.55}
              emissive="#ffe090" emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* Globe */}
          <mesh position={[0, 0, 0.35]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#fff9e8" transparent opacity={0.7}
              emissive="#ffdd88" emissiveIntensity={0.8} />
          </mesh>
          <pointLight position={[0, 0, 0.4]} intensity={1.2} distance={8} color="#ffcc66" />
        </group>
      ))}
    </group>
  );
}

// --- THEATER ENVIRONMENT ---
const TheaterEnvironment = React.memo(function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();
  const ceilingLightsRef = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#04040c', 0.007);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    if (ceilingLightsRef.current) {
      ceilingLightsRef.current.traverse(obj => {
        if (obj instanceof THREE.PointLight) {
          const t = lightsOn ? 3.5 : 0.1;
          obj.intensity += (t - obj.intensity) * delta * 4;
        }
      });
    }
  });

  const steps = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    z: i * 1.9 + 1,
    y: i * 0.42,
    index: i,
  })), []);

  return (
    <group>
      {/* Main floor – dark marble */}
      <mesh position={[0, -0.01, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[55, 65]} />
        <meshStandardMaterial color="#0e0e1e" roughness={0.3} metalness={0.35} />
      </mesh>

      {/* Floor reflective inlay strips */}
      {[-8, -4, 0, 4, 8].map((xp, i) => (
        <mesh key={i} position={[xp, 0.005, 8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 28]} />
          <meshStandardMaterial color="#2a2a50" roughness={0.1} metalness={0.9}
            emissive="#1a1a40" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Center aisle carpet */}
      <mesh position={[0, 0.008, 9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.6, 26]} />
        <meshStandardMaterial color="#3d0a0a" roughness={0.99} />
      </mesh>

      {/* Side walls with wainscoting */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * 19.5, 7, 4]}>
          {/* Main wall */}
          <mesh rotation={[0, side * -Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[55, 16]} />
            <meshStandardMaterial color="#0d0d20" roughness={0.92} />
          </mesh>
          {/* Wainscot rail */}
          <mesh position={[0, -4.5, side * -0.05]} rotation={[0, side * -Math.PI / 2, 0]}>
            <planeGeometry args={[55, 3]} />
            <meshStandardMaterial color="#12102a" roughness={0.7} metalness={0.2} />
          </mesh>
          {/* Gold chair rail */}
          <mesh position={[0, -2.9, 0]}>
            <boxGeometry args={[0.08, 0.12, 55]} />
            <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
              emissive="#c8a850" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ))}

      {/* Back wall */}
      <mesh position={[0, 7, 27]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[42, 16]} />
        <meshStandardMaterial color="#09091a" roughness={0.96} />
      </mesh>

      {/* Ornate ceiling */}
      <mesh position={[0, 15.5, 6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 48]} />
        <meshStandardMaterial color="#070715" roughness={0.96} />
      </mesh>

      {/* Ceiling gold border strips */}
      {[[-19, 15.4, 6], [19, 15.4, 6]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.15, 48]} />
          <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
            emissive="#c8a850" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Ceiling center medallion */}
      <mesh position={[0, 15.45, 6]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 2.5, 32]} />
        <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
          emissive="#c8a850" emissiveIntensity={0.4} />
      </mesh>

      <WallSconces />

      {/* Tiered steps */}
      {steps.map(step => (
        <group key={step.index}>
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[36, 0.48, 1.9]} />
            <meshStandardMaterial color="#181830" roughness={0.72} />
          </mesh>
          {/* Riser face */}
          <mesh position={[0, step.y + 0.24, step.z + 0.95]}>
            <boxGeometry args={[36, 0.48, 0.04]} />
            <meshStandardMaterial color="#0f0f26" roughness={0.85} />
          </mesh>
          {/* LED strip – main */}
          <mesh position={[0, step.y + 0.255, step.z + 0.94]}>
            <boxGeometry args={[32, 0.025, 0.025]} />
            <meshBasicMaterial color="#4455aa" />
          </mesh>
          {/* Gold accent strip */}
          <mesh position={[0, step.y + 0.26, step.z + 0.92]}>
            <boxGeometry args={[32, 0.012, 0.012]} />
            <meshBasicMaterial color="#c8a850" />
          </mesh>
          <pointLight position={[0, step.y + 0.32, step.z + 0.96]}
            intensity={0.28} distance={4.5} color="#4455aa" />
        </group>
      ))}

      {/* Side aisle LED strips */}
      {[-14.5, 14.5].map((xp, i) => (
        <mesh key={i} position={[xp, 0.01, 9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 26]} />
          <meshStandardMaterial color="#c8a850" emissive="#c8a850" emissiveIntensity={1.5} />
        </mesh>
      ))}

      {/* Exit signs */}
      {[[-17.5, 7, 23], [17.5, 7, 23]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[2.0, 0.6, 0.1]} radius={0.06} smoothness={3} castShadow>
            <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={2} />
          </RoundedBox>
          <Text position={[0, 0, 0.06]} fontSize={0.26} color="#fff" anchorX="center">
            EXIT
          </Text>
          <pointLight position={[0, 0, 0.4]} intensity={1.2} distance={6} color="#059669" />
        </group>
      ))}

      {/* Chandelier – main */}
      <group position={[0, 15.2, 6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.5, 10]} />
          <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.98} />
        </mesh>
        {/* Ring */}
        <mesh position={[0, -1.2, 0]}>
          <torusGeometry args={[1.8, 0.06, 10, 40]} />
          <meshStandardMaterial color="#c8a850" roughness={0.15} metalness={0.98}
            emissive="#c8a850" emissiveIntensity={0.3} />
        </mesh>
        {/* Crystal drops on ring */}
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(angle) * 1.8, -1.4, Math.sin(angle) * 1.8]}>
              <mesh>
                <octahedronGeometry args={[0.07, 0]} />
                <meshStandardMaterial color="#e0e8ff" transparent opacity={0.8}
                  emissive="#aabbff" emissiveIntensity={0.6} metalness={0.5} roughness={0.05} />
              </mesh>
            </group>
          );
        })}
        {/* Central globe */}
        <mesh position={[0, -1.2, 0]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#fff9e0" transparent opacity={0.5}
            emissive="#ffe8a0" emissiveIntensity={1.2} />
        </mesh>
        <pointLight position={[0, -1.2, 0]} intensity={4} distance={18} color="#ffe8b0" castShadow />
      </group>

      {/* Ceiling recessed lights */}
      <group ref={ceilingLightsRef}>
        {[
          [-12, 15.3, -2], [12, 15.3, -2],
          [-12, 15.3, 7], [12, 15.3, 7],
          [-12, 15.3, 16], [12, 15.3, 16],
          [0, 15.3, -2], [0, 15.3, 7], [0, 15.3, 16],
        ].map((pos, i) => (
          <group key={i} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.38, 0.48, 0.14, 14]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.36, 0.36, 0.04, 14]} />
              <meshStandardMaterial color="#fff5e0" transparent opacity={0.4}
                emissive="#ffe8c0" emissiveIntensity={0.6} />
            </mesh>
            <pointLight intensity={3} distance={16} color="#ffe8c0" castShadow />
          </group>
        ))}
      </group>

      {/* Projector booth */}
      <group position={[0, 12.5, 25]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5, 3.2, 4.5]} />
          <meshStandardMaterial color="#0c0c1e" roughness={0.65} />
        </mesh>
        {/* Booth window */}
        <mesh position={[0, 0.3, -2.27]}>
          <planeGeometry args={[3.2, 1.6]} />
          <meshStandardMaterial color="#1a1a3e" transparent opacity={0.55} />
        </mesh>
        {/* Projector barrel */}
        <group position={[0, -0.25, -1.8]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.9, 14]} />
            <meshStandardMaterial color="#252538" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.16, 0.12, 14]} />
            <meshStandardMaterial color="#8aaccc" transparent opacity={0.85}
              emissive="#88aacc" emissiveIntensity={0.7} />
          </mesh>
          <spotLight position={[0, 0, -0.6]} angle={0.22} penumbra={0.35}
            intensity={4} distance={50} color="#c8d8ff" castShadow />
        </group>
      </group>

      {/* Subwoofer speakers */}
      {[[-19, SCREEN_Y - 3, SCREEN_Z + 3], [19, SCREEN_Y - 3, SCREEN_Z + 3],
        [-19, SCREEN_Y + 2, SCREEN_Z + 3], [19, SCREEN_Y + 2, SCREEN_Z + 3],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[0.7, 2.2, 0.9]} radius={0.1} smoothness={4} castShadow>
            <meshStandardMaterial color="#080818" roughness={0.75} />
          </RoundedBox>
          {/* Grille lines */}
          {[-0.3, -0.1, 0.1, 0.3].map((yoff, j) => (
            <mesh key={j} position={[0, yoff, 0.46]}>
              <boxGeometry args={[0.5, 0.025, 0.02]} />
              <meshStandardMaterial color="#1a1a30" roughness={0.8} />
            </mesh>
          ))}
          {/* Logo dot */}
          <mesh position={[0, 0.55, 0.46]}>
            <circleGeometry args={[0.06, 12]} />
            <meshStandardMaterial color="#c8a850" emissive="#c8a850" emissiveIntensity={1} />
          </mesh>
        </group>
      ))}

      {/* Starfield ceiling */}
      {[...Array(80)].map((_, i) => (
        <mesh key={i} position={[
          (Math.random() - 0.5) * 36,
          15.3,
          (Math.random() - 0.5) * 44 + 5
        ]}>
          <sphereGeometry args={[0.016 + Math.random() * 0.018, 5, 5]} />
          <meshBasicMaterial color={i % 5 === 0 ? '#ffe8a0' : '#e8eeff'} />
        </mesh>
      ))}

      <FloatingParticles />
    </group>
  );
});

// --- ROW LABELS ---
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, i) => {
        const z = i * 1.9 + 1;
        const y = i * 0.42 + 0.6;
        return (
          <React.Fragment key={row}>
            {[-1, 1].map(side => (
              <group key={side} position={[side * 16.5, y, z]}>
                <RoundedBox args={[0.64, 0.64, 0.1]} radius={0.06} smoothness={3}>
                  <meshStandardMaterial color="#12102a" roughness={0.4} metalness={0.3}
                    emissive="#c8a850" emissiveIntensity={0.12} />
                </RoundedBox>
                {/* Gold border */}
                <mesh position={[0, 0, 0.06]}>
                  <ringGeometry args={[0.28, 0.32, 8]} />
                  <meshStandardMaterial color="#c8a850" roughness={0.2} metalness={0.9}
                    emissive="#c8a850" emissiveIntensity={0.4} />
                </mesh>
                <Text position={[0, 0, 0.07]} fontSize={0.36} color="#e8c87a"
                  anchorX="center" anchorY="middle">
                  {row}
                </Text>
              </group>
            ))}
          </React.Fragment>
        );
      })}
    </group>
  );
}

// --- SEAT TOOLTIP ---
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const typeLabel: Record<string, string> = { standard: 'Standard', premium: 'Premium', vip: 'VIP', accessible: 'Accessible' };
  const typeBadge: Record<string, string> = { standard: 'bg-slate-500', premium: 'bg-blue-600', vip: 'bg-purple-600', accessible: 'bg-teal-600' };

  return (
    <Html position={[position[0], position[1] + 2.2, position[2]]} center distanceFactor={14}>
      <div className="bg-slate-950/98 backdrop-blur-2xl text-white px-5 py-4 rounded-2xl shadow-2xl border border-amber-500/30 min-w-[210px] pointer-events-none select-none"
        style={{ boxShadow: '0 0 40px rgba(200,168,80,0.15), 0 20px 40px rgba(0,0,0,0.8)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-bold text-base tracking-wide">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${typeBadge[seat.type]} text-white shadow-lg`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent mb-2.5" />
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-emerald-400 text-base">{Rs}{seat.price.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
          </span>
        </div>
        {!isBooked && (
          <p className="mt-2.5 pt-2 border-t border-white/10 text-center text-xs text-amber-400/70">
            Click to {isSelected ? 'deselect' : 'select'}
          </p>
        )}
      </div>
    </Html>
  );
}

// --- YOUTUBE OVERLAY ---
function YouTubeOverlay({ videoId, rect }: { videoId: string; rect: { left: number; top: number; width: number; height: number; visible: boolean } }) {
  if (!rect.visible) return null;
  return (
    <div style={{
      position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      zIndex: 5, pointerEvents: 'auto', overflow: 'hidden', borderRadius: 6, backgroundColor: '#000',
      boxShadow: '0 0 80px rgba(99,102,241,0.6), 0 0 120px rgba(200,168,80,0.2)',
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
    if (s.status === 'booked' || s.isBooked) return 'bg-slate-700';
    if (selectedIds.includes(s.id)) return 'bg-emerald-400 ring-2 ring-emerald-300 shadow-lg shadow-emerald-400/50';
    if (s.type === 'vip') return 'bg-purple-500';
    if (s.type === 'premium') return 'bg-blue-500';
    if (s.type === 'accessible') return 'bg-teal-500';
    return 'bg-slate-400';
  };

  return (
    <div className="bg-slate-950/98 backdrop-blur-2xl p-4 rounded-2xl border border-amber-500/25 shadow-2xl"
      style={{ boxShadow: '0 0 30px rgba(200,168,80,0.1), 0 20px 40px rgba(0,0,0,0.8)' }}>
      <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full mb-3 shadow-lg shadow-amber-400/50" />
      <p className="text-[9px] text-center text-amber-400/70 mb-2.5 tracking-[0.2em] uppercase font-bold">Screen</p>
      <div className="space-y-1.5">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-1">
            <span className="text-[8px] text-amber-400/60 w-3 text-right font-bold">{row}</span>
            <div className="flex gap-1">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={!!(seat.status === 'booked' || seat.isBooked)}
                  className={`w-2 h-2 rounded-sm transition-all hover:scale-[3] ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:z-10'}`}
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
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(200,168,80,0.15), 0 30px 60px rgba(0,0,0,0.9)' }}
        onClick={e => e.stopPropagation()}>
        {/* Gold top accent */}
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
          <div className="border-t border-amber-500/15 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{selectedSeats.length}× Tickets</span>
              <span>{Rs}{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Convenience fee</span>
              <span>{Rs}50.00</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>GST (18%)</span>
              <span>{Rs}{Math.round(total * 0.18).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-amber-500/15">
              <span>Total</span>
              <span className="text-emerald-400 text-lg">{Rs}{(total + 50 + Math.round(total * 0.18)).toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-semibold transition-all">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all">
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
      const rowZ = rowIndex * 1.9 + 1;
      const rowY = rowIndex * 0.42 + 0.3;
      const mid = Math.floor(rowSeats.length / 2);
      rowSeats.forEach((seat, seatIndex) => {
        const normalizedX = (seatIndex - (rowSeats.length - 1) / 2) / Math.max(rowSeats.length / 2, 1);
        const curvePush = normalizedX * normalizedX * 0.45;
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.15 + (seatIndex >= mid ? 0.7 : -0.7);
        positions.push({ seat, position: [seatX, rowY, rowZ + curvePush] });
      });
    });
    return positions;
  }, [seatsByRow]);

  const findBestSeats = useCallback((count: number = 4) => {
    const available = seatPositions.filter(({ seat }) => seat.status === 'available' && !seat.isBooked);
    const scored = available.map(({ seat, position }) => ({
      seat,
      score: (15 - Math.abs(position[0])) + (12 - Math.abs(4 - position[2] / 1.9)) + (seat.type === 'vip' ? 8 : seat.type === 'premium' ? 5 : 0),
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
      setCameraTarget({ position: new THREE.Vector3(x * 0.35, y + 2.8, z + 4.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
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
      topdown: { position: new THREE.Vector3(0, 32, 12), lookAt: new THREE.Vector3(0, 0, 8) },
      front: { position: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z + 9), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side: { position: new THREE.Vector3(30, 12, 9), lookAt: new THREE.Vector3(0, 4, 6) },
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
          setCameraTarget({ position: new THREE.Vector3(x * 0.35, y + 2.8, z + 4.5), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) });
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
    <div className="relative w-full h-[900px] rounded-2xl overflow-hidden shadow-2xl border border-amber-500/20"
      style={{ background: 'linear-gradient(to bottom, #04040c, #080814, #04040c)' }}>

      {/* Outer gold accent border */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none z-30"
        style={{ boxShadow: 'inset 0 0 80px rgba(200,168,80,0.06), inset 0 0 1px rgba(200,168,80,0.3)' }} />

      {youtubeId && <YouTubeOverlay videoId={youtubeId} rect={screenRect} />}

      {/* TOP CONTROLS */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-b from-black/95 via-black/70 to-transparent pt-4 pb-14 px-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex-1 max-w-[580px]">
              <button onClick={() => setShowMoviePanel(!showMoviePanel)}
                className="flex items-center gap-2.5 mb-3 group">
                <Film className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400/80 group-hover:text-amber-300 transition-colors">
                  Movie & Showtime
                </span>
                {showMoviePanel ? <ChevronDown className="w-3.5 h-3.5 text-amber-400/50" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-400/50" />}
              </button>

              {showMoviePanel && (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {movies.map(movie => (
                      <button key={movie.id}
                        onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                        className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border shadow-lg
                          ${selectedMovie.id === movie.id
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 shadow-amber-500/20'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-amber-500/20'
                          }`}>
                        <img src={movie.image} alt="" className="w-6 h-9 object-cover rounded shadow-md"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
                            ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-300 shadow-emerald-500/20'
                            : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/8 hover:border-amber-500/20'
                          }`}>
                        {st.time}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-amber-500/20 shadow-lg">
                    <img src={selectedMovie.image} alt="" className="w-8 h-12 object-cover rounded shadow-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-bold truncate">{selectedMovie.title}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">{selectedMovie.genre} · {selectedMovie.duration}</p>
                    </div>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold flex-shrink-0">{selectedMovie.rating}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                {[
                  { icon: soundEnabled ? Volume2 : VolumeX, fn: () => setSoundEnabled(!soundEnabled), on: soundEnabled },
                  { icon: Camera, fn: () => { if (soundEnabled) playSound('success'); const c = document.querySelector('canvas'); if (c) { const l = document.createElement('a'); l.download = `cineplex-${Date.now()}.png`; l.href = c.toDataURL('image/png'); l.click(); } } },
                  { icon: Grid3X3, fn: () => setShowMiniMap(!showMiniMap), on: showMiniMap },
                  { icon: lightsOn ? Sun : SunDim, fn: () => setLightsOn(!lightsOn), on: lightsOn },
                ].map(({ icon: Icon, fn, on }, i) => (
                  <button key={i} onClick={fn}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border shadow-lg
                      ${on ? 'bg-amber-500/25 border-amber-400/40 text-amber-300 shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10 hover:border-amber-500/20'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {([
                  { m: 'default' as ViewMode, l: 'Free', I: Eye },
                  { m: 'topdown' as ViewMode, l: 'Top', I: Maximize2 },
                  { m: 'front' as ViewMode, l: 'Front', I: Film },
                  { m: 'side' as ViewMode, l: 'Side', I: Armchair },
                ]).map(({ m, l, I }) => (
                  <button key={m} onClick={() => changeView(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1 shadow-md
                      ${viewMode === m ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <I className="w-3 h-3" />{l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { if (soundEnabled) playSound('success'); setHighlightedSeats(findBestSeats(4)); setTimeout(() => setHighlightedSeats([]), 6000); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:bg-amber-500/35 flex items-center gap-1.5 shadow-lg shadow-amber-500/15">
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

      {viewingSeat && (
        <div className="absolute top-[125px] left-1/2 -translate-x-1/2 z-20">
          <div className="bg-amber-500/15 backdrop-blur-xl text-white px-5 py-2 rounded-full flex items-center gap-2.5 border border-amber-500/30 shadow-xl shadow-amber-500/15">
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
            <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent mb-3" />
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              {[
                ['#2d3a4f', 'Standard'],
                ['#1e3a7a', 'Premium'],
                ['#5b21b6', 'VIP'],
                ['#0f766e', 'Accessible'],
                ['#059669', 'Selected'],
                ['#111122', 'Booked'],
                ['#f59e0b', 'Best Seats'],
              ].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-md flex-shrink-0 shadow-lg ring-1 ring-white/10" style={{ backgroundColor: c }} />
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
        <div className="bg-slate-950/98 backdrop-blur-2xl p-4 rounded-2xl border border-amber-500/25 w-[268px] shadow-2xl"
          style={{ boxShadow: '0 0 30px rgba(200,168,80,0.08), 0 20px 40px rgba(0,0,0,0.9)' }}>
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent mb-3" />
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
                <div className="flex justify-between text-gray-500">
                  <span>Convenience fee</span>
                  <span>{Rs}50</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>GST (18%)</span>
                  <span>{Rs}{Math.round(totalPrice * 0.18).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-amber-500/15">
                  <span>Total</span>
                  <span className="text-emerald-400 text-base">{Rs}{(totalPrice + 50 + Math.round(totalPrice * 0.18)).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(true)}
                className="w-full mt-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 transition-all">
                <Check className="w-4 h-4" /> Checkout
              </button>
            </>
          ) : (
            <div className="text-center py-7">
              <Sofa className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-xs font-medium">No seats selected</p>
              <p className="text-gray-600 text-[10px] mt-1">Click a seat in the theater</p>
            </div>
          )}
        </div>
      </div>

      {/* 3D CANVAS */}
      <Canvas
        shadows
        camera={{ position: [DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z], fov: 52, near: 0.5, far: 120 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.35,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'linear-gradient(to bottom, #04040c, #080814)' }}
        dpr={[1, 2]}
      >
        <CameraController target={cameraTarget} isAnimating={isAnimating}
          onDone={() => setIsAnimating(false)} controlsRef={controlsRef} />

        {/* Lighting rig */}
        <ambientLight intensity={0.45} color="#b0bcd8" />
        <hemisphereLight args={['#3a4a78', '#0a0a1e', 0.55]} />
        <directionalLight position={[10, 22, 12]} intensity={1.8} color="#f5ead8"
          castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-28} shadow-camera-right={28}
          shadow-camera-top={28} shadow-camera-bottom={-28}
          shadow-bias={-0.0001} />
        <directionalLight position={[-12, 18, -10]} intensity={0.55} color="#6677cc" />
        <directionalLight position={[0, 10, -22]} intensity={0.8} color="#4466dd" />
        <pointLight position={[0, 5, 20]} intensity={0.4} distance={30} color="#c8a850" />

        {youtubeId && <ScreenPositionTracker onUpdate={handleScreenUpdate} />}

        <PremiumTheaterScreen movieTitle={selectedMovie.title} />
        <RowLabels rows={rows} />
        <TheaterEnvironment lightsOn={lightsOn} />

        {seatPositions.map(({ seat, position }) => (
          <LuxurySeat3D
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
          minDistance={5}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2.08}
          minPolarAngle={0.12}
          target={[DEFAULT_LOOK_AT.x, DEFAULT_LOOK_AT.y, DEFAULT_LOOK_AT.z]}
          enableDamping
          dampingFactor={0.04}
          rotateSpeed={0.55}
          zoomSpeed={0.9}
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
