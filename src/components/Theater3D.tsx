import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  RotateCcw,
  Eye,
  Film,
  Clock,
  Volume2,
  VolumeX,
  Camera,
  Grid3X3,
  Ticket,
  CreditCard,
  Star,
  Zap,
  Users,
  Info,
  AlertCircle,
  X,
  Check,
  ArrowUp,
  ArrowDown,
  Maximize2,
} from "lucide-react";

/* ─── simple Button ─── */
const Button = ({
  children,
  onClick,
  className = "",
  variant = "default",
  size = "default",
  disabled = false,
}: any) => {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const v: Record<string, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-white/20 bg-transparent hover:bg-white/10",
  };
  const s: Record<string, string> = {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${v[variant] || v.default} ${s[size] || s.default} ${className}`}
    >
      {children}
    </button>
  );
};

/* ─── DATA ─── */
const movies = [
  {
    id: "1",
    title: "The Dark Knight",
    image:
      "https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911BTUgMe1nEuEr.jpg",
    video: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
    description: "Batman faces the Joker in Gotham.",
    duration: "2h 32m",
    rating: "PG-13",
    genre: "Action, Crime",
  },
  {
    id: "2",
    title: "Inception",
    image:
      "https://image.tmdb.org/t/p/w200/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg",
    video: "https://www.youtube.com/watch?v=YoHD9XEInc0",
    description: "A thief steals secrets through dreams.",
    duration: "2h 28m",
    rating: "PG-13",
    genre: "Sci-Fi, Action",
  },
  {
    id: "3",
    title: "Interstellar",
    image:
      "https://image.tmdb.org/t/p/w200/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    video: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
    description: "Explorers travel through a wormhole.",
    duration: "2h 49m",
    rating: "PG-13",
    genre: "Sci-Fi",
  },
  {
    id: "4",
    title: "Oppenheimer",
    image:
      "https://image.tmdb.org/t/p/w200/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    video: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    description: "The story of the atomic bomb.",
    duration: "3h 0m",
    rating: "R",
    genre: "Drama, History",
  },
];

const showtimes = [
  { id: "1", time: "10:00 AM" },
  { id: "2", time: "1:30 PM" },
  { id: "3", time: "4:00 PM" },
  { id: "4", time: "7:00 PM" },
  { id: "5", time: "9:30 PM" },
  { id: "6", time: "11:45 PM" },
];

function getYouTubeId(url: string) {
  const m = url.match(
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  );
  return m && m[2].length === 11 ? m[2] : null;
}

/* ─── TYPES ─── */
export interface Seat {
  id: string;
  row: string;
  number: number;
  status: "available" | "booked" | "selected";
  type: "standard" | "premium" | "vip" | "accessible";
  price: number;
  isBooked?: boolean;
  isSelected?: boolean;
}

interface Theater3DProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
}
interface CamTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}
type ViewMode = "default" | "topdown" | "front" | "side";

/* ─── LAYOUT CONSTANTS ─── */
const SCR_W = 22;
const SCR_H = 9;
const SCR_Z = -10;
const SCR_Y = 7.5;
const HALL_W = 28;
const DEFAULT_CAM = new THREE.Vector3(0, 12, 22);
const DEFAULT_LOOK = new THREE.Vector3(0, 3, 0);

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── AUDIO ─── */
const useAudio = () => {
  const ctx = useRef<AudioContext | null>(null);
  const playSound = useCallback(
    (type: "click" | "select" | "hover" | "success" | "error") => {
      try {
        if (!ctx.current)
          ctx.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        const c = ctx.current;
        if (c.state === "suspended") c.resume();
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        const f: Record<string, [number, number]> = {
          click: [500, 700],
          select: [600, 900],
          hover: [400, 500],
          success: [800, 1200],
          error: [200, 150],
        };
        const [f1, f2] = f[type] || f.click;
        o.frequency.setValueAtTime(f1, c.currentTime);
        o.frequency.linearRampToValueAtTime(f2, c.currentTime + 0.08);
        o.type = type === "error" ? "sawtooth" : "sine";
        g.gain.setValueAtTime(0.06, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
        o.start(c.currentTime);
        o.stop(c.currentTime + 0.12);
      } catch {
        /* */
      }
    },
    []
  );
  return { playSound };
};

/* ════════════════════════════════════════
   3‑D COMPONENTS THAT LIVE INSIDE <Canvas>
   ════════════════════════════════════════ */

/* ── dust ── */
function Dust({ count = 100 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const pts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 10,
        y: Math.random() * 9 + 3,
        z: (Math.random() - 0.5) * 28,
        sp: Math.random() * 0.2 + 0.04,
        ph: Math.random() * 6.28,
        sc: Math.random() * 0.02 + 0.006,
      })),
    [count]
  );
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    pts.forEach((p, i) => {
      tmp.position.set(
        p.x + Math.sin(t * p.sp + p.ph) * 0.4,
        p.y + Math.sin(t * p.sp * 0.6 + p.ph) * 0.2,
        p.z + Math.cos(t * p.sp * 0.4) * 0.3
      );
      tmp.scale.setScalar(p.sc);
      tmp.updateMatrix();
      ref.current!.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color="#fef3c7"
        transparent
        opacity={0.15}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ── projector beam ── */
function Beam() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.02 + Math.sin(clock.getElapsedTime() * 0.4) * 0.006;
  });
  return (
    <mesh ref={ref} position={[0, 11, 5]} rotation={[0.18, 0, 0]}>
      <coneGeometry args={[10, 32, 24, 1, true]} />
      <meshBasicMaterial
        color="#93c5fd"
        transparent
        opacity={0.02}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ── camera animator ── */
function CamCtrl({
  target,
  running,
  onDone,
  ctrlRef,
}: {
  target: CamTarget;
  running: boolean;
  onDone: () => void;
  ctrlRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const p = useRef(0);
  const from = useRef(new THREE.Vector3());
  const fromT = useRef(new THREE.Vector3());
  useEffect(() => {
    if (running) {
      p.current = 0;
      from.current.copy(camera.position);
      if (ctrlRef.current) fromT.current.copy(ctrlRef.current.target);
    }
  }, [running, target, camera, ctrlRef]);

  useFrame((_, dt) => {
    if (!running) return;
    p.current = Math.min(p.current + dt * 1.6, 1);
    const t = ease(p.current);
    camera.position.lerpVectors(from.current, target.position, t);
    if (ctrlRef.current) {
      ctrlRef.current.target.lerpVectors(fromT.current, target.lookAt, t);
      ctrlRef.current.update();
    }
    if (p.current >= 1) onDone();
  });
  return null;
}

/* ─────────────────────────────────────
   CINEMA SCREEN  –  YouTube is rendered
   with <Html> directly on the 3‑D mesh
   so it moves with the camera perfectly.
   ───────────────────────────────────── */
function CinemaScreen({
  movieTitle,
  youtubeId,
}: {
  movieTitle: string;
  youtubeId: string | null;
}) {
  const glowRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (glowRef.current)
      glowRef.current.intensity =
        3 + Math.sin(clock.getElapsedTime() * 0.3) * 0.4;
  });

  return (
    <group position={[0, SCR_Y, SCR_Z]}>
      {/* recess */}
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[SCR_W + 2, SCR_H + 1.5, 0.5]} />
        <meshStandardMaterial color="#111827" roughness={0.92} />
      </mesh>

      {/* silver frame */}
      <mesh position={[0, 0, -0.07]}>
        <planeGeometry args={[SCR_W + 0.5, SCR_H + 0.3]} />
        <meshStandardMaterial
          color="#9ca3af"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* screen surface (dark) */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[SCR_W, SCR_H]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#1e3a5f"
          emissiveIntensity={0.1}
          roughness={0.95}
        />
      </mesh>

      {/*
        ★ KEY FIX ★
        YouTube iframe lives INSIDE the 3D scene via drei <Html>.
        - transform keeps it glued to this group
        - The div is sized to cover the screen plane exactly
        - occlude={false} so it is always visible when the screen is
        - pointerEvents='auto' lets user interact with controls
      */}
      {youtubeId && (
        <Html
          transform
          position={[0, 0, 0.01]}
          scale={0.0345}
          // each "1 unit" of the Html in 3‑D ≈ 0.0345 CSS‑px, so
          // we size the iframe to cover SCR_W × SCR_H world units.
          // 22 / 0.0345 ≈ 638 px  ;  9 / 0.0345 ≈ 261 px
          occlude={false}
          style={{ pointerEvents: "auto" }}
        >
          <div
            style={{
              width: `${Math.round(SCR_W / 0.0345)}px`,
              height: `${Math.round(SCR_H / 0.0345)}px`,
              overflow: "hidden",
              borderRadius: 4,
              background: "#000",
              transform: "translate(-50%, -50%)",
            }}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
              title="Trailer"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              style={{
                border: "none",
                width: "100%",
                height: "100%",
                display: "block",
              }}
            />
          </div>
        </Html>
      )}

      {/* glow */}
      <pointLight
        ref={glowRef}
        position={[0, 0, 5]}
        intensity={3}
        distance={30}
        color="#60a5fa"
      />
      <pointLight
        position={[-7, 0, 3]}
        intensity={1.2}
        distance={16}
        color="#818cf8"
      />
      <pointLight
        position={[7, 0, 3]}
        intensity={1.2}
        distance={16}
        color="#818cf8"
      />

      {/* curtains LEFT */}
      <group position={[-(SCR_W / 2 + 2.2), 0, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[Math.sin(i * 0.7) * 0.1, 0, i * 0.04]}
            castShadow
          >
            <boxGeometry args={[0.65, SCR_H + 3.5, 0.22]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#991b1b" : "#b91c1c"}
              roughness={0.82}
            />
          </mesh>
        ))}
      </group>

      {/* curtains RIGHT */}
      <group position={[SCR_W / 2 + 2.2, 0, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[-Math.sin(i * 0.7) * 0.1, 0, i * 0.04]}
            castShadow
          >
            <boxGeometry args={[0.65, SCR_H + 3.5, 0.22]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#991b1b" : "#b91c1c"}
              roughness={0.82}
            />
          </mesh>
        ))}
      </group>

      {/* valance TOP */}
      <group position={[0, SCR_H / 2 + 2, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={i}
            position={[
              (i - 3) * ((SCR_W + 4) / 7),
              Math.sin(i) * 0.08,
              0,
            ]}
            castShadow
          >
            <boxGeometry
              args={[(SCR_W + 4) / 7 + 0.05, 1.8 + Math.sin(i * 0.6) * 0.15, 0.25]}
            />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#991b1b" : "#b91c1c"}
              roughness={0.82}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.8, 0.06]}>
          <boxGeometry args={[SCR_W + 4.5, 0.08, 0.05]} />
          <meshStandardMaterial
            color="#d4a537"
            metalness={0.85}
            roughness={0.2}
            emissive="#d4a537"
            emissiveIntensity={0.2}
          />
        </mesh>
      </group>

      {/* title */}
      <Text
        position={[0, -(SCR_H / 2 + 1.2), 0.15]}
        fontSize={0.5}
        color="#9ca3af"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
      >
        {"★ NOW SHOWING: " + movieTitle.toUpperCase() + " ★"}
      </Text>
    </group>
  );
}

/* ── seat 3D ── */
function Seat3D({
  seat,
  position,
  onClick,
  onHover,
  isHighlighted,
  soundOn,
  playSound,
}: {
  seat: Seat;
  position: [number, number, number];
  onClick: (s: Seat) => void;
  onHover: (s: Seat | null, p?: [number, number, number]) => void;
  isHighlighted: boolean;
  soundOn: boolean;
  playSound: (t: "click" | "select" | "hover" | "success" | "error") => void;
}) {
  const [hov, setHov] = useState(false);
  const grp = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const booked = seat.status === "booked" || seat.isBooked;
  const selected = seat.status === "selected" || seat.isSelected;

  useFrame((st) => {
    if (grp.current) {
      const ty = hov && !booked ? 0.06 : 0;
      grp.current.position.y = THREE.MathUtils.lerp(
        grp.current.position.y,
        ty,
        0.12
      );
    }
    if (glow.current && selected)
      glow.current.intensity =
        0.6 + Math.sin(st.clock.elapsedTime * 3) * 0.2;
  });

  const col = useMemo(() => {
    if (booked) return "#4b5563";
    if (selected) return "#10b981";
    if (isHighlighted) return "#f59e0b";
    if (hov) return "#fbbf24";
    return (
      { vip: "#a855f7", premium: "#3b82f6", accessible: "#14b8a6" }[
        seat.type
      ] || "#6b7280"
    );
  }, [booked, selected, isHighlighted, hov, seat.type]);

  const cush = useMemo(() => {
    if (booked) return "#374151";
    if (selected) return "#047857";
    return (
      { vip: "#7c3aed", premium: "#2563eb", accessible: "#0d9488" }[
        seat.type
      ] || "#4b5563"
    );
  }, [booked, selected, seat.type]);

  const em = selected
    ? 0.5
    : isHighlighted
      ? 0.35
      : hov && !booked
        ? 0.25
        : 0.06;
  const sc = hov && !booked ? 1.05 : 1;

  const click = (e: any) => {
    e.stopPropagation();
    if (!booked) {
      if (soundOn) playSound("select");
      onClick(seat);
    } else if (soundOn) playSound("error");
  };
  const enter = (e: any) => {
    e.stopPropagation();
    if (soundOn && !booked) playSound("hover");
    setHov(true);
    document.body.style.cursor = booked ? "not-allowed" : "pointer";
    onHover(seat, position);
  };
  const leave = () => {
    setHov(false);
    document.body.style.cursor = "auto";
    onHover(null);
  };

  return (
    <group position={position}>
      <group ref={grp}>
        {/* legs */}
        {[
          [-0.28, -0.08],
          [0.28, -0.08],
          [-0.28, 0.22],
          [0.28, 0.22],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.06, z]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.16, 6]} />
            <meshStandardMaterial
              color="#4b5563"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}

        {/* bottom */}
        <RoundedBox
          args={[0.68, 0.09, 0.48]}
          radius={0.025}
          smoothness={3}
          position={[0, 0.06, 0.04]}
          onClick={click}
          onPointerEnter={enter}
          onPointerLeave={leave}
          scale={sc}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={cush}
            roughness={0.65}
            metalness={0.08}
            emissive={col}
            emissiveIntensity={em}
          />
        </RoundedBox>

        {/* back */}
        <RoundedBox
          args={[0.68, 0.55, 0.07]}
          radius={0.025}
          smoothness={3}
          position={[0, 0.38, 0.26]}
          onClick={click}
          onPointerEnter={enter}
          onPointerLeave={leave}
          scale={sc}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={cush}
            roughness={0.65}
            metalness={0.08}
            emissive={col}
            emissiveIntensity={em}
          />
        </RoundedBox>

        {/* frame */}
        <RoundedBox
          args={[0.72, 0.6, 0.04]}
          radius={0.02}
          smoothness={3}
          position={[0, 0.37, 0.3]}
          castShadow
        >
          <meshStandardMaterial
            color="#1f2937"
            roughness={0.4}
            metalness={0.5}
          />
        </RoundedBox>

        {/* armrests */}
        {[-0.38, 0.38].map((x, i) => (
          <RoundedBox
            key={i}
            args={[0.05, 0.035, 0.36]}
            radius={0.01}
            smoothness={2}
            position={[x, 0.15, 0.06]}
            castShadow
          >
            <meshStandardMaterial
              color="#374151"
              roughness={0.4}
              metalness={0.6}
            />
          </RoundedBox>
        ))}

        {/* number */}
        <Text
          position={[0, 0.4, 0.32]}
          fontSize={0.09}
          color={booked ? "#6b7280" : "#e5e7eb"}
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          {seat.number}
        </Text>

        {/* vip crown */}
        {seat.type === "vip" && (
          <group position={[0, 0.75, 0.26]}>
            <mesh>
              <coneGeometry args={[0.05, 0.1, 5]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#fbbf24"
                emissiveIntensity={0.8}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            <pointLight intensity={0.3} distance={1} color="#fbbf24" />
          </group>
        )}

        {/* accessible */}
        {seat.type === "accessible" && (
          <mesh position={[0, 0.75, 0.26]}>
            <torusGeometry args={[0.05, 0.018, 8, 16]} />
            <meshStandardMaterial
              color="#14b8a6"
              emissive="#14b8a6"
              emissiveIntensity={0.8}
            />
          </mesh>
        )}

        {/* selection glow */}
        {selected && (
          <>
            <pointLight
              ref={glow}
              position={[0, 0.35, 0]}
              intensity={0.6}
              distance={1.8}
              color="#10b981"
            />
            <mesh
              position={[0, -0.01, 0.06]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.2, 0.4, 20]} />
              <meshBasicMaterial
                color="#10b981"
                transparent
                opacity={0.2}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </>
        )}
        {isHighlighted && !selected && (
          <pointLight
            position={[0, 0.35, 0]}
            intensity={0.5}
            distance={1.5}
            color="#f59e0b"
          />
        )}
      </group>
    </group>
  );
}

/* ── tooltip ── */
function Tip({
  seat,
  pos,
}: {
  seat: Seat;
  pos: [number, number, number];
}) {
  const booked = seat.status === "booked" || seat.isBooked;
  const selected = seat.status === "selected" || seat.isSelected;
  const lbl: Record<string, string> = {
    standard: "Standard",
    premium: "Premium",
    vip: "VIP",
    accessible: "Accessible",
  };
  const bg: Record<string, string> = {
    standard: "bg-gray-500",
    premium: "bg-blue-500",
    vip: "bg-purple-500",
    accessible: "bg-teal-500",
  };

  return (
    <Html position={[pos[0], pos[1] + 1.4, pos[2]]} center distanceFactor={10}>
      <div className="bg-gray-900/95 backdrop-blur text-white px-3 py-2 rounded-lg shadow-xl border border-white/10 min-w-[160px] pointer-events-none select-none">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm">
            {seat.row}
            {seat.number}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${bg[seat.type]}`}
          >
            {lbl[seat.type]}
          </span>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-400">Price</span>
            <span className="font-bold text-green-400">
              ${seat.price.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status</span>
            <span
              className={
                booked
                  ? "text-red-400"
                  : selected
                    ? "text-green-400"
                    : "text-blue-400"
              }
            >
              {booked ? "Booked" : selected ? "Selected" : "Available"}
            </span>
          </div>
        </div>
        {!booked && (
          <p className="mt-1 pt-1 border-t border-white/10 text-center text-[9px] text-gray-500">
            Click to {selected ? "deselect" : "select"}
          </p>
        )}
        {booked && (
          <p className="mt-1 pt-1 border-t border-white/10 text-center text-[9px] text-red-400 flex items-center justify-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" />
            Unavailable
          </p>
        )}
      </div>
    </Html>
  );
}

