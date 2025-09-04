import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Plane } from '@react-three/drei';
import { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Seat } from '@/contexts/BookingContext';

interface Theater3DProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
}

// 3D Seat Component
function Seat3D({ 
  seat, 
  position, 
  onClick 
}: { 
  seat: Seat; 
  position: [number, number, number]; 
  onClick: (seat: Seat) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation for selected seats
      if (seat.isSelected) {
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      } else {
        meshRef.current.position.y = position[1];
      }
      
      // Scale animation on hover
      const targetScale = hovered && !seat.isBooked ? 1.1 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const getSeatColor = () => {
    if (seat.isBooked) return '#666666';
    if (seat.isSelected) return '#dc2626'; // cinema-red
    if (hovered && !seat.isBooked) return '#fbbf24'; // hover gold
    
    switch (seat.type) {
      case 'vip': return '#f59e0b'; // cinema-gold
      case 'premium': return '#3b82f6'; // primary blue
      default: return '#374151'; // default gray
    }
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => !seat.isBooked && onClick(seat)}
        onPointerEnter={() => !seat.isBooked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {/* Seat base */}
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color={getSeatColor()} />
      </mesh>
      
      {/* Seat back */}
      <mesh position={[0, 0.3, -0.3]}>
        <boxGeometry args={[0.8, 0.6, 0.1]} />
        <meshStandardMaterial color={getSeatColor()} />
      </mesh>
      
      {/* Seat number */}
      <Text
        position={[0, 0.15, 0.41]}
        fontSize={0.15}
        color={seat.isBooked ? '#999' : '#fff'}
        anchorX="center"
        anchorY="middle"
      >
        {seat.number}
      </Text>
    </group>
  );
}

// 3D Screen Component
function Screen3D() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle glow animation
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group position={[0, 2, -8]}>
      {/* Main screen */}
      <mesh ref={meshRef}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          emissive="#333333"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Screen frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[17, 10]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      
      {/* "SCREEN" text */}
      <Text
        position={[0, -5.5, 0.01]}
        fontSize={0.8}
        color="#f59e0b"
        anchorX="center"
        anchorY="middle"
      >
        SCREEN
      </Text>
    </group>
  );
}

// Stage/Floor Component
function Stage3D() {
  return (
    <group>
      {/* Main floor */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[20, 0.2, 16]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      
      {/* Stage area */}
      <mesh position={[0, -0.3, -7]} receiveShadow>
        <boxGeometry args={[18, 0.4, 3]} />
        <meshStandardMaterial color="#1a1a1a" />
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
      const rowZ = (rows.length - 1 - rowIndex) * 1.2 - 2; // Front rows have lower Z values
      
      rowSeats.forEach((seat, seatIndex) => {
        const seatX = (seatIndex - (rowSeats.length - 1) / 2) * 1.0;
        positions.push({
          seat,
          position: [seatX, 0, rowZ]
        });
      });
    });
    
    return positions;
  }, [seatsByRow]);

  return (
    <div className="w-full h-[600px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [0, 8, 8], fov: 60 }}
        shadows
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 10, 0]} intensity={0.8} castShadow />
        <pointLight position={[0, 5, -8]} intensity={0.5} color="#f59e0b" />
        <directionalLight
          position={[5, 10, 5]}
          intensity={0.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* 3D Scene Components */}
        <Screen3D />
        <Stage3D />
        
        {/* Render all seats */}
        {seatPositions.map(({ seat, position }) => (
          <Seat3D
            key={seat.id}
            seat={seat}
            position={position}
            onClick={onSeatClick}
          />
        ))}

        {/* Camera Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={15}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  );
}