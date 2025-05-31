// src/components/NarrativeDisplayManager.jsx
import { useEffect, useState, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { NarrativeText } from './NarrativeText';
import { pages as appPages } from './UI'; // Your page data
import {
  currentVisiblePageAtom,
  currentTextLineIndexAtom,
  kenBurnsActiveAtom, // To time first line with Ken Burns
} from './atoms';
import { pageAtom } from './UI'; // CORRECTED IMPORT FOR pageAtom
import { useThree } from '@react-three/fiber';

// Add to top of NarrativeDisplayManager.jsx if needed for more precise first-line placement
// const PAGE_WIDTH = 1.28; // From Book.jsx
const PAGE_HEIGHT = 1.71; // From Book.jsx

export const NarrativeDisplayManager = ({ bookGroupRef }) => {
  const visiblePageIdx = useAtomValue(currentVisiblePageAtom);
  const [currentLineIdx, setCurrentLineIdx] = useAtom(currentTextLineIndexAtom);
  const isKenBurnsActive = useAtomValue(kenBurnsActiveAtom);
  const globalPage = useAtomValue(pageAtom); // For knowing current page from UI

  const [firstLineText, setFirstLineText] = useState(null);
  const [flyByTexts, setFlyByTexts] = useState([]); // Array of { id, text, visible, startTime }

  const pageData = appPages[visiblePageIdx];
  const { camera } = useThree();
  const flyByTextIdCounter = useRef(0);
  const flyByTimers = useRef({}); // To store timers for fly-by texts

  // Handle First Line Text (Task 2.2)
  useEffect(() => {
    if (pageData && pageData.floatingTexts && pageData.floatingTexts.length > 0) {
      if (isKenBurnsActive && currentLineIdx === 0) { // Show first line when Ken Burns starts and it's the first line
        setFirstLineText({
          text: pageData.floatingTexts[0],
          visible: true,
          key: `firstLine-${visiblePageIdx}-0`
        });
      } else if (!isKenBurnsActive && firstLineText?.visible && currentLineIdx === 0) {
        // If Ken burns stops while first line is visible, hide it.
        // Or if page changes.
        // setFirstLineText(prev => prev ? { ...prev, visible: false } : null);
      }
    } else {
      // No text for this page or conditions not met, ensure it's hidden
      if (firstLineText?.visible) {
        setFirstLineText(prev => prev ? { ...prev, visible: false } : null);
      } else if (!firstLineText) {
        setFirstLineText(null);
      }
    }
  }, [visiblePageIdx, pageData, isKenBurnsActive, currentLineIdx]);

  // Handle Sequential Fly-By Text (Task 2.3)
  useEffect(() => {
    // Clear previous fly-by texts if the page changes
    if (pageData) { // Check if pageData is valid
        const currentFlyByPageKey = `flyby-${visiblePageIdx}`;
        const activeFlyBys = flyByTexts.filter(t => t.pageKey === currentFlyByPageKey);

        if (currentLineIdx > 0 && currentLineIdx < pageData.floatingTexts.length) {
            // Check if this line is already displayed or being displayed
            const existingLine = activeFlyBys.find(t => t.text === pageData.floatingTexts[currentLineIdx]);
            if (!existingLine) {
                const newLine = pageData.floatingTexts[currentLineIdx];
                const newId = flyByTextIdCounter.current++;
                setFlyByTexts(prev => [
                    ...prev.map(t => ({...t, visible: t.pageKey === currentFlyByPageKey ? t.visible : false })), // Hide texts from other pages
                    {
                        id: newId,
                        text: newLine,
                        visible: true,
                        startTime: Date.now(),
                        pageKey: currentFlyByPageKey, // Associate with current page
                        duration: 7000 + Math.random() * 3000, // 7-10 seconds
                    }
                ]);
            }
        }
    } else {
        // No pageData, clear all fly-by texts
        setFlyByTexts(prev => prev.map(t => ({ ...t, visible: false })));
    }

  }, [visiblePageIdx, currentLineIdx, pageData]);


  // Effect to manage timeouts for fly-by texts
  useEffect(() => {
    flyByTexts.forEach(item => {
      if (item.visible && !flyByTimers.current[item.id]) {
        flyByTimers.current[item.id] = setTimeout(() => {
          handleFlyByFadeOutComplete(item.id);
          delete flyByTimers.current[item.id];
        }, item.duration);
      }
    });

    // Cleanup timers when component unmounts or flyByTexts change
    return () => {
      Object.values(flyByTimers.current).forEach(clearTimeout);
      flyByTimers.current = {};
    };
  }, [flyByTexts]);


  const handleFirstLineFadeInComplete = () => {
    if (pageData && pageData.floatingTexts && pageData.floatingTexts.length > 1 && currentLineIdx === 0) {
        setTimeout(() => {
            setCurrentLineIdx(1);
        }, 1000); 
    } else if (pageData && pageData.floatingTexts && pageData.floatingTexts.length === 1 && currentLineIdx === 0) {
        // Only one line, it's done.
        // Potentially trigger chapter end logic here if that's desired immediately
    }
  };
  
  const handleFirstLineFadeOutComplete = () => {
    setFirstLineText(null); // Fully remove after fade out
  };

  const handleFlyByFadeOutComplete = (id) => {
    setFlyByTexts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    
    // Check if there are more lines for the current page
    if (pageData && pageData.floatingTexts && currentLineIdx < pageData.floatingTexts.length - 1) {
      // Wait a bit before showing the next fly-by to avoid clutter
      setTimeout(() => {
        setCurrentLineIdx(idx => idx + 1);
      }, 500); // 0.5 second delay
    } else {
      // All text for this page is done.
      // Chapter transition logic in Experience.jsx will handle next steps.
    }
  };

  // Remove fly-by texts that are no longer visible and have completed their fade-out
  useEffect(() => {
    const activeAndVisibleFlyByTexts = flyByTexts.filter(item => {
        if (!item.visible) {
            // If a timer was associated, ensure it's cleared
            if (flyByTimers.current[item.id]) {
                clearTimeout(flyByTimers.current[item.id]);
                delete flyByTimers.current[item.id];
            }
            return false; // Remove if not visible (after fade out animation is handled by NarrativeText)
        }
        return true;
    });
    if (activeAndVisibleFlyByTexts.length !== flyByTexts.length) {
       // setFlyByTexts(activeAndVisibleFlyByTexts); // This can cause issues if NarrativeText is still fading.
       // Let NarrativeText unmount itself after its fade.
    }
  }, [flyByTexts]);


  const firstLinePosition = [0, PAGE_HEIGHT * 0.55, 0.25]; 
  const firstLineRotation = [MathUtils.degToRad(-5), 0, 0]; // Slightly tilted

  return (
    <>
      {firstLineText && bookGroupRef?.current && (
        <group
          position={bookGroupRef.current.position} 
          rotation={bookGroupRef.current.rotation}
        >
           <NarrativeText
            key={firstLineText.key}
            text={firstLineText.text}
            visible={firstLineText.visible}
            position={firstLinePosition} 
            rotation={firstLineRotation}
            size={0.055} // Slightly smaller
            height={0.003}
            color="#E8E8FF"
            emissive="#6060C0"
            emissiveIntensity={0.7}
            fadeInDuration={1.8}
            fadeOutDuration={1.0}
            onFadeInComplete={handleFirstLineFadeInComplete}
            onFadeOutComplete={handleFirstLineFadeOutComplete}
            isFirstLine={true}
           />
        </group>
      )}

      {flyByTexts.map(item => {
        if (!item.visible && !gsap.isTweening(item)) return null; // Don't render if not visible and not tweening

        const spawnZ = camera.position.z - 12 - (Math.random() * 5); 
        const targetX = (Math.random() - 0.5) * 6; 
        const targetY = camera.position.y + (Math.random() - 0.5) * 3; 

        return (
          <NarrativeText
            key={item.id}
            text={item.text}
            visible={item.visible} // GSAP in NarrativeText handles actual fade
            position={[targetX, targetY, spawnZ]} 
            size={0.1 + Math.random()*0.05} // Varied size
            height={0.006}
            color="#D8D8F8"
            emissive="#7070D0"
            emissiveIntensity={0.5}
            fadeInDuration={1.2}
            fadeOutDuration={1.5} // Give more time to fade as it moves
            animateFlyBy={true}
            flyByStartPosZ={spawnZ}
            flyByEndPosZ={camera.position.z + 8} 
            flyByDuration={item.duration / 1000} // Convert ms to s
            // onFadeOutComplete is handled by the timer logic above for fly-by
          />
        );
      })}
    </>
  );
};