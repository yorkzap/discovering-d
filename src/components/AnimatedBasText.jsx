// src/components/AnimatedBasText.jsx
import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, extend } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { shaderMaterial } from '@react-three/drei';
import { computeFaceCentroid, fibSpherePoint, separateFaces } from './textAnimationUtils';

const vertexShader = `
  uniform float uProgress;
  uniform float uAnimationDuration;
  uniform float uTravelDistance;

  attribute vec2 aAnimationData;
  attribute vec3 aTravelDirection;
  attribute vec4 aAxisAngle;

  varying float vFaceProgress;

  float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
  vec3 rotateVector(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
  vec4 quatFromAxisAngle(vec3 axis, float angle) {
    float halfAngle = angle * 0.5;
    return vec4(axis.xyz * sin(halfAngle), cos(halfAngle));
  }

  void main() {
    float tDelay = aAnimationData.x;
    float tDuration = aAnimationData.y;
    float faceTime = clamp((uProgress * uAnimationDuration) - tDelay, 0.0, tDuration);
    float faceProgress = tDuration > 0.0001 ? easeOutCubic(faceTime / tDuration) : 0.0;
    vFaceProgress = faceProgress;

    vec3 scaledVertex = position * faceProgress; // 'position' is the formed position

    float currentAngle = aAxisAngle.w * (1.0 - faceProgress);
    vec4 tQuat = quatFromAxisAngle(aAxisAngle.xyz, currentAngle);
    vec3 rotatedVertex = rotateVector(tQuat, scaledVertex);

    vec3 travelOffset = aTravelDirection * uTravelDistance * (1.0 - faceProgress);
    vec3 transformed = rotatedVertex + travelOffset;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uEmissiveColor;
  uniform float uOpacity;
  varying float vFaceProgress;

  void main() {
    float faceAlpha = smoothstep(0.0, 0.35, vFaceProgress);
    vec3 finalColor = uBaseColor + uEmissiveColor * (faceAlpha * 0.7 + 0.1);
    float finalOpacity = faceAlpha * uOpacity;

    if (finalOpacity < 0.01) discard;
    gl_FragColor = vec4(finalColor, finalOpacity);
  }
`;

const AnimatedTextMaterialConstructor = shaderMaterial(
  {
    uProgress: 0.0,
    uAnimationDuration: 1.0,
    uTravelDistance: 1.0,
    uBaseColor: new THREE.Color("#cccccc"),
    uEmissiveColor: new THREE.Color("#6688ff"),
    uOpacity: 0.0,
  },
  vertexShader,
  fragmentShader,
  (material) => { 
    material.transparent = true;
    material.side = THREE.DoubleSide;
    material.depthWrite = false;
    material.blending = THREE.AdditiveBlending;
  }
);

extend({ AnimatedTextMaterial: AnimatedTextMaterialConstructor });

