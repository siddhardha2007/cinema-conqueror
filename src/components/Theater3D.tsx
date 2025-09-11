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

// Enhanced 3D Seat Component with Realistic Cinema Lighting
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
  const ledStripRef = useRef<THREE.Mesh>(null);
  const spotlightRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation for selected seats
      if (seat.isSelected) {
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.03;
      } else {
        meshRef.current.position.y = position[1];
      }
      
      // Scale animation on hover
      const targetScale = hovered && !seat.isBooked ? 1.15 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }

    // LED strip under seat animation
    if (ledStripRef.current) {
      const material = ledStripRef.current.material as THREE.MeshStandardMaterial;
      if (seat.isSelected) {
        material.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
      } else {
        material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      }
    }

    // Spotlight effect for selected seats
    if (spotlightRef.current && seat.isSelected) {
      const material = spotlightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
    }
  });

  const getSeatColor = () => {
    if (seat.isBooked) return '#2a2a2a';
    if (seat.isSelected) return '#dc2626'; // Cinema red
    if (hovered && !seat.isBooked) return '#f59e0b'; // Hover gold
    
    switch (seat.type) {
      case 'vip': return '#1e293b'; // Dark blue for VIP
      case 'premium': return '#374151'; // Dark gray for premium
      default: return '#4b5563'; // Standard gray
    }
  };

  const getSeatGlow = () => {
    if (seat.isBooked) return '#444444';
    if (seat.isSelected) return '#dc2626';
    
    switch (seat.type) {
      case 'vip': return '#eab308'; // Bright yellow aura for VIP
      case 'premium': return '#d4af37'; // Golden glow for premium
      default: return '#3b82f6'; // Blue for standard
    }
  };

  const getLEDStripColor = () => {
    if (seat.isSelected) return '#dc2626';
    switch (seat.type) {
      case 'vip': return '#eab308';
      case 'premium': return '#d4af37';
      default: return '#06b6d4';
    }
  };

  return (
    <group position={position}>
      {/* LED strip under seat for realistic cinema effect */}
      <mesh
        ref={ledStripRef}
        position={[0, -0.1, 0]}
      >
        <boxGeometry args={[1.1, 0.05, 1.1]} />
        <meshStandardMaterial 
          color={getLEDStripColor()}
          emissive={getLEDStripColor()}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Seat base with luxury padding and realistic materials */}
      <mesh
        ref={meshRef}
        onClick={() => !seat.isBooked && onClick(seat)}
        onPointerEnter={() => !seat.isBooked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        position={[0, 0.05, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.9, 0.15, 0.9]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.4}
          metalness={0.1}
          emissive={getSeatGlow()}
          emissiveIntensity={seat.isSelected ? 0.2 : (seat.type === 'vip' ? 0.15 : seat.type === 'premium' ? 0.1 : 0.05)}
        />
      </mesh>
      
      {/* Seat back with curved design and lighting */}
      <mesh position={[0, 0.4, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.7, 0.15]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.4}
          metalness={0.1}
          emissive={getSeatGlow()}
          emissiveIntensity={seat.isSelected ? 0.15 : (seat.type === 'vip' ? 0.1 : seat.type === 'premium' ? 0.08 : 0.03)}
        />
      </mesh>
      
      {/* Luxury armrests with ambient glow */}
      <mesh position={[-0.5, 0.25, -0.1]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.5}
          emissive={getSeatGlow()}
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh position={[0.5, 0.25, -0.1]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.5}
          emissive={getSeatGlow()}
          emissiveIntensity={0.05}
        />
      </mesh>
      
      {/* Seat number with improved visibility */}
      <Text
        position={[0, 0.2, 0.46]}
        fontSize={0.12}
        color={seat.isBooked ? '#666' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {seat.number}
      </Text>
      
      {/* Enhanced selection glow with spotlight effect */}
      {seat.isSelected && (
        <>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[1.3, 0.25, 1.3]} />
            <meshStandardMaterial 
              color="#dc2626" 
              transparent 
              opacity={0.4}
              emissive="#dc2626"
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Spotlight cone effect */}
          <mesh ref={spotlightRef} position={[0, 1.5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.8, 1.5, 8]} />
            <meshStandardMaterial 
              color="#ffffff"
              transparent
              opacity={0.1}
              emissive="#dc2626"
              emissiveIntensity={0.6}
            />
          </mesh>
        </>
      )}

      {/* VIP seat special aura effect */}
      {seat.type === 'vip' && (
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[1.4, 0.8, 1.4]} />
          <meshStandardMaterial 
            color="#eab308" 
            transparent 
            opacity={0.2}
            emissive="#eab308"
            emissiveIntensity={0.4}
          />
        </mesh>
      )}

      {/* Premium seat golden glow */}
      {seat.type === 'premium' && (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.2, 0.6, 1.2]} />
          <meshStandardMaterial 
            color="#d4af37" 
            transparent 
            opacity={0.15}
            emissive="#d4af37"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

