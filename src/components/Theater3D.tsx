import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Plane } from '@react-three/drei';
import { useState, useRef, useMemo, Suspense } from 'react';
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
  const projectorLightRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Dynamic cinematic screen glow with movie simulation
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 0.8) * 0.4;
      
      // Subtle screen flicker effect
      material.color.setHSL(0.6, 0.8, 0.1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.05);
    }
    
    // Elegant curtain movement
    if (curtainLeftRef.current && curtainRightRef.current) {
      const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.02;
      curtainLeftRef.current.position.x = -11.5 + sway;
      curtainRightRef.current.position.x = 11.5 - sway;
    }

    // Projector light beam animation
    if (projectorLightRef.current) {
      const intensity = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      projectorLightRef.current.scale.y = intensity;
    }
  });

  return (
    <group position={[0, 3, -12]}>
      {/* Massive IMAX-style screen */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[24, 14]} />
        <meshStandardMaterial 
          color="#0f1419" 
          emissive="#2563eb"
          emissiveIntensity={0.6}
          roughness={0.05}
          metalness={0.2}
        />
      </mesh>
      
      {/* Movie content simulation - flickering colors */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[23.5, 13.5]} />
        <meshStandardMaterial 
          color="#1e293b" 
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Premium decorative frame with art deco design */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[26, 16]} />
        <meshStandardMaterial 
          color="#d4af37"
          roughness={0.1}
          metalness={0.9}
          emissive="#fbbf24"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Outer architectural frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial 
          color="#0f172a" 
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      
      {/* Luxury velvet curtains with tassels */}
      <mesh ref={curtainLeftRef} position={[-11.5, 0, 1]}>
        <planeGeometry args={[4, 18]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
          emissive="#991b1b"
          emissiveIntensity={0.1}
        />
      </mesh>
      <mesh ref={curtainRightRef} position={[11.5, 0, 1]}>
        <planeGeometry args={[4, 18]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
          emissive="#991b1b"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Projector light beam effect */}
      <mesh ref={projectorLightRef} position={[0, 0, 6]}>
        <coneGeometry args={[0.5, 12, 8]} />
        <meshStandardMaterial 
          color="#ffffff"
          transparent
          opacity={0.1}
          emissive="#ffffff"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Premium sound system speakers */}
      <mesh position={[-15, -2, 0.5]}>
        <boxGeometry args={[2, 6, 2]} />
        <meshStandardMaterial 
          color="#0f172a" 
          roughness={0.2}
          metalness={0.8}
          emissive="#1e293b"
          emissiveIntensity={0.1}
        />
      </mesh>
      <mesh position={[15, -2, 0.5]}>
        <boxGeometry args={[2, 6, 2]} />
        <meshStandardMaterial 
          color="#0f172a" 
          roughness={0.2}
          metalness={0.8}
          emissive="#1e293b"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Subwoofers */}
      <mesh position={[-15, -6, 1]}>
        <boxGeometry args={[3, 2, 2]} />
        <meshStandardMaterial color="#000000" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[15, -6, 1]}>
        <boxGeometry args={[3, 2, 2]} />
        <meshStandardMaterial color="#000000" roughness={0.1} metalness={0.9} />
      </mesh>
      
      {/* Cinema branding with glow */}
      <Text
        position={[0, -10, 0.01]}
        fontSize={1.5}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        IMAX DELUXE THEATER
      </Text>
      
      {/* Atmospheric lighting strips around screen */}
      <mesh position={[0, 9, 0.02]}>
        <boxGeometry args={[26, 0.3, 0.1]} />
        <meshStandardMaterial 
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, -9, 0.02]}>
        <boxGeometry args={[26, 0.3, 0.1]} />
        <meshStandardMaterial 
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[-13, 0, 0.02]}>
        <boxGeometry args={[0.3, 16, 0.1]} />
        <meshStandardMaterial 
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[13, 0, 0.02]}>
        <boxGeometry args={[0.3, 16, 0.1]} />
        <meshStandardMaterial 
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

