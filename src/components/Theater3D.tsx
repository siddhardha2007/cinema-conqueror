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

// 3D Screen Component with Theater Curtains
function Screen3D() {
  const meshRef = useRef<THREE.Mesh>(null);
  const curtainLeftRef = useRef<THREE.Mesh>(null);
  const curtainRightRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle glow animation
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    
    // Gentle curtain movement
    if (curtainLeftRef.current && curtainRightRef.current) {
      const sway = Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
      curtainLeftRef.current.rotation.y = sway;
      curtainRightRef.current.rotation.y = -sway;
    }
  });

  return (
    <group position={[0, 2, -10]}>
      {/* Theater curtains */}
      <mesh ref={curtainLeftRef} position={[-9, 0, 0.5]}>
        <planeGeometry args={[2, 12]} />
        <meshStandardMaterial color="#8b0000" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={curtainRightRef} position={[9, 0, 0.5]}>
        <planeGeometry args={[2, 12]} />
        <meshStandardMaterial color="#8b0000" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Main screen */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
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
      
      {/* Decorative screen border */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[18, 11]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      
      {/* "SCREEN" text */}
      <Text
        position={[0, -6.5, 0.01]}
        fontSize={1}
        color="#f59e0b"
        anchorX="center"
        anchorY="middle"
      >
        SCREEN
      </Text>
      
      {/* Theater speakers */}
      <mesh position={[-10, -2, 0.3]}>
        <boxGeometry args={[1, 3, 1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[10, -2, 0.3]}>
        <boxGeometry args={[1, 3, 1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  );
}

// Theater Environment Component
function TheaterEnvironment() {
  return (
    <group>
      {/* Main floor with carpet texture */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[25, 0.2, 20]} />
        <meshStandardMaterial color="#1a0f0f" roughness={0.8} />
      </mesh>
      
      {/* Stage area */}
      <mesh position={[0, -0.3, -9]} receiveShadow>
        <boxGeometry args={[22, 0.4, 4]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      
      {/* Theater Walls */}
      {/* Left wall */}
      <mesh position={[-12, 3, 0]}>
        <boxGeometry args={[0.5, 8, 20]} />
        <meshStandardMaterial color="#2d1b1b" />
      </mesh>
      
      {/* Right wall */}
      <mesh position={[12, 3, 0]}>
        <boxGeometry args={[0.5, 8, 20]} />
        <meshStandardMaterial color="#2d1b1b" />
      </mesh>
      
      {/* Back wall */}
      <mesh position={[0, 3, 10]}>
        <boxGeometry args={[25, 8, 0.5]} />
        <meshStandardMaterial color="#2d1b1b" />
      </mesh>
      
      {/* Ceiling */}
      <mesh position={[0, 7, 0]}>
        <boxGeometry args={[25, 0.3, 20]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Aisles */}
      {/* Center aisle */}
      <mesh position={[0, -0.45, 2]} receiveShadow>
        <boxGeometry args={[1.5, 0.1, 12]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
      
      {/* Side aisles */}
      <mesh position={[-8, -0.45, 2]} receiveShadow>
        <boxGeometry args={[1, 0.1, 12]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
      <mesh position={[8, -0.45, 2]} receiveShadow>
        <boxGeometry args={[1, 0.1, 12]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
      
      {/* Exit Signs */}
      <group position={[-11, 5, 8]}>
        <mesh>
          <boxGeometry args={[1.5, 0.5, 0.1]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          EXIT
        </Text>
      </group>
      
      <group position={[11, 5, 8]}>
        <mesh>
          <boxGeometry args={[1.5, 0.5, 0.1]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          EXIT
        </Text>
      </group>
      
      {/* Emergency lighting strips */}
      <mesh position={[-11.8, 0.5, 2]}>
        <boxGeometry args={[0.1, 0.1, 12]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[11.8, 0.5, 2]}>
        <boxGeometry args={[0.1, 0.1, 12]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.2} />
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
        {/* Advanced Theater Lighting */}
        <ambientLight intensity={0.15} color="#1a0f0f" />
        
        {/* Screen lighting */}
        <pointLight position={[0, 5, -10]} intensity={1.2} color="#f59e0b" castShadow />
        
        {/* Ceiling spotlights */}
        <spotLight
          position={[-6, 6, 2]}
          intensity={0.4}
          angle={Math.PI / 6}
          penumbra={0.5}
          color="#ffaa00"
          castShadow
        />
        <spotLight
          position={[6, 6, 2]}
          intensity={0.4}
          angle={Math.PI / 6}
          penumbra={0.5}
          color="#ffaa00"
          castShadow
        />
        <spotLight
          position={[0, 6, 6]}
          intensity={0.3}
          angle={Math.PI / 4}
          penumbra={0.8}
          color="#ff6600"
          castShadow
        />
        
        {/* Exit sign lighting */}
        <pointLight position={[-11, 5, 8]} intensity={0.3} color="#ff0000" />
        <pointLight position={[11, 5, 8]} intensity={0.3} color="#ff0000" />
        
        {/* Emergency floor lighting */}
        <pointLight position={[-11.5, 0.5, 2]} intensity={0.2} color="#00ff00" />
        <pointLight position={[11.5, 0.5, 2]} intensity={0.2} color="#00ff00" />
        
        {/* Atmospheric rim lighting */}
        <directionalLight
          position={[0, 8, 12]}
          intensity={0.2}
          color="#4a4a4a"
        />

        {/* 3D Scene Components */}
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