import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls, Environment, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";

// ============================================================
// THEATER CONSTANTS
// ============================================================
const SCREEN_WIDTH = 28;
const SCREEN_HEIGHT = 13;
const SCREEN_Y = 6;
const SCREEN_Z = -22;

const SEAT_CATEGORIES = {
  PLATINUM: {
    label: "Platinum Recliner",
    color: "#d4af37",
    emissive: "#d4af37",
    price: 699,
    rows: 2,
    startRow: 0,
  },
  GOLD: {
    label: "Gold",
    color: "#c0843a",
    emissive: "#c0843a",
    price: 449,
    rows: 4,
    startRow: 2,
  },
  SILVER: {
    label: "Silver",
    color: "#7b9dc4",
    emissive: "#7b9dc4",
    price: 249,
    rows: 5,
    startRow: 6,
  },
} as const;

const SEATS_PER_ROW = 16;
const SEAT_SPACING_X = 1.35;
const SEAT_SPACING_Z = 1.6;
const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SeatCategory = keyof typeof SEAT_CATEGORIES;
type SeatStatus = "available" | "booked" | "selected" | "unavailable";

interface SeatData {
  id: string;
  row: number;
  col: number;
  category: SeatCategory;
  status: SeatStatus;
  price: number;
}

// ============================================================
// LOADER OVERLAY
// ============================================================
function LoaderOverlay() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm tracking-widest text-blue-300 font-light">
          LOADING THEATER… {Math.round(progress)}%
        </span>
      </div>
    </Html>
  );
}

// ============================================================
// ANIMATED PARTICLES AROUND SCREEN
// ============================================================
function ScreenParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 60;

  const { positions, speeds, phases } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const speeds: number[] = [];
    const phases: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const rx = SCREEN_WIDTH / 2 + 0.5 + Math.random() * 3.5;
      const ry = SCREEN_HEIGHT / 2 + 0.5 + Math.random() * 2.5;
      positions.push(
        new THREE.Vector3(Math.cos(angle) * rx, Math.sin(angle) * ry, Math.random() * 1.5)
      );
      speeds.push(0.3 + Math.random() * 0.7);
      phases.push(Math.random() * Math.PI * 2);
    }
    return { positions, speeds, phases };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const p = positions[i];
      const s = Math.sin(t * speeds[i] + phases[i]) * 0.5 + 0.5;
      dummy.position.set(p.x, p.y + Math.sin(t * speeds[i] * 0.5 + phases[i]) * 0.4, p.z);
      const scale = 0.03 + s * 0.04;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(
        i,
        new THREE.Color().setHSL(0.6 + s * 0.1, 0.8, 0.5 + s * 0.3)
      );
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.6} />
    </instancedMesh>
  );
}

