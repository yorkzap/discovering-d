// src/components/AnimatedBasText.jsx - Enhanced BAS-Style Animation with Better Sync and Elegance
import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, extend } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { shaderMaterial } from '@react-three/drei';
import { computeFaceCentroid, separateFaces } from './textAnimationUtils';

// Enhanced Vertex Shader with smoother transitions
const enhancedVertexShader = `
  uniform float uTime; // Direct time uniform instead of progress
  uniform float uAnimationDuration; // Total animation duration
  uniform vec3 uBookPosition; // Book's world position for sync
  uniform vec3 uBookRotation; // Book's rotation for sync
  uniform float uMusicIntensity; // Music intensity for subtle effects
  uniform float uBoostIntensity; // Boost intensity for dramatic effects

  attribute vec2 aAnimation;  // x: delay, y: duration
  attribute vec3 aControl0;   // Bezier control point 0
  attribute vec3 aControl1;   // Bezier control point 1
  attribute vec3 aEndPosition; // End position for scattered state

  varying float vProgress;
  varying vec3 vWorldPosition;

  // Enhanced cubic Bezier with easing
  vec3 cubicBezier(vec3 p0, vec3 c0, vec3 c1, vec3 p1, float t) {
    // Apply easing for smoother motion - ease in-out cubic
    float easedT = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
    
    float nt = 1.0 - easedT;
    return nt * nt * nt * p0 + 3.0 * nt * nt * easedT * c0 + 
           3.0 * nt * easedT * easedT * c1 + easedT * easedT * easedT * p1;
  }

  void main() {
    float tDelay = aAnimation.x;
    float tDuration = aAnimation.y;
    
    // Calculate piece progress
    float pieceTime = clamp(uTime - tDelay, 0.0, tDuration);
    float tProgress = tDuration > 0.0 ? pieceTime / tDuration : 0.0;
    
    vProgress = tProgress;
    
    // Original position
    vec3 basePosition = position;
    
    // Book sync effects - apply book's transformations
    vec3 syncPosition = basePosition;
    
    // Rotation sync with book
    float cosY = cos(uBookRotation.y);
    float sinY = sin(uBookRotation.y);
    mat2 rotY = mat2(cosY, -sinY, sinY, cosY);
    syncPosition.xz = rotY * syncPosition.xz;
    
    // Music micro-movements (very subtle)
    if (uMusicIntensity > 0.1) {
      float musicOffset = sin(uTime * 4.0 + position.x * 10.0) * uMusicIntensity * 0.002;
      syncPosition.y += musicOffset;
    }
    
    // Boost effects
    if (uBoostIntensity > 0.01) {
      float boostWave = sin(uTime * 8.0 + position.x * 15.0) * uBoostIntensity * 0.005;
      syncPosition.z += boostWave;
    }
    
    // Enhanced piece animation
    vec3 finalPosition = syncPosition;
    finalPosition *= (1.0 - tProgress);
    
    // Add Bezier path with enhanced control points that consider book position
    vec3 enhancedControl0 = aControl0 + uBookPosition * 0.1;
    vec3 enhancedControl1 = aControl1 + uBookPosition * 0.05;
    vec3 enhancedEndPos = aEndPosition + uBookPosition * 0.02;
    
    finalPosition += cubicBezier(syncPosition, enhancedControl0, enhancedControl1, enhancedEndPos, tProgress);
    
    vWorldPosition = finalPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
  }
`;

// Enhanced Fragment Shader with better visual effects
const enhancedFragmentShader = `
  uniform vec3 uBaseColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uMusicIntensity;
  uniform float uBoostIntensity;
  
  varying float vProgress;
  varying vec3 vWorldPosition;

  void main() {
    vec3 finalColor = uBaseColor;
    
    // Enhanced color effects
    float distanceFromCenter = length(vWorldPosition.xy) * 0.5;
    
    // Subtle music color shift
    if (uMusicIntensity > 0.1) {
      vec3 musicTint = vec3(0.2, 0.4, 1.0) * uMusicIntensity * 0.1;
      finalColor += musicTint;
    }
    
    // Boost color enhancement
    if (uBoostIntensity > 0.01) {
      vec3 boostTint = vec3(1.0, 0.8, 0.3) * uBoostIntensity * 0.15;
      finalColor += boostTint;
    }
    
    // Smooth edge softening based on progress
    float edgeSoftness = 1.0 - smoothstep(0.7, 1.0, vProgress);
    
    // Enhanced opacity with smooth transitions
    float pieceOpacity = mix(1.0, 0.8, vProgress) * edgeSoftness;
    
    gl_FragColor = vec4(finalColor, uOpacity * pieceOpacity);
  }
`;

