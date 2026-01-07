import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { RotateCcw, Eye, Film } from 'lucide-react';

// Movie data with stable CORS-friendly URLs
const movies = [
  {
    id: 1,
    title: "Cosmic Odyssey",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/681px-Placeholder_view_vector.svg.png"
  },
  {
    id: 2,
    title: "Desert Storm",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/330px-No-Image-Placeholder.svg.png"
  },
  {
    id: 3,
    title: "Ocean Deep",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/300px-No_image_available.svg.png"
  }
];

interface Seat {
  id: string;
  row: string;
  number: number;
  price: number;
  isBooked: boolean;
  position: [number, number, number];
}

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 8, 18);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 1, -5);
const SCREEN_Z = -15;
const SCREEN_Y = 6;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Camera Controller with smooth transitions
function CameraController({ targetSeat }: { targetSeat: Seat | null }) {
  const { camera } = useThree();
  const startPos = useRef(DEFAULT_CAMERA_POS.clone());
  const startLookAt = useRef(DEFAULT_LOOK_AT.clone());
  const targetPos = useRef(DEFAULT_CAMERA_POS.clone());
  const targetLookAt = useRef(DEFAULT_LOOK_AT.clone());
  const progress = useRef(0);
  const isAnimating = useRef(false);

  useEffect(() => {
    if (targetSeat) {
      startPos.current.copy(camera.position);
      const controls = camera.userData.controls;
      if (controls?.target) {
        startLookAt.current.copy(controls.target);
      }
      
      const [x, y, z] = targetSeat.position;
      targetPos.current.set(x, y + 3, z + 8);
      targetLookAt.current.set(x, y, z);
      
      progress.current = 0;
      isAnimating.current = true;
    } else {
      startPos.current.copy(camera.position);
      const controls = camera.userData.controls;
      if (controls?.target) {
        startLookAt.current.copy(controls.target);
      }
      
      targetPos.current.copy(DEFAULT_CAMERA_POS);
      targetLookAt.current.copy(DEFAULT_LOOK_AT);
      
      progress.current = 0;
      isAnimating.current = true;
    }
  }, [targetSeat, camera]);

  useFrame((state, delta) => {
    if (isAnimating.current) {
      progress.current = Math.min(progress.current + delta * 0.8, 1);
      const t = easeInOutCubic(progress.current);
      
      camera.position.lerpVectors(startPos.current, targetPos.current, t);
      
      const controls = camera.userData.controls;
      if (controls?.target) {
        controls.target.lerpVectors(startLookAt.current, targetLookAt.current, t);
      }
      
      if (progress.current >= 1) {
        isAnimating.current = false;
      }
    }
  });

  return null;
}