/* ── row labels ── */
function RowLabels({
  rows,
  getPos,
}: {
  rows: string[];
  getPos: (i: number) => { z: number; y: number };
}) {
  return (
    <group>
      {rows.map((r, i) => {
        const { z, y } = getPos(i);
        return (
          <group key={r}>
            <Text
              position={[-HALL_W / 2 + 1.5, y + 0.4, z]}
              fontSize={0.4}
              color="#60a5fa"
              anchorX="center"
              anchorY="middle"
              fontWeight={700}
            >
              {r}
            </Text>
            <Text
              position={[HALL_W / 2 - 1.5, y + 0.4, z]}
              fontSize={0.4}
              color="#60a5fa"
              anchorX="center"
              anchorY="middle"
              fontWeight={700}
            >
              {r}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ── exit signs ── */
function Exits() {
  return (
    <group>
      {[
        [-HALL_W / 2 + 0.8, 5.5, 8],
        [HALL_W / 2 - 0.8, 5.5, 8],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <RoundedBox args={[1.6, 0.5, 0.1]} radius={0.04} smoothness={3}>
            <meshBasicMaterial color="#22c55e" toneMapped={false} />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.24}
            color="#fff"
            anchorX="center"
            fontWeight={900}
          >
            EXIT
          </Text>
          <pointLight
            position={[0, 0, 0.3]}
            intensity={0.6}
            distance={3}
            color="#22c55e"
          />
        </group>
      ))}
    </group>
  );
}

/* ── ceiling lights ── */
function CeilLights({ on }: { on: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.traverse((c) => {
      if (c instanceof THREE.PointLight)
        c.intensity = THREE.MathUtils.lerp(
          c.intensity,
          on ? 0.9 : 0.1,
          0.04
        );
    });
  });

  const pts = useMemo(() => {
    const a: [number, number, number][] = [];
    for (let x = -10; x <= 10; x += 7)
      for (let z = -2; z <= 14; z += 5) a.push([x, 12.8, z]);
    return a;
  }, []);

  return (
    <group ref={ref}>
      {pts.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.3, 0.2, 8]} />
            <meshStandardMaterial
              color="#4b5563"
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, -0.1, 0]}>
            <sphereGeometry args={[0.08, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial
              color={on ? "#fef9c3" : "#374151"}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            intensity={on ? 0.9 : 0.1}
            distance={7}
            color="#fef3c7"
          />
        </group>
      ))}
    </group>
  );
}

