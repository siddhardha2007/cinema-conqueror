import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import { useState, useMemo, Suspense, useRef } from 'react';
import type { Seat } from '@/contexts/BookingContext';
import { Button } from '@/components/ui/button';
import { RotateCcw, Eye } from 'lucide-react';
import * as THREE from 'three';

interface Theater3DProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
}

interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

const DEFAULT_CAMERA: CameraTarget = {
  position: new THREE.Vector3(0, 8, 18),
  lookAt: new THREE.Vector3(0, 1, -5)
};

// Animated camera controller
function CameraController({ target, isAnimating, onAnimationComplete }: { 
  target: CameraTarget; 
  isAnimating: boolean;
  onAnimationComplete: () => void;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!isAnimating) return;
    
    progressRef.current = Math.min(progressRef.current + delta * 1.5, 1);
    const t = easeInOutCubic(progressRef.current);
    
    camera.position.lerp(target.position, t * 0.1);
    
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.add(camera.position);
    currentLookAt.lerp(target.lookAt, t * 0.1);
    camera.lookAt(currentLookAt);
    
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      onAnimationComplete();
    }
  });

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Simple 3D Seat Component with cushioned look
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

  const getSeatColor = () => {
    if (seat.isBooked) return '#374151';
    if (seat.isSelected) return '#dc2626';
    if (hovered) return '#f59e0b';
    
    if (seat.type === 'premium') return '#3b82f6';
    return '#6b7280'; // regular seats
  };

  return (
    <group position={position} rotation={[0, 0, 0]}>
      {/* Seat cushion (base) - RoundedBox for soft look */}
      <RoundedBox
        args={[0.8, 0.15, 0.7]}
        radius={0.05}
        smoothness={4}
        onClick={() => !seat.isBooked && onClick(seat)}
        onPointerEnter={() => !seat.isBooked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        position={[0, 0.05, 0]}
        scale={hovered && !seat.isBooked ? 1.1 : 1}
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.85}
        />
      </RoundedBox>
      
      {/* Seat back cushion - RoundedBox for soft look */}
      <RoundedBox
        args={[0.8, 0.55, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.35, 0.32]}
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.85}
        />
      </RoundedBox>
      
      {/* Armrests */}
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[-0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.08, 0.15, 0.5]} radius={0.02} smoothness={2} position={[0.4, 0.15, 0.1]}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </RoundedBox>
      
      {/* Seat number - on top of seat */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.15}
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

// Screen at Z = -15, Y = 6 (Size: 24x10) - Vertical
function Screen3D() {
  return (
    <group position={[0, 6, -15]} rotation={[0, 0, 0]}>
      {/* Screen - bright emissive material (24x10) */}
      <mesh>
        <planeGeometry args={[24, 10]} />
        <meshBasicMaterial 
          color="#4a90d9"
          toneMapped={false}
        />
      </mesh>
      
      {/* Screen glow lights */}
      <pointLight position={[0, 0, 2]} intensity={3} distance={18} color="#60a5fa" />
      <pointLight position={[-10, 0, 2]} intensity={1.5} distance={12} color="#3b82f6" />
      <pointLight position={[10, 0, 2]} intensity={1.5} distance={12} color="#3b82f6" />
      
      {/* Screen backing frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[26, 12]} />
        <meshStandardMaterial 
          color="#0a0a14"
          roughness={0.95}
        />
      </mesh>
      
      {/* Screen label */}
      <Text
        position={[0, -6.5, 0.01]}
        fontSize={1}
        color="#9ca3af"
        anchorX="center"
        anchorY="middle"
      >
        SCREEN
      </Text>
    </group>
  );
}