// Luxury Theater Environment with Enhanced Lighting
function TheaterEnvironment() {
  const floorLightRef = useRef<THREE.Mesh>(null);
  const ceilingLightRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    // Animated floor lighting
    if (floorLightRef.current) {
      const material = floorLightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    
    // Pulsing ceiling lights
    if (ceilingLightRef.current) {
      const material = ceilingLightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    }
  });

  return (
    <group>
      {/* Premium illuminated marble floor */}
      <mesh ref={floorLightRef} position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[30, 0.3, 25]} />
        <meshStandardMaterial 
          color="#8b7355" 
          roughness={0.1}
          metalness={0.3}
          emissive="#d4af37"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Glowing floor patterns */}
      <mesh position={[0, -0.35, 0]}>
        <planeGeometry args={[28, 23]} />
        <meshStandardMaterial 
          color="#1e293b"
          emissive="#3b82f6"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Elevated stage platform with glow */}
      <mesh position={[0, -0.2, -10]} receiveShadow>
        <boxGeometry args={[25, 0.6, 5]} />
        <meshStandardMaterial 
          color="#4a3728" 
          roughness={0.2}
          metalness={0.4}
          emissive="#fbbf24"
          emissiveIntensity={0.15}
        />
      </mesh>
      
      {/* Luxury theater walls with ambient glow */}
      <mesh position={[-15, 4, 0]}>
        <boxGeometry args={[0.8, 10, 25]} />
        <meshStandardMaterial 
          color="#7c3aed" 
          roughness={0.7}
          metalness={0.1}
          emissive="#8b5cf6"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[15, 4, 0]}>
        <boxGeometry args={[0.8, 10, 25]} />
        <meshStandardMaterial 
          color="#7c3aed" 
          roughness={0.7}
          metalness={0.1}
          emissive="#8b5cf6"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Acoustic panels with subtle lighting */}
      <mesh position={[0, 4, 12]}>
        <boxGeometry args={[30, 10, 0.8]} />
        <meshStandardMaterial 
          color="#6366f1" 
          roughness={0.8}
          emissive="#4338ca"
          emissiveIntensity={0.15}
        />
      </mesh>
      
      {/* Illuminated coffered ceiling */}
      <mesh ref={ceilingLightRef} position={[0, 9, 0]}>
        <boxGeometry args={[30, 0.5, 25]} />
        <meshStandardMaterial 
          color="#4338ca" 
          roughness={0.3}
          metalness={0.2}
          emissive="#6366f1"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Ceiling light panels */}
      <mesh position={[-8, 8.8, 0]}>
        <boxGeometry args={[4, 0.2, 6]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[8, 8.8, 0]}>
        <boxGeometry args={[4, 0.2, 6]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 8.8, -8]}>
        <boxGeometry args={[4, 0.2, 6]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 8.8, 8]}>
        <boxGeometry args={[4, 0.2, 6]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>
      
      {/* Luxury glowing carpet aisles */}
      <mesh position={[0, -0.4, 2]} receiveShadow>
        <boxGeometry args={[2, 0.15, 15]} />
        <meshStandardMaterial 
          color="#dc2626" 
          roughness={0.9}
          emissive="#ef4444"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Side aisles with premium carpet glow */}
      <mesh position={[-10, -0.4, 2]} receiveShadow>
        <boxGeometry args={[1.5, 0.15, 15]} />
        <meshStandardMaterial 
          color="#dc2626" 
          roughness={0.9}
          emissive="#ef4444"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[10, -0.4, 2]} receiveShadow>
        <boxGeometry args={[1.5, 0.15, 15]} />
        <meshStandardMaterial 
          color="#dc2626" 
          roughness={0.9}
          emissive="#ef4444"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Enhanced exit signs with bright glow */}
      <group position={[-14, 6, 10]}>
        <mesh>
          <boxGeometry args={[2.5, 1, 0.3]} />
          <meshStandardMaterial 
            color="#22c55e" 
            emissive="#16a34a"
            emissiveIntensity={0.8}
            roughness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.16]}
          fontSize={0.4}
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
          <boxGeometry args={[2.5, 1, 0.3]} />
          <meshStandardMaterial 
            color="#22c55e" 
            emissive="#16a34a"
            emissiveIntensity={0.8}
            roughness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0, 0.16]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          EXIT
        </Text>
      </group>
      
      {/* Enhanced ambient LED strips */}
      <mesh position={[-14.5, 1, 2]}>
        <boxGeometry args={[0.3, 0.3, 15]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          emissive="#2563eb"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[14.5, 1, 2]}>
        <boxGeometry args={[0.3, 0.3, 15]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          emissive="#2563eb"
          emissiveIntensity={0.6}
        />
      </mesh>
      
      {/* Floor LED strips for guidance */}
      <mesh position={[-1, -0.4, 2]}>
        <boxGeometry args={[0.1, 0.1, 15]} />
        <meshStandardMaterial 
          color="#f59e0b" 
          emissive="#f59e0b"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[1, -0.4, 2]}>
        <boxGeometry args={[0.1, 0.1, 15]} />
        <meshStandardMaterial 
          color="#f59e0b" 
          emissive="#f59e0b"
          emissiveIntensity={0.8}
        />
      </mesh>
      
      {/* Decorative glowing ceiling beams */}
      <mesh position={[-8, 8.5, 0]}>
        <boxGeometry args={[1, 0.8, 25]} />
        <meshStandardMaterial 
          color="#6366f1" 
          roughness={0.6}
          emissive="#4338ca"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[8, 8.5, 0]}>
        <boxGeometry args={[1, 0.8, 25]} />
        <meshStandardMaterial 
          color="#6366f1" 
          roughness={0.6}
          emissive="#4338ca"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Atmospheric fog/mist effects using planes */}
      <mesh position={[0, 1, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25, 15]} />
        <meshStandardMaterial 
          color="#1e293b"
          transparent
          opacity={0.1}
          emissive="#3b82f6"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Corner accent lighting */}
      <mesh position={[-14, 1, -10]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial 
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[14, 1, -10]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial 
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[-14, 1, 10]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial 
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[14, 1, 10]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial 
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
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
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cinema-gold mx-auto mb-4"></div>
            <p className="text-white">Loading 3D Theater...</p>
          </div>
        </div>
      }>
        <Canvas
        camera={{ position: [0, 12, 12], fov: 50 }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        style={{ background: 'linear-gradient(to bottom, #0f172a, #000000)' }}
      >
        {/* Enhanced Cinematic Lighting Setup */}
        <ambientLight intensity={0.4} color="#e0e7ff" />
        
        {/* Key screen lighting with increased intensity */}
        <spotLight
          position={[0, 10, -11]}
          intensity={3}
          angle={Math.PI / 2.5}
          penumbra={0.3}
          color="#60a5fa"
          castShadow
          shadow-mapSize={[4096, 4096]}
        />
        
        {/* Main ceiling spotlights */}
        <spotLight
          position={[-8, 12, 2]}
          intensity={2}
          angle={Math.PI / 3}
          penumbra={0.5}
          color="#fbbf24"
          castShadow
        />
        <spotLight
          position={[8, 12, 2]}
          intensity={2}
          angle={Math.PI / 3}
          penumbra={0.5}
          color="#fbbf24"
          castShadow
        />
        
        {/* Audience area bright mood lighting */}
        <spotLight
          position={[0, 10, 8]}
          intensity={1.5}
          angle={Math.PI / 2.5}
          penumbra={0.8}
          color="#a78bfa"
          castShadow
        />
        
        {/* Enhanced rim lighting for depth */}
        <directionalLight
          position={[0, 15, 15]}
          intensity={0.8}
          color="#c084fc"
        />
        
        {/* Additional fill lighting */}
        <pointLight position={[0, 8, 0]} intensity={1.2} color="#ffffff" />
        
        {/* Enhanced LED strip effects */}
        <pointLight position={[-14, 1, 2]} intensity={1} color="#3b82f6" />
        <pointLight position={[14, 1, 2]} intensity={1} color="#3b82f6" />
        
        {/* Corner accent lighting */}
        <pointLight position={[-14, 3, -10]} intensity={0.8} color="#8b5cf6" />
        <pointLight position={[14, 3, -10]} intensity={0.8} color="#8b5cf6" />
        <pointLight position={[-14, 3, 10]} intensity={0.8} color="#8b5cf6" />
        <pointLight position={[14, 3, 10]} intensity={0.8} color="#8b5cf6" />
        
        {/* Ceiling panel lighting */}
        <pointLight position={[-8, 9, 0]} intensity={1.5} color="#ffffff" />
        <pointLight position={[8, 9, 0]} intensity={1.5} color="#ffffff" />
        <pointLight position={[0, 9, -8]} intensity={1.5} color="#ffffff" />
        <pointLight position={[0, 9, 8]} intensity={1.5} color="#ffffff" />
        
        {/* Enhanced exit sign illumination */}
        <pointLight position={[-14, 6, 10]} intensity={0.8} color="#22c55e" />
        <pointLight position={[14, 6, 10]} intensity={0.8} color="#22c55e" />
        
        {/* Floor guidance lighting */}
        <pointLight position={[-1, 0, 2]} intensity={0.6} color="#f59e0b" />
        <pointLight position={[1, 0, 2]} intensity={0.6} color="#f59e0b" />

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
      </Suspense>
    </div>
  );
}