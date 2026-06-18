import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

// ---- Procedural textures (generated once per mount, no external assets needed) ----

function makeVelvetTexture(baseHex: string) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  // vertical nap streaks - gives velvet its directional sheen instead of a flat fill
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const w = 0.4 + Math.random() * 1.6;
    const dark = Math.random() > 0.5;
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 0, w, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  return tex;
}

function makeBrushedMetalTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeScreenGlowTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.68);
  grad.addColorStop(0, '#33336b');
  grad.addColorStop(0.55, '#1a1a40');
  grad.addColorStop(1, '#06060f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // fine grain so the surface doesn't read as a flat plastic plane
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return new THREE.CanvasTexture(canvas);
}

function makeFloorAOTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// --- PREMIUM THEATER SCREEN (FIXED PROPORTIONS, ENHANCED REALISM) ---
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);

  const velvetTexA = useMemo(() => makeVelvetTexture('#7a1515'), []);
  const velvetTexB = useMemo(() => makeVelvetTexture('#922020'), []);
  const metalTex = useMemo(() => makeBrushedMetalTexture(), []);
  const screenGlowTex = useMemo(() => makeScreenGlowTexture(), []);
  const aoTex = useMemo(() => makeFloorAOTexture(), []);

  useFrame((state) => {
    glowRef.current = Math.sin(state.clock.elapsedTime * 0.5) * 0.15 + 0.85;
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = glowRef.current * 0.3;
      }
    }
  });

  return (
    <group position={[0, SCREEN_Y, SCREEN_Z]}>
      {/* Wall behind - larger coverage */}
      <mesh position={[0, 0, -1.5]} receiveShadow>
        <boxGeometry args={[45, 22, 0.5]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.9} />
      </mesh>

      {/* Soft sky/ground fill - cheapest realism win, kills the "flat CG" look */}
      <hemisphereLight color="#4a5a9a" groundColor="#0a0a12" intensity={0.35} />

      {/* Architectural wall panels with depth */}
      {[-1, 1].map((side) => (
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

      {/* Premium frame - multiple beveled layers, now brushed-metal textured */}
      <mesh position={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 2.5, SCREEN_HEIGHT + 2, 0.25]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.3} metalness={0.7} map={metalTex} />
      </mesh>
      <mesh position={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 1.8, SCREEN_HEIGHT + 1.3, 0.18]} />
        <meshStandardMaterial color="#1a1a35" roughness={0.25} metalness={0.8} map={metalTex} />
      </mesh>
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 0.8, SCREEN_HEIGHT + 0.5, 0.12]} />
        <meshStandardMaterial color="#20203a" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Screen surface - vignette + grain texture instead of a flat fill */}
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial
          color="#ffffff"
          map={screenGlowTex}
          roughness={0.15}
          metalness={0.4}
          emissiveMap={screenGlowTex}
          emissive="#1a1a40"
          emissiveIntensity={0.25}
        />
      </mesh>

      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.1, SCREEN_HEIGHT + 0.1]} />
        <meshBasicMaterial color="#3a4a8a" transparent opacity={0.15} />
      </mesh>

      {/* Volumetric light shaft from the top spot - the projector-beam effect that sells "cinema" */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 3, 2.2]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[5.5, 7, 32, 1, true]} />
        <meshBasicMaterial
          color="#8899cc"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Enhanced screen lighting - more dramatic */}
      <pointLight position={[0, 0, 6]} intensity={5} distance={45} color="#4a6a9a" castShadow />
      <pointLight position={[-10, 3, 4]} intensity={2.5} distance={22} color="#5577dd" />
      <pointLight position={[10, 3, 4]} intensity={2.5} distance={22} color="#5577dd" />
      <pointLight position={[0, SCREEN_HEIGHT / 2 + 1, 3]} intensity={2} distance={18} color="#6688cc" />
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 1, 3]} intensity={1.5} distance={15} color="#5577dd" />

      {/* Premium velvet curtains - textured nap instead of flat color blocks */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4), 0, 0.8]}>
          {[...Array(10)].map((_, i) => {
            const xOffset = side * (i * 0.35);
            const zWave = Math.sin(i * 0.6) * 0.18 + Math.cos(i * 1.2) * 0.12;
            const yOffset = -Math.abs(Math.sin(i * 0.5)) * 0.15;
            const width = 0.32 + Math.sin(i * 0.8) * 0.05;
            return (
              <mesh key={i} position={[xOffset, yOffset, zWave]} castShadow receiveShadow>
                <boxGeometry args={[width, SCREEN_HEIGHT + 4.5, 0.12]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? '#7a1515' : '#922020'}
                  map={i % 2 === 0 ? velvetTexA : velvetTexB}
                  roughness={0.96}
                  metalness={0.02}
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

      {/* Ornate curtain rod system - brushed metal texture instead of flat gold */}
      <group position={[0, SCREEN_HEIGHT / 2 + 2.8, 1]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, SCREEN_WIDTH + 14, 20]} />
          <meshStandardMaterial color="#8b7355" map={metalTex} roughness={0.15} metalness={0.92} />
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

      {/* Decorative finials - layered material fakes a clearcoat-like polished gold look */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 7.5), SCREEN_HEIGHT / 2 + 2.8, 1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.35, 24, 24]} />
            <meshStandardMaterial color="#d4af37" roughness={0.12} metalness={0.95} emissive="#d4af37" emissiveIntensity={0.4} />
          </mesh>
          {/* thin glossy outer shell catches a tighter, brighter highlight than the base coat alone */}
          <mesh castShadow>
            <sphereGeometry args={[0.36, 24, 24]} />
            <meshStandardMaterial color="#fff7d6" roughness={0.04} metalness={0.6} transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow>
            <coneGeometry args={[0.2, 0.5, 16]} />
            <meshStandardMaterial color="#d4af37" roughness={0.12} metalness={0.95} emissive="#d4af37" emissiveIntensity={0.3} />
          </mesh>
          <pointLight position={[0, 0, 0]} intensity={0.8} distance={3} color="#d4af37" />
        </group>
      ))}

      {/* Premium pelmet */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.2, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[SCREEN_WIDTH + 12, 2.5, 1]} />
        <meshStandardMaterial color="#6a1515" map={velvetTexA} roughness={0.92} />
      </mesh>
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.95, 1.15]}>
        <boxGeometry args={[SCREEN_WIDTH + 12, 0.15, 0.15]} />
        <meshStandardMaterial color="#8b7355" map={metalTex} roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Soft contact-shadow gradient under the whole rig - grounds it instead of floating */}
      <mesh position={[0, -SCREEN_HEIGHT / 2 - 3.2, 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCREEN_WIDTH + 14, 6]} />
        <meshBasicMaterial map={aoTex} transparent depthWrite={false} />
      </mesh>

      {/* Ambient particle effects around screen */}
      <group>
        {[...Array(25)].map((_, i) => {
          const angle = (i / 25) * Math.PI * 2;
          const radius = SCREEN_WIDTH / 2 + 1 + Math.random() * 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * (SCREEN_HEIGHT / 2 + 1);
          const z = Math.random() * 2;
          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#5577dd" transparent opacity={0.4 + Math.random() * 0.3} />
            </mesh>
          );
        })}
      </group>

      {/* Movie title with premium styling */}
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

      {/* Top spotlight effect - more dramatic */}
      <spotLight
        position={[0, SCREEN_HEIGHT / 2 + 4, 3]}
        angle={0.9}
        penumbra={0.6}
        intensity={3}
        distance={28}
        color="#8899cc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {[-1, 1].map(side => (
        <spotLight
          key={side}
          position={[side * (SCREEN_WIDTH / 2 + 2), SCREEN_Y, SCREEN_Z + 4]}
          target-position={[0, SCREEN_Y, SCREEN_Z]}
          angle={0.5}
          penumbra={0.7}
          intensity={1.5}
          distance={20}
          color="#5577dd"
        />
      ))}
      <pointLight position={[0, -SCREEN_HEIGHT / 2 - 2, 2]} intensity={2} distance={12} color="#4a5a8a" />
    </group>
  );
}

export default PremiumTheaterScreen;
