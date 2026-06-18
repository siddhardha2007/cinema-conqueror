import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const SCREEN_WIDTH  = 28;
const SCREEN_HEIGHT = 13;
const SCREEN_Y      = 6;
const SCREEN_Z      = -22;

const SEAT_CATEGORIES = {
  PLATINUM: { label: "Platinum Recliner", color: "#d4af37", emissive: "#d4af37", price: 699, rows: 2 },
  GOLD:     { label: "Gold",              color: "#c0843a", emissive: "#c0843a", price: 449, rows: 4 },
  SILVER:   { label: "Silver",            color: "#7b9dc4", emissive: "#7b9dc4", price: 249, rows: 5 },
} as const;

const SEATS_PER_ROW  = 16;
const SEAT_SPACING_X = 1.35;
const SEAT_SPACING_Z = 1.6;
const ROW_LABELS     = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SeatCategory = keyof typeof SEAT_CATEGORIES;
type SeatStatus   = "available" | "booked" | "selected";

interface SeatData {
  id: string; row: number; col: number;
  category: SeatCategory; status: SeatStatus; price: number;
}

// ─────────────────────────────────────────────
// ANIMATED SCREEN  — looks like a trailer is playing
// ─────────────────────────────────────────────
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef  = useRef<THREE.Mesh>(null);
  const scanRef    = useRef<THREE.Mesh>(null);
  const overlayRef = useRef<THREE.Mesh>(null);

  // Six cinematic scene "moods" that cross-fade like trailer cuts
  const palette = useMemo(() => [
    { bg: new THREE.Color("#ff6a00"), fg: new THREE.Color("#1a0500") }, // fiery orange
    { bg: new THREE.Color("#0033aa"), fg: new THREE.Color("#000818") }, // deep space blue
    { bg: new THREE.Color("#00aa44"), fg: new THREE.Color("#001208") }, // jungle green
    { bg: new THREE.Color("#aa0033"), fg: new THREE.Color("#180004") }, // blood red
    { bg: new THREE.Color("#6600cc"), fg: new THREE.Color("#0a0018") }, // cosmic purple
    { bg: new THREE.Color("#00aacc"), fg: new THREE.Color("#000c10") }, // ice teal
  ], []);

  const tmpBg = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t   = state.clock.elapsedTime;
    // Each "scene" lasts 2 s, 0.5 s cross-fade
    const raw  = (t * 0.5) % palette.length;        // 0.5 scenes/sec
    const idx  = Math.floor(raw) % palette.length;
    const next = (idx + 1) % palette.length;
    const frac = raw % 1;

    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      // Blend between scene colours
      tmpBg.lerpColors(palette[idx].bg, palette[next].bg, frac);
      mat.emissive.copy(tmpBg);
      // Bright, pulsing like a real projector
      mat.emissiveIntensity = 1.6 + Math.sin(t * 2.5) * 0.2 + Math.sin(t * 0.7) * 0.15;
      // Screen surface stays white-ish so colour shows through
      mat.color.setRGB(0.92, 0.95, 1.0);
    }

    // Scanline sweeps top→bottom
    if (scanRef.current) {
      scanRef.current.position.y = SCREEN_HEIGHT / 2 - ((t * 4) % SCREEN_HEIGHT);
      (scanRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.07 + Math.sin(t * 5) * 0.03;
    }

    // Vignette overlay pulses slightly
    if (overlayRef.current) {
      (overlayRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.18 + Math.sin(t * 0.4) * 0.06;
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>

      {/* ── Wall behind ── */}
      <mesh position={[0, 0, -1.5]} receiveShadow>
        <boxGeometry args={[45, 22, 0.5]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.9} />
      </mesh>

      {/* ── Architectural side panels ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 3.5), 0, -1]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4, SCREEN_HEIGHT + 5, 0.4]} />
            <meshStandardMaterial color="#15152a" roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[side * -0.5, 0, 0.3]} castShadow>
            <boxGeometry args={[2.5, SCREEN_HEIGHT + 4, 0.2]} />
            <meshStandardMaterial color="#1a1a35" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[side * -0.5, 0, 0.5]}>
            <boxGeometry args={[0.08, SCREEN_HEIGHT + 4, 0.06]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2.5} />
          </mesh>
          <pointLight position={[side * -0.5, 0, 0.6]} intensity={1.5} distance={6} color="#3b82f6" />
        </group>
      ))}

      {/* ── Multi-layer premium frame ── */}
      <mesh position={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 2.5, SCREEN_HEIGHT + 2, 0.25]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 1.8, SCREEN_HEIGHT + 1.3, 0.18]} />
        <meshStandardMaterial color="#1a1a35" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 0.8, SCREEN_HEIGHT + 0.5, 0.12]} />
        <meshStandardMaterial color="#20203a" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* ── MAIN SCREEN SURFACE — animated trailer colours ── */}
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial
          color="#eef2ff"
          roughness={0.08}
          metalness={0.0}
          emissive="#0033aa"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      {/* ── Scanline ── */}
      <mesh ref={scanRef} position={[0, 0, 0.04]}>
        <planeGeometry args={[SCREEN_WIDTH, 0.55]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.07} depthWrite={false} />
      </mesh>

      {/* ── Vignette border darkening ── */}
      <mesh ref={overlayRef} position={[0, 0, 0.03]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.1, SCREEN_HEIGHT + 0.1]} />
        <meshBasicMaterial color="#000022" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* ── Screen lighting — floods entire auditorium ── */}
      <pointLight position={[0, 0, 7]}   intensity={14} distance={55} color="#c8d8ff" castShadow />
      <pointLight position={[-10, 3, 5]} intensity={6}  distance={30} color="#8899dd" />
      <pointLight position={[ 10, 3, 5]} intensity={6}  distance={30} color="#8899dd" />
      <pointLight position={[0,  SCREEN_HEIGHT / 2 + 1, 3]} intensity={4} distance={20} color="#aabbee" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 1, 3]} intensity={3} distance={16} color="#7788cc" />

      {/* ── Premium velvet curtains ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4), 0, 0.8]}>
          {[...Array(10)].map((_, i) => {
            const xOffset = side * (i * 0.35);
            const zWave   = Math.sin(i * 0.6) * 0.18 + Math.cos(i * 1.2) * 0.12;
            const yOffset = -Math.abs(Math.sin(i * 0.5)) * 0.15;
            const width   = 0.32 + Math.sin(i * 0.8) * 0.05;
            return (
              <mesh key={i} position={[xOffset, yOffset, zWave]} castShadow receiveShadow>
                <boxGeometry args={[width, SCREEN_HEIGHT + 4.5, 0.12]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? "#7a1515" : "#922020"}
                  roughness={0.96} metalness={0.02}
                />
              </mesh>
            );
          })}
          <mesh position={[side * 1.5, 0, 0]} castShadow>
            <boxGeometry args={[0.15, SCREEN_HEIGHT + 4.5, 0.15]} />
            <meshStandardMaterial color="#5a1010" roughness={0.85} metalness={0.15} />
          </mesh>
        </group>
      ))}

      {/* ── Ornate curtain rod ── */}
      <group position={[0, SCREEN_HEIGHT / 2 + 2.8, 1]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, SCREEN_WIDTH + 14, 20]} />
          <meshStandardMaterial color="#8b7355" roughness={0.15} metalness={0.92} />
        </mesh>
        {[...Array(12)].map((_, i) => {
          const x = (i - 5.5) * 2.2;
          return (
            <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.18, 0.03, 12, 20]} />
              <meshStandardMaterial color="#6a5a45" roughness={0.2} metalness={0.88} />
            </mesh>
          );
        })}
      </group>

      {/* ── Finials ── */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 7.5), SCREEN_HEIGHT / 2 + 2.8, 1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.35, 20, 20]} />
            <meshStandardMaterial color="#d4af37" roughness={0.15} metalness={0.95} emissive="#d4af37" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow>
            <coneGeometry args={[0.2, 0.5, 16]} />
            <meshStandardMaterial color="#d4af37" roughness={0.15} metalness={0.95} emissive="#d4af37" emissiveIntensity={0.3} />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={0.8} distance={3} color="#d4af37" />
        </group>
      ))}

      {/* ── Pelmet ── */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.2, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[SCREEN_WIDTH + 12, 2.5, 1]} />
        <meshStandardMaterial color="#6a1515" roughness={0.92} />
      </mesh>
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.95, 1.15]}>
        <boxGeometry args={[SCREEN_WIDTH + 12, 0.15, 0.15]} />
        <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* ── Ambient particles ── */}
      {[...Array(25)].map((_, i) => {
        const angle  = (i / 25) * Math.PI * 2;
        const radius = SCREEN_WIDTH / 2 + 1 + (i % 3) * 0.8;
        const x      = Math.cos(angle) * radius;
        const y      = Math.sin(angle) * (SCREEN_HEIGHT / 2 + 1);
        const z      = (i % 4) * 0.4;
        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#5577dd" transparent opacity={0.45} />
          </mesh>
        );
      })}

      {/* ── NOW SHOWING title ── */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 2, 0.5]}>
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[SCREEN_WIDTH - 2, 1.5]} />
          <meshStandardMaterial color="#0f0f22" transparent opacity={0.6} roughness={0.8} />
        </mesh>
        <Text fontSize={0.5} color="#6b8cce" anchorX="center" anchorY="middle" letterSpacing={0.18} position={[0, 0.35, 0]}>
          NOW SHOWING
        </Text>
        <mesh position={[0, 0.05, 0]}>
          <planeGeometry args={[8, 0.02]} />
          <meshBasicMaterial color="#4a6a9a" />
        </mesh>
        <Text position={[0, -0.4, 0]} fontSize={0.42} color="#9ab0d9" anchorX="center" anchorY="middle" letterSpacing={0.1} maxWidth={SCREEN_WIDTH - 3}>
          {movieTitle.toUpperCase()}
        </Text>
      </group>

      {/* ── Spotlights ── */}
      <spotLight position={[0, SCREEN_HEIGHT / 2 + 4, 3]} angle={0.9} penumbra={0.6} intensity={5} distance={30} color="#8899cc" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      {([-1, 1] as const).map((side) => (
        <spotLight key={side} position={[side * (SCREEN_WIDTH / 2 + 2), SCREEN_Y, SCREEN_Z + 4]} angle={0.5} penumbra={0.7} intensity={2} distance={22} color="#5577dd" />
      ))}
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 2, 2]} intensity={2} distance={12} color="#4a5a8a" />

      {/* ── Projector beam from behind camera ── */}
      <spotLight
        position={[0, SCREEN_Y + 3, 18]}
        angle={0.14}
        penumbra={0.4}
        intensity={12}
        distance={70}
        color="#ddeeff"
      />
    </group>
  );
}

