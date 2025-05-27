// src/components/CameraControlsUI.jsx
import { useAtom, useSetAtom } from "jotai";
import { cameraFocusAtom, triggerCameraResetAtom } from "./atoms";

// Simple SVG Icons (replace with better ones if available)
const ZoomOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
  </svg>
);

const ResetViewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" />
  </svg>
);


export const CameraControlsUI = () => {
  const [focus] = useAtom(cameraFocusAtom);
  const setFocus = useSetAtom(cameraFocusAtom);
  const setTriggerReset = useSetAtom(triggerCameraResetAtom);

  const handleResetZoom = () => setFocus(null);
  const handleResetView = () => setTriggerReset(c => c + 1);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-auto">
      {focus && (
        <button
          title="Reset Zoom"
          className="p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full shadow-lg transition-colors"
          onClick={handleResetZoom}
        >
          <ZoomOutIcon />
        </button>
      )}
      <button
        title="Reset View to Default"
        className="p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full shadow-lg transition-colors"
        onClick={handleResetView}
      >
        <ResetViewIcon />
      </button>
    </div>
  );
};