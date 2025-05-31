// src/components/NarrativeManager.jsx
import { useAtom } from "jotai";
import { useEffect, useState, useRef, useCallback } from "react";
import { pageAtom, pages } from "./UI"; // Assuming UI.js defines pages array
import { AnimatedBasText } from "./AnimatedBasText";
import * as THREE from "three";

let nextTextId = 0;
const getUniqueId = () => `bas-narrative-${nextTextId++}`;

const AUTO_TURN_CONFIG = {
  BASE_DELAY: 7000,
  MIN_DELAY: 1000,
  BOOST_REDUCTION: 1000,
  TEXT_FORMATION_BUFFER: 50,
};

// --- Centralized Configuration for Narrative Text ---
const NARRATIVE_TEXT_CONFIG = {
  // --- Text Sizing & Appearance ---
  SIZE: 0.03, // Base size of the text in scene units. ADJUST THIS.
  DEPTH_FACTOR: 0.0, // Multiplier for SIZE to determine text depth. 0.0 for flat text.
  BEVEL_ENABLED: true,
  BEVEL_SIZE_FACTOR: 0.05,    // Multiplier for SIZE for bevel (0.005 / 0.10 original ratio)
  BEVEL_THICKNESS_FACTOR: 0.135, // Multiplier for SIZE for bevel thickness (0.0035 / 0.10 original ratio)
  CURVE_SEGMENTS: 8, // Geometry detail for text.

  // --- Line Layout ---
  LINE_SPACING_FACTOR: 3.0, // ADJUST for line height. e.g., 1.5 = 50% text height space.

  // --- Text Formation Timing ---
  PAGE_TURN_SETTLE_DELAY_MS: 10, // ADJUST: Delay (ms) after page content is loaded before *first* line starts forming.
  INTER_LINE_STAGGER_MS: 100,    // ADJUST: Delay (ms) between each *subsequent* line starting to form.

  // --- Text Animation Parameters (passed to AnimatedBasText) ---
  ANIM_FORMATION_DURATION: 3.0,
  ANIM_EXPLOSION_DURATION: 0.8,
  ANIM_MAX_DELAY_FACTOR: 0.01,
  ANIM_MIN_PIECE_DURATION: 1.0,
  ANIM_MAX_PIECE_DURATION: 4.0,
  ANIM_EXTRA_OVERALL_DURATION: 1.0,
};
// --- End of Configuration ---