// ─────────────────────────────────────────────
// FLOOR
// ─────────────────────────────────────────────
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
            {/* Carpet aisle */}
            <mesh position={[0, y + 0.01, z]}>
              <boxGeometry args={[1.6, 0.01, 2.8]} />
              <meshStandardMaterial color="#4a0e0e" roughness={0.98} />
            </mesh>
            {/* LED floor strips */}
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

// ─────────────────────────────────────────────
// WALLS & CEILING
// ─────────────────────────────────────────────
function TheaterWalls() {
  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * 20, 3, -5]} receiveShadow>
            <boxGeometry args={[0.4, 18, 46]} />
            <meshStandardMaterial color="#0c0c1a" roughness={0.9} />
          </mesh>
          {[...Array(7)].map((_, i) => (
            <mesh key={i} position={[side * 19.7, 0.5 + i * 1.3, -5]}>
              <boxGeometry args={[0.04, 0.04, 44]} />
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
      {[...Array(6)].map((_, i) => (
        <pointLight key={i} position={[(i - 2.5) * 7, 11.5, -5]} intensity={1.2} distance={14} color="#2a2a6a" />
      ))}
      {/* Back wall */}
      <mesh position={[0, 3, 20]} receiveShadow>
        <boxGeometry args={[42, 18, 0.4]} />
        <meshStandardMaterial color="#080812" roughness={0.95} />
      </mesh>
      {/* Projection booth */}
      <mesh position={[0, 8, 18]} castShadow>
        <boxGeometry args={[7, 4.5, 2.5]} />
        <meshStandardMaterial color="#111122" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 8, 16.8]}>
        <boxGeometry args={[3.5, 1.8, 0.08]} />
        <meshStandardMaterial color="#1a2a4a" transparent opacity={0.55} roughness={0.1} metalness={0.85} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────
// SEAT
// ─────────────────────────────────────────────
function TheaterSeat({
  seat, onSelect, position,
}: {
  seat: SeatData; onSelect: (id: string) => void; position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const cat         = SEAT_CATEGORIES[seat.category];
  const isPlatinum  = seat.category === "PLATINUM";

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
    const mat    = meshRef.current.material as THREE.MeshStandardMaterial;
    const target = hovered && seat.status === "available" ? 1.0
      : seat.status === "selected" ? 0.75 : 0.18;
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
        <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.18} roughness={isPlatinum ? 0.55 : 0.78} metalness={isPlatinum ? 0.15 : 0.04} />
      </mesh>
      {/* Back */}
      <mesh position={[0, isPlatinum ? 0.62 : 0.52, isPlatinum ? -0.3 : -0.26]} castShadow>
        <boxGeometry args={isPlatinum ? [0.85, 0.78, 0.15] : [0.78, 0.68, 0.13]} />
        <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.12} roughness={isPlatinum ? 0.55 : 0.78} metalness={isPlatinum ? 0.15 : 0.04} />
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
          <meshStandardMaterial color={baseColor} emissive={emissiveColor} emissiveIntensity={0.2} roughness={0.5} />
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
        <pointLight position={[0, 0.3, 0]} intensity={2} distance={2.2} color="#22c55e" />
      )}
    </group>
  );
}

