// src/components/ContinuousTravelLines.jsx
import { useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { bookFloatingAtom, pages as appPages } from "./UI"; // Using bookFloatingAtom from UI
import { cameraFocusAtom } from './atoms'; // To deactivate when focused

const MAX_LINES = 100; // Total number of line segments (MAX_LINES / 2 actual lines)
const SPAWN_RATE = 2; // New line segments per frame
const LINE_LIFETIME = 1.5; // Seconds
const LINE_SPEED = 2.5;
const LINE_INITIAL_LENGTH = 0.3;
const SPREAD_FACTOR = 0.05; // How much lines spread out from pure +Z

// Constants from Book.jsx
const PAGE_HEIGHT_CONST = 1.71;
const PAGE_DEPTH_CONST = 0.003;

export const ContinuousTravelLines = () => {
  const [isBookPrimarilyFloating] = useAtom(bookFloatingAtom); // From UI.jsx
  const [focus] = useAtom(cameraFocusAtom);

  const linesRef = useRef();
  const [lineData, setLineData] = useState([]); // Stores { id, origin, direction, age, startPos }
  const nextLineId = useRef(0);

  const bookThickness = useMemo(() => appPages.length * PAGE_DEPTH_CONST, []);

  const isActive = isBookPrimarilyFloating && !focus;

  const spineCorners = useMemo(() => {
    const halfH = PAGE_HEIGHT_CONST / 2;
    const halfT = bookThickness / 2;
    const backZ = 0.02; // Slightly behind the spine
    return [
      new THREE.Vector3(halfT, halfH, backZ),
      new THREE.Vector3(halfT, -halfH, backZ),
      new THREE.Vector3(-halfT, halfH, backZ),
      new THREE.Vector3(-halfT, -halfH, backZ),
    ];
  }, [bookThickness]);

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: 0xd0d0ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useEffect(() => {
    if (!isActive) {
      // If effect becomes inactive, clear existing lines gradually or immediately
      // For simplicity here, we'll let them fade out naturally if their age progresses
      // Or, if you want immediate clear: setLineData([]);
    }
  }, [isActive]);


  useFrame((state, delta) => {
    if (!linesRef.current) return;

    let newLinesData = [...lineData];

    // 1. Age and remove old lines
    newLinesData = newLinesData.filter(line => {
      line.age += delta;
      return line.age < LINE_LIFETIME;
    });

    // 2. Spawn new lines if active and below max count
    if (isActive && newLinesData.length < MAX_LINES / 2) {
      for (let i = 0; i < SPAWN_RATE; i++) {
        if (newLinesData.length >= MAX_LINES / 2) break;

        const originCorner = spineCorners[Math.floor(Math.random() * spineCorners.length)];
        const slightOffset = new THREE.Vector3(
          (Math.random() - 0.5) * bookThickness * 0.1,
          (Math.random() - 0.5) * PAGE_HEIGHT_CONST * 0.1,
          (Math.random() - 0.5) * 0.02
        );
        const startPos = originCorner.clone().add(slightOffset);

        newLinesData.push({
          id: nextLineId.current++,
          startPos: startPos, // Store initial spawn point for this instance
          age: 0,
          // Direction will be calculated per frame relative to current age for trail effect
        });
      }
    }
    
    setLineData(newLinesData); // Update state with new set of lines

    // 3. Update geometry
    if (newLinesData.length > 0) {
      const allLineSegments = [];
      newLinesData.forEach(line => {
        const progress = line.age / LINE_LIFETIME; // 0 to 1
        
        // Head of the line moves away
        const headZ = line.startPos.z + line.age * LINE_SPEED;
        
        // Tail of the line also moves, but starts later or moves slower to create a trailing effect
        // For simplicity, let's make the line length decrease over its life
        const currentLength = LINE_INITIAL_LENGTH * (1 - progress * 0.7); // Shrinks a bit
        const tailZ = headZ - currentLength;

        // Add slight randomness to X and Y for a bit of spread/energy
        const spreadX = (Math.random() - 0.5) * SPREAD_FACTOR * line.age;
        const spreadY = (Math.random() - 0.5) * SPREAD_FACTOR * line.age;

        const headPoint = new THREE.Vector3(line.startPos.x + spreadX, line.startPos.y + spreadY, headZ);
        const tailPoint = new THREE.Vector3(line.startPos.x + spreadX * 0.8, line.startPos.y + spreadY * 0.8, tailZ); // Tail spreads less
        
        allLineSegments.push(tailPoint, headPoint);
      });

      if (allLineSegments.length > 0) {
        const newGeometry = new THREE.BufferGeometry().setFromPoints(allLineSegments);
        if (linesRef.current.geometry) {
          linesRef.current.geometry.dispose();
        }
        linesRef.current.geometry = newGeometry;
        linesRef.current.visible = true;
        
        // Fade opacity of material based on overall activity (optional, could be per line)
        // Here, just ensuring material opacity is set if it was changed.
        linesRef.current.material.opacity = isActive ? 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.1 : 0; // Pulsate slightly if active
      } else {
        linesRef.current.visible = false;
      }

    } else {
      linesRef.current.visible = false;
    }
  });

  return (
    <lineSegments ref={linesRef} frustumCulled={false} visible={false}>
      <primitive object={lineMaterial} attach="material" />
    </lineSegments>
  );
};