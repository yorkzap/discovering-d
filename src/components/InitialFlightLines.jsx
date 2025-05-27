// src/components/InitialFlightLines.jsx
import { useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { showInitialFlightEffectAtom } from './atoms';
import { pages as appPages } from "./UI"; // Import pages data for book dimensions

const LINE_COUNT = 25; // Number of lines
const LINE_LENGTH_INITIAL = 0.7; // Initial length of lines
const EFFECT_DURATION = 1.2; // How long the effect lasts in seconds
const SPEED = 4.5; // How fast lines travel (units per second)

// Constants derived from Book.jsx (or could be passed as props if they vary)
const PAGE_HEIGHT_CONST = 1.71; 
const PAGE_DEPTH_CONST = 0.003; // Thickness of a single page

export const InitialFlightLines = () => {
  const [showEffect, setShowEffect] = useAtom(showInitialFlightEffectAtom);
  const linesRef = useRef();
  const [linesData, setLinesData] = useState([]);
  const effectIsActive = useRef(false); // Internal flag to manage ongoing animation
  const effectStartTime = useRef(0);

  // Calculate book thickness based on number of pages
  const bookThickness = useMemo(() => appPages.length * PAGE_DEPTH_CONST, []);

  useEffect(() => {
    if (showEffect && !effectIsActive.current) {
      // Start effect
      effectIsActive.current = true;
      effectStartTime.current = performance.now(); // Record start time
      const newLines = [];
      for (let i = 0; i < LINE_COUNT; i++) {
        newLines.push({
          id: i,
          // Lines start relative to the Book's group coordinate system:
          // X: along the book's thickness.
          // Y: along the book's height.
          // Z: just "behind" the spine plane (Z=0). Pages open towards -Z.
          initialPos: new THREE.Vector3(
            (Math.random() - 0.5) * bookThickness * 1.2, 
            (Math.random() - 0.5) * PAGE_HEIGHT_CONST * 0.95, 
            0.01 + Math.random() * 0.05 // Start slightly behind Z=0 plane, from Z=0.01 to Z=0.06
          ),
          startTimeOffset: Math.random() * 0.25, // Stagger line appearance
        });
      }
      setLinesData(newLines);

      // Automatically turn off the trigger atom after the effect duration
      const timer = setTimeout(() => {
        setShowEffect(false); 
        // effectIsActive will be set to false by useFrame when lines are done
      }, (EFFECT_DURATION + 0.4) * 1000); // Buffer for fade out
      return () => clearTimeout(timer);

    } else if (!showEffect && effectIsActive.current) {
      // If trigger is turned off externally, ensure internal state resets
      effectIsActive.current = false;
      // Lines will fade out naturally or be cleared by useFrame
    }
  }, [showEffect, setShowEffect, bookThickness]);

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: 0xe0e0ff, // A light, slightly blueish white
    transparent: true,
    opacity: 0.65, // Initial opacity
    blending: THREE.AdditiveBlending, // For a brighter, softer glow
    depthWrite: false, // Often good for transparent effects
  }), []);

  useFrame(() => {
    if (!linesRef.current || !effectIsActive.current) {
      if (linesRef.current) linesRef.current.visible = false;
      return;
    }

    const elapsedTimeSinceEffectStart = (performance.now() - effectStartTime.current) / 1000;
    
    const allLineSegments = [];
    let activeLinesThisFrame = 0;

    linesData.forEach(line => {
      // Only process line if its appearance time has come
      if (elapsedTimeSinceEffectStart < line.startTimeOffset) return; 

      const timeActive = elapsedTimeSinceEffectStart - line.startTimeOffset;
      // Stop processing line if its individual lifetime is over
      if (timeActive < 0 || timeActive > EFFECT_DURATION) return; 

      activeLinesThisFrame++;
      
      // Lines move along the Book group's +Z axis ("behind" the spine)
      const currentZ = line.initialPos.z + timeActive * SPEED;
      // Lines shorten over their lifetime for a tapered effect
      const currentLength = LINE_LENGTH_INITIAL * Math.max(0, (1 - (timeActive / EFFECT_DURATION)));
      
      const startPoint = new THREE.Vector3(line.initialPos.x, line.initialPos.y, currentZ);
      const endPoint = new THREE.Vector3(line.initialPos.x, line.initialPos.y, currentZ + currentLength);
      
      allLineSegments.push(startPoint, endPoint);
    });

    if (activeLinesThisFrame > 0 && allLineSegments.length > 0) {
        const newGeometry = new THREE.BufferGeometry().setFromPoints(allLineSegments);
        if (linesRef.current.geometry) {
          linesRef.current.geometry.dispose(); // Dispose old geometry to free GPU memory
        }
        linesRef.current.geometry = newGeometry;
        linesRef.current.visible = true;

        // Fade out the entire set of lines as the effect nears its end
        const overallProgress = Math.min(1, elapsedTimeSinceEffectStart / (EFFECT_DURATION + 0.1));
        linesRef.current.material.opacity = Math.max(0, 0.65 * (1 - Math.pow(overallProgress, 2)));
    } else {
        linesRef.current.visible = false;
        // If no active lines and effect duration has passed, fully reset
        if (effectIsActive.current && elapsedTimeSinceEffectStart > EFFECT_DURATION + 0.2) {
            effectIsActive.current = false; 
            setLinesData([]); // Clear data to free memory and stop processing
        }
    }
  });
  
  // Conditionally render the lineSegments object to keep scene graph cleaner when not active
  if (!showEffect && !effectIsActive.current && linesData.length === 0) return null;

  return (
    // Start with an empty geometry; it will be populated by useFrame
    <lineSegments ref={linesRef} frustumCulled={false} visible={false}>
      {/* Use primitive for the memoized material */}
      <primitive object={lineMaterial} attach="material" />
    </lineSegments>
  );
};