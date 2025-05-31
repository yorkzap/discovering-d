// src/components/TextManager.jsx
import { useAtom, useSetAtom } from "jotai";
import { useFrame } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import { pageAtom, pages, currentLineIndexAtom } from "./UI";
import { NarrativeText } from "./NarrativeText";

const TEXT_SPAWN_Z = -8;
const TEXT_DESPAWN_Z = 6;
const TEXT_MOVE_SPEED = 2.5;
const TEXT_SLOW_ZONE_Z_START = -1;
const TEXT_SLOW_ZONE_Z_END = 1;
const TEXT_SLOW_ZONE_SPEED = 0.8;
const FIRST_LINE_POSITION = [0, 0.8, 0.5]; // Close to book
const LINE_SPAWN_DELAY = 2500; // ms between lines

export const TextManager = () => {
  const [currentPage] = useAtom(pageAtom);
  const [currentLineIndex, setCurrentLineIndex] = useAtom(currentLineIndexAtom);
  const [activeLines, setActiveLines] = useState([]);
  const nextLineTimer = useRef(null);
  const lastPageRef = useRef(currentPage);
  const lineIdCounter = useRef(0);

  const currentPageData = pages[currentPage];
  const floatingTexts = currentPageData?.floatingTexts || [];

  // Reset when page changes
  useEffect(() => {
    if (lastPageRef.current !== currentPage) {
      lastPageRef.current = currentPage;
      setCurrentLineIndex(0);
      setActiveLines([]);
      
      // Clear any pending timers
      if (nextLineTimer.current) {
        clearTimeout(nextLineTimer.current);
        nextLineTimer.current = null;
      }

      // Start the text sequence for new page if it has floating texts
      if (floatingTexts.length > 0) {
        // Show first line immediately when page opens
        setTimeout(() => {
          if (currentPage === lastPageRef.current) {
            showFirstLine();
          }
        }, 800); // Wait for page turn animation
      }
    }
  }, [currentPage, floatingTexts.length]);

  const showFirstLine = () => {
    if (floatingTexts.length === 0) return;

    const firstLine = {
      id: `line-${lineIdCounter.current++}`,
      text: floatingTexts[0],
      position: [...FIRST_LINE_POSITION],
      isFirstLine: true,
      visible: true
    };

    setActiveLines([firstLine]);
    setCurrentLineIndex(1);

    // Schedule next line
    scheduleNextLine();
  };

  const scheduleNextLine = () => {
    if (nextLineTimer.current) {
      clearTimeout(nextLineTimer.current);
    }

    nextLineTimer.current = setTimeout(() => {
      spawnNextLine();
    }, LINE_SPAWN_DELAY);
  };

  const spawnNextLine = () => {
    if (currentLineIndex >= floatingTexts.length) return;

    const newLine = {
      id: `line-${lineIdCounter.current++}`,
      text: floatingTexts[currentLineIndex],
      position: [
        (Math.random() - 0.5) * 4, // Random X position
        (Math.random() - 0.5) * 2, // Random Y position
        TEXT_SPAWN_Z
      ],
      isFirstLine: false,
      visible: true
    };

    setActiveLines(prev => [...prev, newLine]);
    setCurrentLineIndex(prev => prev + 1);

    // Schedule next line if there are more
    if (currentLineIndex + 1 < floatingTexts.length) {
      scheduleNextLine();
    }
  };

  // Update flying text positions
  useFrame((state, delta) => {
    setActiveLines(prevLines => {
      return prevLines.map(line => {
        if (line.isFirstLine) {
          // First line stays in place, just gentle floating
          const time = state.clock.elapsedTime;
          return {
            ...line,
            position: [
              FIRST_LINE_POSITION[0] + Math.sin(time * 0.8) * 0.02,
              FIRST_LINE_POSITION[1] + Math.sin(time * 1.2) * 0.01,
              FIRST_LINE_POSITION[2]
            ]
          };
        } else {
          // Flying lines move toward camera
          const currentZ = line.position[2];
          let moveSpeed = TEXT_MOVE_SPEED;

          // Apply slow zone
          if (currentZ >= TEXT_SLOW_ZONE_Z_START && currentZ <= TEXT_SLOW_ZONE_Z_END) {
            moveSpeed = TEXT_SLOW_ZONE_SPEED;
          }

          const newZ = currentZ + moveSpeed * delta;

          return {
            ...line,
            position: [line.position[0], line.position[1], newZ]
          };
        }
      }).filter(line => {
        // Remove lines that have passed the camera
        return line.isFirstLine || line.position[2] < TEXT_DESPAWN_Z;
      });
    });
  });

  const handleFirstLineFadeOut = (lineId) => {
    setActiveLines(prev => prev.filter(line => line.id !== lineId));
  };

  // Clean up timers
  useEffect(() => {
    return () => {
      if (nextLineTimer.current) {
        clearTimeout(nextLineTimer.current);
      }
    };
  }, []);

  return (
    <>
      {activeLines.map(line => (
        <NarrativeText
          key={line.id}
          text={line.text}
          position={line.position}
          visible={line.visible}
          color={line.isFirstLine ? "#ffffff" : "#e0e0ff"}
          emissiveColor={line.isFirstLine ? "#4a2a66" : "#2a2a4a"}
          emissiveIntensity={line.isFirstLine ? 0.4 : 0.3}
          size={line.isFirstLine ? 0.06 : 0.05}
          onFadeOutComplete={() => {
            if (line.isFirstLine) {
              handleFirstLineFadeOut(line.id);
            }
          }}
        />
      ))}
    </>
  );
};