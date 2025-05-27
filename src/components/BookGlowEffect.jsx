// src/components/BookGlowEffect.jsx
import { useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { audioAnalyserAtom, isMusicPlayingAtom } from './atoms'; // Ensure these are correct

const PARTICLE_COUNT = 200;     // Reduced for clarity, can increase later
const EDGE_OFFSET = 0.01;       // <<--- MUCH SMALLER! (e.g., 1cm if 1 unit = 1 meter)
const PARTICLE_BASE_SIZE = 4;   // <<--- MUCH SMALLER!
const MIN_INTENSITY_FOR_GLOW = 0.1; // Minimum audio intensity to show glow

// Helper objects for dimension calculations
const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

export const BookGlowEffect = ({ bookObjectRef }) => {
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlaying] = useAtom(isMusicPlayingAtom); // Already in Experience, but good for internal logic

  const pointsRef = useRef();
  const dataArray = useRef(null);
  const audioIntensity = useRef(0);

  // Store current book dimensions and center (in local space of BookGlowEffect's parent)
  const [currentBookDimensions, setCurrentBookDimensions] = useState({
    width: 1.2, height: 1.8, depth: 0.3, // Default/fallback
    center: new THREE.Vector3(0, 0, 0)
  });

  const particlePositions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const particleLifes = useRef(new Float32Array(PARTICLE_COUNT));
  const particleColors = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const particleBasePositions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const particleBaseSizes = useRef(new Float32Array(PARTICLE_COUNT));

  const glowPalette = [
    new THREE.Color(0xffaa00), new THREE.Color(0xffff55), new THREE.Color(0xffddaa),
  ];

  const updateAndGetBookDimensions = () => {
    if (bookObjectRef && bookObjectRef.current) {
      // Calculate bounding box in the local coordinate system of bookObjectRef.current's parent
      // This assumes BookGlowEffect is a sibling of bookObjectRef.current
      bookObjectRef.current.updateWorldMatrix(true, false); // Ensure matrix is up-to-date
      tempBox.setFromObject(bookObjectRef.current); // Gets AABB in world space

      if (!tempBox.isEmpty()) {
        tempBox.getSize(tempSize);
        tempBox.getCenter(tempCenter); // World center

        // To get dimensions relative to the BookGlowEffect's own position (if it's at 0,0,0 sibling)
        // we effectively want the local bounding box of the book object if BookGlowEffect is also at local 0,0,0
        // For simplicity, if BookGlowEffect and Book are direct siblings under <Float>,
        // and Float is centered, their local coords are simple.
        // The bounding box of bookObjectRef.current already considers its internal rotations.
        setCurrentBookDimensions({
            width: tempSize.x,
            height: tempSize.y,
            depth: tempSize.z, // This will be the axis-aligned depth in world space
            // Center should be (0,0,0) if bookObjectRef is centered and BookGlowEffect is also at (0,0,0)
            // For now, assume we emit around local (0,0,0) using these dimensions.
            center: new THREE.Vector3(0,0,0) // Simplification: assume centered
        });
        return true;
      }
    }
    // Fallback if ref not ready
    setCurrentBookDimensions({ width: 1.2, height: 1.8, depth: 0.3, center: new THREE.Vector3(0,0,0) });
    return false;
  };


  const getRandomEdgePoint = () => {
    const { width, height, depth, center } = currentBookDimensions;
    const halfW = width / 2;
    const halfH = height / 2;
    // For an open book, 'depth' from AABB might be small if pages are thin.
    // Or it could be large if the book is very thick / many pages are splayed.
    // We primarily care about the outer rectangle for an open book glow.
    const halfD = Math.min(depth / 2, 0.05); // Cap depth for edge emission to keep it thin

    let x, y, z;
    const edgeSelector = Math.random();

    if (edgeSelector < 0.25) { // Top
      x = (Math.random() - 0.5) * width; y = halfH; z = (Math.random() - 0.5) * halfD * 2;
    } else if (edgeSelector < 0.5) { // Bottom
      x = (Math.random() - 0.5) * width; y = -halfH; z = (Math.random() - 0.5) * halfD * 2;
    } else if (edgeSelector < 0.75) { // Left
      x = -halfW; y = (Math.random() - 0.5) * height; z = (Math.random() - 0.5) * halfD * 2;
    } else { // Right
      x = halfW; y = (Math.random() - 0.5) * height; z = (Math.random() - 0.5) * halfD * 2;
    }
    return new THREE.Vector3(x + center.x, y + center.y, z + center.z);
  };

  const resetParticle = (index) => {
    const i3 = index * 3;
    const basePos = getRandomEdgePoint();

    particleBasePositions.current[i3 + 0] = basePos.x;
    particleBasePositions.current[i3 + 1] = basePos.y;
    particleBasePositions.current[i3 + 2] = basePos.z;
    particlePositions.current.set([basePos.x, basePos.y, basePos.z], i3);

    particleLifes.current[index] = 0.3 + Math.random() * 0.5; // Short lifespan

    const color = glowPalette[Math.floor(Math.random() * glowPalette.length)];
    particleColors.current.set([color.r, color.g, color.b], i3);
    particleBaseSizes.current[index] = PARTICLE_BASE_SIZE * (0.7 + Math.random() * 0.6);
  };

  useMemo(() => {
    updateAndGetBookDimensions(); // Initial attempt
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      resetParticle(i);
      particleLifes.current[i] *= Math.random();
    }
  }, []); // Removed bookObjectRef from deps to avoid re-init on every ref change, handle in useFrame

   const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions.current, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(particleColors.current, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(particleBaseSizes.current, 1));
    return geo;
  }, []);


  useFrame((state, delta) => {
    if (!pointsRef.current || !pointsRef.current.geometry || !bookObjectRef || !bookObjectRef.current) {
      if(pointsRef.current) pointsRef.current.visible = false;
      return;
    }
    
    // Try to update book dimensions each frame - can be expensive.
    // Consider doing this less frequently if performance is an issue.
    updateAndGetBookDimensions();

    let currentIntensity = 0;
    if (analyser && isMusicPlaying) { // isMusicPlaying from jotai atom
      if (!dataArray.current) dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray.current);
      let sum = 0;
      for (let i = 0; i < dataArray.current.length; i++) sum += dataArray.current[i];
      currentIntensity = sum / dataArray.current.length / 255;
    }
    audioIntensity.current = THREE.MathUtils.lerp(audioIntensity.current, currentIntensity, 0.15);

    const showEffect = isMusicPlaying && audioIntensity.current > MIN_INTENSITY_FOR_GLOW;
    pointsRef.current.visible = showEffect;
    if (!showEffect) return;

    const positions = pointsRef.current.geometry.attributes.position;
    const colors = pointsRef.current.geometry.attributes.color;
    const sizes = pointsRef.current.geometry.attributes.size;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleLifes.current[i] -= delta;
      if (particleLifes.current[i] <= 0) {
        resetParticle(i);
      }

      const i3 = i * 3;
      const lifeRatio = Math.max(0, particleLifes.current[i] / (0.3 + Math.random() * 0.5)); // Use original max life
      
      const basePosVec = new THREE.Vector3(
        particleBasePositions.current[i3 + 0],
        particleBasePositions.current[i3 + 1],
        particleBasePositions.current[i3 + 2]
      );
      
      const outwardDir = basePosVec.clone().normalize(); // Simple outward from particle's base
      const shimmerStrength = 0.001 + audioIntensity.current * 0.003; // Reduced shimmer
      const offsetMagnitude = EDGE_OFFSET + Math.sin(state.clock.elapsedTime * 15 + i * 0.5) * shimmerStrength;

      positions.array[i3 + 0] = basePosVec.x + outwardDir.x * offsetMagnitude;
      positions.array[i3 + 1] = basePosVec.y + outwardDir.y * offsetMagnitude;
      positions.array[i3 + 2] = basePosVec.z + outwardDir.z * offsetMagnitude;
      
      const intensityFactor = 0.6 + audioIntensity.current * 1.0;
      colors.array[i3 + 0] = particleColors.current[i3 + 0] * intensityFactor * lifeRatio; // Use original particle color
      colors.array[i3 + 1] = particleColors.current[i3 + 1] * intensityFactor * lifeRatio;
      colors.array[i3 + 2] = particleColors.current[i3 + 2] * intensityFactor * lifeRatio;
      
      sizes.array[i] = particleBaseSizes.current[i] * lifeRatio * (0.5 + audioIntensity.current * 0.5);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        vertexColors
        sizeAttenuation={true}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.8} // Overall opacity, can adjust
      />
    </points>
  );
};