import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useState, useMemo, Suspense, lazy } from 'react';
import type { Seat } from '@/contexts/BookingContext';

// Lazy load postprocessing to avoid SSR issues
const EffectComposer = lazy(() => 
  import('@react-three/postprocessing').then(mod => ({ default: mod.EffectComposer }))
);
const Bloom = lazy(() => 
  import('@react-three/postprocessing').then(mod => ({ default: mod.Bloom }))
);

interface Theater3DProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
}

// Simple 3D Seat Component
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
      {/* Seat base */}
      <mesh
        onClick={() => !seat.isBooked && onClick(seat)}
        onPointerEnter={() => !seat.isBooked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        position={[0, 0, 0]}
        scale={hovered && !seat.isBooked ? 1.1 : 1}
      >
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.7}
        />
      </mesh>
      
      {/* Seat back - positioned toward positive Z so seat faces negative Z (toward screen) */}
      <mesh position={[0, 0.3, 0.3]}>
        <boxGeometry args={[0.8, 0.6, 0.1]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.7}
        />
      </mesh>
      
      {/* Seat number - on top of seat */}
      <Text
        position={[0, 0.15, 0]}
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

// Simple Screen with high emissive for bloom
function Screen3D() {
  return (
    <group position={[0, 3, -12]}>
      {/* Screen - high emissive intensity to trigger bloom */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial 
          color="#1e3a8a" 
          emissive="#60a5fa"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      
      {/* Frame */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial 
          color="#1f2937"
          roughness={0.3}
        />
      </mesh>
      
      {/* Screen label */}
      <Text
        position={[0, -8, 0.01]}
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

// Simple Theater Floor
function TheaterEnvironment() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[30, 0.2, 25]} />
        <meshStandardMaterial 
          color="#1f2937" 
          roughness={0.8}
        />
      </mesh>
      
      {/* Center aisle */}
      <mesh position={[0, -0.4, 2]}>
        <boxGeometry args={[1.5, 0.1, 15]} />
        <meshStandardMaterial 
          color="#4b5563" 
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}

// Main Theater3D Component
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
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
      // Row A (index 0) is closest to screen (negative Z), last row is furthest (positive Z)
      // Seats positioned at positive Z, screen at negative Z
      const rowZ = rowIndex * 1.2 + 2;
      // Add slight elevation for stadium seating effect (back rows higher)
      const rowY = rowIndex * 0.15;
      
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

  return (
    <div className="w-full h-[700px] bg-gradient-to-b from-slate-900 via-slate-800 to-black rounded-2xl overflow-hidden shadow-2xl">
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
            onClick={onSeatClick}
          />
        ))}

        {/* Camera Controls - positioned behind seats looking toward screen */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={30}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1, -5]}
          enableDamping={true}
          dampingFactor={0.05}
        />

        {/* Post-processing bloom effect - wrapped in Suspense for lazy loading */}
        <Suspense fallback={null}>
          <EffectComposer>
            <Bloom
              intensity={0.6}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.3}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
      </Suspense>
    </div>
  );
}