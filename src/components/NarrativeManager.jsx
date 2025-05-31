// src/components/NarrativeManager.jsx
import { useAtom } from "jotai";
import { useEffect, useState, useRef, useCallback } from "react";
import { pageAtom, pages } from "./UI";
import { AnimatedBasText } from "./AnimatedBasText"; // Use the new component
import * as THREE from "three";

let nextTextId = 0;
const getUniqueId = () => `bas-narrative-${nextTextId++}`;

const PAGE_TURN_VISUAL_DELAY = 600; // Time for book page to turn
const TEXT_ANIMATE_OUT_DURATION = 400; // Time for old text to animate out (uProgress to 0)
const TEXT_APPEAR_BASE_STAGGER = PAGE_TURN_VISUAL_DELAY; // Delay before new text *starts* its animation
const INTER_LINE_APPEAR_DELAY = 400; // Stagger between lines

export const NarrativeManager = ({ bookGroupRef }) => {
  const [currentPageIndex] = useAtom(pageAtom);
  const [activeNarratives, setActiveNarratives] = useState([]);
  const bookWorldPosition = useRef(new THREE.Vector3());
  const pageTurnTimeoutRef = useRef(null);

  const calculateTextPosition = useCallback(
    (lineIndex, totalLines) => {
      if (bookGroupRef?.current) {
        bookGroupRef.current.getWorldPosition(bookWorldPosition.current);
      }
      const baseBookPos = bookWorldPosition.current;
      const PAGE_HEIGHT = 1.71;
      const TEXT_SIZE_APPROX = 0.08; // Corresponds to textParams.size in AnimatedBasText override
      const LINE_SPACING = TEXT_SIZE_APPROX * 1.8; // Increased spacing for 3D text

      const textX = baseBookPos.x;
      const totalTextBlockHeight = (totalLines - 1) * LINE_SPACING;
      
      // Adjust Y to be higher to account for text size and centering
      const yOffsetForTextBlockCenter = PAGE_HEIGHT * 0.4 + totalTextBlockHeight / 2; 
      const textY = baseBookPos.y + yOffsetForTextBlockCenter - (lineIndex * LINE_SPACING);
      const textZ = baseBookPos.z + 0.45; // A bit more in front for 3D

      return [textX, textY, textZ];
    },
    [bookGroupRef]
  );

  useEffect(() => {
    // 1. Signal existing texts to start animating out
    setActiveNarratives(prev =>
      prev.map(n => ({ ...n, visible: false, initialDelay: 0 })) // initialDelay 0 for immediate out animation
    );

    if (pageTurnTimeoutRef.current) clearTimeout(pageTurnTimeoutRef.current);

    // 2. After a delay (for old text to animate out), add new texts
    pageTurnTimeoutRef.current = setTimeout(() => {
      const pageData = pages[currentPageIndex];
      const narrativeLines = pageData?.narrative || [];

      if (!pageData && currentPageIndex > 0 && currentPageIndex < pages.length) { // Check bounds
        console.warn(`NarrativeManager: No page data for index ${currentPageIndex}`);
        setActiveNarratives([]); // Clear if no data
        return;
      }
      if (narrativeLines.length === 0) {
         setActiveNarratives([]); // Clear if no narrative lines for this page
         return;
       }

      const newNarratives = narrativeLines.map((line, index) => ({
        id: getUniqueId(),
        text: line,
        targetPosition: calculateTextPosition(index, narrativeLines.length),
        visible: true, // Will trigger animation in
        initialDelay: TEXT_APPEAR_BASE_STAGGER + (index * INTER_LINE_APPEAR_DELAY),
      }));
      setActiveNarratives(newNarratives);

    }, TEXT_ANIMATE_OUT_DURATION); // Wait for old text to finish its uProgress animation to 0

    return () => {
      if (pageTurnTimeoutRef.current) clearTimeout(pageTurnTimeoutRef.current);
    };
  }, [currentPageIndex, calculateTextPosition, bookGroupRef]);

  const handleTextAnimationComplete = useCallback((textId, wasMadeVisible) => {
    if (!wasMadeVisible) { // If animation out (uProgress to 0) is complete
      setActiveNarratives(prev => prev.filter(n => n.id !== textId));
    }
  }, []);

  return (
    <group name="NarrativeTextsContainer_BAS">
      {activeNarratives.map(narrative => (
        <AnimatedBasText
          key={narrative.id}
          id={narrative.id}
          text={narrative.text}
          targetPosition={narrative.targetPosition}
          visible={narrative.visible}
          initialDelay={narrative.initialDelay}
          onAnimationComplete={handleTextAnimationComplete}
          // You can override default textParams and animationParams here if needed per-instance
          textParams={{ 
            size: 0.08,       // Adjust size as needed
            depth: 0.01,      // Use depth
            curveSegments: 3 
          }}
          animationParams={{ // Fine-tune these for desired animation feel
            minDuration: 0.9,
            maxDuration: 1.3,
            stretch: 0.1,
            lengthFactor: 0.04,
            explodeRadius: 0.35,
            rotationFactor: Math.PI * 1.2,
          }}
          color="#c0d0ff" // Slightly different color for effect
        />
      ))}
    </group>
  );
};