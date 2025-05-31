// src/components/FontLoader.jsx
import { useEffect } from "react";

export const FontLoader = ({ children }) => {
  useEffect(() => {
    console.log("FontLoader: Initializing text rendering system");
  }, []);

  // Simply render children - no font dependency needed
  // The NarrativeText component handles font rendering internally
  return children;
};