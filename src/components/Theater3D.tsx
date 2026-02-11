import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================
interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium' | 'vip' | 'accessible';
  price: number;
}

interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

type ViewMode = 'default' | 'topdown' | 'front' | 'side';

// ============================================
// CONSTANTS
// ============================================
const SCREEN_WIDTH = 30;
const SCREEN_HEIGHT = 16.875; // 16:9
const SCREEN_Z = -20;
const SCREEN_Y = 10;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 12, 26);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 3, 0);

// ============================================
// DATA
// ============================================
const movies = [
  {
    id: '1',
    title: 'The Dark Knight',
    image: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
    description: 'Batman faces the Joker in Gotham.',
    duration: '2h 32m',
    rating: 'PG-13',
    genre: 'Action, Crime',
  },
  {
    id: '2',
    title: 'Inception',
    image: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
    description: 'A thief steals secrets through dreams.',
    duration: '2h 28m',
    rating: 'PG-13',
    genre: 'Sci-Fi, Action',
  },
  {
    id: '3',
    title: 'Interstellar',
    image: 'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    description: 'Explorers travel through a wormhole.',
    duration: '2h 49m',
    rating: 'PG-13',
    genre: 'Sci-Fi, Adventure',
  },
  {
    id: '4',
    title: 'Oppenheimer',
    image: 'https://m.media-amazon.com/images/M/MV5BMDBmYTZjNjUtN2M1MS00MTQ2LTk2ODgtNzc2M2QyZGE5NTVjXkEyXkFqcGdeQXVyNzAwMjU2MTY@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    description: 'The story of the atomic bomb.',
    duration: '3h 0m',
    rating: 'R',
    genre: 'Drama, History',
  },
];

const showtimes = [
  { id: '1', time: '10:00 AM' },
  { id: '2', time: '1:30 PM' },
  { id: '3', time: '4:00 PM' },
  { id: '4', time: '7:00 PM' },
  { id: '5', time: '9:30 PM' },
];

// ============================================
// HELPERS
// ============================================
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([^#&?]{11})/);
  return match ? match[1] : null;
}

function generateSeats(): Seat[] {
  const rows = 'ABCDEFGH'.split('');
  const seatsPerRow = 12;
  const seatList: Seat[] = [];

  rows.forEach((row, ri) => {
    for (let i = 1; i <= seatsPerRow; i++) {
      let type: Seat['type'] = 'standard';
      let price = 12;
      if (ri >= 6) { type = 'vip'; price = 25; }
      else if (ri >= 4) { type = 'premium'; price = 18; }
      if (i === 1 && ri === 0) { type = 'accessible'; price = 10; }

      const isBooked = Math.random() < 0.15;

      seatList.push({
        id: `${row}${i}`,
        row,
        number: i,
        status: isBooked ? 'booked' : 'available',
        type,
        price,
      });
    }
  });
  return seatList;
}

// ============================================
// 3D: CAMERA CONTROLLER
// ============================================
function CameraController({
  target,
  isAnimating,
  onDone,
  controlsRef,
}: {
  target: CameraTarget;
  isAnimating: boolean;
  onDone: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progress = useRef(0);

  useEffect(() => {
    progress.current = 0;
  }, [target]);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    progress.current = Math.min(progress.current + delta * 1.8, 1);
    const t = progress.current;
    camera.position.lerp(target.position, t * 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target.lookAt, t * 0.08);
      controlsRef.current.update();
    }
    if (progress.current >= 1) {
      progress.current = 0;
      onDone();
    }
  });
  return null;
}

