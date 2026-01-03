import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

export function EarthGlobe() {
  const globeRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Create a subtle glow/atmosphere
  const atmosphereMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x00aaff) },
      viewVector: { value: new THREE.Vector3(0, 0, 1) }
    },
    vertexShader: `
      varying float intensity;
      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vNormel = normalize(normalMatrix * vec3(0,0,1));
        intensity = pow(0.7 - dot(vNormal, vNormel), 2.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying float intensity;
      void main() {
        vec3 glow = glowColor * intensity;
        gl_FragColor = vec4(glow, 1.0);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  }), []);

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.001;
      globeRef.current.rotation.x += 0.0002;
    }
  });

  return (
    <group ref={globeRef}>
      <Stars radius={300} depth={60} count={20000} factor={7} saturation={0} fade speed={1} />
      
      {/* Atmosphere Glow */}
      <mesh ref={atmosphereRef} scale={[1.2, 1.2, 1.2]}>
        <sphereGeometry args={[5, 64, 64]} />
        <primitive object={atmosphereMaterial} attach="material" />
      </mesh>

      {/* Main Globe Body */}
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <Sphere args={[5, 64, 64]}>
          <meshPhongMaterial
            color="#1a365d"
            emissive="#001a33"
            specular="#ffffff"
            shininess={10}
            wireframe={true}
            transparent={true}
            opacity={0.3}
          />
        </Sphere>
        
        {/* Core light */}
        <pointLight color="#00aaff" intensity={2} distance={20} />
      </Float>

      {/* Landmass points/clusters (abstract representation) */}
      {Array.from({ length: 150 }).map((_, i) => {
        const phi = Math.acos(-1 + (2 * i) / 150);
        const theta = Math.sqrt(150 * Math.PI) * phi;
        const x = 5.05 * Math.cos(theta) * Math.sin(phi);
        const y = 5.05 * Math.sin(theta) * Math.sin(phi);
        const z = 5.05 * Math.cos(phi);

        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#00f2ff" transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}