// ============================================================
// PREMIUM THEATER SCREEN
// ============================================================
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const scanlineRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    glowRef.current = Math.sin(t * 0.5) * 0.15 + 0.85;
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = glowRef.current * 0.35;
    }
    // Animated scanline
    if (scanlineRef.current) {
      const y = ((t * 0.4) % 1) * SCREEN_HEIGHT - SCREEN_HEIGHT / 2;
      scanlineRef.current.position.y = y;
      const mat = scanlineRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.04 + Math.sin(t * 2) * 0.02;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* ── Deep back wall ── */}
      <mesh position={[0, 0, -2]} receiveShadow>
        <boxGeometry args={[50, 26, 0.4]} />
        <meshStandardMaterial color="#07070f" roughness={1} />
      </mesh>

      {/* ── Architectural side panels ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4), 0, -1.2]}>
          {/* Panel body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5, SCREEN_HEIGHT + 7, 0.5]} />
            <meshStandardMaterial color="#111128" roughness={0.75} metalness={0.25} />
          </mesh>
          {/* Recessed inner panel */}
          <mesh position={[side * -0.6, 0, 0.35]}>
            <boxGeometry args={[3, SCREEN_HEIGHT + 6, 0.22]} />
            <meshStandardMaterial color="#181838" roughness={0.6} metalness={0.45} />
          </mesh>
          {/* LED strip A */}
          <mesh position={[side * -0.85, 0, 0.55]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 6, 0.06]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={3.5} />
          </mesh>
          {/* LED strip B */}
          <mesh position={[side * -0.15, 0, 0.55]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 6, 0.06]} />
            <meshStandardMaterial color="#6d28d9" emissive="#6d28d9" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[side * -0.85, 0, 0.7]} intensity={2} distance={8} color="#3b82f6" />
          <pointLight position={[side * -0.15, 0, 0.7]} intensity={1.5} distance={6} color="#6d28d9" />
        </group>
      ))}

      {/* ── Multi-layer premium frame ── */}
      <mesh position={[0, 0, -0.22]}>
        <boxGeometry args={[SCREEN_WIDTH + 3, SCREEN_HEIGHT + 2.6, 0.28]} />
        <meshStandardMaterial color="#0a0a18" roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[SCREEN_WIDTH + 2.1, SCREEN_HEIGHT + 1.8, 0.2]} />
        <meshStandardMaterial color="#14143a" roughness={0.22} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[SCREEN_WIDTH + 1, SCREEN_HEIGHT + 0.8, 0.13]} />
        <meshStandardMaterial color="#1e1e48" roughness={0.18} metalness={0.88} />
      </mesh>

      {/* ── Glowing frame edge ── */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.15, SCREEN_HEIGHT + 0.15]} />
        <meshBasicMaterial color="#4466cc" transparent opacity={0.18} />
      </mesh>

      {/* ── Main screen surface ── */}
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial
          color="#090912"
          roughness={0.12}
          metalness={0.35}
          emissive="#1a1a50"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* ── Scanline animation ── */}
      <mesh ref={scanlineRef} position={[0, 0, 0.03]}>
        <planeGeometry args={[SCREEN_WIDTH, 0.5]} />
        <meshBasicMaterial color="#88aaff" transparent opacity={0.05} />
      </mesh>

      {/* ── Ambient particles ── */}
      <ScreenParticles />

      {/* ── Screen lighting ── */}
      <pointLight position={[0, 0, 7]} intensity={6} distance={50} color="#4a6aaa" castShadow />
      <pointLight position={[-12, 4, 5]} intensity={3} distance={25} color="#5577dd" />
      <pointLight position={[12, 4, 5]} intensity={3} distance={25} color="#5577dd" />
      <pointLight position={[0, SCREEN_HEIGHT / 2 + 2, 4]} intensity={2.5} distance={20} color="#6688cc" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 2, 4]} intensity={2} distance={18} color="#5566bb" />

      {/* ── Premium velvet curtains ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4.5), 0, 0.9]}>
          {[...Array(12)].map((_, i) => {
            const xOff = side * i * 0.38;
            const zWave = Math.sin(i * 0.55) * 0.22 + Math.cos(i * 1.1) * 0.14;
            const yOff = -Math.abs(Math.sin(i * 0.45)) * 0.18;
            const w = 0.3 + Math.sin(i * 0.7) * 0.06;
            const shade = i % 3 === 0 ? "#6b1010" : i % 3 === 1 ? "#841c1c" : "#9a2424";
            return (
              <mesh key={i} position={[xOff, yOff, zWave]} castShadow receiveShadow>
                <boxGeometry args={[w, SCREEN_HEIGHT + 5.5, 0.14]} />
                <meshStandardMaterial color={shade} roughness={0.97} metalness={0.01} />
              </mesh>
            );
          })}
          {/* Edge trim */}
          <mesh position={[side * 2, 0, 0]} castShadow>
            <boxGeometry args={[0.18, SCREEN_HEIGHT + 5.5, 0.18]} />
            <meshStandardMaterial color="#4a0e0e" roughness={0.88} metalness={0.12} />
          </mesh>
          {/* Gold braid */}
          <mesh position={[side * 2, 0, 0.1]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 5.5, 0.06]} />
            <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.9} emissive="#d4af37" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── Ornate curtain rod ── */}
      <group position={[0, SCREEN_HEIGHT / 2 + 3.2, 1.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, SCREEN_WIDTH + 16, 24]} />
          <meshStandardMaterial color="#8b7355" roughness={0.12} metalness={0.94} />
        </mesh>
        {[...Array(15)].map((_, i) => (
          <mesh key={i} position={[(i - 7) * 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.16, 0.025, 12, 24]} />
            <meshStandardMaterial color="#6a5a45" roughness={0.18} metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* ── Finials ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 8.2), SCREEN_HEIGHT / 2 + 3.2, 1.2]}>
          <mesh castShadow>
            <sphereGeometry args={[0.38, 24, 24]} />
            <meshStandardMaterial color="#d4af37" roughness={0.12} metalness={0.96} emissive="#d4af37" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.22, 0.55, 20]} />
            <meshStandardMaterial color="#d4af37" roughness={0.12} metalness={0.96} emissive="#d4af37" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.12, 0.2, 0.4, 20]} />
            <meshStandardMaterial color="#b8962e" roughness={0.2} metalness={0.9} />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={1} distance={4} color="#d4af37" />
        </group>
      ))}

      {/* ── Pelmet ── */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.4, 0.7]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 14, 2.8, 1.1]} />
        <meshStandardMaterial color="#5a1010" roughness={0.93} />
      </mesh>
      {/* Pelmet gold trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 1.0, 1.3]}>
        <boxGeometry args={[SCREEN_WIDTH + 14, 0.1, 0.12]} />
        <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.92} emissive="#d4af37" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, SCREEN_HEIGHT / 2 + 3.8, 1.3]}>
        <boxGeometry args={[SCREEN_WIDTH + 14, 0.1, 0.12]} />
        <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.92} emissive="#d4af37" emissiveIntensity={0.3} />
      </mesh>

      {/* ── "NOW SHOWING" title card ── */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 2.2, 0.6]}>
        <mesh position={[0, 0, -0.06]}>
          <planeGeometry args={[SCREEN_WIDTH - 1, 2]} />
          <meshStandardMaterial color="#0a0a1e" transparent opacity={0.7} roughness={0.9} />
        </mesh>
        {/* Gold top line */}
        <mesh position={[0, 0.65, 0]}>
          <planeGeometry args={[10, 0.025]} />
          <meshBasicMaterial color="#d4af37" />
        </mesh>
        <Text fontSize={0.45} color="#6b8cce" anchorX="center" anchorY="middle" letterSpacing={0.2} position={[0, 0.38, 0]}>
          NOW SHOWING
        </Text>
        <mesh position={[0, 0.05, 0]}>
          <planeGeometry args={[9, 0.018]} />
          <meshBasicMaterial color="#4a6a9a" />
        </mesh>
        <Text
          position={[0, -0.38, 0]}
          fontSize={0.44}
          color="#c8d8f0"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.12}
          maxWidth={SCREEN_WIDTH - 4}
        >
          {movieTitle.toUpperCase()}
        </Text>
        {/* Gold bottom line */}
        <mesh position={[0, -0.72, 0]}>
          <planeGeometry args={[10, 0.025]} />
          <meshBasicMaterial color="#d4af37" />
        </mesh>
      </group>

      {/* ── Spotlights ── */}
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 5, 4]} angle={0.85} penumbra={0.65} intensity={4} distance={32} color="#8899cc" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      {([-1, 1] as const).map((side) => (
        <spotLight key={side} position={[side * (SCREEN_WIDTH / 2 + 2), 8, SCREEN_Z + 6]} angle={0.45} penumbra={0.7} intensity={2} distance={25} color="#5577dd" />
      ))}
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 3, 3]} intensity={2.5} distance={14} color="#4a5a8a" />
    </group>
  );
}