/* ── stadium steps ── */
function Steps({
  n,
  getPos,
}: {
  n: number;
  getPos: (i: number) => { z: number; y: number };
}) {
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const { z, y } = getPos(i);
        return (
          <group key={i}>
            <mesh position={[0, y - 0.12, z]} receiveShadow castShadow>
              <boxGeometry args={[HALL_W - 3, 0.35, 1.35]} />
              <meshStandardMaterial
                color="#1e1e38"
                roughness={0.88}
                metalness={0.06}
              />
            </mesh>
            <mesh position={[0, y + 0.06, z]}>
              <boxGeometry args={[HALL_W - 3.5, 0.012, 1.3]} />
              <meshStandardMaterial color="#252548" roughness={0.94} />
            </mesh>
            {/* LED edge */}
            <mesh position={[0, y + 0.065, z + 0.64]}>
              <boxGeometry args={[HALL_W - 3.5, 0.01, 0.02]} />
              <meshBasicMaterial
                color="#3b82f6"
                toneMapped={false}
                transparent
                opacity={0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ── theater room ── */
function Room({
  lightsOn,
  nRows,
  getPos,
}: {
  lightsOn: boolean;
  nRows: number;
  getPos: (i: number) => { z: number; y: number };
}) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#0c0c1e", 0.004);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  const hw = HALL_W / 2;

  return (
    <group>
      {/* floor */}
      <mesh
        position={[0, -0.4, 3]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[45, 45]} />
        <meshStandardMaterial color="#151528" roughness={0.94} metalness={0.04} />
      </mesh>

      {/* walls */}
      <mesh
        position={[-hw, 6.5, 2]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[42, 14]} />
        <meshStandardMaterial
          color="#171730"
          roughness={0.88}
          metalness={0.06}
        />
      </mesh>
      <mesh
        position={[hw, 6.5, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[42, 14]} />
        <meshStandardMaterial
          color="#171730"
          roughness={0.88}
          metalness={0.06}
        />
      </mesh>

      {/* ceiling */}
      <mesh position={[0, 13.5, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL_W + 3, 45]} />
        <meshStandardMaterial color="#0e0e24" roughness={0.96} />
      </mesh>

      {/* back wall */}
      <mesh position={[0, 6.5, 18]} receiveShadow>
        <planeGeometry args={[HALL_W + 3, 14]} />
        <meshStandardMaterial color="#171730" roughness={0.9} />
      </mesh>

      {/* screen back wall */}
      <mesh position={[0, SCR_Y, SCR_Z - 0.8]}>
        <planeGeometry args={[HALL_W + 6, 18]} />
        <meshStandardMaterial color="#111827" roughness={0.96} />
      </mesh>

      <Steps n={nRows} getPos={getPos} />
      <Exits />
      <CeilLights on={lightsOn} />

      {/* sconces */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i}>
          {[-hw + 0.15, hw - 0.15].map((x, j) => (
            <group key={j} position={[x, 5, -2 + i * 4.5]}>
              <mesh>
                <boxGeometry args={[0.18, 0.35, 0.08]} />
                <meshStandardMaterial
                  color="#d4a537"
                  metalness={0.8}
                  roughness={0.3}
                  emissive="#d4a537"
                  emissiveIntensity={0.1}
                />
              </mesh>
              <pointLight
                position={[j === 0 ? 0.25 : -0.25, 0, 0]}
                intensity={lightsOn ? 0.5 : 0.1}
                distance={4}
                color="#fef3c7"
              />
            </group>
          ))}
        </group>
      ))}

      {/* projector */}
      <group position={[0, 11.5, 17]}>
        <mesh castShadow>
          <boxGeometry args={[2.5, 2, 2.5]} />
          <meshStandardMaterial
            color="#2d3748"
            roughness={0.6}
            metalness={0.4}
          />
        </mesh>
        <mesh position={[0, -0.15, -1.35]}>
          <cylinderGeometry args={[0.25, 0.35, 0.5, 10]} />
          <meshStandardMaterial
            color="#4b5563"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[0, -0.15, -1.6]}>
          <circleGeometry args={[0.22, 16]} />
          <meshBasicMaterial
            color="#93c5fd"
            toneMapped={false}
            transparent
            opacity={0.35}
          />
        </mesh>
      </group>

      <Beam />
      <Dust count={80} />
    </group>
  );
}

