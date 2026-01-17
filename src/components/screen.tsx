'use client';

import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

// This is the 3D Component
export default function TheaterScene() {
  return (
    <div className="w-full h-full bg-black">
      <Canvas shadows camera={{ position: [0, 5, 15], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        {/* The Screen */}
        <group position={[0, 4, -8]}>
          <mesh>
            <planeGeometry args={[16, 9]} />
            <meshStandardMaterial color="black" emissive="#111" />
          </mesh>
          <Text position={[0, 0, 0.1]} fontSize={1} color="white">
             Select a Seat
          </Text>
        </group>

        {/* The Seats */}
        <SeatGroup />
        
        <OrbitControls 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 2}
            maxDistance={25}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

function SeatGroup() {
  // Generate simple seat data
  const seats = useMemo(() => {
    const arr = [];
    for(let row=0; row<5; row++) {
      for(let col=0; col<8; col++) {
        arr.push({ 
          id: `${row}-${col}`, 
          x: (col - 3.5) * 1.5, 
          z: row * 2,
          row: row + 1,
          num: col + 1 
        });
      }
    }
    return arr;
  }, []);

  return (
    <group position={[0, -2, 2]}>
      {seats.map((seat) => (
        <Seat key={seat.id} {...seat} />
      ))}
    </group>
  );
}

function Seat({ x, z, row, num }: any) {
  const [hovered, setHover] = useState(false);
  const [selected, setSelected] = useState(false);

  const color = selected ? '#22c55e' : hovered ? '#3b82f6' : '#64748b';

  return (
    <group position={[x, 0, z]}>
      <RoundedBox 
        args={[1, 1, 1]} 
        radius={0.1} 
        smoothness={4}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor='pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHover(false); document.body.style.cursor='auto'; }}
        onClick={(e) => { e.stopPropagation(); setSelected(!selected); }}
      >
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <Text position={[0, 0.6, 0]} fontSize={0.3} color="white" rotation={[-Math.PI/4, 0, 0]}>
        {String.fromCharCode(64+row)}{num}
      </Text>
    </group>
  );
}
