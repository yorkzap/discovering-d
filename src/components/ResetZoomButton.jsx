// src/components/ResetZoomButton.jsx
import { useAtom, useSetAtom } from "jotai"; // Added useSetAtom
import { cameraFocusAtom, triggerCameraResetAtom } from "./atoms"; // Added triggerCameraResetAtom

export const ResetZoomButton = () => {
  const [focus, setFocus] = useAtom(cameraFocusAtom);
  // const setTriggerReset = useSetAtom(triggerCameraResetAtom); // Uncomment if this button should do a FULL reset

  if (!focus) {
    return null; // Don't show the button if not zoomed
  }

  const handleClick = () => {
    setFocus(null); // This will trigger the "unzoom" animation in Experience.jsx
    // If you want this button to also fully reset to the initial view (not just undo zoom):
    // setTriggerReset(c => c + 1); 
  };

  return (
    <button
      className="pointer-events-auto fixed top-4 right-4 z-50 px-4 py-2 bg-gray-800 bg-opacity-75 text-white rounded shadow-lg hover:bg-gray-700 transition-colors"
      onClick={handleClick}
    >
      Reset Zoom
    </button>
  );
};