// Premium Seat with Animation
function Seat3D({ seat, isSelected, onSelect, onHover }: {
  seat: Seat;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (seat: Seat | null) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const targetY = useRef(seat.position[1]);

  useEffect(() => {
    targetY.current = (hovered || isSelected) ? seat.position[1] + 0.3 : seat.position[1];
  }, [hovered, isSelected, seat.position]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetY.current,
        delta * 8
      );
    }
  });

  const seatColor = seat.isBooked ? '#475569' : isSelected ? '#ef4444' : '#1e293b';
  const emissiveColor = isSelected ? '#dc2626' : '#000000';

  return (
    <group
      ref={meshRef}
      position={seat.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!seat.isBooked) {
          setHovered(true);
          onHover(seat);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        onHover(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!seat.isBooked) onSelect();
      }}
    >
      {/* Base */}
      <RoundedBox args={[1, 0.3, 1]} radius={0.05} castShadow receiveShadow>
        <meshStandardMaterial color={seatColor} roughness={0.7} metalness={0.2} emissive={emissiveColor} emissiveIntensity={0.3} />
      </RoundedBox>
      
      {/* Back */}
      <RoundedBox args={[1, 1, 0.2]} radius={0.05} position={[0, 0.5, -0.4]} castShadow receiveShadow>
        <meshStandardMaterial color={seatColor} roughness={0.7} metalness={0.2} emissive={emissiveColor} emissiveIntensity={0.3} />
      </RoundedBox>
      
      {/* Headrest */}
      <RoundedBox args={[0.8, 0.3, 0.15]} radius={0.05} position={[0, 1.1, -0.45]} castShadow receiveShadow>
        <meshStandardMaterial color={seatColor} roughness={0.7} metalness={0.2} emissive={emissiveColor} emissiveIntensity={0.3} />
      </RoundedBox>
      
      {/* Left Armrest */}
      <RoundedBox args={[0.15, 0.15, 0.8]} radius={0.02} position={[-0.5, 0.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={seatColor} roughness={0.8} metalness={0.1} />
      </RoundedBox>
      
      {/* Right Armrest */}
      <RoundedBox args={[0.15, 0.15, 0.8]} radius={0.02} position={[0.5, 0.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={seatColor} roughness={0.8} metalness={0.1} />
      </RoundedBox>
      
      {/* Cup Holders */}
      <mesh position={[-0.5, 0.38, 0.2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 0.38, 0.2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Hover Tooltip */}
      {hovered && !seat.isBooked && (
        <Html position={[0, 1.5, 0]} center>
          <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg border border-slate-700 whitespace-nowrap">
            <div className="text-xs font-semibold">{seat.row}{seat.number}</div>
            <div className="text-xs text-amber-400">${seat.price}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Safe Screen Component with Manual Texture Loading
function Screen3D({ movieUrl }: { movieUrl: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    
    loader.load(
      movieUrl,
      (loadedTexture) => {
        if (isMounted) {
          setTexture(loadedTexture);
        }
      },
      undefined,
      (error) => {
        console.error('Error loading texture:', error);
        if (isMounted) {
          setTexture(null);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [movieUrl]);

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[16, 9, 0.2]} />
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.1} metalness={0.8} />
        ) : (
          <meshStandardMaterial color="#f8f8f8" roughness={0.1} metalness={0.8} />
        )}
      </mesh>

      {/* Screen Glow */}
      <pointLight position={[0, 0, 1]} color="#60a5fa" intensity={2} distance={15} decay={2} />

      {/* Left Curtain */}
      <mesh position={[-8.5, 0, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[1, 10, 1]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.8} />
      </mesh>

      {/* Right Curtain */}
      <mesh position={[8.5, 0, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[1, 10, 1]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Stadium-Style Seating
function StadiumSteps() {
  const rows = [
    { name: 'A', y: -1, z: 5, seats: 8, price: 12 },
    { name: 'B', y: 0, z: 8, seats: 10, price: 15 },
    { name: 'C', y: 1, z: 11, seats: 10, price: 15 },
    { name: 'D', y: 2, z: 14, seats: 12, price: 18 }
  ];

  const seats: Seat[] = useMemo(() => {
    const allSeats: Seat[] = [];
    rows.forEach(row => {
      const spacing = 1.5;
      const rowWidth = (row.seats - 1) * spacing;
      const startX = -rowWidth / 2;

      for (let i = 0; i < row.seats; i++) {
        allSeats.push({
          id: `${row.name}${i + 1}`,
          row: row.name,
          number: i + 1,
          price: row.price,
          isBooked: Math.random() > 0.7,
          position: [startX + i * spacing, row.y, row.z]
        });
      }
    });
    return allSeats;
  }, []);

  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [focusedSeat, setFocusedSeat] = useState<Seat | null>(null);

  return (
    <>
      <CameraController targetSeat={focusedSeat} />
      {seats.map(seat => (
        <Seat3D
          key={seat.id}
          seat={seat}
          isSelected={selectedSeats.has(seat.id)}
          onSelect={() => {
            setSelectedSeats(prev => {
              const next = new Set(prev);
              if (next.has(seat.id)) {
                next.delete(seat.id);
              } else {
                next.add(seat.id);
              }
              return next;
            });
          }}
          onHover={setHoveredSeat}
        />
      ))}
    </>
  );
}

// Side Walls with Sconces
function SideWalls() {
  const wallLength = 40;
  const wallHeight = 12;
  const zPos = 0;
  const lightPositions = [-5, 5, 15];

  return (
    <group>
      {/* Left Wall */}
      <mesh position={[-20, 4, zPos]} receiveShadow>
        <boxGeometry args={[1, wallHeight, wallLength]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>
      
      {/* Right Wall */}
      <mesh position={[20, 4, zPos]} receiveShadow>
        <boxGeometry args={[1, wallHeight, wallLength]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>

      {/* Sconces */}
      {lightPositions.map((z, i) => (
        <group key={i}>
          {/* Left Sconce */}
          <mesh position={[-19.4, 6, z]}>
            <boxGeometry args={[0.2, 0.8, 0.4]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[-18, 6, z]} color="#fbbf24" distance={8} intensity={1} decay={2} />

          {/* Right Sconce */}
          <mesh position={[19.4, 6, z]}>
            <boxGeometry args={[0.2, 0.8, 0.4]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[18, 6, z]} color="#fbbf24" distance={8} intensity={1} decay={2} />
        </group>
      ))}
    </group>
  );
}

// Projector with Dust Effect
function ProjectorEffect() {
  return (
    <group position={[0, 8, 18]} rotation={[0.15, 0, 0]}>
      {/* Light Cone */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
        <cylinderGeometry args={[0.1, 4, 20, 32, 1, true]} />
        <meshBasicMaterial 
          color="#bae6fd" 
          opacity={0.06}
          transparent={true} 
          side={THREE.DoubleSide} 
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Dust Particles */}
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
        <Sparkles 
          count={200} 
          scale={[6, 20, 6]}
          size={4} 
          speed={0.4} 
          opacity={0.5} 
          color="#ffffff" 
        />
      </group>
    </group>
  );
}

// Theater Environment
function TheaterEnvironment() {
  const { scene } = useThree();
  
  useEffect(() => {
    scene.fog = new THREE.Fog('#020617', 15, 50);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0f0518" roughness={0.9} />
      </mesh>

      <StadiumSteps />
      <ProjectorEffect />
      <SideWalls />
    </group>
  );
}

// Main Component
export default function Theater3D() {
  const [selectedMovie, setSelectedMovie] = useState(movies[0]);

  return (
    <div className="w-full h-screen bg-slate-950 relative">
      {/* Movie Selection UI */}
      <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-sm p-4 rounded-xl border border-slate-700 shadow-2xl">
        <h2 className="text-white font-bold mb-3 flex items-center gap-2">
          <Film className="w-5 h-5 text-amber-400" />
          Now Playing
        </h2>
        <div className="space-y-2">
          {movies.map(movie => (
            <Button
              key={movie.id}
              onClick={() => setSelectedMovie(movie)}
              variant={selectedMovie.id === movie.id ? "default" : "outline"}
              className="w-full justify-start"
            >
              {movie.title}
            </Button>
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 18], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#020617']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />

        <Screen3D movieUrl={selectedMovie.poster} />
        <TheaterEnvironment />
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2}
          target={[0, 1, -5]}
        />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-sm p-4 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex gap-4 text-sm text-white">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-700 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-500 rounded"></div>
            <span>Booked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
