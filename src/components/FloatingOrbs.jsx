// src/components/FloatingOrbs.jsx
import { Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { audioAnalyserAtom, isMusicPlayingAtom } from './atoms';

export const FloatingOrbs = () => {
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlaying] = useAtom(isMusicPlayingAtom);
  const dataArray = useRef(null);
  const orbRefs = useRef([]);

  const orbs = useMemo(() => {
    const orbsCount = 8; // Reduced count for better performance
    orbRefs.current = new Array(orbsCount); // Initialize refs array
    
    return Array.from({ length: orbsCount }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 25 - 10
      ],
      scale: Math.random() * 0.6 + 0.3,
      speed: Math.random() * 0.8 + 0.4,
      floatSpeed: Math.random() * 1.5 + 0.8,
      color: new THREE.Color().setHSL(
        0.55 + (i / orbsCount) * 0.3 + Math.random() * 0.15, 
        0.7 + Math.random() * 0.3, 
        0.4 + Math.random() * 0.3
      ),
      frequencyBand: Math.floor(Math.random() * 8),
      phase: Math.random() * Math.PI * 2
    }));
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    let bassIntensity = 0;
    let midIntensity = 0;
    let trebleIntensity = 0;

    if (analyser && isMusicPlaying) {
      if (!dataArray.current) {
        dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(dataArray.current);

      // Calculate frequency intensities
      const bassRange = Math.floor(dataArray.current.length * 0.1);
      const midRange = Math.floor(dataArray.current.length * 0.5);
      
      let bassSum = 0, midSum = 0, trebleSum = 0;
      
      for (let i = 0; i < bassRange; i++) bassSum += dataArray.current[i];
      for (let i = bassRange; i < midRange; i++) midSum += dataArray.current[i];
      for (let i = midRange; i < dataArray.current.length; i++) trebleSum += dataArray.current[i];
      
      bassIntensity = bassSum / bassRange / 255;
      midIntensity = midSum / (midRange - bassRange) / 255;
      trebleIntensity = trebleSum / (dataArray.current.length - midRange) / 255;
    }

    orbRefs.current.forEach((orbRef, i) => {
      if (!orbRef || !orbRef.scale || !orbRef.material) return;
      
      const orb = orbs[i];
      if (!orb) return;
      
      const orbIntensity = isMusicPlaying ? 
        (bassIntensity + midIntensity + trebleIntensity) / 3 : 0;

      // Scale pulsation based on audio
      const baseScale = orb.scale;
      const pulseScale = isMusicPlaying ? 
        baseScale * (1 + orbIntensity * 1.5 + Math.sin(time * 4 + orb.phase) * 0.2) :
        baseScale * (1 + Math.sin(time * 2 + orb.phase) * 0.1);
      
      orbRef.scale.setScalar(pulseScale);

      // Update material properties safely
      const targetEmissiveIntensity = isMusicPlaying ? 
        0.3 + orbIntensity * 0.5 : 0.2;
      
      if (orbRef.material.emissiveIntensity !== undefined) {
        orbRef.material.emissiveIntensity = THREE.MathUtils.lerp(
          orbRef.material.emissiveIntensity, 
          targetEmissiveIntensity, 
          0.1
        );
      }

      // Dynamic color shifting - safer approach
      if (orbRef.material.color && orbRef.material.emissive) {
        const hueShift = isMusicPlaying ? 
          Math.sin(time * 0.5 + orb.phase) * 0.1 : 
          Math.sin(time * 0.2 + orb.phase) * 0.05;
        
        const newColor = orb.color.clone();
        if (newColor.offsetHSL) {
          newColor.offsetHSL(hueShift, 0, orbIntensity * 0.2);
        }
        
        orbRef.material.color.lerp(newColor, 0.05);
        
        // Safer emissive color update
        const emissiveColor = newColor.clone().multiplyScalar(0.5);
        orbRef.material.emissive.lerp(emissiveColor, 0.05);
      }
    });
  });

  return (
    <>
      {orbs.map((orb, i) => (
        <Float 
          key={i} 
          speed={orb.floatSpeed} 
          rotationIntensity={0.2} 
          floatIntensity={0.8}
        >
          <mesh 
            position={orb.position}
            ref={(ref) => { 
              if (ref) orbRefs.current[i] = ref; 
            }}
          >
            <sphereGeometry args={[orb.scale, 16, 16]} />
            <meshStandardMaterial
              color={orb.color}
              transparent
              opacity={0.4}
              emissive={orb.color.clone().multiplyScalar(0.3)}
              emissiveIntensity={0.2}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
};