// Enhanced Luxury 3D Screen with Cinematic Glow
function Screen3D() {
  const meshRef = useRef<THREE.Mesh>(null);
  const curtainLeftRef = useRef<THREE.Mesh>(null);
  const curtainRightRef = useRef<THREE.Mesh>(null);
  const projectorLightRef = useRef<THREE.Mesh>(null);
  const screenGlowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Enhanced cinematic screen glow with movie simulation
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 0.8) * 0.6;
      
      // Realistic screen color changes simulating movie content
      const hue = 0.6 + Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      material.color.setHSL(hue, 0.7, 0.2);
      material.emissive.setHSL(hue, 0.8, 0.4);
    }
    
    // Enhanced screen atmosphere glow
    if (screenGlowRef.current) {
      const material = screenGlowRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 1.2) * 0.3;
    }
    
    // Elegant curtain movement with realistic sway
    if (curtainLeftRef.current && curtainRightRef.current) {
      const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
      curtainLeftRef.current.position.x = -11.5 + sway;
      curtainRightRef.current.position.x = 11.5 - sway;
      
      // Subtle curtain ripple effect
      curtainLeftRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
      curtainRightRef.current.rotation.y = -Math.sin(state.clock.elapsedTime * 0.8) * 0.02;
    }

    // Enhanced projector light beam animation
    if (projectorLightRef.current) {
      const intensity = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      projectorLightRef.current.scale.y = intensity;
      const material = projectorLightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2;
    }
  });

  return (
    <group position={[0, 3, -12]}>
      {/* Massive IMAX-style screen with realistic glow */}
      <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 14]} />
        <meshStandardMaterial 
          color="#1e3a8a" 
          emissive="#3b82f6"
          emissiveIntensity={0.8}
          roughness={0.05}
          metalness={0.2}
        />
      </mesh>
      
      {/* Screen atmospheric glow effect */}
      <mesh ref={screenGlowRef} position={[0, 0, 0.5]}>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial 
          color="#1e40af" 
          emissive="#60a5fa"
          emissiveIntensity={0.4}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Movie content simulation with dynamic colors */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[23.5, 13.5]} />
        <meshStandardMaterial 
          color="#0f172a" 
          emissive="#3b82f6"
          emissiveIntensity={0.6}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Premium art deco frame with enhanced glow */}
      <mesh position={[0, 0, -0.05]} receiveShadow>
        <planeGeometry args={[26, 16]} />
        <meshStandardMaterial 
          color="#d4af37"
          roughness={0.1}
          metalness={0.9}
          emissive="#fbbf24"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Outer architectural frame */}
      <mesh position={[0, 0, -0.1]} receiveShadow>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial 
          color="#0f172a" 
          roughness={0.3}
          metalness={0.5}
          emissive="#1e293b"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Enhanced luxury velvet curtains with realistic fabric */}
      <mesh ref={curtainLeftRef} position={[-11.5, 0, 1]} castShadow>
        <planeGeometry args={[4, 18]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
          emissive="#991b1b"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh ref={curtainRightRef} position={[11.5, 0, 1]} castShadow>
        <planeGeometry args={[4, 18]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
          emissive="#991b1b"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Enhanced projector light beam with realistic cone */}
      <mesh ref={projectorLightRef} position={[0, 0, 8]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.2, 16, 12]} />
        <meshStandardMaterial 
          color="#ffffff"
          transparent
          opacity={0.15}
          emissive="#60a5fa"
          emissiveIntensity={0.4}
        />
      </mesh>
      
      {/* Cinema branding with enhanced glow */}
      <Text
        position={[0, -10, 0.01]}
        fontSize={1.5}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
      >
        DELUXE CINEMA HALL
      </Text>
      
      {/* Enhanced atmospheric lighting strips around screen */}
      <mesh position={[0, 9, 0.02]}>
        <boxGeometry args={[26, 0.4, 0.2]} />
        <meshStandardMaterial 
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[0, -9, 0.02]}>
        <boxGeometry args={[26, 0.4, 0.2]} />
        <meshStandardMaterial 
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[-13, 0, 0.02]}>
        <boxGeometry args={[0.4, 16, 0.2]} />
        <meshStandardMaterial 
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[13, 0, 0.02]}>
        <boxGeometry args={[0.4, 16, 0.2]} />
        <meshStandardMaterial 
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

