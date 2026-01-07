import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button'; 
import { RotateCcw, Eye, Film } from 'lucide-react';

// ... (Keep your existing Data, Types, and Constants) ...
// PASTE THE PREVIOUS DATA/CONSTANTS HERE IF NEEDED, OR KEEP YOUR EXISTING ONES

// --- NEW COMPONENT: Detailed Premium Seat ---
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
  // Animation state for "Pop" effect
  const targetY = useRef(position[1]); 
  const currentY = useRef(position[1]);
  const meshRef = useRef<THREE.Group>(null);

  const isBooked = seat.status === 'booked' || seat.isBooked;
  const isSelected = seat.status === 'selected' || seat.isSelected;

  // Animation Logic: Smooth bounce when selected
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // If selected or hovered, lift up slightly
    const hoverLift = hovered && !isBooked ? 0.1 : 0;
    const selectedLift = isSelected ? 0.2 : 0;
    const targetHeight = position[1] + hoverLift + selectedLift;

    // Smooth lerp to target height
    currentY.current = THREE.MathUtils.lerp(currentY.current, targetHeight, delta * 10);
    meshRef.current.position.y = currentY.current;
  });

  const getSeatColor = () => {
    if (isBooked) return '#475569'; // Slate for booked
    if (isSelected) return '#ef4444'; // Red for selected
    if (hovered) return '#f59e0b';    // Gold for hover
    if (seat.type === 'premium') return '#3b82f6'; // Blue for premium
    return '#94a3b8'; // Light Grey for standard
  };

  return (
    <group 
        ref={meshRef} 
        position={[position[0], position[1], position[2]]}
    >
      {/* 1. SEAT CUSHION (Base) */}
      <RoundedBox
        args={[0.7, 0.15, 0.7]}
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
        castShadow 
        receiveShadow
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>

      {/* 2. SEAT BACKREST (Tilted slightly back for realism) */}
      <RoundedBox
        args={[0.7, 0.6, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.4, 0.3]}
        rotation={[-0.1, 0, 0]} // Slight recline
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={getSeatColor()} 
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>

      {/* 3. HEADREST (The "Premium" look) */}
      <RoundedBox
        args={[0.5, 0.2, 0.1]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.75, 0.25]} // Sitting on top of backrest
        rotation={[-0.1, 0, 0]}
        castShadow
        receiveShadow
      >
         <meshStandardMaterial color={isBooked ? '#334155' : '#1e293b'} /> 
      </RoundedBox>

      {/* 4. ARMRESTS with CUP HOLDERS */}
      {/* Left Arm */}
      <group position={[-0.4, 0.2, 0.1]}>
          <RoundedBox args={[0.1, 0.15, 0.6]} radius={0.02} smoothness={2} castShadow>
             <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </RoundedBox>
          {/* Cup Holder (Cylinder subtraction look) */}
          <mesh position={[0, 0.08, 0.2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.01, 16]} />
              <meshStandardMaterial color="#0f172a" />
          </mesh>
      </group>

      {/* Right Arm */}
      <group position={[0.4, 0.2, 0.1]}>
          <RoundedBox args={[0.1, 0.15, 0.6]} radius={0.02} smoothness={2} castShadow>
             <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.08, 0.2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.01, 16]} />
              <meshStandardMaterial color="#0f172a" />
          </mesh>
      </group>
      
      {/* 5. FLOATING TOOLTIP (Only visible on hover) */}
      {hovered && !isBooked && (
        <Html position={[0, 1.2, 0]} center distanceFactor={10}>
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 whitespace-nowrap backdrop-blur-md">
            <span className="font-bold">{seat.row}{seat.number}</span>
            <span className="mx-1">|</span>
            <span className="text-yellow-400">₹{seat.price}</span>
          </div>
        </Html>
      )}

      {/* Seat Number (On the headrest or back) */}
      <Text
        position={[0, 0.55, 0.36]}
        fontSize={0.08}
        color="white"
        anchorX="center"
        anchorY="middle"
        rotation={[-0.1, 0, 0]} 
      >
        {seat.number}
      </Text>
    </group>
  );
}

// ... (Rest of your components like Screen3D, StadiumSteps, etc. stay exactly the same) ...