// ============================================
// 3D: SCREEN POSITION TRACKER
// ============================================
function ScreenTracker({
  onUpdate,
}: {
  onUpdate: (r: { left: number; top: number; width: number; height: number; visible: boolean }) => void;
}) {
  const { camera, gl } = useThree();

  useFrame(() => {
    const corners = [
      new THREE.Vector3(-SCREEN_WIDTH / 2, SCREEN_Y + SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(SCREEN_WIDTH / 2, SCREEN_Y + SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(-SCREEN_WIDTH / 2, SCREEN_Y - SCREEN_HEIGHT / 2, SCREEN_Z),
      new THREE.Vector3(SCREEN_WIDTH / 2, SCREEN_Y - SCREEN_HEIGHT / 2, SCREEN_Z),
    ];
    corners.forEach((c) => c.project(camera));

    const center3D = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const toScreen = center3D.clone().sub(camera.position).normalize();
    const visible = dir.dot(toScreen) > 0.1;

    const rect = gl.domElement.getBoundingClientRect();
    const toPixel = (ndc: THREE.Vector3) => ({
      x: ((ndc.x + 1) / 2) * rect.width + rect.left,
      y: ((-ndc.y + 1) / 2) * rect.height + rect.top,
    });

    const px = corners.map(toPixel);
    const left = Math.min(px[0].x, px[2].x);
    const top = Math.min(px[0].y, px[1].y);
    const right = Math.max(px[1].x, px[3].x);
    const bottom = Math.max(px[2].y, px[3].y);

    onUpdate({
      left,
      top,
      width: right - left,
      height: bottom - top,
      visible: visible && right - left > 40 && bottom - top > 25,
    });
  });
  return null;
}

// ============================================
// 3D: CINEMA SCREEN
// ============================================
function CinemaScreen({ title }: { title: string }) {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Back wall */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color="#020206" roughness={0.98} />
      </mesh>

      {/* Screen frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[SCREEN_WIDTH + 1.2, SCREEN_HEIGHT + 0.8]} />
        <meshStandardMaterial color="#111122" roughness={0.7} metalness={0.4} />
      </mesh>

      {/* Silver trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.25, -0.05]}>
        <boxGeometry args={[SCREEN_WIDTH + 1, 0.06, 0.04]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -SCREEN_HEIGHT / 2 - 0.25, -0.05]}>
        <boxGeometry args={[SCREEN_WIDTH + 1, 0.06, 0.04]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-SCREEN_WIDTH / 2 - 0.25, 0, -0.05]}>
        <boxGeometry args={[0.06, SCREEN_HEIGHT + 0.6, 0.04]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[SCREEN_WIDTH / 2 + 0.25, 0, -0.05]}>
        <boxGeometry args={[0.06, SCREEN_HEIGHT + 0.6, 0.04]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Screen surface (dark - video overlaid via HTML) */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#0a0a12" />
      </mesh>

      {/* Glow lights */}
      <pointLight position={[0, 0, 6]} intensity={2} distance={35} color="#4466dd" />
      <pointLight position={[-10, 0, 4]} intensity={1} distance={18} color="#5577ee" />
      <pointLight position={[10, 0, 4]} intensity={1} distance={18} color="#5577ee" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2, 3]} intensity={1.2} distance={20} color="#3355cc" />

      {/* Left curtain */}
      <mesh position={[-SCREEN_WIDTH / 2 - 3, 0, -0.3]} castShadow>
        <boxGeometry args={[4, SCREEN_HEIGHT + 4, 0.6]} />
        <meshStandardMaterial color="#5a1010" roughness={0.9} />
      </mesh>
      {/* Right curtain */}
      <mesh position={[SCREEN_WIDTH / 2 + 3, 0, -0.3]} castShadow>
        <boxGeometry args={[4, SCREEN_HEIGHT + 4, 0.6]} />
        <meshStandardMaterial color="#5a1010" roughness={0.9} />
      </mesh>
      {/* Top valance */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.5, -0.3]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 10, 3, 0.6]} />
        <meshStandardMaterial color="#5a1010" roughness={0.9} />
      </mesh>

      {/* Title */}
      <Text position={[0, -SCREEN_HEIGHT / 2 - 2, 0.1]} fontSize={1} color="#8899bb" anchorX="center">
        NOW SHOWING: {title.toUpperCase()}
      </Text>
    </group>
  );
}

