import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

// ============================================================
// CONSTANTS
// ============================================================
const SCREEN_WIDTH = 28;
const SCREEN_HEIGHT = 13;
const SCREEN_Y = 6;
const SCREEN_Z = -22;

const SEAT_CATEGORIES = {
  PLATINUM: { label: "Platinum Recliner", color: "#d4af37", emissive: "#d4af37", price: 699, rows: 2 },
  GOLD:     { label: "Gold",              color: "#c0843a", emissive: "#c0843a", price: 449, rows: 4 },
  SILVER:   { label: "Silver",            color: "#7b9dc4", emissive: "#7b9dc4", price: 249, rows: 5 },
} as const;

const SEATS_PER_ROW = 16;
const SEAT_SPACING_X = 1.35;
const SEAT_SPACING_Z = 1.6;
const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SeatCategory = keyof typeof SEAT_CATEGORIES;
type SeatStatus = "available" | "booked" | "selected";

interface SeatData {
  id: string;
  row: number;
  col: number;
  category: SeatCategory;
  status: SeatStatus;
  price: number;
}

// ============================================================
// ANIMATED SCREEN  (simulates trailer with color cycling)
// ============================================================
function TheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef  = useRef<THREE.Mesh>(null);
  const scanRef    = useRef<THREE.Mesh>(null);
  const glowRef    = useRef<THREE.Mesh>(null);

  // Pre-build a simple "trailer" palette — cycles through warm/cool cinematic tones
  const palette = useMemo(
    () => [
      new THREE.Color("#1a0a00"),
      new THREE.Color("#0a0a2a"),
      new THREE.Color("#001a0a"),
      new THREE.Color("#1a0010"),
      new THREE.Color("#0a1020"),
      new THREE.Color("#150a00"),
    ],
    []
  );

  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // ── Cinematic screen glow / color shift ──
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      const idx  = Math.floor(t * 0.4) % palette.length;
      const next = (idx + 1) % palette.length;
      const frac = (t * 0.4) % 1;
      tmpColor.lerpColors(palette[idx], palette[next], frac);

      // Base screen brightness — much brighter than before
      mat.emissive.copy(tmpColor).multiplyScalar(1);
      mat.emissiveIntensity = 2.8 + Math.sin(t * 1.2) * 0.4;
      mat.color.set("#d8e8ff"); // near-white screen surface
    }

    // ── Scanline sweeping top → bottom ──
    if (scanRef.current) {
      const y = SCREEN_HEIGHT / 2 - ((t * 3.5) % SCREEN_HEIGHT);
      scanRef.current.position.y = y;
      const mat = scanRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.sin(t * 4) * 0.03;
    }

    // ── Subtle border pulse ──
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(t * 0.8) * 0.06;
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
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5, SCREEN_HEIGHT + 7, 0.5]} />
            <meshStandardMaterial color="#111128" roughness={0.75} metalness={0.25} />
          </mesh>
          <mesh position={[side * -0.6, 0, 0.35]}>
            <boxGeometry args={[3, SCREEN_HEIGHT + 6, 0.22]} />
            <meshStandardMaterial color="#181838" roughness={0.6} metalness={0.45} />
          </mesh>
          {/* LED strip A — blue */}
          <mesh position={[side * -0.85, 0, 0.55]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 6, 0.06]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={3.5} />
          </mesh>
          {/* LED strip B — violet */}
          <mesh position={[side * -0.15, 0, 0.55]}>
            <boxGeometry args={[0.06, SCREEN_HEIGHT + 6, 0.06]} />
            <meshStandardMaterial color="#6d28d9" emissive="#6d28d9" emissiveIntensity={3} />
          </mesh>
          <pointLight position={[side * -0.85, 0, 0.7]} intensity={2}   distance={8}  color="#3b82f6" />
          <pointLight position={[side * -0.15, 0, 0.7]} intensity={1.5} distance={6}  color="#6d28d9" />
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

      {/* ── Glowing frame border ── */}
      <mesh ref={glowRef} position={[0, 0, 0.005]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.15, SCREEN_HEIGHT + 0.15]} />
        <meshBasicMaterial color="#4466cc" transparent opacity={0.15} />
      </mesh>

      {/* ── MAIN SCREEN — bright, glowing, animated ── */}
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial
          color="#d8e8ff"
          roughness={0.08}
          metalness={0.1}
          emissive="#0a0a30"
          emissiveIntensity={2.8}
          toneMapped={false}
        />
      </mesh>

      {/* ── Scanline ── */}
      <mesh ref={scanRef} position={[0, 0, 0.04]}>
        <planeGeometry args={[SCREEN_WIDTH, 0.6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
      </mesh>

      {/* ── Screen lighting — floods the whole auditorium ── */}
      <pointLight position={[0,  0,  8]}  intensity={12} distance={55} color="#c8d8ff" castShadow />
      <pointLight position={[-10, 3, 5]}  intensity={5}  distance={30} color="#8899dd" />
      <pointLight position={[ 10, 3, 5]}  intensity={5}  distance={30} color="#8899dd" />
      <pointLight position={[0,  SCREEN_HEIGHT / 2 + 2, 4]} intensity={4} distance={22} color="#aabbee" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 2, 4]} intensity={3} distance={18} color="#7788cc" />

      {/* ── Velvet curtains ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4.5), 0, 0.9]}>
          {[...Array(12)].map((_, i) => {
            const xOff  = side * i * 0.38;
            const zWave = Math.sin(i * 0.55) * 0.22 + Math.cos(i * 1.1) * 0.14;
            const yOff  = -Math.abs(Math.sin(i * 0.45)) * 0.18;
            const w     = 0.3 + Math.sin(i * 0.7) * 0.06;
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
            <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.9} emissive="#d4af37" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {/* ── Curtain rod ── */}
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
          <pointLight position={[0, 0, 0]} intensity={1} distance={4} color="#d4af37" />
        </group>
      ))}

      {/* ── Pelmet ── */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.4, 0.7]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 14, 2.8, 1.1]} />
        <meshStandardMaterial color="#5a1010" roughness={0.93} />
      </mesh>
      {/* Gold trim lines */}
      {[1.0, 3.8].map((yo) => (
        <mesh key={yo} position={[0, SCREEN_HEIGHT / 2 + yo, 1.3]}>
          <boxGeometry args={[SCREEN_WIDTH + 14, 0.1, 0.12]} />
          <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.92} emissive="#d4af37" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* ── NOW SHOWING title ── */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 2.2, 0.6]}>
        <mesh position={[0, 0, -0.06]}>
          <planeGeometry args={[SCREEN_WIDTH - 1, 2]} />
          <meshStandardMaterial color="#0a0a1e" transparent opacity={0.7} roughness={0.9} />
        </mesh>
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
        <Text position={[0, -0.38, 0]} fontSize={0.44} color="#c8d8f0" anchorX="center" anchorY="middle" letterSpacing={0.12} maxWidth={SCREEN_WIDTH - 4}>
          {movieTitle.toUpperCase()}
        </Text>
        <mesh position={[0, -0.72, 0]}>
          <planeGeometry args={[10, 0.025]} />
          <meshBasicMaterial color="#d4af37" />
        </mesh>
      </group>

      {/* ── Spotlights ── */}
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 5, 4]} angle={0.85} penumbra={0.65} intensity={6} distance={35} color="#aabbee" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      {([-1, 1] as const).map((side) => (
        <spotLight key={side} position={[side * (SCREEN_WIDTH / 2 + 2), 8, SCREEN_Z + 6]} angle={0.45} penumbra={0.7} intensity={3} distance={28} color="#5577dd" />
      ))}
    </group>
  );
}

