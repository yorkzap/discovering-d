// src/components/NarrativeManager.jsx
import { useAtom } from "jotai";
import { useEffect, useState, useRef, useCallback } from "react";
import { pageAtom, pages } from "./UI";
import { AnimatedBasText } from "./AnimatedBasText";
import * as THREE from "three";

let nextTextId = 0;
const getUniqueId = () => `bas-narrative-${nextTextId++}`;

const TEXT_ANIMATE_OUT_EFFECTIVE_DURATION = 450; // Can be slightly faster if animation is faster

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
      const TEXT_SIZE_PARAM = 0.055; // MATCHES AnimatedBasText new default textParams.size
      const LINE_SPACING = TEXT_SIZE_PARAM * 2.0; // Slightly more relative spacing for smaller text to maintain readability
      
      const textX = baseBookPos.x;
      const totalTextBlockHeight = (totalLines - 1) * LINE_SPACING;
      // Adjust Y offset: start higher if text is smaller to keep it above book center
      const yOffsetForTextBlockCenter = PAGE_HEIGHT * 0.44 + totalTextBlockHeight / 2; 
      const textY = baseBookPos.y + yOffsetForTextBlockCenter - (lineIndex * LINE_SPACING);
      const textZ = baseBookPos.z + 0.25; // Bring even closer to book if smaller
      return [textX, textY, textZ];
    },
    [bookGroupRef]
  );

  useEffect(() => {
    const previousManagedIndex = managedPageIndex;
    setManagedPageIndex(currentPageIndexAtom);

    if (activeNarratives.length > 0 && previousManagedIndex !== currentPageIndexAtom) {
      setActiveNarratives(prev => {
        const newAnimatingOut = new Set();
        const next = prev.map(n => {
          if (n.visible) newAnimatingOut.add(n.id);
          return { ...n, visible: false, initialDelay: 0 };
        });
        animatingOutIds.current = newAnimatingOut;
        if(newAnimatingOut.size === 0 && animatingOutIds.current.size === 0){ 
             loadNewPageTexts(currentPageIndexAtom);
        }
        return next;
      });
    } else if (previousManagedIndex !== currentPageIndexAtom || activeNarratives.length === 0 ) {
      animatingOutIds.current.clear();
      loadNewPageTexts(currentPageIndexAtom);
    }
  }, [currentPageIndexAtom]);


  const loadNewPageTexts = useCallback((pageIndexToShow) => {
    const pageData = pages[pageIndexToShow];
    const narrativeLines = pageData?.narrative || [];

    if ((!pageData && pageIndexToShow >=0 && pageIndexToShow < pages.length) || narrativeLines.length === 0) {
      setActiveNarratives([]); return;
    }

    const pageTurnSettleDelay = 200; // ADJUSTED: Even faster
    const interLineStagger = 120;   // ADJUSTED: Even faster

    const newNarratives = narrativeLines.map((line, index) => ({
      id: getUniqueId(),
      text: line,
      targetPosition: calculateTextPosition(index, narrativeLines.length),
      visible: true,
      initialDelay: pageTurnSettleDelay + (index * interLineStagger),
      textParams: { 
        size: 0.055, // Consistent smaller size
        depth: 0.008, 
        curveSegments: 2 
      },
      animationParams: { 
        minDuration: 0.6, maxDuration: 1.0, stretch: 0.08,
        lengthFactor: 0.03, explodeSphereRadius: 0.25, 
        rotationFactor: Math.PI * 1.3,
      },
    }));
    setActiveNarratives(newNarratives);
  }, [calculateTextPosition]);


  const handleTextAnimationComplete = useCallback((textId, wasMadeVisible) => {
    if (!wasMadeVisible) {
      animatingOutIds.current.delete(textId);
      if (animatingOutIds.current.size === 0 ) {
        if (managedPageIndex === currentPageIndexAtom) {
            const narrativesAreForOldPage = activeNarratives.some(n => !n.visible);
            if (narrativesAreForOldPage || activeNarratives.length === 0) {
                 loadNewPageTexts(currentPageIndexAtom);
            }
        }
      }
    }
  }, [loadNewPageTexts, currentPageIndexAtom, managedPageIndex, activeNarratives]);

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
          textParams={narrative.textParams}
          animationParams={narrative.animationParams}
          baseColor="#e0e8ff" // Slightly brighter base for smaller text
          emissiveColor="#99bbff"
        />
      ))}
    </group>
  );
};