// 8 Individual Step Meshes - Width 26, Height 0.4, Depth 1.2
function StadiumSteps() {
  const steps = useMemo(() => {
    const stepData = [];
    for (let i = 0; i < 8; i++) {
      // Step Position: Y = index * 0.3, Z = index * 1.2 + 2
      const stepY = i * 0.3;
      const stepZ = i * 1.2 + 2;
      stepData.push({ y: stepY, z: stepZ, index: i });
    }
    return stepData;
  }, []);

  return (
    <group>
      {steps.map((step) => (
        <group key={step.index}>
          {/* Step platform - Width 26, Height 0.4, Depth 1.2 */}
          <mesh position={[0, step.y, step.z]}>
            <boxGeometry args={[26, 0.4, 1.2]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
          </mesh>
          
          {/* Blue emissive strip at front edge - Height 0.02, at Z + 0.59 */}
          <mesh position={[0, step.y + 0.21, step.z + 0.59]}>
            <boxGeometry args={[26, 0.02, 0.04]} />
            <meshBasicMaterial color="#0ea5e9" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Projector Light Beam - pointing at screen center [0, 6, -15]
function ProjectorBeam() {
  // Calculate angle from projector at [0, 8, 20] to screen at [0, 6, -15]
  // Distance Z: 35, Height diff: -2
  const angleToScreen = Math.atan2(-2, -35); // pointing downward and forward
  
  return (
    <group position={[0, 8, 20]}>
      {/* Projector housing */}
      <mesh>
        <boxGeometry args={[1.5, 0.8, 1]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Projector lens */}
      <mesh position={[0, -0.1, -0.5]} rotation={[angleToScreen, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.3, 16]} />
        <meshStandardMaterial color="#1e3a5f" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Spotlight for actual light - pointing at screen center */}
      <spotLight
        position={[0, 0, 0]}
        target-position={[0, 6, -15]}
        angle={0.12}
        penumbra={0.3}
        intensity={2}
        distance={50}
        color="#e8e8ff"
      />
      
      {/* Visible light cone (dusty beam effect) - angled upward toward screen */}
      <mesh position={[0, -1, -17.5]} rotation={[angleToScreen + 0.05, 0, 0]}>
        <coneGeometry args={[4.5, 40, 32, 1, true]} />
        <meshBasicMaterial
          color="#8899cc"
          transparent
          opacity={0.025}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Aisle Floor Lights
function AisleLighting() {
  const minZ = 2;
  const maxZ = 7 * 1.2 + 2.5;
  const aisleLength = maxZ - minZ;

  return (
    <group>
      {/* Left aisle strip */}
      <mesh position={[-0.85, 0.01, (maxZ + minZ) / 2]}>
        <boxGeometry args={[0.08, 0.02, aisleLength]} />
        <meshBasicMaterial color="#0ea5e9" toneMapped={false} />
      </mesh>
      {/* Right aisle strip */}
      <mesh position={[0.85, 0.01, (maxZ + minZ) / 2]}>
        <boxGeometry args={[0.08, 0.02, aisleLength]} />
        <meshBasicMaterial color="#0ea5e9" toneMapped={false} />
      </mesh>
      
      {/* Glow lights for aisle */}
      <pointLight position={[-0.85, 0.3, (maxZ + minZ) / 2]} intensity={0.3} distance={4} color="#0ea5e9" />
      <pointLight position={[0.85, 0.3, (maxZ + minZ) / 2]} intensity={0.3} distance={4} color="#0ea5e9" />
    </group>
  );
}

// Open Stadium Environment with base floor
function TheaterEnvironment() {
  return (
    <group>
      {/* Main Base Floor - huge ground at Y = -1 */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[100, 0.1, 100]} />
        <meshStandardMaterial color="#020617" roughness={1} metalness={0} />
      </mesh>
      
      {/* Stadium steps */}
      <StadiumSteps />
      
      {/* Projector beam */}
      <ProjectorBeam />
      
      {/* Aisle lighting */}
      <AisleLighting />
    </group>
  );
}

// Main Theater3D Component
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(DEFAULT_CAMERA);
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingFromSeat, setViewingFromSeat] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);

  // Group seats by row for positioning
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
      // Seat Z: rowIndex * 1.2 + 2 (Center of the step)
      const rowZ = rowIndex * 1.2 + 2;
      // Seat Y: (rowIndex * 0.3) + 0.3 (Step height + sitting offset)
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
    // Find the seat position
    const seatData = seatPositions.find(s => s.seat.id === seat.id);
    if (!seatData) return;

    // Animate camera to seat's eye level
    const [x, y, z] = seatData.position;
    setCameraTarget({
      position: new THREE.Vector3(x, y + 1.0, z),
      lookAt: new THREE.Vector3(0, 6, -15) // Look at the screen
    });
    setIsAnimating(true);
    setViewingFromSeat(`${seat.row}${seat.number}`);

    // Also trigger the original onSeatClick for selection logic
    onSeatClick(seat);
  };

  const handleResetView = () => {
    setCameraTarget(DEFAULT_CAMERA);
    setIsAnimating(true);
    setViewingFromSeat(null);
    
    // Reset OrbitControls target
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 1, -5);
    }
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
  };

  return (
    <div className="relative w-full h-[700px] bg-gradient-to-b from-slate-900 via-slate-800 to-black rounded-2xl overflow-hidden shadow-2xl">
      {/* View controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {viewingFromSeat && (
          <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg flex items-center gap-2">
            <Eye className="w-4 h-4 text-cinema-gold" />
            <span className="text-sm">Viewing from seat {viewingFromSeat}</span>
          </div>
        )}
        <Button 
          onClick={handleResetView}
          variant="outline"
          size="sm"
          className="bg-black/70 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
      </div>

      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cinema-gold mx-auto mb-4"></div>
            <p className="text-white">Loading 3D Theater...</p>
          </div>
        </div>
      }>
        <Canvas
          camera={{ position: [0, 8, 18], fov: 50 }}
          style={{ background: '#0f172a' }}
        >
          {/* Camera animation controller */}
          <CameraController 
            target={cameraTarget} 
            isAnimating={isAnimating}
            onAnimationComplete={handleAnimationComplete}
          />

          {/* Simple Lighting Setup */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[0, 10, 5]} intensity={1} />
          <pointLight position={[0, 5, -10]} intensity={0.8} color="#3b82f6" />

          {/* 3D Components */}
          <Screen3D />
          <TheaterEnvironment />
          
          {/* Render all seats */}
          {seatPositions.map(({ seat, position }) => (
            <Seat3D
              key={seat.id}
              seat={seat}
              position={position}
              onClick={handleSeatClick}
            />
          ))}

          {/* Camera Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={30}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 1, -5]}
            enableDamping={true}
            dampingFactor={0.05}
          />

        </Canvas>
      </Suspense>
    </div>
  );
}