// ============================================================
// THEATER FLOOR
// ============================================================
function TheaterFloor() {
  return (
    <group>
      {[...Array(11)].map((_, i) => {
        const z = -18 + i * 2.8;
        const y = -1.5 + i * 0.28;
        return (
          <group key={i}>
            <mesh position={[0, y - 0.14, z]} receiveShadow>
              <boxGeometry args={[36, 0.28, 2.8]} />
              <meshStandardMaterial color={i % 2 === 0 ? "#0e0e1c" : "#0c0c18"} roughness={0.92} />
            </mesh>
            {/* Aisle carpet strip */}
            <mesh position={[0, y + 0.01, z]} receiveShadow>
              <boxGeometry args={[1.6, 0.01, 2.8]} />
              <meshStandardMaterial color="#4a0e0e" roughness={0.98} />
            </mesh>
            {/* Aisle LED strips */}
            {([-1, 1] as const).map((side) => (
              <mesh key={side} position={[side * 1.25, y + 0.015, z]}>
                <boxGeometry args={[0.07, 0.01, 2.5]} />
                <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2.5} />
              </mesh>
            ))}
          </group>
        );
      })}
      <mesh position={[0, -3, 0]} receiveShadow>
        <boxGeometry args={[50, 0.5, 60]} />
        <meshStandardMaterial color="#080810" roughness={1} />
      </mesh>
    </group>
  );
}