// ============================================================
// SEAT COMPONENT
// ============================================================
function TheaterSeat({
  seat,
  onSelect,
  position,
}: {
  seat: SeatData;
  onSelect: (id: string) => void;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const cat = SEAT_CATEGORIES[seat.category];

  const baseColor = useMemo(() => {
    if (seat.status === "booked") return "#2a2a3a";
    if (seat.status === "unavailable") return "#1a1a22";
    if (seat.status === "selected") return "#22c55e";
    return cat.color;
  }, [seat.status, cat.color]);

  const emissiveColor = useMemo(() => {
    if (seat.status === "booked") return "#111118";
    if (seat.status === "unavailable") return "#0a0a10";
    if (seat.status === "selected") return "#16a34a";
    return cat.emissive;
  }, [seat.status, cat.emissive]);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const targetEmissive = hovered && seat.status === "available" ? 0.9 : seat.status === "selected" ? 0.7 : 0.15;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, 0.12);
  });

  const isPlatinum = seat.category === "PLATINUM";

  return (
    <group
      position={position}
      onClick={() => seat.status === "available" && onSelect(seat.id)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Seat base / cushion */}
      <mesh
        ref={meshRef}
        position={[0, isPlatinum ? 0.18 : 0.12, 0]}
        castShadow
      >
        <boxGeometry args={isPlatinum ? [0.85, 0.22, 0.75] : [0.78, 0.18, 0.68]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={0.15}
          roughness={seat.category === "PLATINUM" ? 0.55 : 0.75}
          metalness={seat.category === "PLATINUM" ? 0.15 : 0.05}
        />
      </mesh>

      {/* Seat back */}
      <mesh position={[0, isPlatinum ? 0.62 : 0.52, isPlatinum ? -0.3 : -0.26]} castShadow>
        <boxGeometry args={isPlatinum ? [0.85, 0.78, 0.15] : [0.78, 0.68, 0.13]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={0.1}
          roughness={seat.category === "PLATINUM" ? 0.55 : 0.75}
          metalness={seat.category === "PLATINUM" ? 0.15 : 0.05}
        />
      </mesh>

      {/* Armrests */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (isPlatinum ? 0.48 : 0.44), isPlatinum ? 0.38 : 0.32, isPlatinum ? -0.06 : -0.04]}
          castShadow
        >
          <boxGeometry args={isPlatinum ? [0.09, 0.12, 0.65] : [0.07, 0.1, 0.58]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Platinum headrest */}
      {isPlatinum && (
        <mesh position={[0, 1.08, -0.28]} castShadow>
          <boxGeometry args={[0.75, 0.28, 0.13]} />
          <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.2} roughness={0.5} metalness={0.2} />
        </mesh>
      )}

      {/* Seat leg */}
      <mesh position={[0, -0.05, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color="#0f0f1a" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Hover glow under seat */}
      {hovered && seat.status === "available" && (
        <pointLight position={[0, 0.2, 0]} intensity={1.5} distance={1.8} color={cat.color} />
      )}

      {/* Selected indicator */}
      {seat.status === "selected" && (
        <pointLight position={[0, 0.3, 0]} intensity={2} distance={2} color="#22c55e" />
      )}

      {/* Seat number indicator (small dot) */}
      <mesh position={[0, 0.03, 0.32]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial
          color={seat.status === "booked" ? "#333" : cat.color}
          emissive={seat.status === "booked" ? "#000" : cat.emissive}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

// ============================================================
// FLOOR / AISLE / STEPS
// ============================================================
function TheaterFloor() {
  return (
    <group>
      {/* Main sloped floor sections */}
      {[...Array(11)].map((_, i) => {
        const z = -18 + i * 2.8;
        const y = -1.5 + i * 0.28;
        return (
          <mesh key={i} position={[0, y - 0.14, z]} receiveShadow>
            <boxGeometry args={[36, 0.28, 2.8]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#0e0e1c" : "#0c0c18"}
              roughness={0.92}
              metalness={0.05}
            />
          </mesh>
        );
      })}

      {/* Center aisle carpet */}
      {[...Array(11)].map((_, i) => {
        const z = -18 + i * 2.8;
        const y = -1.5 + i * 0.28;
        return (
          <mesh key={i} position={[0, y + 0.01, z]} receiveShadow>
            <boxGeometry args={[1.5, 0.01, 2.8]} />
            <meshStandardMaterial color="#4a0e0e" roughness={0.98} />
          </mesh>
        );
      })}

      {/* Aisle LED floor strips */}
      {([-1, 1] as const).map((side) =>
        [...Array(11)].map((_, i) => {
          const z = -18 + i * 2.8;
          const y = -1.5 + i * 0.28;
          return (
            <mesh key={`${side}-${i}`} position={[side * 1.2, y + 0.015, z]}>
              <boxGeometry args={[0.08, 0.01, 2.5]} />
              <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} />
            </mesh>
          );
        })
      )}

      {/* Wide floor base */}
      <mesh position={[0, -3, 0]} receiveShadow>
        <boxGeometry args={[50, 0.5, 60]} />
        <meshStandardMaterial color="#080810" roughness={1} />
      </mesh>
    </group>
  );
}

// ============================================================
// SIDE WALLS & CEILING
// ============================================================
function TheaterWalls() {
  return (
    <group>
      {/* Left wall */}
      <mesh position={[-20, 3, -5]} receiveShadow>
        <boxGeometry args={[0.4, 18, 46]} />
        <meshStandardMaterial color="#0c0c1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Right wall */}
      <mesh position={[20, 3, -5]} receiveShadow>
        <boxGeometry args={[0.4, 18, 46]} />
        <meshStandardMaterial color="#0c0c1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 12, -5]} receiveShadow>
        <boxGeometry args={[42, 0.4, 46]} />
        <meshStandardMaterial color="#09091a" roughness={0.95} />
      </mesh>

      {/* Wall LED strips - left */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[-19.6, 2 + i * 1.1, -5]}>
          <boxGeometry args={[0.05, 0.04, 44]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
            emissive={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}
      {/* Wall LED strips - right */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[19.6, 2 + i * 1.1, -5]}>
          <boxGeometry args={[0.05, 0.04, 44]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
            emissive={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}

      {/* Ceiling cove lighting */}
      {[...Array(6)].map((_, i) => (
        <pointLight key={i} position={[(i - 2.5) * 7, 11.5, -5]} intensity={1.2} distance={14} color="#2a2a5a" />
      ))}

      {/* Projection booth at back */}
      <mesh position={[0, 8, 18]} castShadow receiveShadow>
        <boxGeometry args={[8, 5, 3]} />
        <meshStandardMaterial color="#111122" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Booth window */}
      <mesh position={[0, 8, 16.4]}>
        <boxGeometry args={[4, 2, 0.1]} />
        <meshStandardMaterial color="#1a2a4a" transparent opacity={0.6} roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Projector beam */}
      <spotLight
        position={[0, 8, 15]}
        target-position={[0, SCREEN_Y, SCREEN_Z]}
        angle={0.18}
        penumbra={0.5}
        intensity={8}
        distance={60}
        color="#c8d8ff"
      />
    </group>
  );
}

// ============================================================
// BOOKING PANEL (HTML OVERLAY)
// ============================================================
function BookingPanel({
  seats,
  selectedIds,
  onClose,
  onConfirm,
}: {
  seats: SeatData[];
  selectedIds: string[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const selected = seats.filter((s) => selectedIds.includes(s.id));
  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const convenience = Math.round(total * 0.12);
  const gst = Math.round((total + convenience) * 0.18);
  const grand = total + convenience + gst;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none">
      <div className="pointer-events-auto bg-gradient-to-b from-[#0d0d22] to-[#050510] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-white font-semibold tracking-wide text-sm">BOOKING SUMMARY</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Seat list */}
        <div className="px-5 py-3 space-y-2 max-h-40 overflow-y-auto">
          {selected.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">No seats selected</p>
          ) : (
            selected.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SEAT_CATEGORIES[s.category].color }}
                  />
                  <span className="text-white/80 text-xs">
                    Row {ROW_LABELS[s.row]} · Seat {s.col + 1}
                  </span>
                  <span className="text-white/40 text-xs">({SEAT_CATEGORIES[s.category].label})</span>
                </div>
                <span className="text-white text-xs font-medium">₹{s.price}</span>
              </div>
            ))
          )}
        </div>

        {/* Price breakdown */}
        {selected.length > 0 && (
          <div className="px-5 py-3 border-t border-white/10 space-y-1.5">
            <div className="flex justify-between text-xs text-white/50">
              <span>Subtotal ({selected.length} seat{selected.length > 1 ? "s" : ""})</span>
              <span>₹{total.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>Convenience Fee (12%)</span>
              <span>₹{convenience.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>GST (18%)</span>
              <span>₹{gst.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm text-white font-semibold border-t border-white/10 pt-2 mt-1">
              <span>Total Payable</span>
              <span className="text-yellow-400">₹{grand.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="px-5 py-4">
          <button
            onClick={selected.length > 0 ? onConfirm : undefined}
            disabled={selected.length === 0}
            className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all ${
              selected.length > 0
                ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:from-yellow-400 hover:to-yellow-500 shadow-lg shadow-yellow-900/40"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            }`}
          >
            {selected.length > 0 ? `PAY ₹${grand.toLocaleString("en-IN")}` : "SELECT SEATS TO CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEAT LEGEND (HTML)
// ============================================================
function SeatLegend() {
  return (
    <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 space-y-2">
      <p className="text-white/40 text-xs tracking-widest uppercase mb-1">Seat Categories</p>
      {(Object.entries(SEAT_CATEGORIES) as [SeatCategory, typeof SEAT_CATEGORIES[SeatCategory]][]).map(([key, cat]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
          <span className="text-white/70 text-xs flex-1">{cat.label}</span>
          <span className="text-white text-xs font-medium">₹{cat.price}</span>
        </div>
      ))}
      <div className="border-t border-white/10 pt-2 space-y-1.5">
        {[
          { color: "#2a2a3a", label: "Booked" },
          { color: "#22c55e", label: "Selected" },
          { color: "#1a1a22", label: "Unavailable" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-white/50 text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SEATS LAYOUT IN 3D
// ============================================================
function SeatsLayout({
  seats,
  onSelect,
}: {
  seats: SeatData[];
  onSelect: (id: string) => void;
}) {
  // Row labels on walls
  const rowStartZ = -16;
  const totalRows = Object.values(SEAT_CATEGORIES).reduce((s, c) => s + c.rows, 0);

  return (
    <group>
      {seats.map((seat) => {
        const x = (seat.col - SEATS_PER_ROW / 2 + 0.5) * SEAT_SPACING_X;
        const z = rowStartZ + seat.row * SEAT_SPACING_Z;
        const y = -1.4 + seat.row * 0.28;
        // Skip middle aisle columns
        const skip = seat.col === 7 || seat.col === 8;
        if (skip) return null;
        return (
          <TheaterSeat
            key={seat.id}
            seat={seat}
            onSelect={onSelect}
            position={[x, y, z]}
          />
        );
      })}

      {/* Row labels */}
      {[...Array(totalRows)].map((_, row) => {
        const z = rowStartZ + row * SEAT_SPACING_Z;
        const y = -1.4 + row * 0.28;
        return (
          <group key={row}>
            {([-1, 1] as const).map((side) => (
              <Text
                key={side}
                position={[side * 11.8, y + 0.5, z]}
                fontSize={0.32}
                color="#ffffff50"
                anchorX="center"
                anchorY="middle"
                rotation={[0, side === -1 ? 0.15 : -0.15, 0]}
              >
                {ROW_LABELS[row]}
              </Text>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ============================================================
// CAMERA RIG
// ============================================================
function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Gentle ambient float
    state.camera.position.y += (Math.sin(t * 0.15) * 0.08 - state.camera.position.y * 0) * 0.01;
  });
  return null;
}

// ============================================================
// CONFIRMATION TOAST
// ============================================================
function ConfirmToast({ count, total, onDismiss }: { count: number; total: number; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-green-900/90 to-emerald-900/90 border border-green-500/30 backdrop-blur-md rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl shadow-green-900/50 animate-pulse">
      <span className="text-green-400 text-xl">✓</span>
      <div>
        <p className="text-white text-sm font-semibold">{count} Seat{count > 1 ? "s" : ""} Booked!</p>
        <p className="text-white/60 text-xs">₹{total.toLocaleString("en-IN")} charged successfully</p>
      </div>
    </div>
  );
}

// ============================================================
// GENERATE SEAT DATA
// ============================================================
function generateSeats(): SeatData[] {
  const seats: SeatData[] = [];
  let globalRow = 0;
  (Object.entries(SEAT_CATEGORIES) as [SeatCategory, typeof SEAT_CATEGORIES[SeatCategory]][]).forEach(([cat, cfg]) => {
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < SEATS_PER_ROW; c++) {
        if (c === 7 || c === 8) continue; // center aisle
        const rand = Math.random();
        const status: SeatStatus =
          rand < 0.18 ? "booked" : rand < 0.21 ? "unavailable" : "available";
        seats.push({
          id: `${cat}-${globalRow}-${c}`,
          row: globalRow,
          col: c,
          category: cat,
          status,
          price: cfg.price,
        });
      }
      globalRow++;
    }
  });
  return seats;
}

// ============================================================
// MAIN SCENE
// ============================================================
function TheaterScene({
  seats,
  onSelect,
}: {
  seats: SeatData[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <color attach="background" args={["#050508"]} />
      <fog attach="fog" args={["#050508", 30, 80]} />

      <ambientLight intensity={0.06} />
      <pointLight position={[0, 10, 5]} intensity={0.4} distance={35} color="#1a1a3a" />

      <PremiumTheaterScreen movieTitle="Interstellar: Beyond the Horizon" />
      <TheaterFloor />
      <TheaterWalls />
      <SeatsLayout seats={seats} onSelect={onSelect} />
      <CameraRig />

      <OrbitControls
        target={[0, 2, -8]}
        minDistance={5}
        maxDistance={38}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.1}
        enablePan={false}
        dampingFactor={0.08}
        enableDamping
      />

      <Environment preset="night" />
    </>
  );
}

// ============================================================
// ROOT EXPORT
// ============================================================
export default function PremiumCinemaBooking() {
  const [seats, setSeats] = useState<SeatData[]>(() => generateSeats());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [toast, setToast] = useState<{ count: number; total: number } | null>(null);

  const handleSelect = (id: string) => {
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const toggled = s.status === "selected" ? "available" : "selected";
        return { ...s, status: toggled };
      })
    );
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setShowPanel(true);
  };

  const handleConfirm = () => {
    const selected = seats.filter((s) => selectedIds.includes(s.id));
    const total =
      selected.reduce((sum, s) => sum + s.price, 0) +
      Math.round(selected.reduce((sum, s) => sum + s.price, 0) * 0.12) +
      Math.round(
        (selected.reduce((sum, s) => sum + s.price, 0) +
          Math.round(selected.reduce((sum, s) => sum + s.price, 0) * 0.12)) *
          0.18
      );
    setSeats((prev) =>
      prev.map((s) =>
        selectedIds.includes(s.id) ? { ...s, status: "booked" } : s
      )
    );
    setToast({ count: selected.length, total });
    setSelectedIds([]);
    setShowPanel(false);
  };

  return (
    <div className="w-full h-screen bg-[#050508] relative overflow-hidden">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 text-xl">🎬</span>
          <div>
            <h1 className="text-white font-bold text-sm tracking-widest">CINEPLEX PRIME</h1>
            <p className="text-white/40 text-xs">Premium 4DX Experience</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-white/60 text-xs">INTERSTELLAR: BEYOND THE HORIZON</p>
            <p className="text-white/30 text-xs">Today · 7:30 PM · Audi 1</p>
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowPanel(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-yellow-900/40"
            >
              {selectedIds.length} Selected · View
            </button>
          )}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 55 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <TheaterScene seats={seats} onSelect={handleSelect} />
        <LoaderOverlay />
      </Canvas>

      {/* Legend */}
      <SeatLegend />

      {/* Booking panel */}
      {showPanel && (
        <BookingPanel
          seats={seats}
          selectedIds={selectedIds}
          onClose={() => setShowPanel(false)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <ConfirmToast
          count={toast.count}
          total={toast.total}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Screen indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-white/20 text-xs tracking-widest uppercase">
        ← scroll to zoom · drag to orbit →
      </div>
    </div>
  );
}
