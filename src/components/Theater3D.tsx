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
const SCREEN_Y = 6.5;
const SCREEN_WIDTH = 22;
const SCREEN_HEIGHT = 10;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 24);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 4, 0);

const SEAT_COLORS: Record<string, { base: string; hover: string; selected: string; booked: string }> = {
  standard: { base: '#3b4a5c', hover: '#4a5d73', selected: '#10b981', booked: '#1a1a2e' },
  premium: { base: '#2563eb', hover: '#3b82f6', selected: '#10b981', booked: '#1a1a2e' },
  vip: { base: '#7c3aed', hover: '#8b5cf6', selected: '#10b981', booked: '#1a1a2e' },
  accessible: { base: '#0d9488', hover: '#14b8a6', selected: '#10b981', booked: '#1a1a2e' },
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

// --- PREMIUM SEAT 3D ---
const PremiumSeat3D = React.memo(function PremiumSeat3D({ seat, position, onClick, onHover, isHighlighted, soundEnabled, playSound }: {
  seat: Seat; position: [number, number, number]; onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean; soundEnabled: boolean;
  playSound: (t: 'click' | 'select' | 'hover' | 'success' | 'error') => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const cushionRef = useRef<THREE.Group>(null);
  const foldRef = useRef(0);
  const scaleRef = useRef(1);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;
  const colors = SEAT_COLORS[seat.type];

  useFrame((_, delta) => {
    const targetFold = isSelected ? 1 : 0;
    foldRef.current += (targetFold - foldRef.current) * delta * 8;

    const targetScale = hovered && !isBooked ? 1.15 : 1;
    scaleRef.current += (targetScale - scaleRef.current) * delta * 12;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }

    if (cushionRef.current) {
      cushionRef.current.position.y = -foldRef.current * 0.08;
      cushionRef.current.position.z = -foldRef.current * 0.05;
      cushionRef.current.rotation.x = foldRef.current * 0.35;
    }
  });

  const color = isBooked ? colors.booked : isSelected ? colors.selected :
    isHighlighted ? '#fbbf24' : hovered ? colors.hover : colors.base;

  const emissiveIntensity = isSelected ? 0.8 : isHighlighted ? 0.6 : hovered && !isBooked ? 0.4 : 0.15;

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
      {(isSelected || isHighlighted) && (
        <pointLight position={[0, 0.5, 0]} intensity={1.5} distance={2.5} color={isSelected ? '#10b981' : '#fbbf24'} />
      )}
      <mesh position={[0, -0.05, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.1, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.8} />
      </mesh>
      <group ref={cushionRef}>
        <RoundedBox args={[0.95, 0.25, 0.8]} radius={0.08} smoothness={4} position={[0, 0.1, 0]} castShadow receiveShadow onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} emissive={color} emissiveIntensity={emissiveIntensity} />
        </RoundedBox>
        <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.35, 16]} />
          <meshStandardMaterial color="#000" roughness={0.9} transparent opacity={0.3} />
        </mesh>
      </group>
      <RoundedBox args={[0.95, 0.85, 0.15]} radius={0.08} smoothness={4} position={[0, 0.55, 0.38]} castShadow receiveShadow onClick={handleClick} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} emissive={color} emissiveIntensity={emissiveIntensity * 0.8} />
      </RoundedBox>
      {seat.type === 'vip' && (
        <RoundedBox args={[0.7, 0.2, 0.12]} radius={0.06} smoothness={3} position={[0, 1.05, 0.35]} castShadow>
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} emissive={color} emissiveIntensity={emissiveIntensity * 0.5} />
        </RoundedBox>
      )}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.55, 0.3, 0.05]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.18, 0.65]} />
            <meshStandardMaterial color="#2a2a3e" roughness={0.2} metalness={0.9} />
          </mesh>
          <RoundedBox args={[0.1, 0.06, 0.5]} radius={0.02} smoothness={2} position={[0, 0.07, 0]}>
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
          </RoundedBox>
        </group>
      ))}
      {(seat.type === 'premium' || seat.type === 'vip') && (
        <group position={[0.65, 0.15, -0.3]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.06, 0.12, 12]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      )}
      <Text position={[0, 0.24, -0.05]} fontSize={0.16} color={isBooked ? '#555' : '#fff'} anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
        {seat.number}
      </Text>
      {seat.type === 'vip' && (
        <group position={[0, 1.15, 0.35]}>
          <mesh>
            <octahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.5} metalness={1} roughness={0.1} />
          </mesh>
        </group>
      )}
      {seat.type === 'premium' && (
        <group position={[0, 1.0, 0.35]}>
          <mesh>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.2} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}
      {seat.type === 'accessible' && (
        <group position={[0, 1.0, 0.35]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.02, 8, 12]} />
            <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
});