const EnhancedBasMaterial = shaderMaterial(
  {
    uTime: 0.0,
    uAnimationDuration: 5.0,
    uBookPosition: new THREE.Vector3(0, 0, 0),
    uBookRotation: new THREE.Vector3(0, 0, 0),
    uMusicIntensity: 0.0,
    uBoostIntensity: 0.0,
    uBaseColor: new THREE.Color("#ffffff"),
    uOpacity: 1.0,
  },
  enhancedVertexShader,
  enhancedFragmentShader,
  (material) => {
    material.transparent = true;
    material.side = THREE.DoubleSide;
    material.flatShading = false; // Smoother shading
    material.depthWrite = false; // Better transparency handling
  }
);

extend({ EnhancedBasMaterial });

export const AnimatedBasText = ({
  id,
  text = "ENHANCED TEXT",
  fontUrl = '/fonts/helvetiker_regular.typeface.json',
  targetPosition = [0, 0, 0],
  visible = true,
  initialDelay = 0,
  pageTurnTriggered = false,
  textParams = {
    size: 0.02, // Reduced size for better proportion
    depth: 0.005, // Reduced depth
    curveSegments: 4,
    bevelEnabled: true,
    bevelSize: 0.003, // Reduced bevel
    bevelThickness: 0.002,
  },
  animationParams = {
    formationDuration: 8.0,
    explosionDuration: 1.2,
    maxDelayFactor: 0.08,
    minPieceDuration: 2.5,
    maxPieceDuration: 4.5,
    extraOverallDuration: 1.5,
  },
  baseColor = "#e8e8e8",
  bookGroupRef, // Reference to book for sync
  onAnimationComplete,
  onPageTurnComplete,
}) => {
  const meshRef = useRef();
  const materialRef = useRef();
  const font = useLoader(FontLoader, fontUrl);
  
  const [currentText, setCurrentText] = useState(text);
  const [isGeometryReady, setIsGeometryReady] = useState(false);
  const [animationState, setAnimationState] = useState('hidden');
  
  // Animation timing
  const animationStartTime = useRef(0);
  const animationDuration = useRef(5.0);
  const isAnimating = useRef(false);

  // Book sync tracking
  const bookWorldPosition = useRef(new THREE.Vector3());
  const bookWorldRotation = useRef(new THREE.Vector3());

  const textMeshGeometry = useMemo(() => {
    console.log(`Creating enhanced geometry for: "${currentText}"`);
    setIsGeometryReady(false);
    if (!font || !currentText || currentText.trim() === "") return null;

    try {
      // Create text geometry with smaller, more elegant proportions
      const tempTextParams = {
        font,
        size: textParams.size * 80, // Reduced scaling factor
        height: textParams.depth * 80,
        curveSegments: textParams.curveSegments,
        bevelEnabled: textParams.bevelEnabled,
        bevelThickness: textParams.bevelThickness * 80,
        bevelSize: textParams.bevelSize * 80,
      };
      
      let geometry = new TextGeometry(currentText, tempTextParams);
      geometry.computeBoundingBox();
      
      const sizeVec = new THREE.Vector3();
      geometry.boundingBox.getSize(sizeVec);
      
      // Center the geometry
      const anchorMatrix = new THREE.Matrix4().makeTranslation(
        sizeVec.x * -0.5,
        sizeVec.y * -0.5,
        sizeVec.z * -0.5
      );
      geometry.applyMatrix4(anchorMatrix);
      
      // Scale to scene units (smaller scale)
      geometry.scale(0.0125, 0.0125, 0.0125); // Reduced from 0.01

      // Separate faces for piece-by-piece animation
      let separatedGeom = separateFaces(geometry);
      geometry.dispose();
      if (!separatedGeom) {
        console.error('Failed to separate faces');
        return null;
      }

      // Create enhanced attributes
      const vertexCount = separatedGeom.attributes.position.count;
      const faceCount = vertexCount / 3;

      const attrAnimation = new Float32Array(vertexCount * 2);
      const attrControl0 = new Float32Array(vertexCount * 3);
      const attrControl1 = new Float32Array(vertexCount * 3);
      const attrEndPosition = new Float32Array(vertexCount * 3);

      // Calculate enhanced animation parameters
      const worldSizeVec = new THREE.Vector3(sizeVec.x, sizeVec.y, sizeVec.z).multiplyScalar(0.0125);
      const textLength = worldSizeVec.multiplyScalar(0.5).length();
      
      let maxCalculatedDelay = 0;

      for (let i = 0; i < faceCount; i++) {
        const centroid = computeFaceCentroid(separatedGeom, i);
        const dirX = centroid.x > 0 ? 1 : -1;
        const dirY = centroid.y > 0 ? 1 : -1;

        // Enhanced timing with more variation
        const distanceFromCenter = centroid.length();
        const delay = distanceFromCenter * THREE.MathUtils.randFloat(0.02, animationParams.maxDelayFactor);
        const duration = THREE.MathUtils.randFloat(animationParams.minPieceDuration, animationParams.maxPieceDuration);
        maxCalculatedDelay = Math.max(maxCalculatedDelay, delay);

        // More elegant control points for smoother arcs
        const spreadFactor = 0.3 + Math.random() * 0.8; // Reduced spread for elegance
        const heightFactor = 0.8 + Math.random() * 0.6; // More controlled height

        const c0x = THREE.MathUtils.randFloat(0.0, 0.15 * spreadFactor) * dirX;
        const c0y = THREE.MathUtils.randFloat(0.3 * heightFactor, 0.6 * heightFactor) * Math.abs(dirY);
        const c0z = THREE.MathUtils.randFloat(-0.1 * spreadFactor, 0.1 * spreadFactor);

        const c1x = THREE.MathUtils.randFloat(0.15 * spreadFactor, 0.3 * spreadFactor) * dirX;
        const c1y = THREE.MathUtils.randFloat(0.1 * heightFactor, 0.4 * heightFactor) * Math.abs(dirY);
        const c1z = THREE.MathUtils.randFloat(-0.1 * spreadFactor, 0.1 * spreadFactor);
        
        // End positions with more elegant dispersal
        const endX = c1x * (1.2 + Math.random() * 0.3);
        const endY = c1y * (1.1 + Math.random() * 0.2);
        const endZ = c1z * (1.1 + Math.random() * 0.2);

        for (let v = 0; v < 3; v++) {
          const idx = i * 3 + v;
          
          attrAnimation[idx * 2 + 0] = delay;
          attrAnimation[idx * 2 + 1] = duration;

          attrControl0[idx * 3 + 0] = c0x;
          attrControl0[idx * 3 + 1] = c0y;
          attrControl0[idx * 3 + 2] = c0z;

          attrControl1[idx * 3 + 0] = c1x;
          attrControl1[idx * 3 + 1] = c1y;
          attrControl1[idx * 3 + 2] = c1z;
          
          attrEndPosition[idx * 3 + 0] = endX;
          attrEndPosition[idx * 3 + 1] = endY;
          attrEndPosition[idx * 3 + 2] = endZ;
        }
      }
      
      separatedGeom.setAttribute('aAnimation', new THREE.BufferAttribute(attrAnimation, 2));
      separatedGeom.setAttribute('aControl0', new THREE.BufferAttribute(attrControl0, 3));
      separatedGeom.setAttribute('aControl1', new THREE.BufferAttribute(attrControl1, 3));
      separatedGeom.setAttribute('aEndPosition', new THREE.BufferAttribute(attrEndPosition, 3));
      
      animationDuration.current = maxCalculatedDelay + animationParams.maxPieceDuration + animationParams.extraOverallDuration;
      console.log(`Enhanced Text: "${currentText}" - Duration: ${animationDuration.current.toFixed(2)}s`);
      
      setIsGeometryReady(true);
      return separatedGeom;

    } catch (error) {
      console.error('Error creating enhanced geometry:', error, currentText);
      return null;
    }
  }, [font, currentText, textParams, animationParams]);

  // Handle text changes
  useEffect(() => {
    if (text !== currentText) {
      setCurrentText(text);
      setAnimationState('hidden');
      isAnimating.current = false;
    }
  }, [text, currentText]);

  // Start formation animation
  useEffect(() => {
    let animTimer;
    if (visible && isGeometryReady && animationState === 'hidden') {
      animTimer = setTimeout(() => {
        console.log(`Enhanced Text "${currentText}": Starting formation`);
        setAnimationState('forming');
        animationStartTime.current = Date.now();
        isAnimating.current = true;
      }, initialDelay);
    } else if (!visible) {
      setAnimationState('hidden');
      isAnimating.current = false;
    }
    return () => clearTimeout(animTimer);
  }, [visible, isGeometryReady, initialDelay, currentText]);

  // Handle explosion trigger
  useEffect(() => {
    if (pageTurnTriggered && animationState === 'formed') {
      console.log(`Enhanced Text "${currentText}": Starting explosion`);
      setAnimationState('exploding');
      animationStartTime.current = Date.now();
      isAnimating.current = true;
    }
  }, [pageTurnTriggered, animationState, currentText]);

  // Enhanced animation loop with book sync
  useFrame((state, delta) => {
    if (!materialRef.current || !meshRef.current || !isGeometryReady) return;

    // Update book sync data
    if (bookGroupRef?.current) {
      bookGroupRef.current.getWorldPosition(bookWorldPosition.current);
      bookWorldRotation.current.setFromEuler(bookGroupRef.current.rotation);
    }

    // Calculate animation time
    let currentTime = 0;
    
    if (animationState === 'forming') {
      const elapsed = (Date.now() - animationStartTime.current) / 1000;
      const formationProgress = Math.min(elapsed / animationParams.formationDuration, 1.0);
      currentTime = (1.0 - formationProgress) * animationDuration.current; // Reverse time for formation
      
      if (formationProgress >= 1.0) {
        setAnimationState('formed');
        currentTime = 0; // Fully formed
        isAnimating.current = false;
        if (onAnimationComplete) onAnimationComplete(id, true);
      }
    } else if (animationState === 'exploding') {
      const elapsed = (Date.now() - animationStartTime.current) / 1000;
      const explosionProgress = Math.min(elapsed / animationParams.explosionDuration, 1.0);
      currentTime = explosionProgress * animationDuration.current; // Forward time for explosion
      
      if (explosionProgress >= 1.0) {
        setAnimationState('hidden');
        isAnimating.current = false;
        if (onPageTurnComplete) onPageTurnComplete(id);
        if (onAnimationComplete) onAnimationComplete(id, false);
      }
    } else if (animationState === 'formed') {
      currentTime = 0; // Stay formed
    }

    // Update material uniforms
    materialRef.current.uTime = currentTime;
    materialRef.current.uAnimationDuration = animationDuration.current;
    materialRef.current.uBookPosition = bookWorldPosition.current;
    materialRef.current.uBookRotation = bookWorldRotation.current;
    materialRef.current.uBaseColor = new THREE.Color(baseColor);
    
    // You can pass music and boost intensity from parent component
    // materialRef.current.uMusicIntensity = musicIntensity;
    // materialRef.current.uBoostIntensity = boostIntensity;

    // Smooth position lerping
    if (targetPosition && Array.isArray(targetPosition)) {
      const targetVec = new THREE.Vector3(...targetPosition);
      meshRef.current.position.lerp(targetVec, 8.0 * delta);
    }
  });

  if (!textMeshGeometry || !font) {
    return null;
  }

  return (
    <mesh
      ref={meshRef}
      geometry={textMeshGeometry}
      position={targetPosition || [0, 0, 0]}
      visible={isGeometryReady && animationState !== 'hidden'}
      frustumCulled={false}
    >
      <enhancedBasMaterial ref={materialRef} uOpacity={1.0} />
    </mesh>
  );
};