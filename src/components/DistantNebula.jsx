// src/components/DistantNebula.jsx
import { useFrame, extend } from '@react-three/fiber';
import { useAtom } from 'jotai';
import { useRef } from 'react';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { isMusicPlayingAtom, isBoostingAtom, boostActivationTimeAtom, audioAnalyserAtom } from './atoms';

const NebulaMaterial = shaderMaterial(
  {
    uTime: 0,
    uMusicPlaying: 0.0,
    uBoostIntensity: 0.0,
    // Audio-reactive colors
    uBassColor: new THREE.Color(0xff4444), // Red for bass
    uMidColor: new THREE.Color(0x44ff44),  // Green for mids  
    uTrebleColor: new THREE.Color(0x4444ff), // Blue for treble
    uBaseColor: new THREE.Color(0x2a1a3a), // Dark purple base
    // Audio intensity values
    uBassIntensity: 0.0,
    uMidIntensity: 0.0,
    uTrebleIntensity: 0.0,
    uOverallIntensity: 0.0,
  },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform float uMusicPlaying;
    uniform float uBoostIntensity;
    uniform vec3 uBassColor;
    uniform vec3 uMidColor;
    uniform vec3 uTrebleColor;
    uniform vec3 uBaseColor;
    uniform float uBassIntensity;
    uniform float uMidIntensity;
    uniform float uTrebleIntensity;
    uniform float uOverallIntensity;
    varying vec2 vUv;

    // Improved noise function
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
        float sum = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 5; i++) {
            sum += noise(p) * amp;
            p *= 2.0;
            amp *= 0.5;
        }
        return sum;
    }

    // Audio-reactive star field
    float stars(vec2 uv, float time, float intensity) {
        float starField = 0.0;
        
        // Multiple star layers with different audio responsiveness
        for(float layer = 0.0; layer < 3.0; layer++) {
            vec2 starUV = uv * (4.0 + layer * 3.0);
            vec2 starGrid = floor(starUV);
            vec2 starFract = fract(starUV);
            
            float random = hash(starGrid + layer * 100.0);
            
            // Audio-reactive star probability
            float starThreshold = 0.92 - intensity * 0.15;
            
            if(random > starThreshold) {
                vec2 starPos = vec2(
                    hash(starGrid + vec2(1.0, 0.0) + layer * 100.0),
                    hash(starGrid + vec2(0.0, 1.0) + layer * 100.0)
                );
                
                float dist = length(starFract - starPos);
                
                // Audio-reactive star size
                float starSize = 0.01 + intensity * 0.02 + layer * 0.005;
                float star = smoothstep(starSize, 0.0, dist);
                
                // Audio-reactive twinkling
                float twinkleSpeed = 2.0 + intensity * 8.0;
                float twinkle = sin(time * twinkleSpeed + random * 6.28) * 0.4 + 0.6;
                
                // Brightness varies with audio and layer
                float brightness = (0.6 + intensity * 0.8) * (1.0 - layer * 0.2);
                
                starField += star * twinkle * brightness;
            }
        }
        
        return clamp(starField, 0.0, 1.0);
    }

    // Audio-reactive meteors
    float meteors(vec2 uv, float time, float bassIntensity) {
        float meteorField = 0.0;
        
        // Bass-driven meteor frequency
        float meteorSpeed = 0.15 + bassIntensity * 0.3;
        
        for(float i = 0.0; i < 3.0; i++) {
            float meteorTime = time * meteorSpeed;
            float meteorCycle = 3.0 + bassIntensity * 2.0; // Bass makes meteors more frequent
            float meteorProgress = fract(meteorTime / meteorCycle + i * 0.33);
            
            // Only show meteor during bass hits or randomly
            float shouldShow = step(0.7, meteorProgress) + step(0.8, bassIntensity);
            shouldShow = clamp(shouldShow, 0.0, 1.0);
            
            if(shouldShow > 0.0) {
                float localProgress = fract(meteorProgress * 3.0);
                
                vec2 meteorStart = vec2(-0.3 + i * 0.15, 0.9 + i * 0.2);
                vec2 meteorEnd = vec2(1.3 + i * 0.15, -0.1 + i * 0.2);
                vec2 meteorPos = mix(meteorStart, meteorEnd, localProgress);
                
                vec2 meteorDir = normalize(meteorEnd - meteorStart);
                vec2 toMeteor = uv - meteorPos;
                float distToPath = abs(dot(toMeteor, vec2(-meteorDir.y, meteorDir.x)));
                float distAlongPath = dot(toMeteor, meteorDir);
                
                // Bass-reactive trail length
                float trailLength = 0.1 + bassIntensity * 0.15;
                float trailFade = smoothstep(trailLength, 0.0, -distAlongPath) * 
                                smoothstep(0.02, 0.0, distAlongPath);
                
                float meteorWidth = smoothstep(0.002 + bassIntensity * 0.003, 0.0, distToPath);
                float meteorBrightness = (1.0 - localProgress) * (0.6 + bassIntensity * 0.8);
                
                meteorField += meteorWidth * trailFade * meteorBrightness * shouldShow;
            }
        }
        
        return meteorField;
    }

    // Audio-reactive space dust
    float spaceDust(vec2 uv, float time, float midIntensity) {
        float dustField = 0.0;
        
        // Mid-frequency driven dust movement
        vec2 dustUV = uv + vec2(
            sin(time * (0.05 + midIntensity * 0.2)), 
            cos(time * (0.07 + midIntensity * 0.15))
        ) * (0.02 + midIntensity * 0.03);
        
        for(float i = 0.0; i < 25.0; i++) {
            vec2 dustSeed = vec2(i * 12.34, i * 56.78);
            vec2 dustPos = vec2(hash(dustSeed), hash(dustSeed + vec2(1.0, 1.0)));
            
            // Audio-reactive movement
            dustPos += vec2(
                sin(time * (0.1 + midIntensity * 0.3) + i * 0.5) * (0.015 + midIntensity * 0.02),
                cos(time * (0.12 + midIntensity * 0.25) + i * 0.7) * (0.015 + midIntensity * 0.02)
            );
            
            dustPos = fract(dustPos);
            
            float dist = distance(dustUV, dustPos);
            float dust = smoothstep(0.005 + midIntensity * 0.008, 0.0, dist);
            
            // Audio-reactive pulsing
            float pulse = sin(time * (1.0 + midIntensity * 3.0) + i) * 0.3 + 0.7;
            
            dustField += dust * pulse * (0.2 + midIntensity * 0.4);
        }
        
        return dustField;
    }

    void main() {
      // Fixed nebula position - back to original spot
      vec2 nebulaCenter = vec2(0.39, 0.51);
      
      // Large, always visible nebula
      vec2 centeredUV = vUv - nebulaCenter;
      float distToNebula = length(centeredUV);
      
      // Make it bigger and always visible
      float nebulaSize = 0.27;
      float nebulaBase = 1.0 - smoothstep(0.0, nebulaSize, distToNebula);
      
      // Simple flowing details
      vec2 flowUV = vUv + vec2(uTime * 0.015, uTime * 0.02);
      float nebulaNoise = fbm(flowUV * 2.0) * 0.5 + 0.5; // Always at least 50% visible
      
      // Gentle spiral pattern
      float angle = atan(centeredUV.y, centeredUV.x);
      float spiral = sin(angle * 2.0 + distToNebula * 6.0 - uTime * 0.3) * 0.2 + 0.8; // Mostly visible
      
      // Wispy details
      float wisps = fbm(vUv * 3.0 + vec2(uTime * 0.01, 0.0)) * 0.3 + 0.7; // Mostly visible
      
      // Combine for strong nebula shape
      float nebula = nebulaBase * nebulaNoise * spiral * wisps;
      nebula = smoothstep(0.05, 0.9, nebula); // Very visible threshold
      
      // Strong base purple color - always visible
      vec3 baseColor = vec3(0.6, 0.3, 0.8); // Bright purple
      vec3 finalNebulaColor = baseColor;
      
      // Audio-reactive color changes - more dramatic
      if(uBassIntensity > 0.02) {
        vec3 redColor = vec3(0.8, 0.1, 1.2); // Bright red
        finalNebulaColor = mix(finalNebulaColor, redColor, uBassIntensity);
      }
      
      if(uMidIntensity > 0.02) {
        vec3 greenColor = vec3(0.2, 1.2, 0.2); // Bright green
        float greenPattern = sin(angle * 3.0 + uTime * 1.5) * 0.5 + 0.5;
        finalNebulaColor = mix(finalNebulaColor, greenColor, uMidIntensity * greenPattern * 0.8);
      }
      
      if(uTrebleIntensity > 0.02) {
        vec3 blueColor = vec3(0.2, 0.4, 1.5); // Bright blue
        float sparklePattern = fbm(vUv * 6.0 + uTime * 0.5) * uTrebleIntensity;
        finalNebulaColor = mix(finalNebulaColor, blueColor, sparklePattern);
      }
      
      // Loudness boost
      float loudnessBoost = 1.2 + uOverallIntensity * 2.0;
      
      // Simple star field
      float starLayer = stars(vUv, uTime, 0.4);
      
      // Meteors on strong bass
      float meteorLayer = 0.0;
      if(uBassIntensity > 0.2) {
        meteorLayer = meteors(vUv, uTime, uBassIntensity);
      }
      
      // Always visible dust
      float dustLayer = spaceDust(vUv, uTime, 0.3);
      
      // Final composition
      vec3 finalColor = vec3(0.0);
      
      // Main nebula - very bright
      finalColor += finalNebulaColor * nebula * loudnessBoost * 1.5;
      
      // Bright stars
      finalColor += vec3(0.9, 0.95, 1.0) * starLayer * 2.0;
      
      // Red meteors
      if(meteorLayer > 0.0) {
        finalColor += vec3(1.5, 0.3, 0.2) * meteorLayer * 2.0;
      }
      
      // Visible dust
      finalColor += vec3(0.5, 0.6, 0.9) * dustLayer * 1.0;
      
      // Strong alpha
      float finalAlpha = nebula * 1.0 + starLayer * 1.0 + meteorLayer * 1.0 + dustLayer * 0.5;
      
      gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
    }
  `
);

extend({ NebulaMaterial });

export const DistantNebula = () => {
  const materialRef = useRef();
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom);
  const [isBoosting] = useAtom(isBoostingAtom);
  const [boostActivationTime] = useAtom(boostActivationTimeAtom);
  const [analyser] = useAtom(audioAnalyserAtom);

  const BOOST_DURATION = 2000;
  const currentBoostIntensity = useRef(0);
  const dataArray = useRef(null);

  // Audio analysis refs
  const bassIntensity = useRef(0);
  const midIntensity = useRef(0);
  const trebleIntensity = useRef(0);
  const overallIntensity = useRef(0);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta;
      
      // Smooth music transition
      materialRef.current.uMusicPlaying = THREE.MathUtils.lerp(
        materialRef.current.uMusicPlaying,
        isMusicPlayingValue ? 1.0 : 0.0,
        0.05
      );

      // Audio analysis
      if (analyser && isMusicPlayingValue) {
        if (!dataArray.current) {
          dataArray.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataArray.current);

        // Split frequency spectrum into bass, mid, treble
        const length = dataArray.current.length;
        const bassEnd = Math.floor(length * 0.1); // 0-10% = bass
        const midEnd = Math.floor(length * 0.4);  // 10-40% = mids
        // 40-100% = treble

        // Calculate bass (low frequencies)
        let bassSum = 0;
        for (let i = 0; i < bassEnd; i++) {
          bassSum += dataArray.current[i];
        }
        const targetBass = bassSum / bassEnd / 255;

        // Calculate mids (middle frequencies)
        let midSum = 0;
        for (let i = bassEnd; i < midEnd; i++) {
          midSum += dataArray.current[i];
        }
        const targetMid = midSum / (midEnd - bassEnd) / 255;

        // Calculate treble (high frequencies)
        let trebleSum = 0;
        for (let i = midEnd; i < length; i++) {
          trebleSum += dataArray.current[i];
        }
        const targetTreble = trebleSum / (length - midEnd) / 255;

        // Calculate overall intensity
        let totalSum = 0;
        for (let i = 0; i < length; i++) {
          totalSum += dataArray.current[i];
        }
        const targetOverall = totalSum / length / 255;

        // Smooth transitions for audio reactivity
        bassIntensity.current = THREE.MathUtils.lerp(bassIntensity.current, targetBass, 0.2);
        midIntensity.current = THREE.MathUtils.lerp(midIntensity.current, targetMid, 0.15);
        trebleIntensity.current = THREE.MathUtils.lerp(trebleIntensity.current, targetTreble, 0.25);
        overallIntensity.current = THREE.MathUtils.lerp(overallIntensity.current, targetOverall, 0.1);

        // Update shader uniforms
        materialRef.current.uBassIntensity = bassIntensity.current;
        materialRef.current.uMidIntensity = midIntensity.current;
        materialRef.current.uTrebleIntensity = trebleIntensity.current;
        materialRef.current.uOverallIntensity = overallIntensity.current;
      } else {
        // Fade out audio intensities when no music
        bassIntensity.current = THREE.MathUtils.lerp(bassIntensity.current, 0, 0.05);
        midIntensity.current = THREE.MathUtils.lerp(midIntensity.current, 0, 0.05);
        trebleIntensity.current = THREE.MathUtils.lerp(trebleIntensity.current, 0, 0.05);
        overallIntensity.current = THREE.MathUtils.lerp(overallIntensity.current, 0, 0.05);

        materialRef.current.uBassIntensity = bassIntensity.current;
        materialRef.current.uMidIntensity = midIntensity.current;
        materialRef.current.uTrebleIntensity = trebleIntensity.current;
        materialRef.current.uOverallIntensity = overallIntensity.current;
      }

      // Boost curve
      let targetBoostIntensity = 0;
      if (isBoosting) {
        const timeSinceBoost = Date.now() - boostActivationTime;
        if (timeSinceBoost < BOOST_DURATION) {
          const progress = timeSinceBoost / BOOST_DURATION;
          const fastStart = Math.exp(-progress * 5);
          const slowEnd = Math.pow(1 - progress, 1.5);
          targetBoostIntensity = (fastStart * 0.8 + slowEnd * 0.2);
        }
      }
      
      currentBoostIntensity.current = THREE.MathUtils.lerp(
        currentBoostIntensity.current,
        targetBoostIntensity,
        isBoosting ? 0.25 : 0.15
      );
      
      materialRef.current.uBoostIntensity = currentBoostIntensity.current;
    }
  });

  return (
    <mesh 
      position={[0, 0, -8]} 
      scale={[40, 40, 1]}
    >
      <planeGeometry args={[1, 1]} />
      {/* @ts-ignore */}
      <nebulaMaterial 
        ref={materialRef} 
        transparent 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};