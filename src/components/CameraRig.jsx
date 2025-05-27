// src/components/CameraRig.jsx
import { useThree, useFrame } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { easing } from 'maath';
import {
  cameraFocusPointAtom,
  cameraDesiredPositionAtom,
  orbitControlsEnabledAtom,
} from './UI';

const LERP_SPEED = 6; // Adjust for faster/slower camera animation (lower is slower)

export function CameraRig() {
  const { camera, controls } = useThree();
  const [desiredPosition] = useAtom(cameraDesiredPositionAtom);
  const [focusPoint] = useAtom(cameraFocusPointAtom);
  const [orbitEnabled] = useAtom(orbitControlsEnabledAtom);

  useFrame((state, delta) => {
    // Animate camera position
    easing.damp3(camera.position, desiredPosition, LERP_SPEED, delta);

    if (controls) {
      controls.enabled = orbitEnabled;
      // If OrbitControls are active, they manage the target.
      // If OrbitControls are disabled (during zoom), we animate its target.
      // When re-enabled, it will naturally pick up from this animated target.
      easing.damp3(controls.target, focusPoint, LERP_SPEED, delta);
      
      // R3F's OrbitControls typically calls .update() internally.
      // If you find the lookAt not updating smoothly when controls are disabled,
      // or target not sticking when re-enabled, explicitly call:
      // controls.update();
    } else {
      // Fallback if controls are not available (shouldn't happen with <OrbitControls />)
      // camera.lookAt(focusPoint); // This would be an instant lookAt
    }
  });

  return null;
}