// --- PREMIUM THEATER SCREEN ---
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);

  useFrame((state) => {
    glowRef.current = Math.sin(state.clock.elapsedTime * 0.5) * 0.15 + 0.85;
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = glowRef.current * 0.3;
      }
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      <mesh position={[0, 0, -1.2]} receiveShadow>
        <boxGeometry args={[42, 20, 0.5]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 2), 0, -0.8]}>
          <mesh castShadow>
            <boxGeometry args={[3, SCREEN_HEIGHT + 4, 0.3]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <boxGeometry args={[0.1, SCREEN_HEIGHT + 4, 0.05]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 2, SCREEN_HEIGHT + 1.5, 0.2]} />
        <meshStandardMaterial color="#0f0f1e" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[SCREEN_WIDTH + 1.2, SCREEN_HEIGHT + 0.8, 0.15]} />
        <meshStandardMaterial color="#1a1a35" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.2} metalness={0.3} emissive="#1a1a3e" emissiveIntensity={0.2} />
      </mesh>
      <pointLight position={[0, 0, 5]} intensity={4} distance={40} color="#5577dd" castShadow />
      <pointLight position={[-8, 2, 3]} intensity={2} distance={20} color="#5577dd" />
      <pointLight position={[8, 2, 3]} intensity={2} distance={20} color="#5577dd" />
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 3), 0, 0.5]}>
          {[...Array(6)].map((_, i) => {
            const xOffset = side * (i * 0.5);
            const zWave = Math.sin(i * 0.7) * 0.2;
            return (
              <mesh key={i} position={[xOffset, 0, zWave]} castShadow receiveShadow>
                <boxGeometry args={[0.4, SCREEN_HEIGHT + 4, 0.15]} />
                <meshStandardMaterial color={i % 2 === 0 ? '#8b1a1a' : '#a52828'} roughness={0.95} />
              </mesh>
            );
          })}
        </group>
      ))}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.5, 0.8]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, SCREEN_WIDTH + 12, 12]} />
        <meshStandardMaterial color="#8b7355" roughness={0.2} metalness={0.9} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (SCREEN_WIDTH / 2 + 6.5), SCREEN_HEIGHT / 2 + 2.5, 0.8]} castShadow>
          <sphereGeometry args={[0.25, 12, 12]} />
          <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.9} emissive="#d4af37" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2, 0.5]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 10, 2.2, 0.8]} />
        <meshStandardMaterial color="#7a1a1a" roughness={0.9} />
      </mesh>
      <group position={[0, -SCREEN_HEIGHT / 2 - 1.5, 0.3]}>
        <Text fontSize={0.6} color="#6b8cce" anchorX="center" letterSpacing={0.15}>NOW SHOWING</Text>
        <Text position={[0, -0.8, 0]} fontSize={0.45} color="#9ab0d9" anchorX="center" letterSpacing={0.08} maxWidth={SCREEN_WIDTH - 2}>
          {movieTitle.toUpperCase()}
        </Text>
      </group>
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 3, 2]} angle={0.8} penumbra={0.5} intensity={2} distance={25} color="#8899cc" castShadow />
    </group>
  );
}

