import React, { useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button'; 
import { RotateCcw, Eye } from 'lucide-react';

// --- Types ---
export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium';
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

// --- Constants ---
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 10, 22);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 2, -5);
const SCREEN_Z = -15; 
const SCREEN_Y = 6;   

// --- Helper Functions ---
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Components ---

// 1. Animated Camera Controller
function CameraController({ 
  target, 
  isAnimating, 
  onAnimationComplete, 
  controlsRef 
}: { 
  target: CameraTarget; 
  isAnimating: boolean; 
  onAnimationComplete: () => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    
    progressRef.current = Math.min(progressRef.current + delta * 1.5, 1);
    const t = easeInOutCubic(progressRef.current);
    
    // Interpolate Camera
    camera.position.lerp(target.position, t * 0.1);
    
    // Interpolate OrbitControls Target (Fixes Snap-back bug)
    if (controlsRef.current) {
        const currentTarget = controlsRef.current.target;
        currentTarget.lerp(target.lookAt, t * 0.1);
        controlsRef.current.update();
    }

    if (progressRef.current >= 1) {
      progressRef.current = 0;
      onAnimationComplete();
    }
  });

  return null;
}

// 2. The Seat Component (Fixed Visibility Logic)
function Seat3D({ 
  seat, 
  position, 
  onClick 
}: { 
  seat: Seat; 
  position: [number, number, number]; 
  onClick: (seat: Seat) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  // COLOR LOGIC
  const getSeatColor = () => {
    // Booked = Slate Grey (Visible Metal)
    if (isBooked) return '#475569'; 
    // Active Colors
    if (isSelected) return '#f472b6'; // Neon Pink
    if (hovered) return '#facc15';    // Bright Yellow
    if (seat.type === 'premium') return '#a855f7'; // Neon Purple
    return '#22d3ee'; // Neon Cyan
  };

  // EMISSIVE (GLOW) LOGIC
  const getEmissive = () => {
    if (isBooked) return '#000000'; // No glow for booked seats
    if (isSelected) return '#f472b6';
    if (hovered) return '#facc15';
    if (seat.type === 'premium') return '#a855f7';
    return '#22d3ee'; // Standard seats have faint glow
  };

  const getEmissiveIntensity = () => {
    if (isBooked) return 0;
    if (hovered || isSelected) return 0.6; // High glow when interacting
    return 0.15; // Low ambient glow for visibility
  };

  return (
    <group position={position}>
      {/* Seat Base */}
      <RoundedBox
        args={[0.8, 0.15, 0.7]}
        radius={0.05}
        smoothness={4}
        onClick={(e) => {
            e.stopPropagation();
            if (!isBooked) onClick(seat);
        }}
        onPointerEnter={(e) => {
            e.stopPropagation();
            if (!isBooked) {
                setHovered(true);
                document.body.style.cursor = 'pointer';
            }
        }}
        onPointerLeave={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
        }}
        position={[0, 0.05, 0]}
        scale={hovered && !isBooked ? 1.1 : 1}
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          emissive={getEmissive()}
          emissiveIntensity={getEmissiveIntensity()}
          // Material Contrast: Booked is Rough/Matte, Active is Shiny/Metallic
          roughness={isBooked ? 0.8 : 0.2} 
          metalness={isBooked ? 0.3 : 0.6} 
        />
      </RoundedBox>
      
      {/* Seat Back */}
      <RoundedBox
        args={[0.8, 0.55, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.35, 0.32]}
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          emissive={getEmissive()}
          emissiveIntensity={getEmissiveIntensity()}
          roughness={isBooked ? 0.8 : 0.2}
          metalness={isBooked ? 0.3 : 0.6}
        />
      </RoundedBox>
      
      {/* Armrests - Lighter Grey for Visibility */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </RoundedBox>
    </group>
  );
}

// 3. Screen Component (Neon White Glow)
function Screen3D() {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen Mesh */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[26, 12]} />
        <meshBasicMaterial 
          color="#e0f2fe"
          toneMapped={false} 
        />
      </mesh>
      
      {/* Bloom Source */}
      <pointLight position={[0, 0, 2]} intensity={3} distance={25} color="#38bdf8" />
      
      {/* Frame */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[28, 14]} />
        <meshStandardMaterial color="#000000" roughness={0.1} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, -7, 0.1]}
        fontSize={1.2}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.8}
      >
        SCREEN
      </Text>
    </group>
  );
}