export const AnimatedBasText = ({
  id,
  text,
  fontUrl = '/fonts/helvetiker_regular.typeface.json',
  targetPosition,
  visible,
  initialDelay = 0,
  textParams = {
    size: 0.15, depth: 0.02, curveSegments: 3, bevelEnabled: false,
  },
  animationParams = {
    minDuration: 1.0, maxDuration: 1.6, stretch: 0.2,
    lengthFactor: 0.03, 
    travelDistance: 0.7, // This will be used for uTravelDistance
    rotationFactor: Math.PI * 1.8,
  },
  baseColor = "#ddeeff",
  emissiveColor = "#88aaff",
  onAnimationComplete,
}) => {
  const meshRef = useRef();
  const materialRef = useRef();
  const font = useLoader(FontLoader, fontUrl);
  const [currentText, setCurrentText] = useState(text);
  const [isGeometryReady, setIsGeometryReady] = useState(false);
  const [canStartAnimation, setCanStartAnimation] = useState(false);
  const animationCompletionState = useRef(null);
  const perFaceAnimationDurationRef = useRef(animationParams.maxDuration + animationParams.stretch);

  const textMeshGeometry = useMemo(() => {
    setIsGeometryReady(false);
    if (!font || !currentText || currentText.trim() === "") return null;
    
    const currentTextParams = { font, ...textParams };
    if (currentTextParams.height && !currentTextParams.depth) {
        currentTextParams.depth = currentTextParams.height;
        delete currentTextParams.height;
    }

    let geom = new TextGeometry(currentText, currentTextParams);
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox.getSize(size);
    geom.translate(-size.x / 2, -size.y / 2, -size.z / 2); // geom.attributes.position now holds centered, formed positions

    let separatedGeom = separateFaces(geom); // Duplicates vertices for per-face attributes
    geom.dispose();

    if (!separatedGeom || !separatedGeom.attributes.position || separatedGeom.attributes.position.count === 0) {
      console.error(`AnimatedBasText [${id}]: Failed separatedGeom.`);
      return null;
    }

    const posAttr = separatedGeom.attributes.position; // These are the formed vertex positions
    const numVertices = posAttr.count;
    const numFaces = numVertices / 3;

    const aAnimationData = new Float32Array(numVertices * 2);
    const aTravelDirection = new Float32Array(numVertices * 3);
    const aAxisAngle = new Float32Array(numVertices * 4);
    
    let maxCalculatedOverallDuration = 0;
    const tempBoundingBox = new THREE.Box3().setFromBufferAttribute(posAttr);
    const geomCenter = new THREE.Vector3(); 
    tempBoundingBox.getCenter(geomCenter); // Should be close to (0,0,0) due to earlier translate
    const geomMaxLength = tempBoundingBox.max.distanceTo(geomCenter) || 1.0;

    for (let i = 0; i < numFaces; i++) {
      const vA_orig = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 0);
      const vB_orig = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
      const vC_orig = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);
      const faceCentroid_orig = new THREE.Vector3().add(vA_orig).add(vB_orig).add(vC_orig).divideScalar(3);

      const delay = (geomMaxLength - faceCentroid_orig.length()) * animationParams.lengthFactor + Math.random() * animationParams.stretch;
      const duration = THREE.MathUtils.randFloat(animationParams.minDuration, animationParams.maxDuration);
      maxCalculatedOverallDuration = Math.max(maxCalculatedOverallDuration, delay + duration);
      
      let travelDir = faceCentroid_orig.clone().sub(geomCenter).normalize();
      if (travelDir.lengthSq() < 0.0001) { // If centroid is at origin, pick random dir
        travelDir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      }

      const axis = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
      const angle = (Math.random() * 2.0 - 1.0) * animationParams.rotationFactor;

      for (let j = 0; j < 3; j++) {
        const vertIndex = i * 3 + j;
        aAnimationData[vertIndex * 2 + 0] = Math.max(0, delay);
        aAnimationData[vertIndex * 2 + 1] = duration;
        aTravelDirection.set([travelDir.x, travelDir.y, travelDir.z], vertIndex * 3);
        aAxisAngle.set([axis.x, axis.y, axis.z, angle], vertIndex * 4);
      }
    }
    perFaceAnimationDurationRef.current = Math.max(0.1, maxCalculatedOverallDuration);

    separatedGeom.setAttribute('aAnimationData', new THREE.BufferAttribute(aAnimationData, 2));
    separatedGeom.setAttribute('aTravelDirection', new THREE.BufferAttribute(aTravelDirection, 3));
    separatedGeom.setAttribute('aAxisAngle', new THREE.BufferAttribute(aAxisAngle, 4));
    // The 'position' attribute of separatedGeom is already the formed position.
    
    setIsGeometryReady(true);
    return separatedGeom;
  }, [font, currentText, textParams, animationParams]);

  useEffect(() => { 
    if (text !== currentText) {
      setCanStartAnimation(false); animationCompletionState.current = null; setCurrentText(text);
    }
  }, [text, currentText]);

  useEffect(() => { 
    let timer;
    if (visible && isGeometryReady) {
      timer = setTimeout(() => {
        setCanStartAnimation(true); animationCompletionState.current = null;
        if (materialRef.current) {
          materialRef.current.uProgress = 0; 
          materialRef.current.uOpacity = 0;
        }
      }, initialDelay);
    } else if (!visible && isGeometryReady) { 
      setCanStartAnimation(true); 
      animationCompletionState.current = null;
    } else { 
      setCanStartAnimation(false);
    }
    return () => clearTimeout(timer);
  }, [visible, initialDelay, id, isGeometryReady]);

  useFrame((state, delta) => {
    if (!materialRef.current || !meshRef.current || !textMeshGeometry || !isGeometryReady) return;

    const targetOverallProgress = visible && canStartAnimation ? 1.0 : 0.0;
    const LERP_SPEED_OVERALL = targetOverallProgress === 1.0 ? 0.7 : 1.8;
    
    const currentOverallProgress = materialRef.current.uProgress;
    let newOverallProgress = THREE.MathUtils.lerp(
      currentOverallProgress,
      targetOverallProgress,
      LERP_SPEED_OVERALL * delta
    );
    if (targetOverallProgress === 1.0) newOverallProgress = Math.min(newOverallProgress, 1.0);
    else newOverallProgress = Math.max(newOverallProgress, 0.0);
    
    if (Math.abs(currentOverallProgress - newOverallProgress) > 0.00001) {
        materialRef.current.uProgress = newOverallProgress;
        materialRef.current.uOpacity = newOverallProgress; 
    }
    materialRef.current.uAnimationDuration = perFaceAnimationDurationRef.current;
    materialRef.current.uTravelDistance = animationParams.travelDistance || 1.0;

    if (targetPosition) meshRef.current.position.lerp(new THREE.Vector3(...targetPosition), 3.0 * delta);

    if (onAnimationComplete && canStartAnimation) {
      const progress = materialRef.current.uProgress;
      const threshold = 0.035; 
      const isAnimationInComplete = targetOverallProgress === 1.0 && (1.0 - progress) < threshold;
      const isAnimationOutComplete = targetOverallProgress === 0.0 && progress < threshold;
      if (isAnimationInComplete && animationCompletionState.current !== true) {
        onAnimationComplete(id, true); animationCompletionState.current = true;
      } else if (isAnimationOutComplete && animationCompletionState.current !== false) {
        onAnimationComplete(id, false); animationCompletionState.current = false;
      }
    }
  });

  if (!textMeshGeometry || !font) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={textMeshGeometry}
      position={targetPosition || [0,0,0]}
      visible={isGeometryReady}
    >
      <animatedTextMaterial
        ref={materialRef}
        uBaseColor={new THREE.Color(baseColor)}
        uEmissiveColor={new THREE.Color(emissiveColor)}
      />
    </mesh>
  );
};