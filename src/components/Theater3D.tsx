// --- PREMIUM THEATER SCREEN (FIXED PROPORTIONS) ---
function PremiumTheaterScreen({ movieTitle }: { movieTitle: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);

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
        <meshStandardMaterial 
          color="#0a0a15" 
          roughness={0.9}
        />
      </mesh>

      {/* Architectural wall panels with depth */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 3.5), 0, -1]}>
          {/* Main panel */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4, SCREEN_HEIGHT + 5, 0.4]} />
            <meshStandardMaterial 
              color="#15152a" 
              roughness={0.7} 
              metalness={0.3}
            />
          </mesh>
          
          {/* Inner detail panel */}
          <mesh position={[side * -0.5, 0, 0.3]} castShadow>
            <boxGeometry args={[2.5, SCREEN_HEIGHT + 4, 0.2]} />
            <meshStandardMaterial 
              color="#1a1a35" 
              roughness={0.6} 
              metalness={0.4}
            />
          </mesh>

          {/* Vertical LED accent strips */}
          <mesh position={[side * -0.5, 0, 0.5]}>
            <boxGeometry args={[0.08, SCREEN_HEIGHT + 4, 0.06]} />
            <meshStandardMaterial 
              color="#3b82f6" 
              emissive="#3b82f6" 
              emissiveIntensity={2.5}
            />
          </mesh>
          <pointLight 
            position={[side * -0.5, 0, 0.6]} 
            intensity={1.5} 
            distance={6} 
            color="#3b82f6"
          />
        </group>
      ))}

      {/* Premium frame - multiple beveled layers */}
      {/* Outer frame */}
      <mesh position={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 2.5, SCREEN_HEIGHT + 2, 0.25]} />
        <meshStandardMaterial 
          color="#0d0d1a" 
          roughness={0.3} 
          metalness={0.7}
        />
      </mesh>

      {/* Middle frame with metallic finish */}
      <mesh position={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 1.8, SCREEN_HEIGHT + 1.3, 0.18]} />
        <meshStandardMaterial 
          color="#1a1a35" 
          roughness={0.25} 
          metalness={0.8}
        />
      </mesh>

      {/* Inner frame - polished */}
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH + 0.8, SCREEN_HEIGHT + 0.5, 0.12]} />
        <meshStandardMaterial 
          color="#20203a" 
          roughness={0.2} 
          metalness={0.85}
        />
      </mesh>

      {/* Screen surface - perfect fit with cinematic aspect ratio */}
      <mesh ref={screenRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
        <meshStandardMaterial 
          color="#0d0d18" 
          roughness={0.15}
          metalness={0.4}
          emissive="#1a1a40"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Screen border glow effect */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[SCREEN_WIDTH + 0.1, SCREEN_HEIGHT + 0.1]} />
        <meshBasicMaterial 
          color="#3a4a8a" 
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Enhanced screen lighting - more dramatic */}
      <pointLight position={[0, 0, 6]} intensity={5} distance={45} color="#4a6a9a" castShadow />
      <pointLight position={[-10, 3, 4]} intensity={2.5} distance={22} color="#5577dd" />
      <pointLight position={[10, 3, 4]} intensity={2.5} distance={22} color="#5577dd" />
      <pointLight position={[0, SCREEN_HEIGHT/2 + 1, 3]} intensity={2} distance={18} color="#6688cc" />
      <pointLight position={[0, -SCREEN_HEIGHT/2 - 1, 3]} intensity={1.5} distance={15} color="#5577dd" />

      {/* Premium velvet curtains - more realistic */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 4), 0, 0.8]}>
          {/* Curtain panels with proper draping */}
          {[...Array(10)].map((_, i) => {
            const xOffset = side * (i * 0.35);
            const zWave = Math.sin(i * 0.6) * 0.18 + Math.cos(i * 1.2) * 0.12;
            const yOffset = -Math.abs(Math.sin(i * 0.5)) * 0.15;
            const width = 0.32 + Math.sin(i * 0.8) * 0.05;
            
            return (
              <mesh 
                key={i} 
                position={[xOffset, yOffset, zWave]} 
                castShadow 
                receiveShadow
              >
                <boxGeometry args={[width, SCREEN_HEIGHT + 4.5, 0.12]} />
                <meshStandardMaterial 
                  color={i % 2 === 0 ? '#7a1515' : '#922020'}
                  roughness={0.96}
                  metalness={0.02}
                />
              </mesh>
            );
          })}

          {/* Curtain edge trim */}
          <mesh position={[side * 1.5, 0, 0]} castShadow>
            <boxGeometry args={[0.15, SCREEN_HEIGHT + 4.5, 0.15]} />
            <meshStandardMaterial 
              color="#5a1010" 
              roughness={0.85}
              metalness={0.15}
            />
          </mesh>
        </group>
      ))}

      {/* Ornate curtain rod system */}
      <group position={[0, SCREEN_HEIGHT / 2 + 2.8, 1]}>
        {/* Main rod */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, SCREEN_WIDTH + 14, 20]} />
          <meshStandardMaterial 
            color="#8b7355" 
            roughness={0.15} 
            metalness={0.92}
          />
        </mesh>

        {/* Decorative rings along rod */}
        {[...Array(12)].map((_, i) => {
          const x = (i - 5.5) * 2.2;
          return (
            <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.18, 0.03, 12, 20]} />
              <meshStandardMaterial 
                color="#6a5a45" 
                roughness={0.2} 
                metalness={0.88}
              />
            </mesh>
          );
        })}
      </group>

      {/* Decorative finials - more ornate */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (SCREEN_WIDTH / 2 + 7.5), SCREEN_HEIGHT / 2 + 2.8, 1]}>
          {/* Base sphere */}
          <mesh castShadow>
            <sphereGeometry args={[0.35, 20, 20]} />
            <meshStandardMaterial 
              color="#d4af37" 
              roughness={0.15} 
              metalness={0.95}
              emissive="#d4af37"
              emissiveIntensity={0.4}
            />
          </mesh>
          {/* Top cone */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <coneGeometry args={[0.2, 0.5, 16]} />
            <meshStandardMaterial 
              color="#d4af37" 
              roughness={0.15} 
              metalness={0.95}
              emissive="#d4af37"
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Glow */}
          <pointLight position={[0, 0, 0]} intensity={0.8} distance={3} color="#d4af37" />
        </group>
      ))}

      {/* Premium pelmet (decorative top covering) */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 2.2, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[SCREEN_WIDTH + 12, 2.5, 1]} />
        <meshStandardMaterial 
          color="#6a1515" 
          roughness={0.92}
        />
      </mesh>

      {/* Pelmet trim */}
      <mesh position={[0, SCREEN_HEIGHT / 2 + 0.95, 1.15]}>
        <boxGeometry args={[SCREEN_WIDTH + 12, 0.15, 0.15]} />
        <meshStandardMaterial 
          color="#8b7355" 
          roughness={0.3} 
          metalness={0.85}
        />
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
              <meshBasicMaterial 
                color="#5577dd" 
                transparent
                opacity={0.4 + Math.random() * 0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* Movie title with premium styling */}
      <group position={[0, -SCREEN_HEIGHT / 2 - 2, 0.5]}>
        {/* Background plate for text */}
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[SCREEN_WIDTH - 2, 1.5]} />
          <meshStandardMaterial 
            color="#0f0f22" 
            transparent
            opacity={0.6}
            roughness={0.8}
          />
        </mesh>

        {/* "NOW SHOWING" text */}
        <Text 
          fontSize={0.5} 
          color="#6b8cce" 
          anchorX="center" 
          anchorY="middle"
          letterSpacing={0.18}
          position={[0, 0.35, 0]}
        >
          NOW SHOWING
        </Text>

        {/* Decorative line */}
        <mesh position={[0, 0.05, 0]}>
          <planeGeometry args={[8, 0.02]} />
          <meshBasicMaterial color="#4a6a9a" />
        </mesh>

        {/* Movie title */}
        <Text 
          position={[0, -0.4, 0]}
          fontSize={0.42} 
          color="#9ab0d9" 
          anchorX="center" 
          anchorY="middle"
          letterSpacing={0.1}
          maxWidth={SCREEN_WIDTH - 3}
        >
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

      {/* Side accent lights */}
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

      {/* Bottom uplighting for drama */}
      <pointLight 
        position={[0, -SCREEN_HEIGHT / 2 - 2, 2]} 
        intensity={2} 
        distance={12} 
        color="#4a5a8a"
      />
    </group>
  );
}