// ============================================================
// WALLS & CEILING
// ============================================================
function TheaterWalls() {
  return (
    <group>
      {/* Side walls */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * 20, 3, -5]} receiveShadow>
            <boxGeometry args={[0.4, 18, 46]} />
            <meshStandardMaterial color="#0c0c1a" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Wall LED strips */}
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[side * 19.6, 1 + i * 1.2, -5]}>
              <boxGeometry args={[0.05, 0.04, 44]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
                emissive={i % 2 === 0 ? "#3b82f6" : "#6d28d9"}
                emissiveIntensity={1.5}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Ceiling */}
      <mesh position={[0, 12, -5]} receiveShadow>
        <boxGeometry args={[42, 0.4, 46]} />
        <meshStandardMaterial color="#09091a" roughness={0.95} />
      </mesh>
      {/* Ceiling cove lights */}
      {[...Array(6)].map((_, i) => (
        <pointLight key={i} position={[(i - 2.5) * 7, 11.5, -5]} intensity={1.5} distance={16} color="#2a2a6a" />
      ))}

      {/* Projection booth */}
      <mesh position={[0, 8, 18]} castShadow receiveShadow>
        <boxGeometry args={[8, 5, 3]} />
        <meshStandardMaterial color="#111122" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 8, 16.4]}>
        <boxGeometry args={[4, 2, 0.1]} />
        <meshStandardMaterial color="#1a2a4a" transparent opacity={0.6} roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Projector beam toward screen */}
      <spotLight
        position={[0, 8, 15]}
        angle={0.16}
        penumbra={0.45}
        intensity={10}
        distance={65}
        color="#ddeeff"
      />
    </group>
  );
}

// ============================================================
// SEAT
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
  const isPlatinum = seat.category === "PLATINUM";

  const baseColor = useMemo(() => {
    if (seat.status === "booked")   return "#2a2a3a";
    if (seat.status === "selected") return "#22c55e";
    return cat.color;
  }, [seat.status, cat.color]);

  const emissiveColor = useMemo(() => {
    if (seat.status === "booked")   return "#111118";
    if (seat.status === "selected") return "#16a34a";
    return cat.emissive;
  }, [seat.status, cat.emissive]);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const target = hovered && seat.status === "available" ? 1.0
      : seat.status === "selected" ? 0.8 : 0.18;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, 0.12);
  });

  return (
    <group
      position={position}
      onClick={() => seat.status === "available" && onSelect(seat.id)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Cushion */}
      <mesh ref={meshRef} position={[0, isPlatinum ? 0.18 : 0.12, 0]} castShadow>
        <boxGeometry args={isPlatinum ? [0.85, 0.22, 0.75] : [0.78, 0.18, 0.68]} />
        <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.18} roughness={isPlatinum ? 0.55 : 0.75} metalness={isPlatinum ? 0.15 : 0.05} />
      </mesh>
      {/* Back */}
      <mesh position={[0, isPlatinum ? 0.62 : 0.52, isPlatinum ? -0.3 : -0.26]} castShadow>
        <boxGeometry args={isPlatinum ? [0.85, 0.78, 0.15] : [0.78, 0.68, 0.13]} />
        <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.12} roughness={isPlatinum ? 0.55 : 0.75} metalness={isPlatinum ? 0.15 : 0.05} />
      </mesh>
      {/* Armrests */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (isPlatinum ? 0.48 : 0.44), isPlatinum ? 0.38 : 0.32, isPlatinum ? -0.06 : -0.04]} castShadow>
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
      {/* Indicator dot */}
      <mesh position={[0, 0.03, 0.32]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={seat.status === "booked" ? "#333" : cat.color} emissive={seat.status === "booked" ? "#000" : cat.emissive} emissiveIntensity={0.9} />
      </mesh>
      {hovered && seat.status === "available" && (
        <pointLight position={[0, 0.2, 0]} intensity={1.8} distance={2} color={cat.color} />
      )}
      {seat.status === "selected" && (
        <pointLight position={[0, 0.3, 0]} intensity={2.2} distance={2.2} color="#22c55e" />
      )}
    </group>
  );
}

// ============================================================
// SEATS LAYOUT
// ============================================================
function SeatsLayout({ seats, onSelect }: { seats: SeatData[]; onSelect: (id: string) => void }) {
  const rowStartZ = -16;
  const totalRows = Object.values(SEAT_CATEGORIES).reduce((s, c) => s + c.rows, 0);
  return (
    <group>
      {seats.map((seat) => {
        if (seat.col === 7 || seat.col === 8) return null;
        const x = (seat.col - SEATS_PER_ROW / 2 + 0.5) * SEAT_SPACING_X;
        const z = rowStartZ + seat.row * SEAT_SPACING_Z;
        const y = -1.4 + seat.row * 0.28;
        return <TheaterSeat key={seat.id} seat={seat} onSelect={onSelect} position={[x, y, z]} />;
      })}
      {/* Row labels */}
      {[...Array(totalRows)].map((_, row) => {
        const z = rowStartZ + row * SEAT_SPACING_Z;
        const y = -1.4 + row * 0.28;
        return ([-1, 1] as const).map((side) => (
          <Text key={`${row}-${side}`} position={[side * 11.8, y + 0.5, z]} fontSize={0.3} color="#ffffff44" anchorX="center" anchorY="middle">
            {ROW_LABELS[row]}
          </Text>
        ));
      })}
    </group>
  );
}

