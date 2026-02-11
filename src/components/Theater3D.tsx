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
const SCREEN_WIDTH = 28;
const SCREEN_HEIGHT = 15.75;
const SCREEN_Z = -18;
const SCREEN_Y = 9;
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 24);
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
    description: 'Batman faces the Joker in Gotham City.',
    duration: '2h 32m',
    rating: 'PG-13',
    genre: 'Action, Crime',
  },
  {
    id: '2',
    title: 'Inception',
    image: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
    description: 'A thief steals secrets through dream-sharing.',
    duration: '2h 28m',
    rating: 'PG-13',
    genre: 'Sci-Fi, Action',
  },
  {
    id: '3',
    title: 'Interstellar',
    image: 'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    description: 'Explorers travel through a wormhole in space.',
    duration: '2h 49m',
    rating: 'PG-13',
    genre: 'Sci-Fi, Adventure',
  },
  {
    id: '4',
    title: 'Oppenheimer',
    image: 'https://m.media-amazon.com/images/M/MV5BMDBmYTZjNjUtN2M1MS00MTQ2LTk2ODgtNzc2M2QyZGE5NTVjXkEyXkFqcGdeQXVyNzAwMjU2MTY@._V1_SX300.jpg',
    video: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    description: 'The story behind the atomic bomb.',
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
      if (ri >= 6) {
        type = 'vip';
        price = 25;
      } else if (ri >= 4) {
        type = 'premium';
        price = 18;
      }
      if (i === 1 && ri === 0) {
        type = 'accessible';
        price = 10;
      }
      seatList.push({
        id: `${row}${i}`,
        row,
        number: i,
        status: Math.random() < 0.12 ? 'booked' : 'available',
        type,
        price,
      });
    }
  });
  return seatList;
}

// ============================================
// CAMERA CONTROLLER
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
    progress.current = Math.min(progress.current + delta * 2, 1);
    camera.position.lerp(target.position, 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target.lookAt, 0.08);
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
// SCREEN POSITION TRACKER (for YouTube overlay)
// ============================================
function ScreenTracker({
  onUpdate,
}: {
  onUpdate: (r: {
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
  }) => void;
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
    const top2 = Math.min(px[0].y, px[1].y);
    const right = Math.max(px[1].x, px[3].x);
    const bottom = Math.max(px[2].y, px[3].y);

    onUpdate({
      left,
      top: top2,
      width: right - left,
      height: bottom - top2,
      visible: visible && right - left > 40 && bottom - top2 > 25,
    });
  });

  return null;
}

// ============================================
// CINEMA SCREEN (3D geometry)
// ============================================
function CinemaScreen({ title }: { title: string }) {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Back wall behind screen */}
      <mesh position={[0, 0, -0.8]}>
        <planeGeometry args={[48, 28]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>

      {/* Screen outer frame */}
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[SCREEN_WIDTH + 1.5, SCREEN_HEIGHT + 1]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Screen inner border (silver trim) */}
      {/* Top */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.15, -0.03]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.6, 0.08, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -SCREEN_HEIGHT / 2 - 0.15, -0.03]}>
        <boxGeometry args={[SCREEN_WIDTH + 0.6, 0.08, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Left */}
      <mesh position={[-SCREEN_WIDTH / 2 - 0.15, 0, -0.03]}>
        <boxGeometry args={[0.08, SCREEN_HEIGHT + 0.4, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right */}
      <mesh position={[SCREEN_WIDTH / 2 + 0.15, 0, -0.03]}>
        <boxGeometry args={[0.08, SCREEN_HEIGHT + 0.4, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Screen surface (dark for YouTube overlay) */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshBasicMaterial color="#111118" />
      </mesh>

      {/* Screen glow lights - makes walls near screen visible */}
      <pointLight position={[0, 0, 8]} intensity={4} distance={40} color="#6688ff" />
      <pointLight position={[-8, 0, 5]} intensity={2} distance={20} color="#7799ff" />
      <pointLight position={[8, 0, 5]} intensity={2} distance={20} color="#7799ff" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2, 5]} intensity={3} distance={25} color="#5577ee" />

      {/* Left curtain */}
      <mesh position={[-SCREEN_WIDTH / 2 - 3, 0, -0.2]} castShadow>
        <boxGeometry args={[4, SCREEN_HEIGHT + 5, 0.5]} />
        <meshStandardMaterial color="#8b1a1a" roughness={0.85} />
      </mesh>
      {/* Right curtain */}
      <mesh position={[SCREEN_WIDTH / 2 + 3, 0, -0.2]} castShadow>
        <boxGeometry args={[4, SCREEN_HEIGHT + 5, 0.5]} />
        <meshStandardMaterial color="#8b1a1a" roughness={0.85} />
      </mesh>
      {/* Top valance */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 3, -0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 10, 3.5, 0.5]} />
        <meshStandardMaterial color="#8b1a1a" roughness={0.85} />
      </mesh>

      {/* Title */}
      <Text
        position={[0, -SCREEN_HEIGHT / 2 - 2, 0.1]}
        fontSize={0.9}
        color="#aabbdd"
        anchorX="center"
      >
        NOW SHOWING: {title.toUpperCase()}
      </Text>
    </group>
  );
}