// ============================================
// 3D: SINGLE SEAT
// ============================================
function Seat3D({
  seat,
  position,
  onClick,
  onHover,
  isHighlighted,
}: {
  seat: Seat;
  position: [number, number, number];
  onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isBooked = seat.status === 'booked';
  const isSelected = seat.status === 'selected';

  const color = useMemo(() => {
    if (isBooked) return '#475569';
    if (isSelected) return '#10b981';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#fbbf24';
    if (seat.type === 'vip') return '#a855f7';
    if (seat.type === 'premium') return '#3b82f6';
    if (seat.type === 'accessible') return '#14b8a6';
    return '#94a3b8';
  }, [isBooked, isSelected, isHighlighted, hovered, seat.type]);

  const emissive = isSelected ? 0.4 : isHighlighted ? 0.25 : hovered ? 0.2 : 0.06;

  return (
    <group position={position}>
      {/* Seat base */}
      <RoundedBox
        args={[0.85, 0.18, 0.75]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.09, 0]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); if (!isBooked) onClick(seat); }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = isBooked ? 'not-allowed' : 'pointer';
          onHover(seat, position);
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
          onHover(null);
        }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.15}
          emissive={color}
          emissiveIntensity={emissive}
        />
      </RoundedBox>

      {/* Seat back */}
      <RoundedBox
        args={[0.85, 0.65, 0.12]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.42, 0.35]}
        castShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.15}
          emissive={color}
          emissiveIntensity={emissive}
        />
      </RoundedBox>

      {/* Armrests */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={3} position={[-0.42, 0.18, 0.08]} castShadow>
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={3} position={[0.42, 0.18, 0.08]} castShadow>
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.4} />
      </RoundedBox>

      {/* Seat number */}
      <Text
        position={[0, 0.22, 0]}
        fontSize={0.13}
        color={isBooked ? '#555' : '#111'}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {seat.number}
      </Text>

      {/* VIP crown */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.85, 0.35]}>
          <coneGeometry args={[0.08, 0.15, 5]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
        </mesh>
      )}

      {/* Glow for selected */}
      {isSelected && <pointLight position={[0, 0.5, 0]} intensity={0.7} distance={2} color="#10b981" />}
      {isHighlighted && !isSelected && <pointLight position={[0, 0.5, 0]} intensity={0.4} distance={1.5} color="#f59e0b" />}
    </group>
  );
}

// ============================================
// 3D: TOOLTIP
// ============================================
function SeatTooltip({ seat, position }: { seat: Seat; position: [number, number, number] }) {
  const typeColors: Record<string, string> = {
    standard: '#6b7280', premium: '#3b82f6', vip: '#a855f7', accessible: '#14b8a6',
  };

  return (
    <Html position={[position[0], position[1] + 1.4, position[2]]} center>
      <div style={{
        background: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        minWidth: '160px',
        pointerEvents: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <strong style={{ fontSize: '15px' }}>Row {seat.row} - Seat {seat.number}</strong>
          <span style={{
            background: typeColors[seat.type],
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 600,
          }}>
            {seat.type.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#9ca3af' }}>Price:</span>
          <span style={{ color: '#34d399', fontWeight: 600 }}>${seat.price.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af' }}>Status:</span>
          <span style={{
            color: seat.status === 'booked' ? '#f87171' : seat.status === 'selected' ? '#34d399' : '#60a5fa',
            fontWeight: 500,
          }}>
            {seat.status === 'booked' ? 'Booked' : seat.status === 'selected' ? 'Selected' : 'Available'}
          </span>
        </div>
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
          fontSize: '11px',
          color: seat.status === 'booked' ? '#f87171' : '#9ca3af',
        }}>
          {seat.status === 'booked' ? '🚫 Unavailable' : `Click to ${seat.status === 'selected' ? 'deselect' : 'select'}`}
        </div>
      </div>
    </Html>
  );
}

// ============================================
// 3D: THEATER ENVIRONMENT
// ============================================
function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog('#050510', 28, 75);
    return () => { scene.fog = null; };
  }, [scene]);

  // Stadium steps
  const steps = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      z: i * 1.8 + 3.5,
      y: i * 0.45,
    })), []);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#070710" roughness={0.97} />
      </mesh>

      {/* Walls */}
      <mesh position={[-20, 7, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[60, 18]} />
        <meshStandardMaterial color="#0a0a18" roughness={0.93} />
      </mesh>
      <mesh position={[20, 7, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[60, 18]} />
        <meshStandardMaterial color="#0a0a18" roughness={0.93} />
      </mesh>
      <mesh position={[0, 15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44, 60]} />
        <meshStandardMaterial color="#030308" roughness={0.97} />
      </mesh>
      <mesh position={[0, 7, 22]}>
        <planeGeometry args={[44, 18]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.93} />
      </mesh>

      {/* Steps */}
      {steps.map((s, i) => (
        <group key={i}>
          <mesh position={[0, s.y, s.z]} receiveShadow castShadow>
            <boxGeometry args={[32, 0.45, 1.8]} />
            <meshStandardMaterial color="#151528" roughness={0.92} />
          </mesh>
          {/* Step edge light strip */}
          <mesh position={[0, s.y + 0.23, s.z + 0.89]}>
            <boxGeometry args={[32, 0.015, 0.025]} />
            <meshBasicMaterial color="#1e3a8a" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Row labels */}
      {'ABCDEFGH'.split('').map((row, i) => {
        const z = i * 1.8 + 3.5;
        const y = i * 0.45 + 0.5;
        return (
          <group key={row}>
            <Text position={[-16, y, z]} fontSize={0.55} color="#3b82f6" anchorX="center">{row}</Text>
            <Text position={[16, y, z]} fontSize={0.55} color="#3b82f6" anchorX="center">{row}</Text>
          </group>
        );
      })}

      {/* Exit signs */}
      {[[-18, 5, 10], [18, 5, 10]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <boxGeometry args={[1.6, 0.5, 0.1]} />
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </mesh>
          <Text position={[0, 0, 0.06]} fontSize={0.25} color="#fff" anchorX="center">EXIT</Text>
          <pointLight intensity={0.5} distance={3} color="#22c55e" />
        </group>
      ))}

      {/* Ceiling lights */}
      {useMemo(() => {
        const positions: [number, number, number][] = [];
        for (let x = -12; x <= 12; x += 8)
          for (let z = -6; z <= 18; z += 8)
            positions.push([x, 14.5, z]);
        return positions;
      }, []).map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.35, 0.15, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.6} />
          </mesh>
          <pointLight intensity={lightsOn ? 0.6 : 0.05} distance={9} color="#fef3c7" />
        </group>
      ))}

      {/* Aisle floor lights */}
      {[-5.5, 5.5].map((x, xi) => (
        <group key={xi}>
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i}>
              <mesh position={[x, i * 0.45 + 0.3, i * 1.8 + 3.5]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color="#fbbf24" toneMapped={false} />
              </mesh>
              <pointLight position={[x, i * 0.45 + 0.3, i * 1.8 + 3.5]} intensity={0.15} distance={0.8} color="#fbbf24" />
            </group>
          ))}
        </group>
      ))}

      {/* Projector */}
      <group position={[0, 13, 24]}>
        <mesh castShadow>
          <boxGeometry args={[3, 2, 3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.4, -1.6]}>
          <cylinderGeometry args={[0.2, 0.25, 0.4, 12]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
        </mesh>
        <spotLight
          position={[0, -0.4, -1.8]}
          angle={0.2}
          penumbra={0.5}
          intensity={2}
          distance={55}
          color="#c8d8ff"
        />
      </group>
    </group>
  );
}

