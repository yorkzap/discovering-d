// src/components/FloatingSpaceText.jsx
import { Text3D } from "@react-three/drei";
import { useAtom, useSetAtom } from "jotai"; // Ensure useSetAtom is imported
import { useEffect, useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";
import { pageAtom, pages as appPages } from "./UI";
import {
  currentTextLineIndexAtom,
  isBoostingAtom,
  textProximityFactorAtom,
  textPassingPhaseAtom,
  activeTextWorldPositionAtom, // ADDED
} from "./atoms";

// --- Aesthetic & Visibility ---
const TEXT_COLOR = new THREE.Color("white");
const TEXT_EMISSIVE_COLOR = new THREE.Color(0xeeeeee);
const TEXT_EMISSIVE_INTENSITY = 0.4;
const TEXT_METALNESS = 0.05;
const TEXT_ROUGHNESS = 0.9;
const TEXT_SIZE_3D = 0.28;
const TEXT_LETTER_SPACING_3D = -0.015;
const TEXT_LINE_HEIGHT_3D = 0.45;

// --- Behavioral Constants ---
const TEXT_SPAWN_Z = -35;
const TEXT_DESPAWN_Z = 10;
const TEXT_SIDE_OFFSET_X = 4.2;
const TEXT_VERTICAL_OFFSET_Y = -0.15;
const TEXT_BASE_SPEED_Z = 3.8;
const TEXT_BOOST_SPEED_MULTIPLIER = 3.2;
const TEXT_FADE_IN_DURATION = 0.9;
const TEXT_FADE_OUT_DURATION = 0.6;
const FONT_PATH = "/fonts/Inter_Regular.json";

const SLOW_ZONE_START_Z = -1.5;
const SLOWEST_POINT_Z = -0.8;
const SLOW_ZONE_END_Z = -0.2;
const MIN_SPEED_FACTOR = 0.97; // Original: 0.97, maybe 0.8 for more noticeable slowdown

const REACTION_ZONE_START_Z = -10.0; // When the book starts "noticing"
const REACTION_PEAK_Z = -0.8;      // Point of maximum interaction/closest approach for proximity calc
const REACTION_ZONE_END_Z = 1.5;   // When the book stops "noticing"

const PASSING_APPROACH_START_Z = -6.0;
const PASSING_PEAK_START_Z = -2.0;
const PASSING_PEAK_END_Z = 0.2;
const PASSING_EXIT_Z = 1.5;

export const FloatingSpaceText = ({ bookRef }) => {
  const [currentPageIndex, setCurrentPage] = useAtom(pageAtom);
  const [currentLineIndex, setCurrentLine] = useAtom(currentTextLineIndexAtom);
  const [isBoosting] = useAtom(isBoostingAtom);
  const setTextProximityFactor = useSetAtom(textProximityFactorAtom);
  const setTextPassingPhase = useSetAtom(textPassingPhaseAtom);
  const setActiveTextWorldPosition = useSetAtom(activeTextWorldPositionAtom); // ADDED

  const [activeTextLineData, setActiveTextLineData] = useState(null);
  const [targetTextId, setTargetTextId] = useState(null);
  const textMeshGroupRef = useRef();
  const materialRef = useRef();
  const advancementTriggeredForId = useRef(null);

  const defaultMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: TEXT_COLOR,
    transparent: true,
    opacity: 0,
    metalness: TEXT_METALNESS,
    roughness: TEXT_ROUGHNESS,
    emissive: TEXT_EMISSIVE_COLOR,
    emissiveIntensity: TEXT_EMISSIVE_INTENSITY,
  }), []);

  useEffect(() => {
    if (currentPageIndex < 0 || currentPageIndex >= appPages.length) {
      setTargetTextId(null); return;
    }
    const pageData = appPages[currentPageIndex];
    if (!pageData || !pageData.floatingTexts) {
      setTargetTextId(null); return;
    }
    if (currentLineIndex < 0 || currentLineIndex >= pageData.floatingTexts.length) {
      setTargetTextId(null); return;
    }
    const newTargetId = `${currentPageIndex}-${currentLineIndex}`;
    setTargetTextId(newTargetId);
  }, [currentPageIndex, currentLineIndex, appPages]);

  const triggerAdvancement = (method) => {
    if (!activeTextLineData || advancementTriggeredForId.current === activeTextLineData.id) return;
    advancementTriggeredForId.current = activeTextLineData.id;

    const currentPageData = appPages[currentPageIndex];
    if (currentPageData && currentPageData.floatingTexts) {
      if (currentLineIndex < currentPageData.floatingTexts.length - 1) {
        setCurrentLine(prev => prev + 1);
      } else {
        if (currentPageIndex < appPages.length - 1) {
          setCurrentPage(prev => prev + 1);
          setCurrentLine(0);
        } else {
          setCurrentLine(prev => prev + 1); // Go beyond last line to signal end
        }
      }
    }
    
    // Clear world position when advancing
    setActiveTextWorldPosition(null);
    if (textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;

    if (method === 'despawn') setActiveTextLineData(null);
  };

  useEffect(() => {
    // Cleanup on unmount or when targetTextId changes significantly before new text is ready
    return () => {
        setActiveTextWorldPosition(null);
        if (textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
    };
  }, [setActiveTextWorldPosition]);


  useEffect(() => {
    // This effect handles switching text lines
    // Old text fades out, new text data is prepared and fades in.

    const activeTextId = activeTextLineData?.id;

    if (activeTextId && activeTextId !== targetTextId) { // Current text exists but is not the target
      if (materialRef.current && materialRef.current.opacity > 0) {
        gsap.to(materialRef.current, {
          opacity: 0, duration: TEXT_FADE_OUT_DURATION, ease: "power1.in",
          onComplete: () => {
            if (activeTextLineData?.id === activeTextId) setActiveTextLineData(null); // Ensure it's the same one
            setActiveTextWorldPosition(null);
            if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
            if (targetTextId) prepareAndAnimateNewText();
          },
        });
      } else { // Already faded out
        setActiveTextLineData(null);
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
        if (targetTextId) prepareAndAnimateNewText();
      }
    } else if (targetTextId && (!activeTextId || activeTextId !== targetTextId)) { // No current text or different, and new target exists
      prepareAndAnimateNewText();
    } else if (!targetTextId && activeTextId) { // No target, but current text exists (e.g. end of all texts)
       if (materialRef.current && materialRef.current.opacity > 0) {
        gsap.to(materialRef.current, {
          opacity: 0, duration: TEXT_FADE_OUT_DURATION, ease: "power1.in",
          onComplete: () => {
            setActiveTextLineData(null);
            setActiveTextWorldPosition(null);
            if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
          }
        });
      } else {
        setActiveTextLineData(null);
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
      }
    }

    function prepareAndAnimateNewText() {
      if (!targetTextId) {
        setActiveTextLineData(null);
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
        return;
      }

      const [pageIdxStr, lineIdxStr] = targetTextId.split("-");
      const pageIdx = parseInt(pageIdxStr, 10);
      const lineIdx = parseInt(lineIdxStr, 10);

      // Ensure current page/line from atoms match the target before proceeding
      if (pageIdx !== currentPageIndex || lineIdx !== currentLineIndex) return;

      const pageData = appPages[pageIdx];
      if (!pageData || !pageData.floatingTexts || lineIdx < 0 || lineIdx >= pageData.floatingTexts.length) {
        setActiveTextLineData(null);
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
        return;
      }

      const lineContent = pageData.floatingTexts[lineIdx];
      let initialSpawnY = TEXT_VERTICAL_OFFSET_Y;
      if (bookRef?.current) {
        const bookWorldPos = new THREE.Vector3();
        bookRef.current.getWorldPosition(bookWorldPos);
        initialSpawnY = bookWorldPos.y + TEXT_VERTICAL_OFFSET_Y;
      }

      const sideMultiplier = (lineIdx % 2 === 0) ? -1 : 1; // Left is even index
      // Adjust side offset for better visibility with "curious reader"
      // Text on the right (odd index, positive X) might need to be less far out
      // Text on the left (even index, negative X) is usually fine
      const adjustedSideOffset = sideMultiplier > 0 ? TEXT_SIDE_OFFSET_X * 0.85 : TEXT_SIDE_OFFSET_X;
      const spawnX = adjustedSideOffset * sideMultiplier;

      const newTextData = {
        id: targetTextId, content: lineContent,
        initialX: spawnX, initialY: initialSpawnY,
        currentZ: TEXT_SPAWN_Z, rotationY: 0
      };

      advancementTriggeredForId.current = null;
      setActiveTextLineData(newTextData);
      setTextProximityFactor(0);
      setTextPassingPhase('none');
      setActiveTextWorldPosition(null); // Clear old position before new text appears
      if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;


      if (materialRef.current) {
        materialRef.current.opacity = 0; 
        gsap.to(materialRef.current, {
          opacity: 1, duration: TEXT_FADE_IN_DURATION, ease: "power1.out"
        });
      }
    }
  }, [targetTextId, bookRef, currentPageIndex, currentLineIndex, appPages, setTextProximityFactor, setTextPassingPhase, setActiveTextWorldPosition, activeTextLineData]);


  useFrame((state, delta) => {
    if (!activeTextLineData || !textMeshGroupRef.current || !materialRef.current) {
      if (activeTextLineData === null && textMeshGroupRef.current?.userData?.isActive) {
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
        setTextProximityFactor(0);
        setTextPassingPhase('none');
      }
      return;
    }

    // If a new target ID is set but this instance is still for the old ID, do nothing.
    // The useEffect above will handle fading this out and preparing the new one.
    if (targetTextId !== null && activeTextLineData.id !== targetTextId) {
        // Ensure world position is cleared if this text is no longer the target
        if (textMeshGroupRef.current?.userData?.isActive) {
            setActiveTextWorldPosition(null);
            textMeshGroupRef.current.userData.isActive = false;
        }
        return;
    }

    const fixedY = activeTextLineData.initialY;
    let baseSpeedZ = TEXT_BASE_SPEED_Z * (isBoosting ? TEXT_BOOST_SPEED_MULTIPLIER : 1.0);
    const currentZ = activeTextLineData.currentZ;

    let speedFactor = 1.0;
    if (currentZ > SLOW_ZONE_START_Z && currentZ < SLOW_ZONE_END_Z && !isBoosting) {
      if (currentZ < SLOWEST_POINT_Z) {
        const progress = Math.max(0, Math.min(1, (currentZ - SLOW_ZONE_START_Z) / (SLOWEST_POINT_Z - SLOW_ZONE_START_Z)));
        speedFactor = THREE.MathUtils.lerp(1.0, MIN_SPEED_FACTOR, Math.sin(progress * Math.PI / 2));
      } else {
        const progress = Math.max(0, Math.min(1, (currentZ - SLOWEST_POINT_Z) / (SLOW_ZONE_END_Z - SLOWEST_POINT_Z)));
        speedFactor = THREE.MathUtils.lerp(MIN_SPEED_FACTOR, 1.0, Math.sin(progress * Math.PI / 2));
      }
    }
    speedFactor = Math.max(speedFactor, MIN_SPEED_FACTOR); // Ensure it doesn't go below min
    const effectiveSpeedZ = baseSpeedZ * speedFactor;
    const newZ = currentZ + effectiveSpeedZ * delta;

    let proximity = 0;
    if (newZ > REACTION_ZONE_START_Z && newZ < REACTION_ZONE_END_Z) {
      if (newZ < REACTION_PEAK_Z) { // Approaching peak
        proximity = (newZ - REACTION_ZONE_START_Z) / (REACTION_PEAK_Z - REACTION_ZONE_START_Z);
      } else { // Moving away from peak
        proximity = 1 - ( (newZ - REACTION_PEAK_Z) / (REACTION_ZONE_END_Z - REACTION_PEAK_Z) );
      }
      proximity = THREE.MathUtils.clamp(proximity, 0, 1);
      proximity = Math.sin(proximity * Math.PI / 2); // Apply sine curve for smoother ramp up/down
    }
    setTextProximityFactor(proximity);

    let passingPhase = 'none';
    if (newZ > PASSING_APPROACH_START_Z) {
      if (newZ < PASSING_PEAK_START_Z) passingPhase = 'approaching';
      else if (newZ < PASSING_PEAK_END_Z) passingPhase = 'passing';
      else if (newZ < PASSING_EXIT_Z) passingPhase = 'exiting';
      else passingPhase = 'passed';
    }
    setTextPassingPhase(passingPhase);

    textMeshGroupRef.current.position.set(activeTextLineData.initialX, fixedY, newZ);
    textMeshGroupRef.current.userData.isActive = true; // Mark as active for world position sharing

    // Update shared world position if text is visible
    if (materialRef.current.opacity > 0.01) {
        setActiveTextWorldPosition(textMeshGroupRef.current.position.clone());
    } else if (textMeshGroupRef.current.userData.isActive) { // If opacity drops but was active
        setActiveTextWorldPosition(null);
        textMeshGroupRef.current.userData.isActive = false;
    }
    
    setActiveTextLineData(prev => {
      if (!prev || prev.id !== activeTextLineData.id) return prev; // Stale update check
      return { ...prev, currentZ: newZ };
    });

    if (newZ > TEXT_DESPAWN_Z) {
      if (activeTextLineData && advancementTriggeredForId.current !== activeTextLineData.id) {
        triggerAdvancement('despawn');
      } else if (activeTextLineData && advancementTriggeredForId.current === activeTextLineData.id) {
        // Already advanced, just clear current data
        setActiveTextLineData(null); 
        setActiveTextWorldPosition(null);
        if(textMeshGroupRef.current) textMeshGroupRef.current.userData.isActive = false;
      }
      setTextProximityFactor(0);
      setTextPassingPhase('none');
      return;
    }
  });

  if (!activeTextLineData || !activeTextLineData.content) return null;

  return (
    <group ref={textMeshGroupRef} key={activeTextLineData.id} rotation-y={activeTextLineData.rotationY}>
      <Text3D
        font={FONT_PATH}
        size={TEXT_SIZE_3D}
        height={TEXT_SIZE_3D * 0.22} curveSegments={10}
        bevelEnabled bevelThickness={TEXT_SIZE_3D * 0.03}
        bevelSize={TEXT_SIZE_3D * 0.025} bevelOffset={0} bevelSegments={4}
        letterSpacing={TEXT_LETTER_SPACING_3D} lineHeight={TEXT_LINE_HEIGHT_3D}
        textAlign={activeTextLineData.initialX < 0 ? "right" : "left"}
        anchorX={activeTextLineData.initialX < 0 ? "right" : "left"}
      >
        {activeTextLineData.content}
        <primitive object={defaultMaterial} ref={materialRef} attach="material" />
      </Text3D>
    </group>
  );
};