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
    if (seat.isBooked) return '#4a4a4a';
    if (seat.isSelected) return '#dc2626'; // cinema-red
    if (hovered && !seat.isBooked) return '#f59e0b'; // hover gold
    
    switch (seat.type) {
      case 'vip': return '#d4af37'; // Premium gold
      case 'premium': return '#6366f1'; // Premium indigo
      default: return '#7c3aed'; // Premium purple
    }
  };

  return (
    <group position={position}>
      {/* Seat base with luxury padding */}
      <mesh
        ref={meshRef}
        onClick={() => !seat.isBooked && onClick(seat)}
        onPointerEnter={() => !seat.isBooked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        position={[0, 0.05, 0]}
      >
        <boxGeometry args={[0.9, 0.15, 0.9]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Seat back with curved design */}
      <mesh position={[0, 0.4, -0.35]}>
        <boxGeometry args={[0.9, 0.7, 0.15]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Armrests */}
      <mesh position={[-0.5, 0.25, -0.1]}>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color={getSeatColor()} roughness={0.4} />
      </mesh>
      <mesh position={[0.5, 0.25, -0.1]}>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color={getSeatColor()} roughness={0.4} />
      </mesh>
      
      {/* Seat number with better styling */}
      <Text
        position={[0, 0.2, 0.46]}
        fontSize={0.12}
        color={seat.isBooked ? '#888' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {seat.number}
      </Text>
      
      {/* Selection glow effect */}
      {seat.isSelected && (
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.1, 0.2, 1.1]} />
          <meshStandardMaterial 
            color="#dc2626" 
            transparent 
            opacity={0.3}
            emissive="#dc2626"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
    </group>
  );
}

// Luxury 3D Screen Component
function Screen3D() {
  const meshRef = useRef<THREE.Mesh>(null);
  const curtainLeftRef = useRef<THREE.Mesh>(null);
  const curtainRightRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Cinematic screen glow
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
    
    // Elegant curtain movement
    if (curtainLeftRef.current && curtainRightRef.current) {
      const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.01;
      curtainLeftRef.current.position.x = -9.5 + sway;
      curtainRightRef.current.position.x = 9.5 - sway;
    }
  });

  return (
    <group position={[0, 2.5, -11]}>
      {/* Luxury velvet curtains */}
      <mesh ref={curtainLeftRef} position={[-9.5, 0, 1]}>
        <planeGeometry args={[3, 14]} />
        <meshStandardMaterial 
          color="#8b0000" 
          roughness={0.8}
          metalness={0.1}
          side={THREE.DoubleSide} 
        />
      </mesh>
      <mesh ref={curtainRightRef} position={[9.5, 0, 1]}>
        <planeGeometry args={[3, 14]} />
        <meshStandardMaterial 
          color="#8b0000" 
          roughness={0.8}
          metalness={0.1}
          side={THREE.DoubleSide} 
        />
      </mesh>
      
      {/* Premium screen with cinematic glow */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[18, 10]} />
        <meshStandardMaterial 
          color="#0a0a0a" 
          emissive="#1a4b8c"
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      
      {/* Elegant golden frame */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial 
          color="#d4af37"
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      
      {/* Outer decorative frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[21, 13]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Cinema branding */}
      <Text
        position={[0, -7.5, 0.01]}
        fontSize={1.2}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        CINEMA DELUXE
      </Text>
      
      {/* Premium sound system */}
      <mesh position={[-12, -1, 0.5]}>
        <boxGeometry args={[1.5, 4, 1.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[12, -1, 0.5]}>
        <boxGeometry args={[1.5, 4, 1.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

// Luxury Theater Environment
function TheaterEnvironment() {
  return (
    <group>
      {/* Premium marble floor */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[30, 0.3, 25]} />
        <meshStandardMaterial 
          color="#2c1810" 
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      
      {/* Elevated stage platform */}
      <mesh position={[0, -0.2, -10]} receiveShadow>
        <boxGeometry args={[25, 0.6, 5]} />
        <meshStandardMaterial 
          color="#1a1008" 
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      
      {/* Luxury theater walls with fabric texture */}
      <mesh position={[-15, 4, 0]}>
        <boxGeometry args={[0.8, 10, 25]} />
        <meshStandardMaterial 
          color="#4a2c2c" 
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[15, 4, 0]}>
        <boxGeometry args={[0.8, 10, 25]} />
        <meshStandardMaterial 
          color="#4a2c2c" 
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      
      {/* Acoustic panels on back wall */}
      <mesh position={[0, 4, 12]}>
        <boxGeometry args={[30, 10, 0.8]} />
        <meshStandardMaterial 
          color="#3a2020" 
          roughness={0.8}
        />
      </mesh>
      
      {/* Coffered ceiling with ambient lighting */}
      <mesh position={[0, 9, 0]}>
        <boxGeometry args={[30, 0.5, 25]} />
        <meshStandardMaterial 
          color="#2a1810" 
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      
      {/* Luxury carpet aisles */}
      <mesh position={[0, -0.4, 2]} receiveShadow>
        <boxGeometry args={[2, 0.15, 15]} />
        <meshStandardMaterial 
          color="#5d1a1a" 
          roughness={0.9}
        />
      </mesh>
      
      {/* Side aisles with premium carpet */}
      <mesh position={[-10, -0.4, 2]} receiveShadow>
        <boxGeometry args={[1.5, 0.15, 15]} />
        <meshStandardMaterial 
          color="#5d1a1a" 
          roughness={0.9}
        />
      </mesh>
      <mesh position={[10, -0.4, 2]} receiveShadow>
        <boxGeometry args={[1.5, 0.15, 15]} />
        <meshStandardMaterial 
          color="#5d1a1a" 
          roughness={0.9}
        />
      </mesh>
      
      {/* Elegant exit signs with soft glow */}
      <group position={[-14, 6, 10]}>
        <mesh>
          <boxGeometry args={[2, 0.8, 0.2]} />
          <meshStandardMaterial 
            color="#ff4444" 
            emissive="#ff2222"
            emissiveIntensity={0.5}
            roughness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.11]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          EXIT
        </Text>
      </group>
      
      <group position={[14, 6, 10]}>
        <mesh>
          <boxGeometry args={[2, 0.8, 0.2]} />
          <meshStandardMaterial 
            color="#ff4444" 
            emissive="#ff2222"
            emissiveIntensity={0.5}
            roughness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.11]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          EXIT
        </Text>
      </group>
      
      {/* Ambient LED strips */}
      <mesh position={[-14.5, 1, 2]}>
        <boxGeometry args={[0.2, 0.2, 15]} />
        <meshStandardMaterial 
          color="#4169e1" 
          emissive="#4169e1"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[14.5, 1, 2]}>
        <boxGeometry args={[0.2, 0.2, 15]} />
        <meshStandardMaterial 
          color="#4169e1" 
          emissive="#4169e1"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Decorative ceiling beams */}
      <mesh position={[-8, 8.5, 0]}>
        <boxGeometry args={[1, 0.8, 25]} />
        <meshStandardMaterial color="#3a2818" roughness={0.6} />
      </mesh>
      <mesh position={[8, 8.5, 0]}>
        <boxGeometry args={[1, 0.8, 25]} />
        <meshStandardMaterial color="#3a2818" roughness={0.6} />
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
    <div className="w-full h-[700px] bg-gradient-to-b from-slate-900 via-slate-800 to-black rounded-2xl overflow-hidden shadow-2xl">
      <Canvas
        camera={{ position: [0, 12, 12], fov: 50 }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        style={{ background: 'linear-gradient(to bottom, #0f172a, #000000)' }}
      >
        {/* Cinematic Lighting Setup */}
        <ambientLight intensity={0.2} color="#1a1a2e" />
        
        {/* Key screen lighting */}
        <spotLight
          position={[0, 8, -11]}
          intensity={2}
          angle={Math.PI / 3}
          penumbra={0.5}
          color="#4169e1"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        
        {/* Dramatic ceiling spots */}
        <spotLight
          position={[-8, 8, 2]}
          intensity={0.8}
          angle={Math.PI / 4}
          penumbra={0.7}
          color="#d4af37"
          castShadow
        />
        <spotLight
          position={[8, 8, 2]}
          intensity={0.8}
          angle={Math.PI / 4}
          penumbra={0.7}
          color="#d4af37"
          castShadow
        />
        
        {/* Audience area mood lighting */}
        <spotLight
          position={[0, 8, 8]}
          intensity={0.4}
          angle={Math.PI / 3}
          penumbra={1}
          color="#8b5a2b"
          castShadow
        />
        
        {/* Rim lighting for depth */}
        <directionalLight
          position={[0, 12, 15]}
          intensity={0.3}
          color="#6366f1"
        />
        
        {/* Ambient LED strip effects */}
        <pointLight position={[-14, 1, 2]} intensity={0.5} color="#4169e1" />
        <pointLight position={[14, 1, 2]} intensity={0.5} color="#4169e1" />
        
        {/* Exit sign illumination */}
        <pointLight position={[-14, 6, 10]} intensity={0.4} color="#ff4444" />
        <pointLight position={[14, 6, 10]} intensity={0.4} color="#ff4444" />

        {/* Luxury 3D Components */}
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

        {/* Premium Camera Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={25}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2}
          target={[0, 2, 0]}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}