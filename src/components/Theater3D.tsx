import React, { useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button'; // Ensure you have this component or replace with standard <button>
import { RotateCcw, Eye } from 'lucide-react';

// --- Types ---
// Ideally, import this from your types definition file
export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'booked' | 'selected';
  type: 'standard' | 'premium';
  price: number;
  isBooked?: boolean;   // Legacy support if your data uses this
  isSelected?: boolean; // Legacy support
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

const SCREEN_Z = -15; // Pushed back for depth
const SCREEN_Y = 6;   // Elevated for stadium view

// --- Helper Functions ---
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Components ---

/**
 * Animated Camera Controller
 * Fixes the "Snap Back" bug by updating OrbitControls target during animation.
 */
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
    
    // Animation speed
    progressRef.current = Math.min(progressRef.current + delta * 1.5, 1);
    const t = easeInOutCubic(progressRef.current);
    
    // 1. Interpolate Camera Position
    camera.position.lerp(target.position, t * 0.1);
    
    // 2. Interpolate OrbitControls Target (Critical Fix)
    // We must move the pivot point of the controls so it doesn't snap back
    if (controlsRef.current) {
        const currentTarget = controlsRef.current.target;
        currentTarget.lerp(target.lookAt, t * 0.1);
        controlsRef.current.update();
    }

    // End animation
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      onAnimationComplete();
    }
  });

  return null;
}

/**
 * Individual Seat Component
 * Uses RoundedBox for realism and smooth hover effects.
 */
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
    if (isBooked) return '#374151'; // Dark Grey
    if (isSelected) return '#dc2626'; // Red
    if (hovered) return '#f59e0b'; // Amber/Gold
    if (seat.type === 'premium') return '#3b82f6'; // Blue
    return '#6b7280'; // Grey (Standard)
  };

  return (
    <group position={position}>
      {/* Seat Cushion (Base) */}
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
          roughness={0.8}
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
          roughness={0.8}
          metalness={0.1}
        />
      </RoundedBox>
      
      {/* Armrests */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </RoundedBox>
      
      {/* Seat Number */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.12}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]} // Flat on seat
      >
        {seat.number}
      </Text>
    </group>
  );
}

/**
 * Screen Wall Component
 * Pushed back to Z = -15 for correct scale.
 */
function Screen3D() {
  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* The Actual Screen (Emissive) */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[24, 10]} />
        <meshBasicMaterial 
          color="#ffffff"
          toneMapped={false} 
        />
      </mesh>
      
      {/* Glow Lights for Bloom Effect */}
      <pointLight position={[0, 0, 2]} intensity={2} distance={20} color="#a5f3fc" />
      
      {/* Screen Frame/Wall */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[32, 18]} />
        <meshStandardMaterial 
          color="#020617"
          roughness={0.9}
        />
      </mesh>
      
      {/* Screen Label (Corrected Position: below screen, on wall) */}
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

/**
 * Stadium Steps Component
 * Generates the physical steps and the integrated aisle lights.
 */
function StadiumSteps() {
  // Generate 8 steps
  const steps = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      // Logic: Start at Z=2, move back 1.2 per row
      z: i * 1.2 + 2,
      // Logic: Start at Y=0, move up 0.3 per row
      y: i * 0.3
    }));
  }, []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          {/* Concrete Step Block */}
          <mesh position={[0, step.y, step.z]} receiveShadow>
            <boxGeometry args={[26, 0.4, 1.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          
          {/* Integrated Aisle Light Strip (Blue) */}
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[26, 0.02, 0.03]} />
            <meshBasicMaterial color="#3b82f6" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Environment Component
 * Includes the base floor, projector beam, and volumetric fog hints.
 */
function TheaterEnvironment() {
  return (
    <group>
      {/* 1. Base Ground Floor (Catches Shadows) */}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#020617" roughness={0.8} />
      </mesh>

      {/* 2. Stadium Steps */}
      <StadiumSteps />
      
      {/* 3. Projector Beam Simulation */}
      <group position={[0, 8, 18]} rotation={[0.15, 0, 0]}>
         {/* Simple Cone for Light Beam */}
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

  // Group seats by row for easier calculations
  const seatsByRow = useMemo(() => {
    return seats.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  // Calculate precise 3D positions for every seat
  const seatPositions = useMemo(() => {
    const positions: Array<{ seat: Seat; position: [number, number, number] }> = [];
    const rows = Object.keys(seatsByRow).sort();
    
    rows.forEach((rowLetter, rowIndex) => {
      const rowSeats = seatsByRow[rowLetter].sort((a, b) => a.number - b.number);
      
      // SYNC LOGIC: Must match StadiumSteps generation
      const rowZ = rowIndex * 1.2 + 2; 
      // SYNC LOGIC: Step height (rowIndex * 0.3) + Seat Offset (0.3)
      const rowY = (rowIndex * 0.3) + 0.3;
      
      rowSeats.forEach((seat, seatIndex) => {
        // center the seats in the row
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
    // 1. Trigger selection logic
    onSeatClick(seat);

    // 2. Animate Camera to Seat View
    const seatData = seatPositions.find(s => s.seat.id === seat.id);
    if (seatData) {
      const [x, y, z] = seatData.position;
      setCameraTarget({
        position: new THREE.Vector3(x, y + 0.8, z), // Eye level
        lookAt: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z) // Look at screen center
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
      
      {/* UI Overlay */}
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
          {/* Logic */}
          <CameraController 
            target={cameraTarget} 
            isAnimating={isAnimating}
            onAnimationComplete={() => setIsAnimating(false)}
            controlsRef={controlsRef}
          />

          {/* Lights */}
          <ambientLight intensity={0.2} />
          <spotLight 
            position={[0, 20, 5]} 
            angle={0.5} 
            penumbra={1} 
            intensity={0.5} 
            castShadow 
          />

          {/* Scene */}
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

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={35}
            maxPolarAngle={Math.PI / 2.1} // Stop going under the floor
            target={[0, 1, -5]}
            enableDamping={true}
            dampingFactor={0.05}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