// 4. Stadium Steps (Glassy + Neon Edges)
function StadiumSteps() {
  const steps = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      z: i * 1.2 + 2,
      y: i * 0.3
    }));
  }, []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          {/* Transparent Indigo Glass Step */}
          <mesh position={[0, step.y, step.z]} receiveShadow>
            <boxGeometry args={[26, 0.4, 1.2]} />
            <meshStandardMaterial 
                color="#312e81" 
                roughness={0.1}
                metalness={0.8}
                transparent
                opacity={0.8}
            />
          </mesh>
          
          {/* Neon Pink Edge Strip */}
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[26, 0.02, 0.03]} />
            <meshBasicMaterial color="#d946ef" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 5. Environment (Cyber Grid + Fog)
function TheaterEnvironment() {
  return (
    <group>
      {/* Neon Floor Grid */}
      <Grid 
        position={[0, -0.1, 0]} 
        args={[100, 100]} 
        cellSize={2} 
        cellThickness={1} 
        cellColor="#6366f1" 
        sectionSize={6} 
        sectionThickness={1.5} 
        sectionColor="#a855f7" 
        fadeDistance={50} 
        fadeStrength={1.5}
      />

      {/* Base Floor Reflection */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.8} />
      </mesh>

      <StadiumSteps />
      
      {/* Atmosphere */}
      <fog attach="fog" args={['#2e1065', 5, 60]} /> 
    </group>
  );
}

// --- Main Export ---
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ 
    position: DEFAULT_CAMERA_POS, 
    lookAt: DEFAULT_LOOK_AT 
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingSeatId, setViewingSeatId] = useState<string | null>(null);
  
  const controlsRef = useRef<any>(null);

  // Group seats logic
  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  // Position logic
  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const rows = Object.keys(seatsByRow).sort();
    
    rows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      const rowZ = rowIndex * 1.2 + 2; 
      const rowY = (rowIndex * 0.3) + 0.3;
      
      rowSeats.forEach((seat, seatIndex) => {
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.0;
        positions.push({
          seat,
          position: [seatX, rowY, rowZ]
        });
      });
    });
    return positions;
  }, [seatsByRow]);

  const handleSeatClick = (seat: Seat) => {
    onSeatClick(seat);
    const seatData = seatPositions.find(s => s.seat.id === seat.id);
    if (seatData) {
      const [x, y, z] = seatData.position;
      setCameraTarget({
        position: new THREE.Vector3(x, y + 0.8, z),
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z)
      });
      setIsAnimating(true);
      setViewingSeatId(seat.id);
    }
  };

  const handleResetView = () => {
    setCameraTarget({
        position: DEFAULT_CAMERA_POS,
        lookAt: DEFAULT_LOOK_AT
    });
    setIsAnimating(true);
    setViewingSeatId(null);
  };

  return (
    <div className="relative w-full h-[700px] bg-gradient-to-b from-[#2e1065] to-black rounded-2xl overflow-hidden shadow-2xl border-2 border-[#6366f1]">
      
      {/* UI: Color Guide Legend */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Seat Guide</h3>
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#22d3ee] shadow-[0_0_8px_#22d3ee]"></div>
                <span className="text-gray-300 text-xs">Standard</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]"></div>
                <span className="text-gray-300 text-xs">Premium</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#f472b6] shadow-[0_0_8px_#f472b6]"></div>
                <span className="text-gray-300 text-xs">Selected</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#475569] border border-gray-500"></div>
                <span className="text-gray-300 text-xs">Booked</span>
            </div>
        </div>
      </div>

      {/* UI: Right Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {viewingSeatId && (
          <div className="bg-[#f472b6] text-black font-bold px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_0_15px_#f472b6] animate-in fade-in zoom-in">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Seat View</span>
          </div>
        )}
        <Button 
          onClick={handleResetView}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_10px_#06b6d4] border-none"
          size="sm"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
      </div>

      <Suspense fallback={<div className="flex h-full items-center justify-center text-cyan-400">Loading Cinema...</div>}>
        <Canvas
          shadows
          camera={{ position: [0, 10, 22], fov: 50 }}
          gl={{ antialias: true }}
        >
          <CameraController 
            target={cameraTarget} 
            isAnimating={isAnimating}
            onAnimationComplete={() => setIsAnimating(false)}
            controlsRef={controlsRef}
          />

          {/* BRIGHT NEON LIGHTING */}
          <ambientLight intensity={1.5} />
          <spotLight position={[10, 20, 10]} color="#d946ef" intensity={2} angle={0.5} />
          <spotLight position={[-10, 20, 10]} color="#06b6d4" intensity={2} angle={0.5} />
          
          <Screen3D />
          <TheaterEnvironment />
          
          {seatPositions.map(({ seat, position }) => (
            <Seat3D
              key={seat.id}
              seat={seat}
              position={position}
              onClick={handleSeatClick}
            />
          ))}

          <OrbitControls
            ref={controlsRef}
            minDistance={5}
            maxDistance={35}
            maxPolarAngle={Math.PI / 2.1} 
            target={[0, 2, -5]}
            enableDamping={true}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
