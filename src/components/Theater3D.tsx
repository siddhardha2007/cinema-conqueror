import React, { useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
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
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 8, 18);
const DEFAULT_LOOK_AT = new THREE.Vector3(0, 1, -5);
const SCREEN_Z = -15; 
const SCREEN_Y = 6;   

// --- Helper Functions ---
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Components ---

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
    
    camera.position.lerp(target.position, t * 0.1);
    
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

// --- THE VISIBILITY FIX IS HERE ---
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

  const getSeatColor = () => {
    // FIX: Changed from dark #374151 to lighter Slate Grey #64748b
    // Now it stands out against the black floor.
    if (isBooked) return '#64748b'; 
    
    if (isSelected) return '#dc2626'; // Red
    if (hovered) return '#f59e0b';    // Gold
    if (seat.type === 'premium') return '#3b82f6'; // Blue
    return '#9ca3af'; // Light Grey (Standard)
  };

  return (
    <group position={position}>
      {/* Seat Cushion */}
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
        scale={hovered && !isBooked ? 1.05 : 1}
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          // Booked seats are matte (rough), others are slightly shiny
          roughness={isBooked ? 0.9 : 0.6}
          metalness={0.1}
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
          roughness={isBooked ? 0.9 : 0.6}
          metalness={0.1}
        />
      </RoundedBox>
      
      {/* Armrests - Made lighter to be visible */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </RoundedBox>
      
      {/* Seat Number */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.12}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]} 
      >
        {seat.number}
      </Text>
    </group>
  );
}

function Screen3D() {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Screen Mesh */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[24, 10]} />
        <meshBasicMaterial 
          color="#ffffff"
          toneMapped={false} 
        />
      </mesh>
      
      {/* Realistic Glow */}
      <pointLight position={[0, 0, 2]} intensity={1.5} distance={20} color="#bfdbfe" />
      
      {/* Frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[32, 18]} />
        <meshStandardMaterial 
          color="#020617"
          roughness={0.9}
        />
      </mesh>
      
      {/* Label on Wall */}
      <Text
        position={[0, -6.5, 0.1]}
        fontSize={0.8}
        color="#475569"
        anchorX="center"
        anchorY="middle"
      >
        SCREEN
      </Text>
    </group>
  );
}

// Restored Concrete Stadium Steps
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
          {/* Concrete Step */}
          <mesh position={[0, step.y, step.z]} receiveShadow>
            <boxGeometry args={[26, 0.4, 1.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          
          {/* Blue LED Strip */}
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[26, 0.02, 0.03]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TheaterEnvironment() {
  return (
    <group>
      {/* Dark Floor */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#020617" roughness={0.8} />
      </mesh>

      <StadiumSteps />
      
      {/* Projector Beam */}
      <group position={[0, 8, 18]} rotation={[0.15, 0, 0]}>
         <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
            <cylinderGeometry args={[0.1, 4, 20, 32, 1, true]} />
            <meshBasicMaterial 
                color="#bae6fd" 
                opacity={0.05} 
                transparent={true} 
                side={THREE.DoubleSide} 
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
         </mesh>
      </group>
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

  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

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
    <div className="relative w-full h-[700px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* UI Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        {viewingSeatId && (
          <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-lg animate-in fade-in zoom-in">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Viewing from selected seat</span>
          </div>
        )}
        <div className="pointer-events-auto">
             <Button 
              onClick={handleResetView}
              variant="outline"
              size="sm"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset View
            </Button>
        </div>
      </div>

      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          <div className="text-white font-medium animate-pulse">Loading Cinema...</div>
        </div>
      }>
        <Canvas
          shadows
          camera={{ position: [0, 8, 18], fov: 50 }}
          gl={{ antialias: true }}
        >
          <CameraController 
            target={cameraTarget} 
            isAnimating={isAnimating}
            onAnimationComplete={() => setIsAnimating(false)}
            controlsRef={controlsRef}
          />

          {/* Standard Realistic Lighting */}
          <ambientLight intensity={0.2} />
          <spotLight 
            position={[0, 20, 5]} 
            angle={0.5} 
            penumbra={1} 
            intensity={0.5} 
            castShadow 
          />

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
            target={[0, 1, -5]}
            enableDamping={true}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