// ─────────────────────────────────────────────
// SEATS LAYOUT
// ─────────────────────────────────────────────
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
      {[...Array(totalRows)].map((_, row) => {
        const z = rowStartZ + row * SEAT_SPACING_Z;
        const y = -1.4 + row * 0.28 + 0.5;
        return ([-1, 1] as const).map((side) => (
          <Text key={`${row}-${side}`} position={[side * 11.8, y, z]} fontSize={0.3} color="#ffffff40" anchorX="center" anchorY="middle">
            {ROW_LABELS[row]}
          </Text>
        ));
      })}
    </group>
  );
}

// ─────────────────────────────────────────────
// GENERATE SEAT DATA
// ─────────────────────────────────────────────
function generateSeats(): SeatData[] {
  const seats: SeatData[] = [];
  let globalRow = 0;
  (Object.entries(SEAT_CATEGORIES) as [SeatCategory, (typeof SEAT_CATEGORIES)[SeatCategory]][]).forEach(
    ([cat, cfg]) => {
      for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < SEATS_PER_ROW; c++) {
          if (c === 7 || c === 8) continue;
          const status: SeatStatus = Math.random() < 0.22 ? "booked" : "available";
          seats.push({ id: `${cat}-${globalRow}-${c}`, row: globalRow, col: c, category: cat, status, price: cfg.price });
        }
        globalRow++;
      }
    }
  );
  return seats;
}

