import { useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { audioAnalyserAtom, isBoostingAtom } from './atoms'; // Added isBoostingAtom

const PARTICLE_COUNT = 800;
const FREQUENCY_BANDS = 8;

export const AudioVisualizer = () => {
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isBoosting] = useAtom(isBoostingAtom); // Read boost state
  const pointsRef = useRef();
  const dataArray = useRef(null);
  const frequencyBands = useRef(new Array(FREQUENCY_BANDS).fill(0));
  const bassIntensity = useRef(0);
  const midIntensity = useRef(0);
  const trebleIntensity = useRef(0);

  const particles = useMemo(() => {
    // ... (particle initialization logic remains the same)
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const baseVelocities = new Float32Array(PARTICLE_COUNT * 3);
    const randomFactors = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const ringIndices = new Float32Array(PARTICLE_COUNT); 

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ringIndex = Math.floor(Math.random() * FREQUENCY_BANDS);
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + ringIndex * 1.5 + Math.random() * 2;
      
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 10;

      baseVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.02;
      baseVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      baseVelocities[i * 3 + 2] = Math.random() * 0.02 + 0.01;

      const baseColor = new THREE.Color().setHSL(
        0.6 + Math.random() * 0.2, 
        0.6 + Math.random() * 0.2,
        0.5 + Math.random() * 0.2
      );
      colors[i * 3 + 0] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;

      randomFactors[i] = Math.random();
      sizes[i] = Math.random() * 0.5 + 0.5;
      ringIndices[i] = ringIndex;
    }
    return { positions, colors, baseVelocities, randomFactors, sizes, ringIndices };
  }, []);

  const geometry = useMemo(() => {
    // ... (geometry setup remains the same)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(particles.positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(particles.colors, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(particles.sizes, 1));
    return geo;
  }, [particles]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const colorsAttribute = pointsRef.current.geometry.attributes.color;
    const sizesAttribute = pointsRef.current.geometry.attributes.size;
    const material = pointsRef.current.material;

    // Boost multipliers
    const boostSpeedFactor = isBoosting ? 3.0 : 1.0;
    const boostTimeFactor = isBoosting ? 1.8 : 1.0; // For time-dependent animations
    const boostRespawnOffset = isBoosting ? 10 : 0; // Respawn further back

    let musicActive = false;
    let averageLoudness = 0;

    if (analyser) {
      // ... (analyser logic remains the same)
      if (!dataArray.current) {
        dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(dataArray.current);

      const bandSize = Math.floor(dataArray.current.length / FREQUENCY_BANDS);
      for (let i = 0; i < FREQUENCY_BANDS; i++) {
        let bandSum = 0;
        for (let j = i * bandSize; j < (i + 1) * bandSize; j++) {
          bandSum += dataArray.current[j];
        }
        frequencyBands.current[i] = bandSum / bandSize / 255;
      }

      bassIntensity.current = (frequencyBands.current[0] + frequencyBands.current[1]) / 2;
      midIntensity.current = (frequencyBands.current[2] + frequencyBands.current[3] + frequencyBands.current[4]) / 3;
      trebleIntensity.current = (frequencyBands.current[5] + frequencyBands.current[6] + frequencyBands.current[7]) / 3;

      let sum = 0;
      for (let i = 0; i < dataArray.current.length; i++) { sum += dataArray.current[i]; }
      averageLoudness = sum / dataArray.current.length / 255;
      musicActive = averageLoudness > 0.05;
    }
    
    // Material properties update (can also be boosted if desired)
    if (musicActive) {
      const targetSize = 0.08 + bassIntensity.current * 0.15;
      material.size = THREE.MathUtils.lerp(material.size, targetSize * (isBoosting ? 1.2 : 1), 0.2);
      material.opacity = THREE.MathUtils.lerp(material.opacity, 0.5 + averageLoudness * 0.5, 0.15);
    } else {
      material.size = THREE.MathUtils.lerp(material.size, 0.06, 0.1);
      material.opacity = THREE.MathUtils.lerp(material.opacity, 0.3, 0.1);
    }

    const effectiveTime = time * boostTimeFactor;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const ringIndex = particles.ringIndices[i];
      const bandIntensity = frequencyBands.current[ringIndex] || 0;

      if (musicActive) {
        const spiralSpeed = 0.5 + bandIntensity * 2; // Base speed
        const angle = effectiveTime * spiralSpeed + particles.randomFactors[i] * Math.PI * 2;
        
        positionsAttribute.array[i3 + 0] += Math.cos(angle) * 0.01 * (1 + bandIntensity) * boostSpeedFactor;
        positionsAttribute.array[i3 + 2] += Math.sin(angle) * 0.01 * (1 + bandIntensity) * boostSpeedFactor;
        
        positionsAttribute.array[i3 + 2] += particles.baseVelocities[i3 + 2] * (1 + bassIntensity.current * 5) * boostSpeedFactor;
        positionsAttribute.array[i3 + 1] += Math.sin(effectiveTime * 2 + particles.randomFactors[i] * Math.PI) * 0.02 * midIntensity.current * boostSpeedFactor;

        const hue = 0.55 + bandIntensity * 0.15 - bassIntensity.current * 0.1;
        const saturation = 0.5 + bandIntensity * 0.5;
        const lightness = 0.4 + bandIntensity * 0.4 + trebleIntensity.current * 0.2;
        
        const targetColor = new THREE.Color().setHSL(hue, saturation, lightness);
        colorsAttribute.array[i3 + 0] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 0], targetColor.r, 0.1);
        colorsAttribute.array[i3 + 1] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 1], targetColor.g, 0.1);
        colorsAttribute.array[i3 + 2] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 2], targetColor.b, 0.1);

        sizesAttribute.array[i] = particles.sizes[i] * (1 + bandIntensity * 2) * (isBoosting ? 1.1 : 1.0);
      } else { // Idle state
        positionsAttribute.array[i3 + 0] += Math.sin(effectiveTime * 0.2 + particles.randomFactors[i] * Math.PI) * 0.003 * boostSpeedFactor;
        positionsAttribute.array[i3 + 1] += Math.cos(effectiveTime * 0.15 + particles.randomFactors[i] * Math.PI) * 0.003 * boostSpeedFactor;
        positionsAttribute.array[i3 + 2] += particles.baseVelocities[i3 + 2] * 0.3 * boostSpeedFactor;

        const idleHue = 0.65 + Math.sin(effectiveTime * 0.5 + particles.randomFactors[i] * Math.PI) * 0.05;
        const idleColor = new THREE.Color().setHSL(idleHue, 0.4, 0.4);
        colorsAttribute.array[i3 + 0] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 0], idleColor.r, 0.05);
        colorsAttribute.array[i3 + 1] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 1], idleColor.g, 0.05);
        colorsAttribute.array[i3 + 2] = THREE.MathUtils.lerp(colorsAttribute.array[i3 + 2], idleColor.b, 0.05);
        sizesAttribute.array[i] = particles.sizes[i];
      }

      if (positionsAttribute.array[i3 + 2] > 5) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3 + particles.ringIndices[i] * 1.5 + Math.random() * 2;
        positionsAttribute.array[i3 + 0] = Math.cos(angle) * radius;
        positionsAttribute.array[i3 + 1] = (Math.random() - 0.5) * 10;
        positionsAttribute.array[i3 + 2] = -15 - Math.random() * 5 - boostRespawnOffset; // Respawn further back
      }
      
      if (Math.abs(positionsAttribute.array[i3 + 0]) > 20) positionsAttribute.array[i3 + 0] *= 0.9;
      if (Math.abs(positionsAttribute.array[i3 + 1]) > 15) positionsAttribute.array[i3 + 1] *= 0.9;
    }

    positionsAttribute.needsUpdate = true;
    colorsAttribute.needsUpdate = true;
    sizesAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        sizeAttenuation={true}
        transparent
        size={0.06}
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};