// ============================================
// YOUTUBE OVERLAY
// ============================================
function YouTubeOverlay({
  videoId,
  screenRect,
}: {
  videoId: string;
  screenRect: { left: number; top: number; width: number; height: number; visible: boolean };
}) {
  if (!screenRect.visible || screenRect.width < 60 || screenRect.height < 35) return null;

  // Fit 16:9 inside the projected rectangle
  const aspect = 16 / 9;
  let w = screenRect.width;
  let h = screenRect.height;
  let ox = 0;
  let oy = 0;

  if (w / h > aspect) {
    w = h * aspect;
    ox = (screenRect.width - w) / 2;
  } else {
    h = w / aspect;
    oy = (screenRect.height - h) / 2;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: screenRect.left + ox,
        top: screenRect.top + oy,
        width: w,
        height: h,
        zIndex: 10,
        pointerEvents: 'auto',
        overflow: 'hidden',
        borderRadius: 3,
        background: '#000',
        boxShadow: '0 0 80px 30px rgba(40,70,180,0.12)',
      }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0&showinfo=0`}
        title="Movie Trailer"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// ============================================
// BOOKING MODAL
// ============================================
function BookingModal({
  open,
  onClose,
  onConfirm,
  seats,
  movie,
  showtime,
  total,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  seats: Seat[];
  movie: typeof movies[0];
  showtime: typeof showtimes[0];
  total: number;
}) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
        padding: 24, maxWidth: 420, width: '95%', color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>🎟️ Confirm Booking</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>{movie.title}</strong>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>{movie.genre} • {movie.duration} • {movie.rating}</div>
          <div style={{ color: '#60a5fa', fontSize: 13, marginTop: 4 }}>🕐 {showtime.time}</div>
        </div>

        <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Selected Seats:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {seats.map((s) => (
              <span key={s.id} style={{
                background: s.type === 'vip' ? 'rgba(168,85,247,0.2)' : s.type === 'premium' ? 'rgba(59,130,246,0.2)' : 'rgba(107,114,128,0.2)',
                color: s.type === 'vip' ? '#c084fc' : s.type === 'premium' ? '#93c5fd' : '#d1d5db',
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              }}>
                {s.row}{s.number} (${s.price})
              </span>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>
            <span>{seats.length} ticket(s)</span><span>${total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>
            <span>Booking fee</span><span>$2.50</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span>Total</span><span style={{ color: '#34d399' }}>${(total + 2.5).toFixed(2)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
            background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>💳 Pay Now</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MINIMAP
// ============================================
function MiniMap({
  seats,
  selectedIds,
  onSeatClick,
}: {
  seats: Seat[];
  selectedIds: string[];
  onSeatClick: (s: Seat) => void;
}) {
  const rows = useMemo(() => {
    const map: Record<string, Seat[]> = {};
    seats.forEach((s) => {
      if (!map[s.row]) map[s.row] = [];
      map[s.row].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const getColor = (s: Seat) => {
    if (s.status === 'booked') return '#475569';
    if (selectedIds.includes(s.id)) return '#10b981';
    if (s.type === 'vip') return '#a855f7';
    if (s.type === 'premium') return '#3b82f6';
    if (s.type === 'accessible') return '#14b8a6';
    return '#6b7280';
  };

  return (
    <div style={{
      background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)',
      padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        🎭 Theater Overview
      </div>
      <div style={{
        width: '100%', height: 3, borderRadius: 3, marginBottom: 16,
        background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map(([letter, rowSeats]) => (
          <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 8, color: '#6b7280', width: 10 }}>{letter}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {rowSeats.sort((a, b) => a.number - b.number).map((s) => (
                <button
                  key={s.id}
                  onClick={() => { if (s.status !== 'booked') onSeatClick(s); }}
                  disabled={s.status === 'booked'}
                  title={`${s.row}${s.number} - $${s.price}`}
                  style={{
                    width: 7, height: 7, borderRadius: 2, border: 'none',
                    background: getColor(s), cursor: s.status === 'booked' ? 'not-allowed' : 'pointer',
                    opacity: s.status === 'booked' ? 0.4 : 1,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.8)'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN EXPORTED COMPONENT
// ============================================
export default function CinemaBookingApp() {
  const [seats, setSeats] = useState<Seat[]>(() => generateSeats());
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[3]);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<{ seat: Seat; position: [number, number, number] } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [lightsOn, setLightsOn] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [highlightedSeats, setHighlightedSeats] = useState<string[]>([]);
  const [screenRect, setScreenRect] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });

  const controlsRef = useRef<any>(null);

  const youtubeId = useMemo(() => getYouTubeId(selectedMovie.video), [selectedMovie.video]);

  const selectedSeats = useMemo(() => seats.filter((s) => s.status === 'selected'), [seats]);
  const totalPrice = useMemo(() => selectedSeats.reduce((sum, s) => sum + s.price, 0), [selectedSeats]);

  // Build seat positions
  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const rowMap: Record<string, Seat[]> = {};
    seats.forEach((s) => { if (!rowMap[s.row]) rowMap[s.row] = []; rowMap[s.row].push(s); });
    const sortedRows = Object.keys(rowMap).sort();

    sortedRows.forEach((row, ri) => {
      const rowSeats = rowMap[row].sort((a, b) => a.number - b.number);
      const z = ri * 1.8 + 3.5;
      const y = ri * 0.45 + 0.3;
      rowSeats.forEach((seat, si) => {
        const mid = Math.floor(rowSeats.length / 2);
        const aisleGap = si >= mid ? 1.2 : 0;
        const x = (si - (rowSeats.length - 1) / 2) * 1.12 + aisleGap * 0.5 - 0.3;
        positions.push({ seat, position: [x, y, z] });
      });
    });
    return positions;
  }, [seats]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (seat.status === 'booked') return;
    setSeats((prev) =>
      prev.map((s) =>
        s.id === seat.id
          ? { ...s, status: s.status === 'selected' ? 'available' : 'selected' }
          : s
      )
    );
    const pos = seatPositions.find((p) => p.seat.id === seat.id);
    if (pos) {
      const [x, y, z] = pos.position;
      setCameraTarget({
        position: new THREE.Vector3(x, y + 1.5, z + 3),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z),
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  }, [seatPositions]);

  const handleResetView = () => {
    setCameraTarget({ position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    const views: Record<ViewMode, CameraTarget> = {
      default: { position: DEFAULT_CAMERA_POS, lookAt: DEFAULT_LOOK_AT },
      topdown: { position: new THREE.Vector3(0, 32, 8), lookAt: new THREE.Vector3(0, 0, 5) },
      front: { position: new THREE.Vector3(0, SCREEN_Y, -14), lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) },
      side: { position: new THREE.Vector3(30, 10, 8), lookAt: new THREE.Vector3(0, 4, 5) },
    };
    setCameraTarget(views[mode]);
    setIsAnimating(true);
  };

  const handleRecommend = () => {
    const avail = seatPositions.filter(({ seat }) => seat.status === 'available');
    const scored = avail.map(({ seat, position }) => {
      const centerScore = 14 - Math.abs(position[0]);
      const rowScore = 10 - Math.abs(4 - position[2] / 1.8);
      const bonus = seat.type === 'vip' ? 4 : seat.type === 'premium' ? 3 : 0;
      return { id: seat.id, score: centerScore + rowScore + bonus };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored.slice(0, 4).map((s) => s.id);
    setHighlightedSeats(best);
    setTimeout(() => setHighlightedSeats([]), 5000);
  };

  const handleScreenPositionUpdate = useCallback(
    (rect: { left: number; top: number; width: number; height: number; visible: boolean }) => {
      setScreenRect(rect);
    }, []
  );

  const handleConfirmBooking = () => {
    setShowBooking(false);
    setSeats((prev) =>
      prev.map((s) => (s.status === 'selected' ? { ...s, status: 'booked' } : s))
    );
    alert('✅ Booking confirmed! Enjoy the movie!');
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleResetView();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // -- Inline styles for the UI buttons
  const btnStyle = (active = false): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 8,
    border: active ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.5)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    transition: 'all 0.2s',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  const iconBtnStyle = (active = false): React.CSSProperties => ({
    ...btnStyle(active),
    padding: '6px 10px',
  });

  const seatGuideItems = [
    { color: '#94a3b8', label: 'Standard' },
    { color: '#3b82f6', label: 'Premium' },
    { color: '#a855f7', label: 'VIP' },
    { color: '#14b8a6', label: 'Accessible' },
    { color: '#10b981', label: 'Selected' },
    { color: '#475569', label: 'Booked' },
    { color: '#f59e0b', label: 'Recommended' },
  ];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      minHeight: 700,
      background: '#020206',
      overflow: 'hidden',
    }}>

      {/* YouTube overlay */}
      {youtubeId && (
        <YouTubeOverlay videoId={youtubeId} screenRect={screenRect} />
      )}

      {/* ===== TOP LEFT: Movie + Showtime ===== */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
        {/* Movie selector */}
        <div style={{
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12,
          padding: 12, border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            🎬 Now Playing
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {movies.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMovie(m)}
                style={btnStyle(selectedMovie.id === m.id)}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>

        {/* Showtime selector */}
        <div style={{
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12,
          padding: 12, border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            🕐 Showtime
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {showtimes.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedShowtime(st)}
                style={{
                  ...btnStyle(selectedShowtime.id === st.id),
                  borderColor: selectedShowtime.id === st.id ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  background: selectedShowtime.id === st.id ? 'rgba(34,197,94,0.3)' : 'rgba(0,0,0,0.5)',
                }}
              >
                {st.time}
              </button>
            ))}
          </div>
        </div>

        {/* Movie info */}
        <div style={{
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12,
          padding: 12, border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', gap: 10,
        }}>
          <img
            src={selectedMovie.image}
            alt={selectedMovie.title}
            style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 6 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>{selectedMovie.title}</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>{selectedMovie.duration} • {selectedMovie.rating}</div>
            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>{selectedMovie.description}</div>
          </div>
        </div>
      </div>

      {/* ===== TOP RIGHT: Controls ===== */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowMiniMap(!showMiniMap)} style={iconBtnStyle(showMiniMap)} title="Toggle Minimap">🗺️</button>
          <button onClick={() => setLightsOn(!lightsOn)} style={iconBtnStyle(lightsOn)} title="Toggle Lights">💡</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['default', 'topdown', 'front', 'side'] as ViewMode[]).map((mode) => {
            const labels: Record<ViewMode, string> = { default: '👁️', topdown: '⬇️', front: '🖥️', side: '➡️' };
            return (
              <button key={mode} onClick={() => handleViewMode(mode)} style={iconBtnStyle(viewMode === mode)} title={mode}>
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {viewingSeatId && (
          <div style={{
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', color: '#fff',
            padding: '6px 14px', borderRadius: 20, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)',
          }}>
            👁️ Viewing from Seat {seats.find((s) => s.id === viewingSeatId)?.row}
            {seats.find((s) => s.id === viewingSeatId)?.number}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleRecommend} style={{ ...btnStyle(), background: 'rgba(245,158,11,0.4)', borderColor: 'rgba(245,158,11,0.5)' }}>
            ⭐ Best Seats
          </button>
          <button onClick={handleResetView} style={btnStyle()}>
            🔄 Reset View
          </button>
        </div>
      </div>

      {/* ===== BOTTOM LEFT: Seat Guide ===== */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 15,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          ℹ️ Seat Guide
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {seatGuideItems.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ color: '#d1d5db', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== BOTTOM RIGHT: Selection Panel ===== */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 15,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
        minWidth: 260,
      }}>
        <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          🎟️ Your Selection
        </div>
        {selectedSeats.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {selectedSeats.map((s) => (
                <span key={s.id} style={{
                  background: s.type === 'vip' ? 'rgba(168,85,247,0.2)' : s.type === 'premium' ? 'rgba(59,130,246,0.2)' : 'rgba(107,114,128,0.2)',
                  color: s.type === 'vip' ? '#c084fc' : s.type === 'premium' ? '#93c5fd' : '#d1d5db',
                  padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${s.type === 'vip' ? 'rgba(168,85,247,0.3)' : s.type === 'premium' ? 'rgba(59,130,246,0.3)' : 'rgba(107,114,128,0.3)'}`,
                }}>
                  {s.row}{s.number} ${s.price}
                </span>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9ca3af', marginBottom: 3 }}>
                <span>{selectedSeats.length} ticket(s)</span><span>${totalPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9ca3af', marginBottom: 3 }}>
                <span>Booking fee</span><span>$2.50</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#fff', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span>Total</span><span style={{ color: '#34d399' }}>${(totalPrice + 2.5).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowBooking(true)}
              style={{
                width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 8, border: 'none',
                background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              ✅ Proceed to Checkout
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>💺</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>No seats selected</div>
            <div style={{ color: '#4b5563', fontSize: 11 }}>Click a seat to select it</div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM CENTER: Minimap ===== */}
      {showMiniMap && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 15 }}>
          <MiniMap seats={seats} selectedIds={selectedSeats.map((s) => s.id)} onSeatClick={handleSeatClick} />
        </div>
      )}

      {/* ===== 3D CANVAS ===== */}
      <Canvas
        shadows
        camera={{ position: [0, 12, 26], fov: 55 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
        }}
      >
        <CameraController
          target={cameraTarget}
          isAnimating={isAnimating}
          onDone={() => setIsAnimating(false)}
          controlsRef={controlsRef}
        />

        <ambientLight intensity={0.18} color="#1a1a3a" />
        <directionalLight
          position={[10, 22, 10]}
          intensity={0.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
        />
        <directionalLight position={[-10, 18, 10]} intensity={0.2} />

        {/* Screen tracker for YouTube overlay */}
        <ScreenTracker onUpdate={handleScreenPositionUpdate} />

        {/* Cinema screen */}
        <CinemaScreen title={selectedMovie.title} />

        {/* Theater environment */}
        <TheaterEnvironment lightsOn={lightsOn} />

        {/* Seats */}
        {seatPositions.map(({ seat, position }) => (
          <Seat3D
            key={seat.id}
            seat={seat}
            position={position}
            onClick={handleSeatClick}
            onHover={(s, p) => {
              if (s && p) setHoveredSeat({ seat: s, position: p });
              else setHoveredSeat(null);
            }}
            isHighlighted={highlightedSeats.includes(seat.id)}
          />
        ))}

        {/* Tooltip */}
        {hoveredSeat && (
          <SeatTooltip seat={hoveredSeat.seat} position={hoveredSeat.position} />
        )}

        <OrbitControls
          ref={controlsRef}
          minDistance={4}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 3, 0]}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Booking Modal */}
      <BookingModal
        open={showBooking}
        onClose={() => setShowBooking(false)}
        onConfirm={handleConfirmBooking}
        seats={selectedSeats}
        movie={selectedMovie}
        showtime={selectedShowtime}
        total={totalPrice}
      />
    </div>
  );
}
