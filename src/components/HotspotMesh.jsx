// src/components/HotspotMesh.jsx
import { Plane } from "@react-three/drei";
import { useSetAtom } from "jotai";
import { useState } from "react";
import * as THREE from "three";
import { cameraFocusAtom } from "./atoms";

export const HotspotMesh = ({
  position,
  args,
  rotationY = 0,
  // Props for debugging or extended functionality (optional)
  // pageNumber,
  // side,
}) => {
  const [hovered, setHovered] = useState(false);
  const setFocus = useSetAtom(cameraFocusAtom);

  const handleClick = (event) => {
    event.stopPropagation();
    const hotspotMesh = event.object;

    const hotspotWorldPosition = new THREE.Vector3();
    hotspotMesh.getWorldPosition(hotspotWorldPosition);

    // Calculate the world normal of the hotspot plane.
    // A default Plane geometry (from drei) is in the XY plane, so its local normal is (0,0,1).
    const worldNormal = new THREE.Vector3(0, 0, 1);
    const worldQuaternion = new THREE.Quaternion();
    hotspotMesh.getWorldQuaternion(worldQuaternion);
    worldNormal.applyQuaternion(worldQuaternion);
    worldNormal.normalize();

    const zoomDistance = 0.8; // How far the camera should be from the hotspot. Adjust as needed.
    const cameraTargetPosition = hotspotWorldPosition.clone();
    const cameraNewPosition = hotspotWorldPosition
      .clone()
      .add(worldNormal.clone().multiplyScalar(zoomDistance));

    setFocus({
      target: cameraTargetPosition,
      position: cameraNewPosition,
    });
  };

  return (
    <Plane
      position={position}
      args={args} // [width, height]
      rotation-y={rotationY}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={handleClick}
    >
      <meshBasicMaterial
        transparent
        opacity={hovered ? 0.2 : 0} // Show a subtle green highlight on hover, otherwise invisible
        color={hovered ? "lightgreen" : "white"}
        depthWrite={false} // Important for transparent overlays that shouldn't obscure
        side={THREE.FrontSide} // Ensures normal calculation is predictable
      />
    </Plane>
  );
};