export const NarrativeManager = ({ bookGroupRef }) => {
  const [currentPageIndexAtom, setPageAtom] = useAtom(pageAtom);
  const [activeNarratives, setActiveNarratives] = useState([]);
  const [managedPageIndex, setManagedPageIndex] = useState(currentPageIndexAtom);
  const [isPageTurning, setIsPageTurning] = useState(false);

  const [boostCount, setBoostCount] = useState(0);
  const [isAutoTurnActive, setIsAutoTurnActive] = useState(false);
  const [timeUntilAutoTurn, setTimeUntilAutoTurn] = useState(0);

  const autoTurnTimerRef = useRef(null);
  const autoTurnStartTimeRef = useRef(null);
  const textFormationCompleteRef = useRef(false);
  const boostActivationTimeRef = useRef(null);

  const bookWorldPosition = useRef(new THREE.Vector3());
  const pendingPageIndex = useRef(null);

  const calculateTextPosition = useCallback(
    (lineIndex, totalLines) => {
      if (bookGroupRef?.current) {
        bookGroupRef.current.getWorldPosition(bookWorldPosition.current);
      }
      const baseBookPos = bookWorldPosition.current;
      const PAGE_HEIGHT = 1.71;
      
      // Use new config for text size and line spacing
      const TEXT_SIZE_PARAM = NARRATIVE_TEXT_CONFIG.SIZE;
      const LINE_SPACING = TEXT_SIZE_PARAM * NARRATIVE_TEXT_CONFIG.LINE_SPACING_FACTOR;

      const textX = baseBookPos.x;
      const totalTextBlockHeight = (totalLines - 1) * LINE_SPACING;
      // Adjusted yOffset for potentially better vertical centering
      const yOffsetForTextBlockCenter = (PAGE_HEIGHT * 0.40) + (totalTextBlockHeight / 2) - (TEXT_SIZE_PARAM / 2);
      const textY = baseBookPos.y + yOffsetForTextBlockCenter - (lineIndex * LINE_SPACING);
      const textZ = baseBookPos.z + 0.35;
      return [textX, textY, textZ];
    },
    [bookGroupRef]
  );

  const loadNewPageTexts = useCallback((pageIndexToShow) => {
    const pageData = pages[pageIndexToShow];
    const narrativeLines = pageData?.narrative || [];
    console.log(`📝 Loading new page texts for page ${pageIndexToShow}:`, narrativeLines);

    if (!pageData || narrativeLines.length === 0) {
      setActiveNarratives([]);
      setIsPageTurning(false);
      return;
    }

    // Use new config for formation delays
    const pageTurnSettleDelay = NARRATIVE_TEXT_CONFIG.PAGE_TURN_SETTLE_DELAY_MS;
    const interLineStagger = NARRATIVE_TEXT_CONFIG.INTER_LINE_STAGGER_MS;

    const newNarratives = narrativeLines.map((line, index) => ({
      id: getUniqueId(),
      text: line,
      targetPosition: calculateTextPosition(index, narrativeLines.length),
      visible: true,
      initialDelay: pageTurnSettleDelay + (index * interLineStagger),
      pageTurnTriggered: false,
      textParams: { // Use new config for text parameters
        size: NARRATIVE_TEXT_CONFIG.SIZE,
        depth: NARRATIVE_TEXT_CONFIG.SIZE * NARRATIVE_TEXT_CONFIG.DEPTH_FACTOR,
        curveSegments: NARRATIVE_TEXT_CONFIG.CURVE_SEGMENTS,
        bevelEnabled: NARRATIVE_TEXT_CONFIG.BEVEL_ENABLED,
        bevelSize: NARRATIVE_TEXT_CONFIG.SIZE * NARRATIVE_TEXT_CONFIG.BEVEL_SIZE_FACTOR,
        bevelThickness: NARRATIVE_TEXT_CONFIG.SIZE * NARRATIVE_TEXT_CONFIG.BEVEL_THICKNESS_FACTOR,
      },
      animationParams: { // Use new config for animation parameters
        formationDuration: NARRATIVE_TEXT_CONFIG.ANIM_FORMATION_DURATION,
        explosionDuration: NARRATIVE_TEXT_CONFIG.ANIM_EXPLOSION_DURATION,
        maxDelayFactor: NARRATIVE_TEXT_CONFIG.ANIM_MAX_DELAY_FACTOR,
        minPieceDuration: NARRATIVE_TEXT_CONFIG.ANIM_MIN_PIECE_DURATION,
        maxPieceDuration: NARRATIVE_TEXT_CONFIG.ANIM_MAX_PIECE_DURATION,
        extraOverallDuration: NARRATIVE_TEXT_CONFIG.ANIM_EXTRA_OVERALL_DURATION,
      },
    }));

    console.log('✨ Setting new active narratives:', newNarratives.length);
    setActiveNarratives(newNarratives);
    setIsPageTurning(false); // New texts are loaded, page turn visual process is considered done for text manager
  }, [calculateTextPosition]);


  const startAutoTurnTimer = useCallback(() => {
    console.log('🕐 Starting auto-turn timer');
    if (autoTurnTimerRef.current) clearTimeout(autoTurnTimerRef.current);

    const reductionFromBoosts = boostCount * AUTO_TURN_CONFIG.BOOST_REDUCTION;
    const effectiveDelay = Math.max(
      AUTO_TURN_CONFIG.BASE_DELAY - reductionFromBoosts,
      AUTO_TURN_CONFIG.MIN_DELAY
    );

    console.log(`⏰ Auto-turn delay: ${effectiveDelay}ms (${boostCount} boosts applied)`);
    setIsAutoTurnActive(true);
    setTimeUntilAutoTurn(effectiveDelay);
    autoTurnStartTimeRef.current = Date.now();

    const updateCountdown = () => {
      if (!autoTurnStartTimeRef.current || !isAutoTurnActive || !autoTurnTimerRef.current) return;
      const elapsed = Date.now() - autoTurnStartTimeRef.current;
      const remaining = Math.max(0, effectiveDelay - elapsed);
      setTimeUntilAutoTurn(remaining);
      if (remaining > 0) requestAnimationFrame(updateCountdown);
    };
    if (effectiveDelay > 0) requestAnimationFrame(updateCountdown);

    autoTurnTimerRef.current = setTimeout(() => {
      console.log('🚀 Auto-turn timer fired - advancing page');
      const nextPage = Math.min(currentPageIndexAtom + 1, pages.length - 1);
      if (nextPage !== currentPageIndexAtom) setPageAtom(nextPage);
      setIsAutoTurnActive(false);
      setTimeUntilAutoTurn(0);
      autoTurnTimerRef.current = null;
      autoTurnStartTimeRef.current = null;
    }, effectiveDelay);
  }, [boostCount, currentPageIndexAtom, setPageAtom, isAutoTurnActive]);

  const stopAutoTurnTimer = useCallback(() => {
    console.log('🛑 Stopping auto-turn timer');
    if (autoTurnTimerRef.current) clearTimeout(autoTurnTimerRef.current);
    autoTurnTimerRef.current = null;
    setIsAutoTurnActive(false);
    setTimeUntilAutoTurn(0);
    autoTurnStartTimeRef.current = null;
  }, []);

  const handleBoost = useCallback(() => {
    if (!isAutoTurnActive || !textFormationCompleteRef.current) {
      console.log('🚫 Boost ignored - timer not active or text not ready');
      return;
    }
    console.log('💨 Boost activated!');
    setBoostCount(prev => {
      const newCount = prev + 1;
      console.log(`⚡ Boost count: ${newCount}`);
      if (autoTurnTimerRef.current) clearTimeout(autoTurnTimerRef.current);
      
      const elapsed = autoTurnStartTimeRef.current ? Date.now() - autoTurnStartTimeRef.current : 0;
      const baseDelayForThisBoost = AUTO_TURN_CONFIG.BASE_DELAY - ((newCount - 1) * AUTO_TURN_CONFIG.BOOST_REduction);
      const remainingTimeBeforeBoostEffect = Math.max(0, baseDelayForThisBoost - elapsed);
      const newRemainingTime = Math.max(
          AUTO_TURN_CONFIG.MIN_DELAY, 
          remainingTimeBeforeBoostEffect - AUTO_TURN_CONFIG.BOOST_REDUCTION
      );

      console.log(`⏱️ Time adjustment: ${remainingTimeBeforeBoostEffect.toFixed(0)}ms → ${newRemainingTime.toFixed(0)}ms`);
      
      setTimeUntilAutoTurn(newRemainingTime);
      autoTurnStartTimeRef.current = Date.now(); 
      
      if (newRemainingTime > 0) {
        autoTurnTimerRef.current = setTimeout(() => {
          console.log('🚀 Boosted auto-turn timer fired!');
          const nextPage = Math.min(currentPageIndexAtom + 1, pages.length - 1);
          if (nextPage !== currentPageIndexAtom) setPageAtom(nextPage);
          setIsAutoTurnActive(false);
          setTimeUntilAutoTurn(0);
          autoTurnTimerRef.current = null;
          autoTurnStartTimeRef.current = null;
        }, newRemainingTime);
      } else {
        Promise.resolve().then(() => { 
          const nextPage = Math.min(currentPageIndexAtom + 1, pages.length - 1);
          if (nextPage !== currentPageIndexAtom) setPageAtom(nextPage);
          setIsAutoTurnActive(false);
          setTimeUntilAutoTurn(0);
          autoTurnTimerRef.current = null;
          autoTurnStartTimeRef.current = null;
        });
      }
      return newCount;
    });
    boostActivationTimeRef.current = Date.now();
  }, [isAutoTurnActive, currentPageIndexAtom, setPageAtom]);

  useEffect(() => {
    window.narrativeBoost = handleBoost;
    return () => { delete window.narrativeBoost; };
  }, [handleBoost]);

  // This useEffect handles page changes and triggers explosions or loads new text
  useEffect(() => {
    if (managedPageIndex !== currentPageIndexAtom) {
      console.log(`📄 Page change detected: ${managedPageIndex} -> ${currentPageIndexAtom}`);
      stopAutoTurnTimer();
      setBoostCount(0);
      textFormationCompleteRef.current = false;
      boostActivationTimeRef.current = null;
      
      if (activeNarratives.length > 0) {
        console.log('💥 Triggering page turn explosion for existing texts');
        setIsPageTurning(true); // Indicate a page turn visual process is happening
        pendingPageIndex.current = currentPageIndexAtom; // Store the target page
        // Tell all active narratives to start their "page turn" (explosion) animation
        setActiveNarratives(prev => prev.map(n => ({ ...n, pageTurnTriggered: true })));
      } else {
        // No active narratives to explode, so load texts for the new page directly
        loadNewPageTexts(currentPageIndexAtom);
      }
    }
    // Keep managedPageIndex in sync with the global pageAtom after processing
    setManagedPageIndex(currentPageIndexAtom);
  }, [
      currentPageIndexAtom, 
      managedPageIndex,
      stopAutoTurnTimer,
      activeNarratives.length,
      loadNewPageTexts // Include loadNewPageTexts as it's called in the effect
    ]);

  const handleTextAnimationComplete = useCallback((textId, wasMadeVisible) => {
    if (wasMadeVisible) { // Text finished forming
      // Your original logic for checking if all narratives are formed:
      const allNarrativesOnPageFormed = activeNarratives.every(narrative => {
        // This check might need refinement if AnimatedBasText has more granular states
        // For now, if a text line calls this with wasMadeVisible=true, we assume it's "formed"
        // And this callback is for the specific textId that just completed.
        // A more robust approach would be to track completion state for each narrative in activeNarratives.
        return true; 
      });

      if (!textFormationCompleteRef.current && allNarrativesOnPageFormed) {
        if (currentPageIndexAtom === managedPageIndex && !isPageTurning) {
          textFormationCompleteRef.current = true;
          setTimeout(() => {
            if (textFormationCompleteRef.current && currentPageIndexAtom === managedPageIndex && !isPageTurning && !isAutoTurnActive) {
              console.log('⏱️ All text formation complete - starting auto-turn timer');
              startAutoTurnTimer();
            }
          }, AUTO_TURN_CONFIG.TEXT_FORMATION_BUFFER);
        }
      }
    }
    // If !wasMadeVisible, it means an explosion animation completed.
    // That specific event is handled by onPageTurnComplete.
  }, [activeNarratives, currentPageIndexAtom, managedPageIndex, isPageTurning, startAutoTurnTimer, isAutoTurnActive]);

  const handlePageTurnComplete = useCallback((textId) => {
    // Called by AnimatedBasText when its pageTurnTriggered (explosion) animation finishes
    setActiveNarratives(prev => {
      const updatedNarratives = prev.filter(n => n.id !== textId);
      // If all texts from the previous page have exploded and been removed:
      if (updatedNarratives.length === 0 && pendingPageIndex.current !== null) {
        console.log('🔄 All texts exploded, loading new page content for:', pendingPageIndex.current);
        // Using Promise.resolve().then() to ensure this runs after current state updates.
        Promise.resolve().then(() => {
            if(pendingPageIndex.current !== null) { // Double-check pendingPageIndex
                loadNewPageTexts(pendingPageIndex.current);
                pendingPageIndex.current = null; // Clear pending index after loading
            }
        });
      }
      return updatedNarratives;
    });
  }, [loadNewPageTexts]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => { stopAutoTurnTimer(); };
  }, [stopAutoTurnTimer]);

  return (
    <group name="NarrativeTextsContainer_Configured_V4">
      {activeNarratives.map(narrative => {
        return (
          <AnimatedBasText
            key={narrative.id}
            id={narrative.id}
            text={narrative.text}
            targetPosition={narrative.targetPosition}
            visible={narrative.visible}
            initialDelay={narrative.initialDelay}
            pageTurnTriggered={narrative.pageTurnTriggered}
            onAnimationComplete={handleTextAnimationComplete} // For formation/explosion general complete
            onPageTurnComplete={handlePageTurnComplete}     // Specifically for page turn explosion complete
            textParams={narrative.textParams}
            animationParams={narrative.animationParams}
            baseColor="#e8e8e8"
            bookGroupRef={bookGroupRef} // Assuming AnimatedBasText uses this for sync
          />
        );
      })}
    </group>
  );
};