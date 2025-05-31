// src/components/NarrativeManager.jsx
import { useAtom } from "jotai";
import { useEffect, useState, useRef, useCallback } from "react";
import { pageAtom, pages } from "./UI";
import { AnimatedBasText } from "./AnimatedBasText";
import * as THREE from "three";

let nextTextId = 0;
const getUniqueId = () => `bas-narrative-${nextTextId++}`;

// Out animation duration is primarily controlled by LERP_SPEED_OVERALL when targetProgress = 0.0 in AnimatedBasText
const TEXT_ANIMATE_OUT_EFFECTIVE_DURATION = 600; // Estimate for uProgress to go 1->0. Adjust if LERP_SPEED_OVERALL changes for out.

export const NarrativeManager = ({ bookGroupRef }) => {
  const [currentPageIndexAtom] = useAtom(pageAtom);
  const [activeNarratives, setActiveNarratives] = useState([]);
  const [managedPageIndex, setManagedPageIndex] = useState(currentPageIndexAtom);
  const animatingOutIds = useRef(new Set());
  const bookWorldPosition = useRef(new THREE.Vector3());

  const calculateTextPosition = useCallback(
    (lineIndex, totalLines) => {
      if (bookGroupRef?.current) {
        bookGroupRef.current.getWorldPosition(bookWorldPosition.current);
      }
      const baseBookPos = bookWorldPosition.current;
      const PAGE_HEIGHT = 1.71;
      const TEXT_SIZE_PARAM = 0.09; // MATCHES AnimatedBasText default textParams.size
      const LINE_SPACING = TEXT_SIZE_PARAM * 1.8; // Adjust spacing based on new size
      
      const textX = baseBookPos.x;
      const totalTextBlockHeight = (totalLines - 1) * LINE_SPACING;
      const yOffsetForTextBlockCenter = PAGE_HEIGHT * 0.40 + totalTextBlockHeight / 2; // Fine-tune Y
      const textY = baseBookPos.y + yOffsetForTextBlockCenter - (lineIndex * LINE_SPACING);
      const textZ = baseBookPos.z + 0.35; // Adjust Z if needed with new size
      return [textX, textY, textZ];
    },
    [bookGroupRef]
  );

  useEffect(() => {
    if (activeNarratives.length > 0 && managedPageIndex !== currentPageIndexAtom) {
      setActiveNarratives(prev => {
        const newAnimatingOut = new Set();
        const next = prev.map(n => {
          if (n.visible) newAnimatingOut.add(n.id);
          return { ...n, visible: false, initialDelay: 0 }; // Animate out immediately
        });
        animatingOutIds.current = newAnimatingOut;
        if(newAnimatingOut.size === 0){ // If nothing was visible to animate out, proceed
             loadNewPageTexts(currentPageIndexAtom);
        }
        return next;
      });
    } else if (managedPageIndex !== currentPageIndexAtom || activeNarratives.length === 0 ) {
      animatingOutIds.current.clear();
      loadNewPageTexts(currentPageIndexAtom);
    }
    setManagedPageIndex(currentPageIndexAtom);
  }, [currentPageIndexAtom]); // Removed loadNewPageTexts from dep array to avoid loops, it's called internally

  const loadNewPageTexts = useCallback((pageIndexToShow) => {
    const pageData = pages[pageIndexToShow];
    const narrativeLines = pageData?.narrative || [];

    if (!pageData && pageIndexToShow >=0 && pageIndexToShow < pages.length) {
      setActiveNarratives([]); return;
    }
    if (narrativeLines.length === 0) {
       setActiveNarratives([]); return;
    }

    // ADJUSTED: Faster appearance of new text
    const pageTurnSettleDelay = 350; // Reduced delay after page turn logic
    const interLineStagger = 200;   // Reduced stagger between lines

    const newNarratives = narrativeLines.map((line, index) => ({
      id: getUniqueId(),
      text: line,
      targetPosition: calculateTextPosition(index, narrativeLines.length),
      visible: true,
      initialDelay: pageTurnSettleDelay + (index * interLineStagger),
      // Override params from AnimatedBasText if needed, or let defaults apply
      textParams: { 
        size: 0.09, // Consistent smaller size
        depth: 0.015, 
        curveSegments: 3 
      },
      animationParams: { 
        minDuration: 0.7, maxDuration: 1.1, stretch: 0.1,
        lengthFactor: 0.035, explodeSphereRadius: 0.35, 
        rotationFactor: Math.PI * 1.5,
      },
    }));
    setActiveNarratives(newNarratives);
  }, [calculateTextPosition]); // currentPageIndexAtom removed as it's passed as arg


  const handleTextAnimationComplete = useCallback((textId, wasMadeVisible) => {
    if (!wasMadeVisible) {
      animatingOutIds.current.delete(textId);
      // If all texts that were animating out have finished
      if (animatingOutIds.current.size === 0 && managedPageIndex === currentPageIndexAtom) {
        // This condition means: we triggered a fade out, ALL faded out, and we are STILL on the target page.
        // This is the primary path to load new texts AFTER old ones are gone.
        loadNewPageTexts(currentPageIndexAtom);
      } else if (animatingOutIds.current.size === 0 && managedPageIndex !== currentPageIndexAtom){
        // This case should be rare if managedPageIndex is updated correctly.
        // It means all faded out, but pageAtom has changed AGAIN. The useEffect on pageAtom will handle it.
      }
    }
  }, [loadNewPageTexts, currentPageIndexAtom, managedPageIndex]);

  return (
    <group name="NarrativeTextsContainer_BAS_Managed">
      {activeNarratives.map(narrative => (
        <AnimatedBasText
          key={narrative.id}
          id={narrative.id}
          text={narrative.text}
          targetPosition={narrative.targetPosition}
          visible={narrative.visible}
          initialDelay={narrative.initialDelay}
          onAnimationComplete={handleTextAnimationComplete}
          textParams={narrative.textParams} // Pass down specific params
          animationParams={narrative.animationParams} // Pass down specific params
          baseColor="#ddeeff" 
          emissiveColor="#77aaff"
        />
      ))}
    </group>
  );
};