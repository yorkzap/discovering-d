// src/components/NarrativeText.jsx
import { Text, Float } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useEffect, useState, useMemo } from "react";

export const NarrativeText = ({
  id,
  text,
  position, // This will be the FINAL resting position
  visible,
  initialDelay = 0,
  fontSize = 0.07,
  color = "#e0e8ff",
  emissiveColor = new THREE.Color(0xadc0ff),
  emissiveIntensity = 0.8,
  maxWidth = 2.0,
  lineHeight = 1.4,
  textAlign = "center",
  anchorX = "center",
  anchorY = "middle",
  font = "/fonts/Inter-Medium.woff",
  onAnimationComplete,
  floatIntensityWhileVisible = 0.003,
  rotationIntensityWhileVisible = 0.003,
  floatSpeed = 0.6,
}) => {
  const textRef = useRef();
  const groupRef = useRef();
  const [isReadyToAnimate, setIsReadyToAnimate] = useState(false);
  const animationCompletionState = useRef(null);
  const { viewport } = useThree();

  const animProps = useMemo(() => {
    const randomAngle = (Math.random() - 0.5) * Math.PI * 0.3;
    return {
      initialPosition: new THREE.Vector3(
        position[0] + (Math.random() - 0.5) * 0.5,
        position[1] - 0.3,
        position[2] + (Math.random() - 0.5) * 0.2
      ),
      targetPosition: new THREE.Vector3(...position),
      initialScale: new THREE.Vector3(0.6, 0.6, 0.6),
      targetScale: new THREE.Vector3(1, 1, 1),
      initialRotation: new THREE.Euler(0, randomAngle, 0),
      targetRotation: new THREE.Euler(0, 0, 0),
    };
  }, [position]);

  useEffect(() => {
    let timer;
    if (visible) {
      timer = setTimeout(() => {
        setIsReadyToAnimate(true);
        animationCompletionState.current = null;
        if (groupRef.current) {
          groupRef.current.position.copy(animProps.initialPosition);
          groupRef.current.scale.copy(animProps.initialScale);
          groupRef.current.rotation.copy(animProps.initialRotation);
        }
      }, initialDelay);
    } else {
      setIsReadyToAnimate(true);
      animationCompletionState.current = null;
    }
    return () => clearTimeout(timer);
  }, [visible, initialDelay, id, animProps]);

  useFrame((state, delta) => {
    if (!groupRef.current || !textRef.current || !textRef.current.material) return;

    // ---- 'material' is defined and used ONLY within this useFrame scope ----
    const material = textRef.current.material;
    const targetOpacity = visible && isReadyToAnimate ? 1.0 : 0.0;
    const LERP_SPEED_OPACITY = visible ? 3.5 : 5;
    
    material.opacity = THREE.MathUtils.lerp(
      material.opacity,
      targetOpacity,
      LERP_SPEED_OPACITY * delta
    );

    const LERP_SPEED_TRANSFORM = 4.0;
    if (visible && isReadyToAnimate) {
      groupRef.current.position.lerp(animProps.targetPosition, LERP_SPEED_TRANSFORM * delta);
      groupRef.current.scale.lerp(animProps.targetScale, LERP_SPEED_TRANSFORM * delta);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, animProps.targetRotation.x, LERP_SPEED_TRANSFORM * delta);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, animProps.targetRotation.y, LERP_SPEED_TRANSFORM * delta);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, animProps.targetRotation.z, LERP_SPEED_TRANSFORM * delta);
    } else if (!visible && isReadyToAnimate) {
      groupRef.current.position.lerp(animProps.initialPosition, LERP_SPEED_TRANSFORM * delta * 0.7);
      groupRef.current.scale.lerp(animProps.initialScale, LERP_SPEED_TRANSFORM * delta * 0.7);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, animProps.initialRotation.y, LERP_SPEED_TRANSFORM * delta * 0.7);
    }

    if (material.hasOwnProperty('emissiveIntensity')) {
      const textIdNum = typeof id === 'number' ? id : parseInt(id.split('-')[1] || "0", 10);
      const emissivePulseFactor = Math.sin(state.clock.elapsedTime * 2.0 + textIdNum % 100) * 0.2 + 0.8;
      material.emissiveIntensity = emissiveIntensity * material.opacity * emissivePulseFactor;
    }

    if (onAnimationComplete) {
      const threshold = 0.03;
      const posReached = groupRef.current.position.distanceTo(visible ? animProps.targetPosition : animProps.initialPosition) < 0.05;
      const scaleReached = groupRef.current.scale.distanceTo(visible ? animProps.targetScale : animProps.initialScale) < 0.05;
      const isAnimationTargetReached = posReached && scaleReached;

      const isFadeInComplete = targetOpacity === 1.0 && Math.abs(material.opacity - targetOpacity) < threshold && isAnimationTargetReached;
      const isFadeOutComplete = targetOpacity === 0.0 && material.opacity < threshold && isAnimationTargetReached;

      if (isFadeInComplete && animationCompletionState.current !== true) {
        onAnimationComplete(id, true);
        animationCompletionState.current = true;
      } else if (isFadeOutComplete && animationCompletionState.current !== false) {
        onAnimationComplete(id, false);
        animationCompletionState.current = false;
      }
    }
  });
  // ---- End of useFrame scope ----

  if (!text || text.trim() === "") return null;

  return (
    <group ref={groupRef} position={animProps.initialPosition} scale={animProps.initialScale} rotation={animProps.initialRotation}>
      <Float
        speed={floatSpeed}
        rotationIntensity={rotationIntensityWhileVisible}
        floatIntensity={floatIntensityWhileVisible}
        floatingRange={[-0.002, 0.002]}
        // Corrected: 'enabled' condition no longer relies on 'material' from outside useFrame
        // It relies on the same logic that drives the opacity and transform animations.
        // We also check textRef.current.material.opacity directly for a more precise condition.
        enabled={visible && isReadyToAnimate && textRef.current?.material?.opacity > 0.8}
      >
        <Text
          ref={textRef}
          position={[0,0,0]} 
          fontSize={fontSize}
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={0} 
          transparent={true}
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          maxWidth={maxWidth}
          lineHeight={lineHeight}
          textAlign={textAlign}
          anchorX={anchorX}
          anchorY={anchorY}
          font={font}
        >
          {text}
        </Text>
      </Float>
    </group>
  );
};