// ─────────────────────────────────────────────
// MINIMAL BOTTOM BAR  (₹ prices)
// ─────────────────────────────────────────────
function BottomBar({
  seats, selectedIds, onConfirm,
}: {
  seats: SeatData[]; selectedIds: string[]; onConfirm: () => void;
}) {
  const selected = seats.filter((s) => selectedIds.includes(s.id));
  const sub      = selected.reduce((a, s) => a + s.price, 0);
  const conv     = Math.round(sub * 0.12);
  const gst      = Math.round((sub + conv) * 0.18);
  const total    = sub + conv + gst;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 max-w-[95vw]">
      {/* Category legend */}
      {(Object.entries(SEAT_CATEGORIES) as [SeatCategory, (typeof SEAT_CATEGORIES)[SeatCategory]][]).map(([key, cat]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="text-white/55 text-xs hidden sm:inline">{cat.label}</span>
          <span className="text-white/90 text-xs font-semibold">₹{cat.price}</span>
        </div>
      ))}

      <div className="w-px h-5 bg-white/15" />

      {/* Status legend */}
      {[{ color: "#2a2a3a", label: "Booked" }, { color: "#22c55e", label: "Selected" }].map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
          <span className="text-white/45 text-xs">{s.label}</span>
        </div>
      ))}

      {/* Pay button — appears only when seats selected */}
      {selected.length > 0 && (
        <>
          <div className="w-px h-5 bg-white/15" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-white/45 text-[10px]">{selected.length} seat{selected.length > 1 ? "s" : ""} · incl. GST</p>
              <p className="text-yellow-400 text-sm font-bold">₹{total.toLocaleString("en-IN")}</p>
            </div>
            <button
              onClick={onConfirm}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-yellow-900/40 whitespace-nowrap active:scale-95"
            >
              PAY ₹{total.toLocaleString("en-IN")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT EXPORT
// ─────────────────────────────────────────────
export default function CinemaBooking() {
  const [seats, setSeats]             = useState<SeatData[]>(() => generateSeats());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast]             = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSeats((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === "selected" ? "available" : "selected" } : s
      )
    );
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const selected = seats.filter((s) => selectedIds.includes(s.id));
    const sub   = selected.reduce((a, s) => a + s.price, 0);
    const conv  = Math.round(sub * 0.12);
    const gst   = Math.round((sub + conv) * 0.18);
    const total = sub + conv + gst;
    setSeats((prev) =>
      prev.map((s) => selectedIds.includes(s.id) ? { ...s, status: "booked" } : s)
    );
    setToast(`✓ ${selected.length} seat${selected.length > 1 ? "s" : ""} booked · ₹${total.toLocaleString("en-IN")} charged`);
    setSelectedIds([]);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="w-full h-screen bg-[#050508] relative overflow-hidden">
      {/* Top minimal label */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <p className="text-white/25 text-[11px] tracking-[0.28em] uppercase">🎬 Cineplex Prime · Audi 1 · 7:30 PM</p>
      </div>

      {/* 3-D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 7, 14], fov: 58 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
      >
        <color attach="background" args={["#050508"]} />
        <fog attach="fog" args={["#050508", 38, 78]} />

        {/* Gentle ambient so seats are never completely black */}
        <ambientLight intensity={0.18} color="#2233bb" />
        <pointLight position={[0, 10, 5]} intensity={0.5} distance={40} color="#1a1a4a" />

        <PremiumTheaterScreen movieTitle="Interstellar: Beyond the Horizon" />
        <TheaterFloor />
        <TheaterWalls />
        <SeatsLayout seats={seats} onSelect={handleSelect} />

        <OrbitControls
          target={[0, 2, -8]}
          minDistance={6}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.08}
          enablePan={false}
          dampingFactor={0.08}
          enableDamping
        />
        <Environment preset="night" />
      </Canvas>

      {/* Bottom bar */}
      <BottomBar seats={seats} selectedIds={selectedIds} onConfirm={handleConfirm} />

      {/* Toast */}
      {toast && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 bg-green-950/90 border border-green-500/30 backdrop-blur-md rounded-xl px-5 py-2.5 text-green-300 text-sm font-medium shadow-2xl whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Hint */}
      <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/12 text-[10px] tracking-widest pointer-events-none select-none">
        scroll to zoom · drag to orbit
      </p>
    </div>
  );
}