// ============================================================
// GENERATE SEATS
// ============================================================
function generateSeats(): SeatData[] {
  const seats: SeatData[] = [];
  let globalRow = 0;
  (Object.entries(SEAT_CATEGORIES) as [SeatCategory, typeof SEAT_CATEGORIES[SeatCategory]][]).forEach(([cat, cfg]) => {
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < SEATS_PER_ROW; c++) {
        if (c === 7 || c === 8) continue;
        const rand   = Math.random();
        const status: SeatStatus = rand < 0.2 ? "booked" : "available";
        seats.push({ id: `${cat}-${globalRow}-${c}`, row: globalRow, col: c, category: cat, status, price: cfg.price });
      }
      globalRow++;
    }
  });
  return seats;
}

// ============================================================
// MINIMAL BOOKING UI  (only what's needed)
// ============================================================
function MinimalBookingUI({
  seats,
  selectedIds,
  onConfirm,
}: {
  seats: SeatData[];
  selectedIds: string[];
  onConfirm: () => void;
}) {
  const selected = seats.filter((s) => selectedIds.includes(s.id));
  const sub  = selected.reduce((sum, s) => sum + s.price, 0);
  const conv = Math.round(sub * 0.12);
  const gst  = Math.round((sub + conv) * 0.18);
  const total = sub + conv + gst;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3">
      {/* Legend dots */}
      {(Object.entries(SEAT_CATEGORIES) as [SeatCategory, typeof SEAT_CATEGORIES[SeatCategory]][]).map(([key, cat]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
          <span className="text-white/60 text-xs">{cat.label}</span>
          <span className="text-white text-xs font-semibold">₹{cat.price}</span>
        </div>
      ))}

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Status */}
      {[
        { color: "#2a2a3a", label: "Booked" },
        { color: "#22c55e", label: "Selected" },
      ].map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          <span className="text-white/50 text-xs">{s.label}</span>
        </div>
      ))}

      {/* Confirm button — only shows when seats are selected */}
      {selected.length > 0 && (
        <>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <div className="text-right">
            <p className="text-white/50 text-xs">{selected.length} seat{selected.length > 1 ? "s" : ""}</p>
            <p className="text-yellow-400 text-xs font-bold">₹{total.toLocaleString("en-IN")}</p>
          </div>
          <button
            onClick={onConfirm}
            className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-yellow-900/40 whitespace-nowrap"
          >
            PAY ₹{total.toLocaleString("en-IN")}
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================
// SCENE
// ============================================================
function TheaterScene({ seats, onSelect }: { seats: SeatData[]; onSelect: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={["#050508"]} />
      <fog attach="fog" args={["#050508", 35, 75]} />
      <ambientLight intensity={0.15} color="#2233aa" />
      <PremiumTheaterScreen movieTitle="Interstellar: Beyond the Horizon" />
      <TheaterFloor />
      <TheaterWalls />
      <SeatsLayout seats={seats} onSelect={onSelect} />
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
// ROOT
// ============================================================
export default function CinemaBooking() {
  const [seats, setSeats]           = useState<SeatData[]>(() => generateSeats());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast]           = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, status: s.status === "selected" ? "available" : "selected" };
      })
    );
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const selected = seats.filter((s) => selectedIds.includes(s.id));
    const sub  = selected.reduce((sum, s) => sum + s.price, 0);
    const conv = Math.round(sub * 0.12);
    const gst  = Math.round((sub + conv) * 0.18);
    const total = sub + conv + gst;

    setSeats((prev) =>
      prev.map((s) => selectedIds.includes(s.id) ? { ...s, status: "booked" } : s)
    );
    setToast(`${selected.length} seat${selected.length > 1 ? "s" : ""} booked · ₹${total.toLocaleString("en-IN")} charged`);
    setSelectedIds([]);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="w-full h-screen bg-[#050508] relative overflow-hidden">
      {/* Minimal top label */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
        <p className="text-white/30 text-xs tracking-[0.3em] uppercase">🎬 Cineplex Prime · Audi 1 · 7:30 PM</p>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 55 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
      >
        <TheaterScene seats={seats} onSelect={handleSelect} />
      </Canvas>

      {/* Bottom minimal UI */}
      <MinimalBookingUI seats={seats} selectedIds={selectedIds} onConfirm={handleConfirm} />

      {/* Toast */}
      {toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-green-900/90 border border-green-500/30 backdrop-blur-md rounded-xl px-5 py-2.5 text-green-300 text-sm font-medium shadow-2xl">
          ✓ {toast}
        </div>
      )}

      <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/15 text-xs tracking-widest pointer-events-none">
        scroll to zoom · drag to orbit
      </p>
    </div>
  );
}