// --- WALL SCONCES ---
function WallSconces() {
  const positions = useMemo(() => {
    const p: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 4; i++) {
      p.push({ pos: [-17, 6, -4 + i * 8], rot: [0, Math.PI / 2, 0] });
      p.push({ pos: [17, 6, -4 + i * 8], rot: [0, -Math.PI / 2, 0] });
    }
    return p;
  }, []);

  return (
    <group>
      {positions.map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.25, 0.08, 6]} />
            <meshStandardMaterial color="#c4982a" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#fff5e0" transparent opacity={0.6} emissive="#ffe8b0" emissiveIntensity={0.5} />
          </mesh>
          <pointLight position={[0, 0, 0.2]} intensity={0.8} distance={6} color="#ffddaa" />
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
    scene.fog = new THREE.FogExp2('#05050a', 0.008);
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    if (ceilingLightsRef.current) {
      ceilingLightsRef.current.children.forEach(child => {
        child.traverse(obj => {
          if (obj instanceof THREE.PointLight) {
            const t = lightsOn ? 2.5 : 0.15;
            obj.intensity += (t - obj.intensity) * delta * 4;
          }
        });
      });
    }
  });

  const steps = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    z: i * 1.9 + 1, y: i * 0.42, index: i,
  })), []);

  return (
    <group>
      <mesh position={[0, -0.01, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 60]} />
        <meshStandardMaterial color="#14142a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.008, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.4, 24]} />
        <meshStandardMaterial color="#2a0e0e" roughness={0.98} />
      </mesh>
      <mesh position={[-19, 7, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[52, 16]} />
        <meshStandardMaterial color="#0f0f22" roughness={0.9} />
      </mesh>
      <mesh position={[19, 7, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[52, 16]} />
        <meshStandardMaterial color="#0f0f22" roughness={0.9} />
      </mesh>
      <mesh position={[0, 7, 25]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 14, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 44]} />
        <meshStandardMaterial color="#08081a" roughness={0.95} />
      </mesh>
      <WallSconces />
      {steps.map(step => (
        <group key={step.index}>
          <mesh position={[0, step.y, step.z]} receiveShadow castShadow>
            <boxGeometry args={[34, 0.5, 1.9]} />
            <meshStandardMaterial color="#1a1a32" roughness={0.7} />
          </mesh>
          <mesh position={[0, step.y + 0.25, step.z + 0.94]}>
            <boxGeometry args={[34, 0.5, 0.04]} />
            <meshStandardMaterial color="#12122a" roughness={0.8} />
          </mesh>
          <mesh position={[0, step.y + 0.26, step.z + 0.93]}>
            <boxGeometry args={[30, 0.03, 0.03]} />
            <meshBasicMaterial color="#3a5a9a" />
          </mesh>
          <pointLight position={[0, step.y + 0.3, step.z + 0.95]} intensity={0.3} distance={4} color="#3a5a9a" />
        </group>
      ))}
      {[[-17, 6.5, 22], [17, 6.5, 22]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <RoundedBox args={[1.8, 0.55, 0.08]} radius={0.05} smoothness={3} castShadow>
            <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={1.5} />
          </RoundedBox>
          <Text position={[0, 0, 0.05]} fontSize={0.25} color="#fff" anchorX="center">EXIT</Text>
          <pointLight position={[0, 0, 0.3]} intensity={1} distance={5} color="#059669" />
        </group>
      ))}
      <group ref={ceilingLightsRef}>
        {[[-10, 13.7, 0], [10, 13.7, 0], [-10, 13.7, 8], [10, 13.7, 8], [-10, 13.7, 16], [10, 13.7, 16]].map((pos, i) => (
          <group key={i} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.4, 0.5, 0.15, 12]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.38, 0.38, 0.05, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.3} emissive="#ffe8c8" emissiveIntensity={0.5} />
            </mesh>
            <pointLight intensity={2.5} distance={14} color="#ffe8c8" castShadow />
          </group>
        ))}
      </group>
      <group position={[0, 12, 23]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4.5, 3, 4]} />
          <meshStandardMaterial color="#0f0f22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.3, -2.05]}>
          <planeGeometry args={[3, 1.5]} />
          <meshStandardMaterial color="#1a1a3e" transparent opacity={0.6} />
        </mesh>
        <group position={[0, -0.2, -1.5]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.8, 12]} />
            <meshStandardMaterial color="#2a2a3e" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.15, 0.1, 12]} />
            <meshStandardMaterial color="#88aacc" transparent opacity={0.8} emissive="#88aacc" emissiveIntensity={0.5} />
          </mesh>
          <spotLight position={[0, 0, -0.5]} angle={0.25} penumbra={0.4} intensity={3} distance={45} color="#d4ddff" castShadow />
        </group>
      </group>
      {[[-18, SCREEN_Y - 2, SCREEN_Z + 2], [18, SCREEN_Y - 2, SCREEN_Z + 2], [-18, SCREEN_Y + 2, SCREEN_Z + 2], [18, SCREEN_Y + 2, SCREEN_Z + 2]].map((pos, i) => (
        <RoundedBox key={i} args={[0.6, 2, 0.8]} radius={0.08} smoothness={3} position={pos as [number, number, number]} castShadow>
          <meshStandardMaterial color="#0a0a1a" roughness={0.7} />
        </RoundedBox>
      ))}
      {[...Array(40)].map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 32, 13.5, (Math.random() - 0.5) * 35 + 5]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshBasicMaterial color="#ffffff" />
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
        const z = i * 1.9 + 1;
        const y = i * 0.42 + 0.6;
        return (
          <React.Fragment key={row}>
            <group position={[-16, y, z]}>
              <RoundedBox args={[0.6, 0.6, 0.1]} radius={0.05} smoothness={2}>
                <meshStandardMaterial color="#1a1a3e" roughness={0.5} emissive="#3a5a9a" emissiveIntensity={0.2} />
              </RoundedBox>
              <Text position={[0, 0, 0.06]} fontSize={0.4} color="#60a5fa" anchorX="center" anchorY="middle">{row}</Text>
            </group>
            <group position={[16, y, z]}>
              <RoundedBox args={[0.6, 0.6, 0.1]} radius={0.05} smoothness={2}>
                <meshStandardMaterial color="#1a1a3e" roughness={0.5} emissive="#3a5a9a" emissiveIntensity={0.2} />
              </RoundedBox>
              <Text position={[0, 0, 0.06]} fontSize={0.4} color="#60a5fa" anchorX="center" anchorY="middle">{row}</Text>
            </group>
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
  const typeBadge: Record<string, string> = { standard: 'bg-gray-500', premium: 'bg-blue-500', vip: 'bg-purple-500', accessible: 'bg-teal-500' };

  return (
    <Html position={[position[0], position[1] + 1.8, position[2]]} center distanceFactor={14}>
      <div className="bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-xl shadow-2xl border border-white/20 min-w-[200px] pointer-events-none select-none">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base">Row {seat.row} · Seat {seat.number}</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${typeBadge[seat.type]} text-white shadow-lg`}>
            {typeLabel[seat.type]}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-emerald-400 text-base">₹{seat.price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isBooked ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isBooked ? '✕ Booked' : isSelected ? '✓ Selected' : '● Available'}
          </span>
        </div>
        {!isBooked && <p className="mt-2 pt-2 border-t border-white/10 text-center text-xs text-gray-400">Click to {isSelected ? 'deselect' : 'select'}</p>}
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
      zIndex: 5, pointerEvents: 'auto', overflow: 'hidden', borderRadius: 4, backgroundColor: '#000',
      boxShadow: '0 0 50px rgba(59, 130, 246, 0.5)',
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
    <div className="bg-slate-900/95 backdrop-blur-xl p-4 rounded-xl border border-white/20 shadow-2xl">
      <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full mb-3 shadow-lg shadow-blue-500/50" />
      <p className="text-[9px] text-center text-slate-400 mb-2 tracking-widest uppercase font-semibold">Screen</p>
      <div className="space-y-1.5">
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-1">
            <span className="text-[8px] text-slate-500 w-3 text-right font-bold">{row}</span>
            <div className="flex gap-1">
              {rowSeats.sort((a, b) => a.number - b.number).map(seat => (
                <button key={seat.id}
                  onClick={() => !(seat.status === 'booked' || seat.isBooked) && onSeatClick(seat)}
                  disabled={!!(seat.status === 'booked' || seat.isBooked)}
                  className={`w-2 h-2 rounded-sm transition-all hover:scale-[3] ${dotColor(seat)} ${(seat.status === 'booked' || seat.isBooked) ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:z-10'}`}
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-400" /> Confirm Booking
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4 flex gap-3 border border-white/10">
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
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3 text-sm border border-white/10">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold">{showtime.time}</span>
            <span className="text-gray-400 text-xs">· {showtime.label}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Selected Seats</p>
            <div className="flex flex-wrap gap-2">
              {selectedSeats.map(s => (
                <span key={s.id} className={`px-3 py-1.5 rounded-lg text-xs font-bold border
                  ${s.type === 'vip' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    s.type === 'premium' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    'bg-white/5 text-gray-300 border-white/10'}`}>
                  {s.row}{s.number} <span className="text-gray-400 ml-1">₹{s.price}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-400"><span>{selectedSeats.length}× Tickets</span><span>₹{total.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Service fee</span><span>₹2.50</span></div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10"><span>Total</span><span className="text-emerald-400 text-lg">₹{(total + 2.5).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-semibold transition-all">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all">
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
  // ✅ NEW: track if we're in "seat view" mode (looking at screen from seat)
  const [isSeatViewMode, setIsSeatViewMode] = useState(false);

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
        const curvePush = normalizedX * normalizedX * 0.4;
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

  // ✅ FIXED handleSeatClick — places camera just behind/above the seat,
  //    looking toward the screen center. No more jarring zoom-in/out.
  const handleSeatClick = useCallback((seat: Seat) => {
    if (soundEnabled) playSound('click');
    onSeatClick(seat);

    const sd = seatPositions.find(s => s.seat.id === seat.id);
    if (sd) {
      const [x, y, z] = sd.position;

      // Camera sits just behind and slightly above eye-level of the seat
      const camX = x * 0.4;          // slight horizontal offset toward center
      const camY = y + 1.4;          // eye-level height above seat
      const camZ = z + 1.2;          // just behind the seat position

      // Look at the center of the screen
      const lookAtX = x * 0.1;       // barely offset so gaze is mostly centered
      const lookAtY = SCREEN_Y;
      const lookAtZ = SCREEN_Z;

      setCameraTarget({
        position: new THREE.Vector3(camX, camY, camZ),
        lookAt: new THREE.Vector3(lookAtX, lookAtY, lookAtZ),
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
      setIsSeatViewMode(true);
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
    setIsSeatViewMode(false);
  }, [soundEnabled, playSound]);

  const changeView = useCallback((mode: ViewMode) => {
    if (soundEnabled) playSound('click');
    setViewMode(mode);
    setIsSeatViewMode(false);
    const views: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 28, 10), lookAt: new THREE.Vector3(0, 0, 8) },
      front: { position: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z + 8), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side: { position: new THREE.Vector3(28, 10, 8), lookAt: new THREE.Vector3(0, 4, 6) },
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
          const camX = x * 0.4;
          const camY = y + 1.4;
          const camZ = z + 1.2;
          setCameraTarget({
            position: new THREE.Vector3(camX, camY, camZ),
            lookAt: new THREE.Vector3(x * 0.1, SCREEN_Y, SCREEN_Z),
          });
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
    <div className="relative w-full h-[900px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80">
      {youtubeId && <YouTubeOverlay videoId={youtubeId} rect={screenRect} />}

      {/* TOP CONTROLS */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-12 px-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex-1 max-w-[560px]">
              <button onClick={() => setShowMoviePanel(!showMoviePanel)} className="flex items-center gap-2.5 mb-3 group">
                <Film className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors">Movie & Showtime</span>
                {showMoviePanel ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
              </button>
              {showMoviePanel && (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {movies.map(movie => (
                      <button key={movie.id} onClick={() => { if (soundEnabled) playSound('click'); setSelectedMovie(movie); }}
                        className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border shadow-lg
                          ${selectedMovie.id === movie.id ? 'bg-blue-600/40 border-blue-400/60 text-white shadow-blue-500/30' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                        <img src={movie.image} alt="" className="w-6 h-9 object-cover rounded shadow-md" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="whitespace-nowrap">{movie.title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {showtimes.map(st => (
                      <button key={st.id} onClick={() => { if (soundEnabled) playSound('click'); setSelectedShowtime(st); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-md
                          ${selectedShowtime.id === st.id ? 'bg-emerald-600/40 border-emerald-400/60 text-emerald-300 shadow-emerald-500/30' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/8'}`}>
                        {st.time}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10 shadow-lg">
                    <img src={selectedMovie.image} alt="" className="w-8 h-12 object-cover rounded shadow-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
                  { icon: Camera, fn: () => { if (soundEnabled) playSound('success'); const c = document.querySelector('canvas'); if (c) { const l = document.createElement('a'); l.download = `theater-view-${Date.now()}.png`; l.href = c.toDataURL('image/png'); l.click(); } } },
                  { icon: Grid3X3, fn: () => setShowMiniMap(!showMiniMap), on: showMiniMap },
                  { icon: lightsOn ? Sun : SunDim, fn: () => setLightsOn(!lightsOn), on: lightsOn },
                ].map(({ icon: Icon, fn, on }, i) => (
                  <button key={i} onClick={fn} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border shadow-lg
                    ${on ? 'bg-blue-500/30 border-blue-400/50 text-blue-300 shadow-blue-500/30' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>
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
                      ${viewMode === m && !isSeatViewMode ? 'bg-white/15 border-white/25 text-white shadow-white/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}>
                    <I className="w-3 h-3" />{l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { if (soundEnabled) playSound('success'); setHighlightedSeats(findBestSeats(4)); setTimeout(() => setHighlightedSeats([]), 6000); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/25 border border-amber-500/30 text-amber-400 hover:bg-amber-500/35 flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                  <Sparkles className="w-3 h-3" /> Best Seats
                </button>
                <button 
