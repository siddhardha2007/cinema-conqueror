import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, Environment, ContactShadows } from '@react-three/drei';
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
const SCREEN_Z = -16;
const SCREEN_Y = 7.5;
const SCREEN_WIDTH = 22;
const SCREEN_HEIGHT = 10;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 24);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 3, 0);

const SEAT_COLORS: Record<string, { base: string; hover: string; selected: string; booked: string; fabric: string; accent: string }> = {
  standard: { base: '#6b7280', hover: '#9ca3af', selected: '#10b981', booked: '#374151', fabric: '#4b5563', accent: '#555e6e' },
  premium: { base: '#3b82f6', hover: '#60a5fa', selected: '#10b981', booked: '#374151', fabric: '#2563eb', accent: '#1d4ed8' },
  vip: { base: '#a855f7', hover: '#c084fc', selected: '#10b981', booked: '#374151', fabric: '#7c3aed', accent: '#6d28d9' },
  accessible: { base: '#14b8a6', hover: '#2dd4bf', selected: '#10b981', booked: '#374151', fabric: '#0d9488', accent: '#0f766e' },
};

// --- DATA ---
const movies = [
  { id: '1', title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911BTUgMe1YdBGm.jpg", video: "https://www.youtube.com/watch?v=EXeTwQWrcwY", description: "Batman faces the Joker.", duration: "2h 32m", rating: "PG-13", genre: "Action • Crime" },
  { id: '2', title: "Inception", image: "https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg", video: "https://www.youtube.com/watch?v=YoHD9XEInc0", description: "Dream-sharing technology.", duration: "2h 28m", rating: "PG-13", genre: "Sci-Fi • Action" },
  { id: '3', title: "Interstellar", image: "https://image.tmdb.org/t/p/w300/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", video: "https://www.youtube.com/watch?v=zSWdZVtXT7E", description: "Journey through a wormhole.", duration: "2h 49m", rating: "PG-13", genre: "Sci-Fi • Adventure" },
  { id: '4', title: "Oppenheimer", image: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", video: "https://www.youtube.com/watch?v=uYPbbksJxIg", description: "The atomic bomb story.", duration: "3h 00m", rating: "R", genre: "Biography • Drama" }
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
      const freqs: Record<string, number[]> = {
        click: [600, 800],
        select: [500, 700, 900],
        hover: [450],
        success: [523, 659, 784],
        error: [200, 180]
      };
      const f = freqs[type];
      f.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        o.type = type === 'error' ? 'sawtooth' : 'sine';
        g.gain.setValueAtTime(0.04, ctx.currentTime + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.15);
        o.start(ctx.currentTime + i * 0.06);
        o.stop(ctx.currentTime + i * 0.06 + 0.15);
      });
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
    progressRef.current = Math.min(progressRef.current + delta * 1.2, 1);
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

// --- REALISTIC THEATER SEAT ---
const Seat3D = React.memo(function Seat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const cushionRef = useRef<THREE.Group>(null);
  const foldAngle = useRef(0);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors = SEAT_COLORS[seat.type];

  useFrame((_, delta) => {
    const targetFold = isSelected ? Math.PI * 0.35 : 0;
    foldAngle.current += (targetFold - foldAngle.current) * delta * 5;

    if (cushionRef.current) {
      cushionRef.current.rotation.x = foldAngle.current;
    }

    if (groupRef.current) {
      const targetScale = hovered && !isBooked ? 1.06 : 1;
      const targetY = hovered && !isBooked ? 0.03 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8);
      groupRef.current.position.y += (position[1] + targetY - groupRef.current.position.y) * delta * 8;
    }
  });

  const mainColor = isBooked ? colors.booked : isSelected ? colors.selected :
    isHighlighted ? '#fbbf24' : hovered ? colors.hover : colors.base;

  const fabricColor = isBooked ? '#2d3748' : isSelected ? '#059669' :
    isHighlighted ? '#d97706' : hovered ? colors.hover : colors.fabric;

  const emissive = isSelected ? 0.3 : isHighlighted ? 0.25 : hovered && !isBooked ? 0.15 : 0.02;

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

  const seatWidth = 0.95;
  const seatDepth = 0.8;
  const armrestHeight = 0.42;
  const backHeight = 0.85;

  return (
    <group ref={groupRef} position={position}>
      {/* === SEAT BASE / PEDESTAL === */}
      <mesh position={[0, -0.05, 0.05]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.1, 8]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Central support post */}
      <mesh position={[0, 0.02, 0.05]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.14, 6]} />
        <meshStandardMaterial color="#252540" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* === SEAT FRAME (metal structure) === */}
      {/* Left frame rail */}
      <mesh position={[-seatWidth / 2 + 0.02, 0.12, 0.05]} castShadow>
        <boxGeometry args={[0.04, 0.06, seatDepth + 0.1]} />
        <meshStandardMaterial color="#2a2a42" roughness={0.25} metalness={0.85} />
      </mesh>
      {/* Right frame rail */}
      <mesh position={[seatWidth / 2 - 0.02, 0.12, 0.05]} castShadow>
        <boxGeometry args={[0.04, 0.06, seatDepth + 0.1]} />
        <meshStandardMaterial color="#2a2a42" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* === SEAT CUSHION (foldable) === */}
      <group ref={cushionRef} position={[0, 0.16, -seatDepth / 2 + 0.4]}>
        {/* Main cushion body */}
        <RoundedBox args={[seatWidth - 0.14, 0.14, seatDepth - 0.08]}
          radius={0.04} smoothness={3}
          position={[0, 0, (seatDepth - 0.08) / 2 - 0.36]}
          castShadow receiveShadow
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <meshStandardMaterial
            color={fabricColor}
            roughness={0.75}
            metalness={0.02}
            emissive={mainColor}
            emissiveIntensity={emissive}
          />
        </RoundedBox>

        {/* Cushion stitch line - center */}
        <mesh position={[0, 0.072, (seatDepth - 0.08) / 2 - 0.36]}
          rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[seatWidth - 0.28, seatDepth - 0.22]} />
          <meshStandardMaterial
            color={fabricColor}
            roughness={0.85}
            metalness={0}
            transparent
            opacity={0.3}
          />
        </mesh>

        {/* Seat number on cushion */}
        <Text
          position={[0, 0.076, (seatDepth - 0.08) / 2 - 0.36]}
          fontSize={0.12}
          color={isBooked ? '#555' : '#fff'}
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {seat.number}
        </Text>
      </group>

      {/* === SEAT BACK === */}
      <group position={[0, 0.16, 0.42]}>
        {/* Back frame */}
        <RoundedBox args={[seatWidth - 0.08, backHeight, 0.1]}
          radius={0.035} smoothness={3}
          position={[0, backHeight / 2 + 0.02, 0]}
          castShadow receiveShadow
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <meshStandardMaterial
            color={fabricColor}
            roughness={0.78}
            metalness={0.02}
            emissive={mainColor}
            emissiveIntensity={emissive}
          />
        </RoundedBox>

        {/* Back cushion padding - upper */}
        <RoundedBox args={[seatWidth - 0.2, backHeight * 0.45, 0.06]}
          radius={0.025} smoothness={2}
          position={[0, backHeight * 0.65 + 0.02, -0.04]}
          castShadow
        >
          <meshStandardMaterial
            color={fabricColor}
            roughness={0.82}
            metalness={0}
            emissive={mainColor}
            emissiveIntensity={emissive * 0.5}
          />
        </RoundedBox>

        {/* Back cushion padding - lower */}
        <RoundedBox args={[seatWidth - 0.2, backHeight * 0.35, 0.055]}
          radius={0.025} smoothness={2}
          position={[0, backHeight * 0.28 + 0.02, -0.04]}
          castShadow
        >
          <meshStandardMaterial
            color={fabricColor}
            roughness={0.82}
            metalness={0}
            emissive={mainColor}
            emissiveIntensity={emissive * 0.5}
          />
        </RoundedBox>

        {/* Headrest - for VIP and Premium */}
        {(seat.type === 'vip' || seat.type === 'premium') && (
          <RoundedBox args={[seatWidth * 0.55, 0.2, 0.08]}
            radius={0.03} smoothness={2}
            position={[0, backHeight + 0.08, -0.02]}
            castShadow
          >
            <meshStandardMaterial
              color={fabricColor}
              roughness={0.8}
              metalness={0.02}
              emissive={mainColor}
              emissiveIntensity={emissive * 0.5}
            />
          </RoundedBox>
        )}

        {/* Back top trim */}
        <mesh position={[0, backHeight + (seat.type === 'vip' || seat.type === 'premium' ? 0.2 : 0) + 0.02, 0]}>
          <boxGeometry args={[seatWidth - 0.06, 0.025, 0.12]} />
          <meshStandardMaterial color="#1e1e35" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      {/* === ARMRESTS === */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (seatWidth / 2 + 0.01), 0.12, 0.08]}>
          {/* Armrest vertical support */}
          <mesh position={[0, armrestHeight / 2 - 0.04, 0.15]} castShadow>
            <boxGeometry args={[0.05, armrestHeight - 0.06, 0.06]} />
            <meshStandardMaterial color="#1e1e35" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0, armrestHeight / 2 - 0.04, -0.15]} castShadow>
            <boxGeometry args={[0.05, armrestHeight - 0.06, 0.06]} />
            <meshStandardMaterial color="#1e1e35" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Armrest top pad */}
          <RoundedBox args={[0.08, 0.04, seatDepth - 0.1]}
            radius={0.015} smoothness={2}
            position={[0, armrestHeight - 0.02, 0.04]}
            castShadow
          >
            <meshStandardMaterial
              color={seat.type === 'vip' ? '#2a2045' : '#1e1e35'}
              roughness={0.5}
              metalness={0.5}
            />
          </RoundedBox>

          {/* Armrest front cap */}
          <mesh position={[0, armrestHeight - 0.02, -seatDepth / 2 + 0.1]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#2a2a45" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* === CUP HOLDER (on right armrest) === */}
      <group position={[seatWidth / 2 + 0.01, armrestHeight + 0.1, -0.08]}>
        <mesh rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.06, 12, 1, true]} />
          <meshStandardMaterial color="#1a1a30" roughness={0.3} metalness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 12]} />
          <meshStandardMaterial color="#151528" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* === TYPE INDICATORS === */}
      {seat.type === 'vip' && (
        <group position={[0, backHeight + 0.52, 0.42]}>
          <mesh>
            <octahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.5} metalness={0.95} roughness={0.05} />
          </mesh>
          {/* Crown shape */}
          {[-0.08, 0, 0.08].map((x, i) => (
            <mesh key={i} position={[x, 0.06, 0]}>
              <coneGeometry args={[0.015, 0.04, 4]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      )}

      {seat.type === 'premium' && (
        <group position={[0, backHeight + 0.45, 0.42]}>
          <mesh>
            <icosahedronGeometry args={[0.04, 0]} />
            <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.8} metalness={0.8} roughness={0.15} />
          </mesh>
        </group>
      )}

      {seat.type === 'accessible' && (
        <group position={[0, backHeight + 0.38, 0.42]}>
          <mesh>
            <torusGeometry args={[0.05, 0.015, 8, 16]} />
            <meshStandardMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.05, 6]} />
            <meshStandardMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      {/* === SELECTION GLOW RING === */}
      {isSelected && (
        <mesh position={[0, 0.01, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.65, 24]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      )}

      {/* === HIGHLIGHT PULSE === */}
      {isHighlighted && (
        <mesh position={[0, 0.01, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} toneMapped={false} />
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
    <Html position={[position[0], position[1] + 1.8, position[2]]} center distanceFactor={14}>
      <div className="bg-slate-900/95 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl border border-white/15 min-w-[200px] pointer-events-none select-none">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${typeBadge[seat.type]} text-white`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Price</span>
            <span className="font-bold text-emerald-400">${seat.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Status</span>
            <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
              {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
            </span>
          </div>
        </div>
        {!isBooked && (
          <p className="mt-2 pt-2 border-t border-white/10 text-center text-[10px] text-gray-500">
            Click to {isSelected ? 'deselect' : 'select'}
          </p>
        )}
      </div>
    </Html>
  );
}

// --- GRAND THEATER SCREEN ---
function TheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenGlowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (screenGlowRef.current) {
      screenGlowRef.current.intensity = 2.5 + Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* === BACK WALL === */}
      <mesh position={[0, 0, -1.2]}>
        <planeGeometry args={[44, 22]} />
        <meshStandardMaterial color="#080818" roughness={0.95} />
      </mesh>

      {/* === SCREEN HOUSING / FRAME === */}
      {/* Outer frame - decorative border */}
      <RoundedBox args={[SCREEN_WIDTH + 3, SCREEN_HEIGHT + 2.2, 0.4]}
        radius={0.12} smoothness={3}
        position={[0, 0.1, -0.3]}
      >
        <meshStandardMaterial color="#12122a" roughness={0.5} metalness={0.6} />
      </RoundedBox>

      {/* Inner frame - metallic */}
      <RoundedBox args={[SCREEN_WIDTH + 1.2, SCREEN_HEIGHT + 0.8, 0.3]}
        radius={0.08} smoothness={3}
        position={[0, 0.1, -0.15]}
      >
        <meshStandardMaterial color="#1a1a38" roughness={0.4} metalness={0.7} />
      </RoundedBox>

      {/* Frame accent lines */}
      {[
        [-SCREEN_WIDTH / 2 - 0.3, 0, -0.08, 0.02, SCREEN_HEIGHT + 0.4, 0.02],
        [SCREEN_WIDTH / 2 + 0.3, 0, -0.08, 0.02, SCREEN_HEIGHT + 0.4, 0.02],
        [0, SCREEN_HEIGHT / 2 + 0.22, -0.08, SCREEN_WIDTH + 0.6, 0.02, 0.02],
        [0, -SCREEN_HEIGHT / 2 - 0.22, -0.08, SCREEN_WIDTH + 0.6, 0.02, 0.02],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} emissive="#c4982a" emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* Corner accents */}
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy], i) => (
        <mesh key={i} position={[
          sx * (SCREEN_WIDTH / 2 + 0.3),
          sy * (SCREEN_HEIGHT / 2 + 0.22),
          -0.06
        ]}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.95} emissive="#c4982a" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* === SCREEN SURFACE === */}
      <mesh position={[0, 0.1, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#0a0a14" />
      </mesh>

      {/* Screen edge glow */}
      <mesh position={[0, 0.1, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.1, SCREEN_HEIGHT + 0.1]} />
        <meshBasicMaterial color="#1a2a55" transparent opacity={0.15} />
      </mesh>

      {/* === SCREEN LIGHTING === */}
      <pointLight ref={screenGlowRef} position={[0, 0, 6]} intensity={2.5} distance={40} color="#4466bb" />
      <pointLight position={[-6, -2, 4]} intensity={0.5} distance={15} color="#3344aa" />
      <pointLight position={[6, -2, 4]} intensity={0.5} distance={15} color="#3344aa" />

      {/* === LUXURY CURTAINS === */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 3.2), 0, 0.2]}>
          {/* Main curtain panels with folds */}
          {Array.from({ length: 7 }, (_, i) => {
            const depth = Math.sin(i * 0.7) * 0.15 + 0.1;
            const widthVar = 0.65 + Math.sin(i * 1.2) * 0.1;
            return (
              <group key={i} position={[side * (i * 0.55), 0, depth]}>
                <mesh castShadow>
                  <boxGeometry args={[widthVar, SCREEN_HEIGHT + 5, 0.25 + Math.sin(i) * 0.06]} />
                  <meshStandardMaterial
                    color={i % 2 === 0 ? '#7a1818' : '#921e1e'}
                    roughness={0.9}
                    metalness={0.05}
                  />
                </mesh>
                {/* Fold shadow strip */}
                <mesh position={[widthVar / 2 * side * -0.3, 0, -0.12]}>
                  <boxGeometry args={[0.08, SCREEN_HEIGHT + 5, 0.02]} />
                  <meshStandardMaterial color="#4a0e0e" roughness={0.95} />
                </mesh>
              </group>
            );
          })}

          {/* Curtain tie-back */}
          <group position={[side * 0.3, -2, 0.5]}>
            <mesh>
              <torusGeometry args={[0.25, 0.04, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
            </mesh>
            {/* Tassel */}
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} position={[(i - 2) * 0.06, -0.35, 0]}>
                <cylinderGeometry args={[0.012, 0.008, 0.3, 4]} />
                <meshStandardMaterial color="#c4982a" roughness={0.4} metalness={0.7} />
              </mesh>
            ))}
            <mesh position={[0, -0.52, 0]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
            </mesh>
          </group>
        </group>
      ))}

      {/* === TOP PELMET / VALANCE === */}
      <group position={[0, SCREEN_HEIGHT / 2 + 2.2, 0.4]}>
        {/* Main pelmet */}
        <mesh castShadow>
          <boxGeometry args={[SCREEN_WIDTH + 12, 2.2, 1]} />
          <meshStandardMaterial color="#7a1818" roughness={0.88} />
        </mesh>
        {/* Pelmet scalloped edge */}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[(i - 5.5) * 2.2, -1.25, 0.3]}>
            <sphereGeometry args={[0.55, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#8a1e1e" roughness={0.9} />
          </mesh>
        ))}
        {/* Gold trim along pelmet */}
        <mesh position={[0, -1.05, 0.52]}>
          <boxGeometry args={[SCREEN_WIDTH + 12, 0.06, 0.04]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} emissive="#c4982a" emissiveIntensity={0.1} />
        </mesh>
      </group>

      {/* === NOW SHOWING TEXT === */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 1.5, 0.3]}>
        <RoundedBox args={[8, 0.5, 0.08]} radius={0.04} smoothness={2}>
          <meshStandardMaterial color="#151528" roughness={0.5} metalness={0.4} />
        </RoundedBox>
        <Text position={[0, 0, 0.06]} fontSize={0.22} color="#7888aa"
          anchorX="center" letterSpacing={0.2} font={undefined}>
          {`★  NOW SHOWING — ${movieTitle.toUpperCase()}  ★`}
        </Text>
      </group>
    </group>
  );
}

// --- ORNATE WALL SCONCE ---
function WallSconce({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Back plate - ornate */}
      <mesh>
        <boxGeometry args={[0.3, 0.5, 0.04]} />
        <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Decorative diamond on plate */}
      <mesh position={[0, -0.12, 0.03]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial color="#d4a83a" roughness={0.15} metalness={0.95} />
      </mesh>

      {/* Arm */}
      <mesh position={[0, 0.08, 0.15]} rotation={[Math.PI * 0.15, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.3, 6]} />
        <meshStandardMaterial color="#b8892a" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* Shade */}
      <mesh position={[0, 0.2, 0.28]}>
        <cylinderGeometry args={[0.08, 0.14, 0.2, 8, 1, true]} />
        <meshStandardMaterial
          color="#fff5e0" roughness={0.7} side={THREE.DoubleSide}
          transparent opacity={0.85}
          emissive="#ffe8b0" emissiveIntensity={0.4}
        />
      </mesh>

      {/* Bulb glow */}
      <mesh position={[0, 0.16, 0.28]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color="#fff5e0" toneMapped={false} />
      </mesh>

      {/* Light */}
      <pointLight position={[0, 0.18, 0.3]} intensity={0.8} distance={6} color="#ffe0a0" />
    </group>
  );
}

function WallSconces() {
  const positions = useMemo(() => {
    const p: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 5; i++) {
      p.push({ pos: [-18.8, 6, -6 + i * 7], rot: [0, Math.PI / 2, 0] });
      p.push({ pos: [18.8, 6, -6 + i * 7], rot: [0, -Math.PI / 2, 0] });
    }
    return p;
  }, []);

  return (
    <group>
      {positions.map((s, i) => (
        <WallSconce key={i} position={s.pos} rotation={s.rot} />
      ))}
    </group>
  );
}

// --- GRAND THEATER ENVIRONMENT ---
const TheaterEnvironment = React.memo(function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();
  const ceilingLightsRef = useRef<THREE.Group>(null);
  const chandelierRef = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#080818', 0.005);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((state, delta) => {
    // Animate ceiling lights
    if (ceilingLightsRef.current) {
      ceilingLightsRef.current.children.forEach(child => {
        child.traverse(obj => {
          if (obj instanceof THREE.PointLight) {
            const t = lightsOn ? 2 : 0.15;
            obj.intensity += (t - obj.intensity) * delta * 3;
          }
        });
      });
    }

    // Slowly rotate chandelier
    if (chandelierRef.current) {
      chandelierRef.current.rotation.y += delta * 0.05;
    }
  });

  const steps = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    z: i * 2 + 1.5,
    y: i * 0.45,
    index: i,
  })), []);

  return (
    <group>
      {/* === FLOOR === */}
      {/* Main floor */}
      <mesh position={[0, -0.05, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 60]} />
        <meshStandardMaterial color="#141428" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Carpet runners */}
      <mesh position={[0, -0.02, 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.5, 25]} />
        <meshStandardMaterial color="#2a1520" roughness={0.95} />
      </mesh>
      {/* Side aisle carpets */}
      <mesh position={[-13, -0.02, 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 25]} />
        <meshStandardMaterial color="#2a1520" roughness={0.95} />
      </mesh>
      <mesh position={[13, -0.02, 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 25]} />
        <meshStandardMaterial color="#2a1520" roughness={0.95} />
      </mesh>

      {/* === WALLS === */}
      {/* Side walls with wainscoting */}
      {[-1, 1].map(side => (
        <group key={side}>
          {/* Main wall */}
          <mesh position={[side * 19, 7, 5]} rotation={[0, -side * Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[52, 18]} />
            <meshStandardMaterial color="#12122a" roughness={0.85} />
          </mesh>

          {/* Lower wall panel (wainscoting) */}
          <mesh position={[side * 18.9, 2.5, 5]} rotation={[0, -side * Math.PI / 2, 0]}>
            <planeGeometry args={[52, 5.5]} />
            <meshStandardMaterial color="#181835" roughness={0.75} metalness={0.15} />
          </mesh>

          {/* Chair rail */}
          <mesh position={[side * 18.85, 5.2, 5]} rotation={[0, -side * Math.PI / 2, 0]}>
            <boxGeometry args={[52, 0.08, 0.12]} />
            <meshStandardMaterial color="#c4982a" roughness={0.25} metalness={0.85} />
          </mesh>

          {/* Crown molding */}
          <mesh position={[side * 18.85, 15, 5]} rotation={[0, -side * Math.PI / 2, 0]}>
            <boxGeometry args={[52, 0.15, 0.2]} />
            <meshStandardMaterial color="#c4982a" roughness={0.25} metalness={0.85} />
          </mesh>

          {/* Decorative wall panels */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[side * 18.88, 8.5, -8 + i * 7]}
              rotation={[0, -side * Math.PI / 2, 0]}>
              <planeGeometry args={[4.5, 6]} />
              <meshStandardMaterial color="#161632" roughness={0.78} metalness={0.12} />
            </mesh>
          ))}

          {/* Panel frame accents */}
          {Array.from({ length: 6 }, (_, i) => (
            <group key={`frame-${i}`}>
              {/* Top */}
              <mesh position={[side * 18.87, 11.5, -8 + i * 7]} rotation={[0, -side * Math.PI / 2, 0]}>
                <boxGeometry args={[4.7, 0.04, 0.04]} />
                <meshStandardMaterial color="#c4982a" roughness={0.3} metalness={0.8} emissive="#c4982a" emissiveIntensity={0.05} />
              </mesh>
              {/* Bottom */}
              <mesh position={[side * 18.87, 5.5, -8 + i * 7]} rotation={[0, -side * Math.PI / 2, 0]}>
                <boxGeometry args={[4.7, 0.04, 0.04]} />
                <meshStandardMaterial color="#c4982a" roughness={0.3} metalness={0.8} emissive="#c4982a" emissiveIntensity={0.05} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Back wall */}
      <mesh position={[0, 7, 26]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[40, 18]} />
        <meshStandardMaterial color="#101025" roughness={0.88} />
      </mesh>

      {/* === CEILING === */}
      {/* Main ceiling */}
      <mesh position={[0, 15.5, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 46]} />
        <meshStandardMaterial color="#0c0c1e" roughness={0.95} />
      </mesh>

      {/* Ceiling coffer panels */}
      {[[-8, 15.3, 2], [8, 15.3, 2], [-8, 15.3, 12], [8, 15.3, 12], [0, 15.3, 7]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[8, 0.15, 8]} radius={0.05} smoothness={2}>
            <meshStandardMaterial color="#0e0e22" roughness={0.8} metalness={0.2} />
          </RoundedBox>
          {/* Coffer trim */}
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[8.2, 0.03, 8.2]} />
            <meshStandardMaterial color="#c4982a" roughness={0.3} metalness={0.8} transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      {/* Wall sconces */}
      <WallSconces />

      {/* === STADIUM SEATING RISERS === */}
      {steps.map(step => (
        <group key={step.index}>
          {/* Main riser */}
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[34, 0.5, 2]} />
            <meshStandardMaterial color="#1a1a35" roughness={0.8} metalness={0.12} />
          </mesh>

          {/* Riser face */}
          <mesh position={[0, step.y + 0.25, step.z + 0.99]}>
            <boxGeometry args={[34, 0.5, 0.02]} />
            <meshStandardMaterial color="#161630" roughness={0.85} />
          </mesh>

          {/* LED strip lighting on each step */}
          <mesh position={[0, step.y + 0.265, step.z + 0.98]}>
            <boxGeometry args={[30, 0.015, 0.015]} />
            <meshBasicMaterial color={lightsOn ? '#4477cc' : '#1a2a55'} toneMapped={false} />
          </mesh>

          {/* Carpet on top of riser */}
          <mesh position={[0, step.y + 0.26, step.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[33.5, 1.9]} />
            <meshStandardMaterial color="#1e1832" roughness={0.95} />
          </mesh>

          {/* Side trim */}
          {[-17, 17].map((x, i) => (
            <mesh key={i} position={[x, step.y + 0.12, step.z]}>
              <boxGeometry args={[0.04, 0.5, 2.02]} />
              <meshStandardMaterial color="#c4982a" roughness={0.3} metalness={0.8} transparent opacity={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* === AISLE STEP LIGHTS === */}
      {steps.map(step => (
        <group key={`aisle-${step.index}`}>
          {[0].map((x, i) => (
            <group key={i}>
              <pointLight
                position={[x, step.y + 0.32, step.z + 0.5]}
                intensity={lightsOn ? 0.15 : 0.04}
                distance={2}
                color="#4477cc"
              />
            </group>
          ))}
        </group>
      ))}

      {/* === EXIT SIGNS === */}
      {[[-17.5, 6, 24], [17.5, 6, 24]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[1.8, 0.55, 0.08]} radius={0.05} smoothness={2}>
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </RoundedBox>
          <Text position={[0, 0, 0.05]} fontSize={0.22} color="#fff" anchorX="center" fontWeight="bold">
            EXIT
          </Text>
          <pointLight position={[0, -0.5, 0.3]} intensity={0.3} distance={3} color="#22c55e" />
        </group>
      ))}

      {/* === CHANDELIER === */}
      <group ref={chandelierRef} position={[0, 14.5, 8]}>
        {/* Central column */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Ceiling plate */}
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.4, 0.3, 0.1, 12]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Ring 1 */}
        <mesh position={[0, -0.2, 0]}>
          <torusGeometry args={[1.2, 0.04, 8, 24]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Ring 2 */}
        <mesh position={[0, -0.5, 0]}>
          <torusGeometry args={[1.8, 0.04, 8, 24]} />
          <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Support chains */}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <group key={i}>
              <mesh position={[Math.cos(angle) * 1.2, -0.2, Math.sin(angle) * 1.2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.7, 4]} />
                <meshStandardMaterial color="#b8892a" roughness={0.3} metalness={0.85} />
              </mesh>
              <mesh position={[Math.cos(angle) * 1.8, -0.5, Math.sin(angle) * 1.8]}>
                <cylinderGeometry args={[0.015, 0.015, 0.7, 4]} />
                <meshStandardMaterial color="#b8892a" roughness={0.3} metalness={0.85} />
              </mesh>
            </group>
          );
        })}

        {/* Inner light bulbs */}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <group key={`inner-${i}`} position={[Math.cos(angle) * 1.2, -0.45, Math.sin(angle) * 1.2]}>
              <mesh>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color="#fff5e0" toneMapped={false} />
              </mesh>
            </group>
          );
        })}

        {/* Outer light bulbs */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <group key={`outer-${i}`} position={[Math.cos(angle) * 1.8, -0.75, Math.sin(angle) * 1.8]}>
              <mesh>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshBasicMaterial color="#fff5e0" toneMapped={false} />
              </mesh>
              {/* Crystal drops */}
              <mesh position={[0, -0.12, 0]}>
                <octahedronGeometry args={[0.03, 0]} />
                <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.1} transparent opacity={0.7} />
              </mesh>
            </group>
          );
        })}

        {/* Chandelier light */}
        <pointLight position={[0, -0.5, 0]} intensity={lightsOn ? 3 : 0.3} distance={18} color="#ffe8c0" />
      </group>

      {/* === CEILING RECESSED LIGHTS === */}
      <group ref={ceilingLightsRef}>
        {[
          [-6, 15.2, 0], [6, 15.2, 0],
          [-6, 15.2, 8], [6, 15.2, 8],
          [-6, 15.2, 16], [6, 15.2, 16],
          [-12, 15.2, 4], [12, 15.2, 4],
          [-12, 15.2, 12], [12, 15.2, 12],
        ].map((pos, i) => (
          <group key={i} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.25, 0.3, 0.1, 12]} />
              <meshStandardMaterial color="#1e1e38" roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.04, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.02, 12]} />
              <meshBasicMaterial color={lightsOn ? '#fff5e0' : '#2a2a40'} toneMapped={false} transparent opacity={lightsOn ? 0.8 : 0.3} />
            </mesh>
            <pointLight intensity={lightsOn ? 2 : 0.15} distance={10} color="#ffe8c8" />
          </group>
        ))}
      </group>

      {/* === PROJECTOR BOOTH === */}
      <group position={[0, 12.5, 24]}>
        {/* Booth structure */}
        <RoundedBox args={[5, 3.5, 4]} radius={0.15} smoothness={2}>
          <meshStandardMaterial color="#151530" roughness={0.7} metalness={0.3} />
        </RoundedBox>

        {/* Window */}
        <mesh position={[0, -0.2, -2.01]}>
          <planeGeometry args={[3, 1.2]} />
          <meshStandardMaterial color="#0a0a1a" roughness={0.1} metalness={0.5} transparent opacity={0.7} />
        </mesh>

        {/* Projector lens */}
        <group position={[0, -0.5, -2.1]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.2, 0.3, 12]} />
            <meshStandardMaterial color="#2a2a48" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
            <meshStandardMaterial color="#4466aa" roughness={0.1} metalness={0.3} transparent opacity={0.6} />
          </mesh>
        </group>

        {/* Projector beam */}
        <spotLight
          position={[0, -0.5, -2.2]}
          angle={0.15}
          penumbra={0.6}
          intensity={2}
          distance={42}
          color="#c8d4ff"
          target-position={[0, SCREEN_Y, SCREEN_Z]}
        />
      </group>

      {/* === SPEAKERS === */}
      {[-1, 1].map(side => (
        <group key={side}>
          {[SCREEN_Y - 2, SCREEN_Y + 2].map((y, yi) => (
            <group key={yi} position={[side * 18, y, SCREEN_Z + 2]}>
              <RoundedBox args={[0.7, 2, 0.9]} radius={0.08} smoothness={2}>
                <meshStandardMaterial color="#151525" roughness={0.75} metalness={0.3} />
              </RoundedBox>
              {/* Speaker cone */}
              <mesh position={[side * -0.35, 0, 0]}>
                <circleGeometry args={[0.3, 16]} />
                <meshStandardMaterial color="#1a1a30" roughness={0.6} metalness={0.4} />
              </mesh>
              <mesh position={[side * -0.355, 0, 0]}>
                <circleGeometry args={[0.12, 12]} />
                <meshStandardMaterial color="#252540" roughness={0.5} metalness={0.5} />
              </mesh>
              {/* Tweeter */}
              <mesh position={[side * -0.35, 0.55, 0]}>
                <circleGeometry args={[0.1, 10]} />
                <meshStandardMaterial color="#1a1a30" roughness={0.5} metalness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* === CEILING STARS === */}
      {useMemo(() => Array.from({ length: 40 }, (_, i) => ({
        x: (Math.random() - 0.5) * 34,
        z: (Math.random() - 0.5) * 40 + 5,
        s: 0.015 + Math.random() * 0.02,
      })), []).map((s, i) => (
        <mesh key={i} position={[s.x, 15.1, s.z]}>
          <sphereGeometry args={[s.s, 4, 4]} />
          <meshBasicMaterial color={lightsOn ? '#3a4055' : '#556688'} toneMapped={false} />
        </mesh>
      ))}

      {/* === FLOOR AISLE LIGHTS === */}
      {steps.map((step, i) => (
        <group key={`floor-light-${i}`}>
          {[-14, 14].map((x, j) => (
            <mesh key={j} position={[x, step.y + 0.27, step.z - 0.6]}>
              <sphereGeometry args={[0.025, 6, 4]} />
              <meshBasicMaterial color="#3355aa" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
});

// --- ROW LABELS ---
function RowLabels({ rows }: { rows: string[] }) {
  return (
    <group>
      {rows.map((row, i) => {
        const z = i * 2 + 1.5;
        const y = i * 0.45 + 0.6;
        return (
          <group key={row}>
            {[-15.5, 15.5].map((x, j) => (
              <group key={j} position={[x, y, z]}>
                <RoundedBox args={[0.6, 0.35, 0.06]} radius={0.04} smoothness={2}>
                  <meshStandardMaterial color="#1a1a35" roughness={0.5} metalness={0.4} />
                </RoundedBox>
                <Text position={[0, 0, 0.04]} fontSize={0.2} color="#6b8bcf"
                  anchorX="center" anchorY="middle" fontWeight="bold">
                  {row}
                </Text>
              </group>
            ))}
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
    if (selectedIds.includes(s.id)) return 'bg-emerald-400 ring-1 ring-emerald-300 shadow-sm shadow-emerald-400/50';
    if (s.type === 'vip') return 'bg-purple-400';
    if (s.type === 'premium') return 'bg-blue-400';
    if (s.type === 'accessible') return 'bg-teal-400';
    return 'bg-slate-400';
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-xl p-3.5 rounded-xl border border-white/10 shadow-2xl">
      <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full mb-2.5" />
      <p className="text-[8px] text-center text-slate-400 mb-2 tracking-[0.2em] uppercase font-semibold">Screen</p>
      <div className="space-y-1">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-1">
            <span className="text-[7px] text-slate-500 w-3 text-right font-mono">{row}</span>
            <div className="flex gap-[3px]">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={!!(seat.status === 'booked' || seat.isBooked)}
                  className={`w-[7px] h-[7px] rounded-sm transition-all duration-150 hover:scale-[2.5] hover:z-10 ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-400" /> Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4 flex gap-4">
            <img src={movie.image} alt="" className="w-14 h-20 object-cover rounded-lg shadow-lg"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="text-white font-bold">{movie.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{movie.genre}</p>
              <div className="flex gap-2 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{movie.duration}</span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">{movie.rating}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium">{showtime.time}</span>
            <span className="text-gray-500 text-xs">· {showtime.label}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Selected Seats</p>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border
                  ${s.type === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                    s.type === 'premium' ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                    'bg-white/5 text-gray-300 border-white/10'}`}>
                  {s.row}{s.number} · ${s.price}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{selectedSeats.length}× Ticket{selectedSeats.length > 1 ? 's' : ''}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Service fee</span><span>$2.50</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
              <span>Total</span>
              <span className="text-emerald-400">${(total + 2.5).toFixed(2)}</span>
            </div>
          </div>

          