// ============================================
// SEAT 3D
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
    if (isBooked) return '#6b7280';
    if (isSelected) return '#22c55e';
    if (isHighlighted) return '#f59e0b';
    if (hovered) return '#facc15';
    if (seat.type === 'vip') return '#a855f7';
    if (seat.type === 'premium') return '#3b82f6';
    if (seat.type === 'accessible') return '#14b8a6';
    return '#cbd5e1';
  }, [isBooked, isSelected, isHighlighted, hovered, seat.type]);

  const emissiveIntensity = isSelected ? 0.5 : isHighlighted ? 0.35 : hovered ? 0.3 : 0.1;
  const scale = hovered && !isBooked ? 1.1 : 1;

  return (
    <group position={position}>
      {/* Seat cushion */}
      <RoundedBox
        args={[0.85, 0.2, 0.75]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.1, 0]}
        scale={scale}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (!isBooked) onClick(seat);
        }}
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
          roughness={0.35}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {/* Seat back */}
      <RoundedBox
        args={[0.85, 0.65, 0.12]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.43, 0.35]}
        scale={scale}
        castShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {/* Left armrest */}
      <RoundedBox
        args={[0.08, 0.16, 0.5]}
        radius={0.02}
        smoothness={3}
        position={[-0.43, 0.2, 0.08]}
        castShadow
      >
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.5} />
      </RoundedBox>

      {/* Right armrest */}
      <RoundedBox
        args={[0.08, 0.16, 0.5]}
        radius={0.02}
        smoothness={3}
        position={[0.43, 0.2, 0.08]}
        castShadow
      >
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.5} />
      </RoundedBox>

      {/* Seat number */}
      <Text
        position={[0, 0.24, 0]}
        fontSize={0.14}
        color={isBooked ? '#888' : '#1e293b'}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {seat.number}
      </Text>

      {/* VIP crown */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.85, 0.35]}>
          <coneGeometry args={[0.09, 0.16, 5]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.6}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      )}

      {/* Accessible indicator */}
      {seat.type === 'accessible' && (
        <mesh position={[0, 0.85, 0.35]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            color="#14b8a6"
            emissive="#14b8a6"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* Selection glow */}
      {isSelected && (
        <pointLight
          position={[0, 0.6, 0]}
          intensity={1.2}
          distance={2.5}
          color="#22c55e"
        />
      )}
      {isHighlighted && !isSelected && (
        <pointLight
          position={[0, 0.6, 0]}
          intensity={0.8}
          distance={2}
          color="#f59e0b"
        />
      )}
    </group>
  );
}

