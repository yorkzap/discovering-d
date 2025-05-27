// Inside the Hotspot component:
const [isZoomedState, setIsZoomedState] = useAtom(isZoomedAtom); // Use the correct atom
const [, setCameraFocusState] = useAtom(cameraFocusAtom);       // Use the correct atom

const handleClick = (e) => {
  e.stopPropagation();
  // if (!hotspotRef.current || isZoomedState) return; // Allow clicking to zoom out if already zoomed

  if (isZoomedState) {
     // If already zoomed, clicking a hotspot zooms out
     setCameraFocusState(null);
     setIsZoomedState(false);
  } else {
     // Zoom In
     const worldPos = new Vector3();
     hotspotRef.current.getWorldPosition(worldPos); // Get world position of the hotspot mesh center

     // The camera should look AT the hotspot's world position.
     // The cameraFocusAtom stores the LOCAL position on the page.
     // We need to provide the local position and other details to cameraFocusAtom.

     setCameraFocusState({
       target: new Vector3(...hotspotData.position), // Page-local hotspot coordinates from hotspotData
       distance: hotspotData.targetCameraOffset ? hotspotData.targetCameraOffset[2] : 0.5, // Assuming Z of offset is distance
       pageNumber: pageNumber,
       isFrontSide: hotspotData.side === "front",
     });
     setIsZoomedState(true);
  }
  setHovered(false);
};