/* ── minimap ── */
function MiniMap({
  seats,
  selIds,
  onSeatClick,
}: {
  seats: Seat[];
  selIds: string[];
  onSeatClick: (s: Seat) => void;
}) {
  const rows = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach((s) => (m[s.row] ||= []).push(s));
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const dot = (s: Seat) => {
    if (s.status === "booked" || s.isBooked) return "bg-slate-700";
    if (selIds.includes(s.id)) return "bg-green-500 shadow-green-500/50 shadow-sm";
    return (
      { vip: "bg-purple-500", premium: "bg-blue-500", accessible: "bg-teal-500" }[
        s.type
      ] || "bg-gray-500"
    );
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl p-3 rounded-xl border border-white/10 shadow-2xl">
      <h4 className="text-white text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
        <Grid3X3 className="w-3 h-3 text-blue-400" />
        Map
      </h4>
      <div className="w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full mb-0.5 relative">
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[6px] text-blue-400 font-bold tracking-widest">
          SCREEN
        </span>
      </div>
      <div className="space-y-0.5 mt-3.5">
        {rows.map(([r, rs]) => (
          <div key={r} className="flex items-center gap-0.5">
            <span className="text-[6px] text-blue-400 w-2 font-bold">{r}</span>
            <div className="flex gap-[2px]">
              {rs
                .sort((a, b) => a.number - b.number)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSeatClick(s)}
                    disabled={s.status === "booked" || s.isBooked}
                    className={`w-[5px] h-[5px] rounded-[1px] transition-all hover:scale-[2] ${dot(s)} ${s.status === "booked" || s.isBooked ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                    title={`${s.row}${s.number}`}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── booking modal ── */
function BookingModal({
  open,
  onClose,
  onOk,
  sel,
  movie,
  st,
  total,
}: {
  open: boolean;
  onClose: () => void;
  onOk: () => void;
  sel: Seat[];
  movie: (typeof movies)[0];
  st: (typeof showtimes)[0];
  total: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl p-5 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-400" />
            Confirm Booking
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="bg-slate-800/40 rounded-lg p-3 flex gap-3 border border-white/5">
            <img
              src={movie.image}
              alt={movie.title}
              className="w-12 h-[72px] object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h4 className="text-white font-bold text-sm">{movie.title}</h4>
              <p className="text-gray-400 text-xs">{movie.genre}</p>
              <p className="text-gray-500 text-xs">
                {movie.duration} · {movie.rating}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-300 bg-slate-800/30 rounded-lg px-3 py-1.5 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />
            {st.time}
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3 border border-white/5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-1">
              Seats
            </p>
            <div className="flex flex-wrap gap-1">
              {sel.map((s) => (
                <span
                  key={s.id}
                  className="px-1.5 py-0.5 rounded text-xs font-bold bg-white/5 text-gray-300 border border-white/10"
                >
                  {s.row}
                  {s.number}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{sel.length} ticket(s)</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Fee</span>
              <span>$2.50</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10">
              <span>Total</span>
              <span className="text-green-400">
                ${(total + 2.5).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={onOk}
              className="flex-1 bg-green-600 hover:bg-green-700 font-bold"
            >
              <CreditCard className="w-4 h-4 mr-1.5" />
              Pay Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════ */
export default function Theater3D({ seats, onSeatClick }: Theater3DProps) {
  const [camTarget, setCamTarget] = useState<CamTarget>({
    position: DEFAULT_CAM,
    lookAt: DEFAULT_LOOK,
  });
  const [anim, setAnim] = useState(false);
  const [viewSeat, setViewSeat] = useState<string | null>(null);
  const [movie, setMovie] = useState(movies[0]);
  const [showtime, setShowtime] = useState(showtimes[3]);
  const [hovSeat, setHovSeat] = useState<{
    seat: Seat;
    pos: [number, number, number];
  } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [miniMap, setMiniMap] = useState(true);
  const [view, setView] = useState<ViewMode>("default");
  const [bookOpen, setBookOpen] = useState(false);
  const [hl, setHl] = useState<string[]>([]);
  const [lights, setLights] = useState(true);

  const ctrlRef = useRef<any>(null);
  const { playSound } = useAudio();

  const ytId = useMemo(() => getYouTubeId(movie.video), [movie.video]);

  const sel = useMemo(
    () => seats.filter((s) => s.status === "selected" || s.isSelected),
    [seats]
  );
  const total = useMemo(() => sel.reduce((a, s) => a + s.price, 0), [sel]);
  const rows = useMemo(() => [...new Set(seats.map((s) => s.row))].sort(), [seats]);

  const rowPos = useCallback(
    (i: number) => ({ z: i * 1.4 + 1.5, y: i * 0.32 + 0.15 }),
    []
  );

  const byRow = useMemo(() => {
    const m: Record<string, Seat[]> = {};
    seats.forEach((s) => (m[s.row] ||= []).push(s));
    return m;
  }, [seats]);

  const seatPos = useMemo(() => {
    const out: { seat: Seat; position: [number, number, number] }[] = [];
    const sr = Object.keys(byRow).sort();
    sr.forEach((row, ri) => {
      const rs = byRow[row].sort((a, b) => a.number - b.number);
      const { z, y } = rowPos(ri);
      const sp = 0.88;
      const gap = 0.9;
      const half = Math.floor(rs.length / 2);
      rs.forEach((seat, si) => {
        let x: number;
        if (rs.length % 2 === 0) {
          x =
            si < half
              ? (si - half) * sp - gap / 2 + sp / 2
              : (si - half) * sp + gap / 2 + sp / 2;
        } else {
          const c = Math.floor(rs.length / 2);
          x =
            si < c
              ? (si - c) * sp - gap / 2
              : si === c
                ? 0
                : (si - c) * sp + gap / 2;
        }
        out.push({ seat, position: [x, y, z] });
      });
    });
    return out;
  }, [byRow, rowPos]);

  const findBest = useCallback(
    (n = 4) => {
      const a = seatPos.filter(
        ({ seat: s }) => s.status === "available" && !s.isBooked
      );
      const sc = a.map(({ seat: s, position: p }) => ({
        id: s.id,
        score:
          14 -
          Math.abs(p[0]) +
          (10 - Math.abs(3 - p[2] / 1.4)) +
          (s.type === "vip" ? 5 : s.type === "premium" ? 3 : 0),
      }));
      sc.sort((a, b) => b.score - a.score);
      return sc.slice(0, n).map((s) => s.id);
    },
    [seatPos]
  );

  const clickSeat = useCallback(
    (seat: Seat) => {
      if (soundOn) playSound("click");
      onSeatClick(seat);
      const d = seatPos.find((s) => s.seat.id === seat.id);
      if (d) {
        const [x, y, z] = d.position;
        setCamTarget({
          position: new THREE.Vector3(x, y + 1.3, z + 2.2),
          lookAt: new THREE.Vector3(0, SCR_Y, SCR_Z),
        });
        setAnim(true);
        setViewSeat(seat.id);
      }
    },
    [soundOn, playSound, onSeatClick, seatPos]
  );

  const hover = useCallback(
    (s: Seat | null, p?: [number, number, number]) => {
      if (s && p) setHovSeat({ seat: s, pos: p });
      else setHovSeat(null);
    },
    []
  );

  const reset = useCallback(() => {
    if (soundOn) playSound("click");
    setCamTarget({ position: DEFAULT_CAM, lookAt: DEFAULT_LOOK });
    setAnim(true);
    setViewSeat(null);
    setView("default");
  }, [soundOn, playSound]);

  const chView = useCallback(
    (m: ViewMode) => {
      if (soundOn) playSound("click");
      setView(m);
      const v: Record<ViewMode, CamTarget> = {
        default: { position: DEFAULT_CAM, lookAt: DEFAULT_LOOK },
        topdown: {
          position: new THREE.Vector3(0, 28, 5),
          lookAt: new THREE.Vector3(0, 0, 3),
        },
        front: {
          position: new THREE.Vector3(0, 7, SCR_Z + 4),
          lookAt: new THREE.Vector3(0, 7, 0),
        },
        side: {
          position: new THREE.Vector3(25, 10, 5),
          lookAt: new THREE.Vector3(0, 4, 3),
        },
      };
      setCamTarget(v[m]);
      setAnim(true);
    },
    [soundOn, playSound]
  );

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!viewSeat) return;
      const cur = seatPos.find((s) => s.seat.id === viewSeat);
      if (!cur) return;
      let tgt: Seat | undefined;
      switch (e.key) {
        case "ArrowLeft":
          tgt = seats.find(
            (s) =>
              s.row === cur.seat.row && s.number === cur.seat.number - 1
          );
          break;
        case "ArrowRight":
          tgt = seats.find(
            (s) =>
              s.row === cur.seat.row && s.number === cur.seat.number + 1
          );
          break;
        case "ArrowUp": {
          const r = String.fromCharCode(cur.seat.row.charCodeAt(0) - 1);
          tgt = seats.find(
            (s) => s.row === r && s.number === cur.seat.number
          );
          break;
        }
        case "ArrowDown": {
          const r = String.fromCharCode(cur.seat.row.charCodeAt(0) + 1);
          tgt = seats.find(
            (s) => s.row === r && s.number === cur.seat.number
          );
          break;
        }
        case "Enter":
        case " ":
          if (cur.seat.status !== "booked") clickSeat(cur.seat);
          break;
        case "Escape":
          reset();
          break;
      }
      if (tgt) {
        e.preventDefault();
        const d = seatPos.find((s) => s.seat.id === tgt!.id);
        if (d) {
          const [x, y, z] = d.position;
          setCamTarget({
            position: new THREE.Vector3(x, y + 1.3, z + 2.2),
            lookAt: new THREE.Vector3(0, SCR_Y, SCR_Z),
          });
          setAnim(true);
          setViewSeat(tgt.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewSeat, seats, seatPos, clickSeat, reset]);

  return (
    <div className="relative w-full h-[850px] bg-[#0a0a1a] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
      {/* ── TOP LEFT : movie + showtime ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[370px]">
        <div className="bg-black/65 backdrop-blur-xl rounded-xl p-2.5 border border-white/[0.08]">
          <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Film className="w-3 h-3 text-blue-400" />
            Now Playing
          </h3>
          <div className="flex flex-wrap gap-1">
            {movies.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (soundOn) playSound("click");
                  setMovie(m);
                }}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${movie.id === m.id ? "bg-blue-600 border-blue-500 text-white" : "bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-black/65 backdrop-blur-xl rounded-xl p-2.5 border border-white/[0.08]">
          <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-green-400" />
            Showtime
          </h3>
          <div className="flex flex-wrap gap-1">
            {showtimes.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (soundOn) playSound("click");
                  setShowtime(s);
                }}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${showtime.id === s.id ? "bg-green-600 border-green-500 text-white" : "bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
              >
                {s.time}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-black/65 backdrop-blur-xl p-2.5 rounded-xl border border-white/[0.08]">
          <div className="flex gap-2">
            <img
              src={movie.image}
              alt={movie.title}
              className="w-11 h-16 object-cover rounded shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-blue-400 font-bold text-xs truncate">
                {movie.title}
              </h4>
              <p className="text-gray-500 text-[10px]">
                {movie.duration} · {movie.rating}
              </p>
              <p className="text-gray-500 text-[10px]">{movie.genre}</p>
              <p className="text-gray-400 text-[10px] mt-0.5 line-clamp-2">
                {movie.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP RIGHT : controls ── */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundOn(!soundOn)}
            className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl"
          >
            {soundOn ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const c = document.querySelector("canvas");
              if (c) {
                const a = document.createElement("a");
                a.download = "theater.png";
                a.href = c.toDataURL();
                a.click();
              }
            }}
            className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl"
          >
            <Camera className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMiniMap(!miniMap)}
            className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${miniMap ? "ring-1 ring-blue-500" : ""}`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLights(!lights)}
            className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${lights ? "ring-1 ring-yellow-500" : ""}`}
          >
            <Zap className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["default", Eye],
              ["topdown", ArrowDown],
              ["front", Maximize2],
              ["side", ArrowUp],
            ] as [ViewMode, any][]
          ).map(([m, Icon]) => (
            <Button
              key={m}
              variant="outline"
              size="sm"
              onClick={() => chView(m)}
              className={`bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl ${view === m ? "ring-1 ring-blue-500" : ""}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </Button>
          ))}
        </div>
        {viewSeat && (
          <div className="bg-black/60 backdrop-blur-xl text-white px-2 py-1 rounded-full flex items-center gap-1 border border-white/10 text-xs">
            <Eye className="w-3 h-3 text-blue-400" />
            Seat {seats.find((s) => s.id === viewSeat)?.row}
            {seats.find((s) => s.id === viewSeat)?.number}
          </div>
        )}
        <div className="flex gap-1">
          <Button
            onClick={() => {
              if (soundOn) playSound("success");
              setHl(findBest(4));
              setTimeout(() => setHl([]), 5000);
            }}
            variant="outline"
            size="sm"
            className="bg-amber-600/25 hover:bg-amber-600/40 border-amber-500/25 text-amber-200 backdrop-blur-xl"
          >
            <Star className="w-3.5 h-3.5 mr-1" />
            Best
          </Button>
          <Button
            onClick={reset}
            variant="outline"
            size="sm"
            className="bg-black/50 hover:bg-black/70 border-white/10 text-white backdrop-blur-xl"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── BOTTOM LEFT : legend ── */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-xl p-2.5 rounded-xl border border-white/[0.08]">
        <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
          <Info className="w-3 h-3 text-gray-400" />
          Legend
        </h3>
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-0.5">
          {[
            ["bg-gray-500", "Standard"],
            ["bg-blue-500", "Premium"],
            ["bg-purple-500", "VIP"],
            ["bg-teal-500", "Accessible"],
            ["bg-green-500", "Selected"],
            ["bg-slate-700", "Booked"],
            ["bg-amber-500", "Recommended"],
          ].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${c}`} />
              <span className="text-gray-400 text-[9px]">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM RIGHT : tickets ── */}
      <div className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-xl p-3 rounded-xl border border-white/[0.08] min-w-[220px]">
        <h3 className="text-white text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
          <Ticket className="w-3 h-3 text-green-400" />
          Your Tickets
        </h3>
        {sel.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1 mb-2">
              {sel.map((s) => (
                <span
                  key={s.id}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/[0.05] text-gray-300 border border-white/10"
                >
                  {s.row}
                  {s.number}{" "}
                  <span className="text-gray-500">${s.price}</span>
                </span>
              ))}
            </div>
            <div className="border-t border-white/[0.08] pt-1.5 space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">{sel.length} ticket(s)</span>
                <span className="text-gray-300">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Fee</span>
                <span className="text-gray-300">$2.50</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/[0.08]">
                <span>Total</span>
                <span className="text-green-400">
                  ${(total + 2.5).toFixed(2)}
                </span>
              </div>
            </div>
            <Button
              onClick={() => setBookOpen(true)}
              className="w-full mt-2 bg-green-600 hover:bg-green-700 font-bold text-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Checkout
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <Users className="w-5 h-5 text-gray-700 mx-auto mb-1" />
            <p className="text-gray-500 text-[10px]">No seats selected</p>
            <p className="text-gray-600 text-[9px]">Click to select</p>
          </div>
        )}
      </div>

      {/* minimap */}
      {miniMap && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <MiniMap
            seats={seats}
            selIds={sel.map((s) => s.id)}
            onSeatClick={clickSeat}
          />
        </div>
      )}

      {/* ═══ CANVAS ═══ */}
      <Canvas
        shadows
        camera={{
          position: [DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z],
          fov: 50,
        }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <CamCtrl
          target={camTarget}
          running={anim}
          onDone={() => setAnim(false)}
          ctrlRef={ctrlRef}
        />

        <color attach="background" args={["#0c0c1e"]} />

        {/* lighting */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#2d4a7a", "#0c0c1e", 0.4]} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-6, 12, 8]} intensity={0.45} />
        <directionalLight position={[0, 5, 16]} intensity={0.3} />

        {/* screen with embedded youtube */}
        <CinemaScreen movieTitle={movie.title} youtubeId={ytId} />

        <RowLabels rows={rows} getPos={rowPos} />
        <Room lightsOn={lights} nRows={rows.length} getPos={rowPos} />

        {seatPos.map(({ seat, position }) => (
          <Seat3D
            key={seat.id}
            seat={seat}
            position={position}
            onClick={clickSeat}
            onHover={hover}
            isHighlighted={hl.includes(seat.id)}
            soundOn={soundOn}
            playSound={playSound}
          />
        ))}

        {hovSeat && <Tip seat={hovSeat.seat} pos={hovSeat.pos} />}

        <OrbitControls
          ref={ctrlRef}
          minDistance={3}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.05}
          target={[DEFAULT_LOOK.x, DEFAULT_LOOK.y, DEFAULT_LOOK.z]}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />
      </Canvas>

      <BookingModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onOk={() => {
          if (soundOn) playSound("success");
          setBookOpen(false);
          alert("Booking confirmed!");
        }}
        sel={sel}
        movie={movie}
        st={showtime}
        total={total}
      />
    </div>
  );
}