// ============================================
// SEAT TOOLTIP
// ============================================
function SeatTooltip({
  seat,
  position,
}: {
  seat: Seat;
  position: [number, number, number];
}) {
  const typeColors: Record<string, string> = {
    standard: '#94a3b8',
    premium: '#3b82f6',
    vip: '#a855f7',
    accessible: '#14b8a6',
  };

  return (
    <Html position={[position[0], position[1] + 1.5, position[2]]} center>
      <div
        style={{
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          padding: '14px 18px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.2)',
          minWidth: 180,
          pointerEvents: 'none',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <strong style={{ fontSize: 16 }}>
            Row {seat.row} • Seat {seat.number}
          </strong>
          <span
            style={{
              background: typeColors[seat.type],
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {seat.type}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}
        >
          <span style={{ color: '#9ca3af' }}>Price:</span>
          <span style={{ color: '#34d399', fontWeight: 700 }}>
            ${seat.price.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af' }}>Status:</span>
          <span
            style={{
              color:
                seat.status === 'booked'
                  ? '#f87171'
                  : seat.status === 'selected'
                  ? '#34d399'
                  : '#60a5fa',
              fontWeight: 600,
            }}
          >
            {seat.status === 'booked'
              ? '❌ Booked'
              : seat.status === 'selected'
              ? '✅ Selected'
              : '🟢 Available'}
          </span>
        </div>
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            fontSize: 11,
            color: seat.status === 'booked' ? '#f87171' : '#9ca3af',
          }}
        >
          {seat.status === 'booked'
            ? '🚫 This seat is unavailable'
            : `Click to ${seat.status === 'selected' ? 'deselect' : 'select'}`}
        </div>
      </div>
    </Html>
  );
}

// ============================================
// THEATER ENVIRONMENT
// ============================================
function TheaterEnvironment({ lightsOn }: { lightsOn: boolean }) {
  // Stadium steps
  const steps = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        z: i * 1.8 + 3,
        y: i * 0.45,
      })),
    []
  );

  const ceilingLightPositions = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let x = -10; x <= 10; x += 5)
      for (let z = -5; z <= 18; z += 6) p.push([x, 13, z]);
    return p;
  }, []);

  return (
    <group>
      {/* ====== FLOOR ====== */}
      <mesh
        position={[0, -0.5, 5]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#1e1e2f" roughness={0.85} />
      </mesh>

      {/* ====== LEFT WALL ====== */}
      <mesh position={[-18, 7, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[55, 16]} />
        <meshStandardMaterial color="#252540" roughness={0.8} />
      </mesh>

      {/* ====== RIGHT WALL ====== */}
      <mesh position={[18, 7, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[55, 16]} />
        <meshStandardMaterial color="#252540" roughness={0.8} />
      </mesh>

      {/* ====== CEILING ====== */}
      <mesh position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 55]} />
        <meshStandardMaterial color="#1a1a30" roughness={0.9} />
      </mesh>

      {/* ====== BACK WALL ====== */}
      <mesh position={[0, 7, 20]}>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color="#252540" roughness={0.8} />
      </mesh>

      {/* ====== STADIUM STEPS ====== */}
      {steps.map((s, i) => (
        <group key={i}>
          <mesh position={[0, s.y, s.z]} receiveShadow castShadow>
            <boxGeometry args={[30, 0.45, 1.8]} />
            <meshStandardMaterial color="#2a2a45" roughness={0.75} />
          </mesh>
          {/* Step edge LED */}
          <mesh position={[0, s.y + 0.24, s.z + 0.89]}>
            <boxGeometry args={[30, 0.02, 0.03]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* ====== ROW LABELS ====== */}
      {'ABCDEFGH'.split('').map((row, i) => (
        <group key={row}>
          <Text
            position={[-15, i * 0.45 + 0.5, i * 1.8 + 3]}
            fontSize={0.55}
            color="#60a5fa"
            anchorX="center"
          >
            {row}
          </Text>
          <Text
            position={[15, i * 0.45 + 0.5, i * 1.8 + 3]}
            fontSize={0.55}
            color="#60a5fa"
            anchorX="center"
          >
            {row}
          </Text>
        </group>
      ))}

      {/* ====== EXIT SIGNS ====== */}
      {(
        [
          [-16, 5.5, 10],
          [16, 5.5, 10],
        ] as [number, number, number][]
      ).map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[1.6, 0.5, 0.1]} />
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </mesh>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.22}
            color="#ffffff"
            anchorX="center"
          >
            EXIT
          </Text>
          <pointLight intensity={1} distance={4} color="#22c55e" />
        </group>
      ))}

      {/* ====== CEILING LIGHTS ====== */}
      {ceilingLightPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.4, 0.2, 12]} />
            <meshStandardMaterial
              color="#555566"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          <pointLight
            intensity={lightsOn ? 2.5 : 0.3}
            distance={12}
            color="#fff5e0"
          />
        </group>
      ))}

      {/* ====== AISLE LIGHTS ====== */}
      {[-5, 5].map((x, xi) => (
        <group key={xi}>
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i}>
              <mesh
                position={[x, i * 0.45 + 0.32, i * 1.8 + 3]}
              >
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color="#fbbf24" toneMapped={false} />
              </mesh>
              <pointLight
                position={[x, i * 0.45 + 0.32, i * 1.8 + 3]}
                intensity={0.4}
                distance={1.2}
                color="#fbbf24"
              />
            </group>
          ))}
        </group>
      ))}

      {/* ====== PROJECTOR BOOTH ====== */}
      <group position={[0, 12, 22]}>
        <mesh castShadow>
          <boxGeometry args={[3, 2.5, 3]} />
          <meshStandardMaterial
            color="#3a3a50"
            roughness={0.6}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, -0.5, -1.6]}>
          <cylinderGeometry args={[0.2, 0.28, 0.5, 12]} />
          <meshStandardMaterial
            color="#666"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <spotLight
          position={[0, -0.5, -1.8]}
          angle={0.2}
          penumbra={0.5}
          intensity={4}
          distance={50}
          color="#dde5ff"
        />
      </group>

      {/* ====== WALL SCONCES (side lights) ====== */}
      {[-17.5, 17.5].map((x, xi) => (
        <group key={xi}>
          {Array.from({ length: 4 }, (_, i) => (
            <group key={i} position={[x, 5, -3 + i * 7]}>
              <mesh>
                <boxGeometry args={[0.3, 0.6, 0.15]} />
                <meshStandardMaterial
                  color="#444455"
                  roughness={0.4}
                  metalness={0.5}
                />
              </mesh>
              <pointLight
                intensity={lightsOn ? 1.5 : 0.2}
                distance={6}
                color="#ffeedd"
              />
            </group>
          ))}
        </group>
      ))}
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
  screenRect: {
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
  };
}) {
  if (!screenRect.visible || screenRect.width < 60 || screenRect.height < 35)
    return null;

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
        borderRadius: 4,
        background: '#000',
        boxShadow: '0 0 60px 15px rgba(50,80,200,0.15)',
      }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0`}
        title="Movie Trailer"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
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
  movie: (typeof movies)[0];
  showtime: (typeof showtimes)[0];
  total: number;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 20,
          padding: 28,
          maxWidth: 440,
          width: '95%',
          color: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            🎟️ Confirm Booking
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 22,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: 'rgba(51,65,85,0.5)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <strong style={{ fontSize: 16 }}>{movie.title}</strong>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            {movie.genre} • {movie.duration} • {movie.rating}
          </div>
          <div style={{ color: '#60a5fa', fontSize: 13, marginTop: 4 }}>
            🕐 {showtime.time}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(51,65,85,0.5)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}
          >
            Selected Seats:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {seats.map((s) => (
              <span
                key={s.id}
                style={{
                  background:
                    s.type === 'vip'
                      ? 'rgba(168,85,247,0.25)'
                      : s.type === 'premium'
                      ? 'rgba(59,130,246,0.25)'
                      : 'rgba(148,163,184,0.2)',
                  color:
                    s.type === 'vip'
                      ? '#c084fc'
                      : s.type === 'premium'
                      ? '#93c5fd'
                      : '#e2e8f0',
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {s.row}
                {s.number} — ${s.price}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: '#94a3b8',
              marginBottom: 6,
            }}
          >
            <span>{seats.length} ticket(s)</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              color: '#94a3b8',
              marginBottom: 6,
            }}
          >
            <span>Booking fee</span>
            <span>$2.50</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 22,
              fontWeight: 700,
              paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span>Total</span>
            <span style={{ color: '#34d399' }}>
              ${(total + 2.5).toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            💳 Pay Now
          </button>
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
    if (s.status === 'booked') return '#4b5563';
    if (selectedIds.includes(s.id)) return '#22c55e';
    if (s.type === 'vip') return '#a855f7';
    if (s.type === 'premium') return '#3b82f6';
    if (s.type === 'accessible') return '#14b8a6';
    return '#94a3b8';
  };

  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(10px)',
        padding: 16,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 10,
        }}
      >
        🎭 Theater Map
      </div>
      <div
        style={{
          width: '100%',
          height: 4,
          borderRadius: 4,
          marginBottom: 14,
          background:
            'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
        }}
      />
      <div
        style={{
          textAlign: 'center',
          fontSize: 8,
          color: '#6b7280',
          marginBottom: 8,
          marginTop: -8,
        }}
      >
        SCREEN
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {rows.map(([letter, rowSeats]) => (
          <div
            key={letter}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span
              style={{
                fontSize: 9,
                color: '#6b7280',
                width: 12,
                textAlign: 'right',
              }}
            >
              {letter}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {rowSeats
                .sort((a, b) => a.number - b.number)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.status !== 'booked') onSeatClick(s);
                    }}
                    disabled={s.status === 'booked'}
                    title={`${s.row}${s.number} — $${s.price} (${s.type})`}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      border: 'none',
                      background: getColor(s),
                      cursor:
                        s.status === 'booked'
                          ? 'not-allowed'
                          : 'pointer',
                      opacity: s.status === 'booked' ? 0.35 : 1,
                      transition: 'transform 0.15s',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.transform =
                        'scale(2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.transform =
                        'scale(1)';
                    }}
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
// MAIN APP COMPONENT
// ============================================
export default function CinemaBookingApp() {
  const [seats, setSeats] = useState<Seat[]>(() => generateSeats());
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);
  const [selectedShowtime, setSelectedShowtime] = useState(showtimes[3]);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({
    position: DEFAULT_CAMERA_POS,
    lookAt: DEFAULT_LOOK_AT,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<{
    seat: Seat;
    position: [number, number, number];
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [lightsOn, setLightsOn] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [highlightedSeats, setHighlightedSeats] = useState<string[]>([]);
  const [screenRect, setScreenRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const controlsRef = useRef<any>(null);

  const youtubeId = useMemo(
    () => getYouTubeId(selectedMovie.video),
    [selectedMovie.video]
  );

  const selectedSeats = useMemo(
    () => seats.filter((s) => s.status === 'selected'),
    [seats]
  );
  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats]
  );

  const seatPositions = useMemo(() => {
    const positions: Array<{
      seat: Seat;
      position: [number, number, number];
    }> = [];
    const rowMap: Record<string, Seat[]> = {};
    seats.forEach((s) => {
      if (!rowMap[s.row]) rowMap[s.row] = [];
      rowMap[s.row].push(s);
    });
    const sortedRows = Object.keys(rowMap).sort();

    sortedRows.forEach((row, ri) => {
      const rowSeats = rowMap[row].sort((a, b) => a.number - b.number);
      const z = ri * 1.8 + 3;
      const y = ri * 0.45 + 0.3;
      rowSeats.forEach((seat, si) => {
        const mid = Math.floor(rowSeats.length / 2);
        const aisleGap = si >= mid ? 1.2 : 0;
        const x =
          (si - (rowSeats.length - 1) / 2) * 1.12 +
          aisleGap * 0.5 -
          0.3;
        positions.push({ seat, position: [x, y, z] });
      });
    });
    return positions;
  }, [seats]);

  const handleSeatClick = useCallback(
    (seat: Seat) => {
      if (seat.status === 'booked') return;
      setSeats((prev) =>
        prev.map((s) =>
          s.id === seat.id
            ? {
                ...s,
                status:
                  s.status === 'selected' ? 'available' : 'selected',
              }
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
    },
    [seatPositions]
  );

  const handleResetView = useCallback(() => {
    setCameraTarget({
      position: DEFAULT_CAMERA_POS,
      lookAt: DEFAULT_LOOK_AT,
    });
    setIsAnimating(true);
    setViewingSeatId(null);
    setViewMode('default');
  }, []);

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    const views: Record<ViewMode, CameraTarget> = {
      default: {
        position: DEFAULT_CAMERA_POS,
        lookAt: DEFAULT_LOOK_AT,
      },
      topdown: {
        position: new THREE.Vector3(0, 30, 8),
        lookAt: new THREE.Vector3(0, 0, 5),
      },
      front: {
        position: new THREE.Vector3(0, SCREEN_Y, -12),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z),
      },
      side: {
        position: new THREE.Vector3(28, 10, 8),
        lookAt: new THREE.Vector3(0, 4, 5),
      },
    };
    setCameraTarget(views[mode]);
    setIsAnimating(true);
  }, []);

  const handleRecommend = useCallback(() => {
    const avail = seatPositions.filter(
      ({ seat }) => seat.status === 'available'
    );
    const scored = avail.map(({ seat, position }) => {
      const centerScore = 14 - Math.abs(position[0]);
      const rowScore = 10 - Math.abs(4 - position[2] / 1.8);
      const bonus =
        seat.type === 'vip' ? 4 : seat.type === 'premium' ? 3 : 0;
      return { id: seat.id, score: centerScore + rowScore + bonus };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored.slice(0, 4).map((s) => s.id);
    setHighlightedSeats(best);
    setTimeout(() => setHighlightedSeats([]), 5000);
  }, [seatPositions]);

  const handleScreenPositionUpdate = useCallback(
    (rect: {
      left: number;
      top: number;
      width: number;
      height: number;
      visible: boolean;
    }) => {
      setScreenRect(rect);
    },
    []
  );

  const handleConfirmBooking = useCallback(() => {
    setShowBooking(false);
    setSeats((prev) =>
      prev.map((s) =>
        s.status === 'selected' ? { ...s, status: 'booked' } : s
      )
    );
    alert('✅ Booking confirmed! Enjoy the movie!');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleResetView();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleResetView]);

  // Button styles
  const btn = (active = false): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: 8,
    border: active
      ? '2px solid #3b82f6'
      : '1px solid rgba(255,255,255,0.2)',
    background: active
      ? 'rgba(59,130,246,0.35)'
      : 'rgba(30,41,59,0.8)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  const iconBtn = (active = false): React.CSSProperties => ({
    ...btn(active),
    padding: '7px 11px',
    fontSize: 14,
  });

  const seatGuide = [
    { color: '#cbd5e1', label: 'Standard' },
    { color: '#3b82f6', label: 'Premium' },
    { color: '#a855f7', label: 'VIP' },
    { color: '#14b8a6', label: 'Accessible' },
    { color: '#22c55e', label: 'Selected' },
    { color: '#6b7280', label: 'Booked' },
    { color: '#f59e0b', label: 'Recommended' },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        background: '#0f172a',
        overflow: 'hidden',
      }}
    >
      {/* YouTube overlay */}
      {youtubeId && (
        <YouTubeOverlay videoId={youtubeId} screenRect={screenRect} />
      )}

      {/* ===== TOP LEFT: Movie + Showtime + Info ===== */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 420,
        }}
      >
        {/* Movie selector */}
        <div
          style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: 14,
            padding: 14,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 10,
            }}
          >
            🎬 Now Playing
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {movies.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMovie(m)}
                style={btn(selectedMovie.id === m.id)}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>

        {/* Showtime selector */}
        <div
          style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: 14,
            padding: 14,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 10,
            }}
          >
            🕐 Showtime
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {showtimes.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedShowtime(st)}
                style={{
                  ...btn(selectedShowtime.id === st.id),
                  borderColor:
                    selectedShowtime.id === st.id
                      ? '#22c55e'
                      : 'rgba(255,255,255,0.2)',
                  background:
                    selectedShowtime.id === st.id
                      ? 'rgba(34,197,94,0.35)'
                      : 'rgba(30,41,59,0.8)',
                }}
              >
                {st.time}
              </button>
            ))}
          </div>
        </div>

        {/* Movie info card */}
        <div
          style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: 14,
            padding: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            gap: 12,
          }}
        >
          <img
            src={selectedMovie.image}
            alt={selectedMovie.title}
            style={{
              width: 50,
              height: 70,
              objectFit: 'cover',
              borderRadius: 8,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: '#60a5fa',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {selectedMovie.title}
            </div>
            <div
              style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}
            >
              {selectedMovie.duration} • {selectedMovie.rating} •{' '}
              {selectedMovie.genre}
            </div>
            <div
              style={{ color: '#cbd5e1', fontSize: 11, marginTop: 6 }}
            >
              {selectedMovie.description}
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOP RIGHT: Controls ===== */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {/* Toggle buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            style={iconBtn(showMiniMap)}
            title="Toggle Map"
          >
            🗺️
          </button>
          <button
            onClick={() => setLightsOn(!lightsOn)}
            style={iconBtn(lightsOn)}
            title="Toggle Lights"
          >
            💡
          </button>
        </div>

        {/* View mode buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              { mode: 'default' as ViewMode, icon: '👁️', tip: 'Default View' },
              { mode: 'topdown' as ViewMode, icon: '⬇️', tip: 'Top View' },
              { mode: 'front' as ViewMode, icon: '🖥️', tip: 'Screen View' },
              { mode: 'side' as ViewMode, icon: '➡️', tip: 'Side View' },
            ] as const
          ).map(({ mode, icon, tip }) => (
            <button
              key={mode}
              onClick={() => handleViewMode(mode)}
              style={iconBtn(viewMode === mode)}
              title={tip}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Current seat view indicator */}
        {viewingSeatId && (
          <div
            style={{
              background: 'rgba(15,23,42,0.9)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid rgba(96,165,250,0.3)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            👁️ Viewing from{' '}
            <strong style={{ color: '#60a5fa' }}>
              {seats.find((s) => s.id === viewingSeatId)?.row}
              {seats.find((s) => s.id === viewingSeatId)?.number}
            </strong>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleRecommend}
            style={{
              ...btn(),
              background: 'rgba(245,158,11,0.4)',
              borderColor: 'rgba(245,158,11,0.5)',
            }}
          >
            ⭐ Best Seats
          </button>
          <button onClick={handleResetView} style={btn()}>
            🔄 Reset
          </button>
        </div>
      </div>

      {/* ===== BOTTOM LEFT: Seat Guide ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 15,
          background: 'rgba(15,23,42,0.88)',
          backdropFilter: 'blur(10px)',
          padding: 16,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          ℹ️ Seat Guide
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 28px',
          }}
        >
          {seatGuide.map(({ color, label }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#d1d5db', fontSize: 11 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== BOTTOM RIGHT: Selection Panel ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 15,
          background: 'rgba(15,23,42,0.88)',
          backdropFilter: 'blur(10px)',
          padding: 16,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.12)',
          minWidth: 270,
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          🎟️ Your Selection
        </div>

        {selectedSeats.length > 0 ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {selectedSeats.map((s) => (
                <span
                  key={s.id}
                  style={{
                    background:
                      s.type === 'vip'
                        ? 'rgba(168,85,247,0.2)'
                        : s.type === 'premium'
                        ? 'rgba(59,130,246,0.2)'
                        : 'rgba(148,163,184,0.15)',
                    color:
                      s.type === 'vip'
                        ? '#c084fc'
                        : s.type === 'premium'
                        ? '#93c5fd'
                        : '#e2e8f0',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${
                      s.type === 'vip'
                        ? 'rgba(168,85,247,0.3)'
                        : s.type === 'premium'
                        ? 'rgba(59,130,246,0.3)'
                        : 'rgba(148,163,184,0.2)'
                    }`,
                  }}
                >
                  {s.row}
                  {s.number}{' '}
                  <span style={{ color: '#94a3b8' }}>
                    ${s.price}
                  </span>
                </span>
              ))}
            </div>

            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#94a3b8',
                  marginBottom: 4,
                }}
              >
                <span>{selectedSeats.length} ticket(s)</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#94a3b8',
                  marginBottom: 4,
                }}
              >
                <span>Booking fee</span>
                <span>$2.50</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#fff',
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span>Total</span>
                <span style={{ color: '#34d399' }}>
                  ${(totalPrice + 2.5).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowBooking(true)}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background:
                  'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
              }}
            >
              ✅ Proceed to Checkout
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💺</div>
            <div
              style={{
                color: '#94a3b8',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              No seats selected
            </div>
            <div
              style={{
                color: '#64748b',
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Click on a seat to select it
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM CENTER: Minimap ===== */}
      {showMiniMap && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
          }}
        >
          <MiniMap
            seats={seats}
            selectedIds={selectedSeats.map((s) => s.id)}
            onSeatClick={handleSeatClick}
          />
        </div>
      )}

      {/* ===== 3D CANVAS ===== */}
      <Canvas
        shadows
        camera={{ position: [0, 10, 24], fov: 55 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Camera animation */}
        <CameraController
          target={cameraTarget}
          isAnimating={isAnimating}
          onDone={() => setIsAnimating(false)}
          controlsRef={controlsRef}
        />

        {/* ====== BRIGHT LIGHTING SETUP ====== */}
        {/* Strong ambient so nothing is pitch black */}
        <ambientLight intensity={0.6} color="#c8d0e0" />

        {/* Main directional light (sun-like) */}
        <directionalLight
          position={[10, 20, 15]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          color="#ffffff"
        />

        {/* Fill light from opposite side */}
        <directionalLight
          position={[-10, 15, 10]}
          intensity={0.8}
          color="#e8e0ff"
        />

        {/* Overhead fill */}
        <directionalLight
          position={[0, 18, 5]}
          intensity={0.6}
          color="#fff8f0"
        />

        {/* Hemisphere light for natural look */}
        <hemisphereLight
          args={['#b4c6e7', '#1e293b', 0.5]}
        />

        {/* Screen tracker for YouTube overlay */}
        <ScreenTracker onUpdate={handleScreenPositionUpdate} />

        {/* Cinema screen */}
        <CinemaScreen title={selectedMovie.title} />

        {/* Theater environment */}
        <TheaterEnvironment lightsOn={lightsOn} />

        {/* All seats */}
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

        {/* Hover tooltip */}
        {hoveredSeat && (
          <SeatTooltip
            seat={hoveredSeat.seat}
            position={hoveredSeat.position}
          />
        )}

        {/* Orbit controls */}
        <OrbitControls
          ref={controlsRef}
          minDistance={4}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 3, 0]}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Booking modal */}
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