// Enhanced Theater Environment with Reflective Floor and Realistic Lighting
function TheaterEnvironment() {
  const floorLightRef = useRef<THREE.Mesh>(null);
  const ceilingLightRef = useRef<THREE.Mesh>(null);
  const reflectiveFloorRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    // Animated floor lighting with wave patterns
    if (floorLightRef.current) {
      const material = floorLightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
    
    // Pulsing ceiling lights
    if (ceilingLightRef.current) {
      const material = ceilingLightRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 0.8) * 0.2;
    }

    // Reflective floor subtle animation
    if (reflectiveFloorRef.current) {
      const material = reflectiveFloorRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.1 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  return (
    <group>
      {/* Ultra-realistic reflective marble floor with patterns */}
      <mesh ref={reflectiveFloorRef} position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[30, 0.3, 25]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          roughness={0.05}
          metalness={0.9}
          emissive="#2563eb"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Reflective surface enhancement */}
      <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 23]} />
        <meshStandardMaterial 
          color="#0f172a"
          roughness={0.02}
          metalness={0.95}
          emissive="#1e40af"
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Glowing floor patterns for guidance */}
      <mesh position={[0, -0.4, 0]}>
        <planeGeometry args={[26, 21]} />
        <meshStandardMaterial 
          color="#1e293b"
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Enhanced glowing carpet aisles with realistic texture */}
      <mesh ref={floorLightRef} position={[0, -0.38, 2]} receiveShadow>
        <boxGeometry args={[2.2, 0.18, 15]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.8}
          emissive="#dc2626"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Side aisles with premium glowing carpet */}
      <mesh position={[-10, -0.38, 2]} receiveShadow>
        <boxGeometry args={[1.8, 0.18, 15]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.8}
          emissive="#dc2626"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[10, -0.38, 2]} receiveShadow>
        <boxGeometry args={[1.8, 0.18, 15]} />
        <meshStandardMaterial 
          color="#7f1d1d" 
          roughness={0.8}
          emissive="#dc2626"
          emissiveIntensity={0.4}
        />
      </mesh>
      
      {/* Enhanced LED strip guidance lighting along aisles */}
      <mesh position={[-1.1, -0.35, 2]}>
        <boxGeometry args={[0.15, 0.12, 15]} />
        <meshStandardMaterial 
          color="#eab308" 
          emissive="#eab308"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[1.1, -0.35, 2]}>
        <boxGeometry args={[0.15, 0.12, 15]} />
        <meshStandardMaterial 
          color="#eab308" 
          emissive="#eab308"
          emissiveIntensity={1.2}
        />
      </mesh>
      
      {/* Side aisle LED guidance */}
      <mesh position={[-9, -0.35, 2]}>
        <boxGeometry args={[0.12, 0.12, 15]} />
        <meshStandardMaterial 
          color="#06b6d4" 
          emissive="#06b6d4"
          emissiveIntensity={1.0}
        />
      </mesh>
      <mesh position={[9, -0.35, 2]}>
        <boxGeometry args={[0.12, 0.12, 15]} />
        <meshStandardMaterial 
          color="#06b6d4" 
          emissive="#06b6d4"
          emissiveIntensity={1.0}
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