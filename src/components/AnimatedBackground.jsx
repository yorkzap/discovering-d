// src/components/AnimatedBackground.jsx

import { useFrame, extend } from '@react-three/fiber';
import { useAtom, useSetAtom } from 'jotai';
import { useRef } from 'react';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { isMusicPlayingAtom, isBoostingAtom, boostActivationTimeAtom } from './atoms';

const simplexNoise3D = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
`;

const BackgroundMaterial = shaderMaterial(
  {
    uTime: 0,
    uMusicPlaying: 0.0,
    uBoostIntensity: 0.0,
    uColor1: new THREE.Color(0x0a0a23),
    uColor2: new THREE.Color(0x1f1f3d),
    uColor3: new THREE.Color(0x4a2a66),
  },
  `
    varying vec3 vPosition;
    varying vec2 vUv;
    void main() {
      vPosition = position;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform float uMusicPlaying; 
    uniform float uBoostIntensity;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    varying vec3 vPosition;
    varying vec2 vUv;

    ${simplexNoise3D} 

    float fbm(vec3 p, float timeSpeed) {
        float sum = 0.0;
        float amp = 0.6; 
        float freq = 1.0;
        for (int i = 0; i < 4; i++) { 
            sum += snoise(p * freq + vec3(0.0, 0.0, uTime * 0.1 * timeSpeed)) * amp;
            freq *= 2.1; 
            amp *= 0.45; 
        }
        return sum;
    }

    // Galaxy cloud streaks for boost effect
    float galaxyStreaks(vec2 uv, float intensity) {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(uv, center);
        
        // Create subtle radial streaks that emerge from center
        float angle = atan(uv.y - center.y, uv.x - center.x);
        float streaks = sin(angle * 10.0 + uTime * 6.0 * intensity) * 0.25 + 0.75;
        
        // Add flowing motion like galaxy arms - slower and more graceful
        float flow = sin(dist * 12.0 - uTime * 8.0 * intensity + angle * 2.5) * 0.15 + 0.85;
        
        // Combine with distance falloff for natural look
        float fadeOut = smoothstep(0.8, 0.2, dist);
        
        return (streaks * flow - 1.0) * intensity * fadeOut * 0.3;
    }

    // Gaussian blur effect at edges for speed sensation
    float speedBlur(vec2 uv, float intensity) {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(uv, center);
        
        // Create motion blur effect radiating outward
        float blur = smoothstep(0.3, 1.0, dist) * intensity;
        
        // Add some directional streaking
        float radialBlur = abs(sin(atan(uv.y - center.y, uv.x - center.x) * 4.0)) * blur * 0.3;
        
        return blur + radialBlur;
    }

    void main() {
      vec3 normalizedPos = normalize(vPosition); 
      
      // Enhanced time speed with boost
      float baseTimeSpeed = 0.3 + uMusicPlaying * 0.7;
      float boostTimeSpeed = baseTimeSpeed + uBoostIntensity * 4.0; // More subtle speed increase
      
      // Enhanced noise layers with galaxy cloud feeling
      float cloudScale1 = 1.5 + uBoostIntensity * 1.0; // Subtle scale changes
      float cloudScale2 = 3.0 + uBoostIntensity * 1.5;
      
      float noiseLayer1 = fbm(normalizedPos * cloudScale1, boostTimeSpeed * 0.5);
      float noiseLayer2 = fbm(normalizedPos * cloudScale2 + 0.5, boostTimeSpeed * 1.0);
      
      // Add wispy galaxy cloud layer with more pleasant motion
      float galaxyWisps = fbm(normalizedPos * 0.7 + vec3(uTime * 0.03), 1.0) * 0.25;
      
      float combinedNoise = smoothstep(-0.2, 0.2, noiseLayer1) * 0.7 + 
                           smoothstep(-0.1, 0.1, noiseLayer2) * 0.3 +
                           galaxyWisps * 0.2;
      
      // Base color - keep existing beautiful scheme
      vec3 baseColor = mix(uColor1, uColor2, smoothstep(-1.0, 1.0, normalizedPos.y * 0.8 + 0.2)); 
      float musicIntensity = uMusicPlaying * 0.5 + 0.1; 
      baseColor = mix(baseColor, uColor3, combinedNoise * musicIntensity * 1.5);
      
      // Subtle music pulse with smoother timing
      baseColor += uMusicPlaying * (sin(uTime * 1.8) * 0.008 + 0.008);
      
      // Add galaxy streaks during boost (very subtle)
      float streakEffect = galaxyStreaks(vUv, uBoostIntensity);
      
      // Speed blur effect
      float blurEffect = speedBlur(vUv, uBoostIntensity);
      
      // Apply boost effects while maintaining color scheme
      vec3 boostColor = uColor3 * 1.2; // Slightly more subtle brightness boost
      vec3 finalColor = baseColor;
      
      // Add galaxy streaks as brightness variation in existing colors
      finalColor += baseColor * streakEffect;
      
      // Apply gaussian blur dimming at edges for speed effect - more subtle
      finalColor *= (1.0 - blurEffect * 0.5);
      
      // Subtle boost glow in center during boost with breathing effect
      vec2 center = vec2(0.5, 0.5);
      float centerDist = distance(vUv, center);
      float breathe = sin(uTime * 3.0) * 0.1 + 0.9; // Gentle breathing
      float centerGlow = (1.0 - smoothstep(0.0, 0.6, centerDist)) * uBoostIntensity * 0.25 * breathe;
      finalColor += boostColor * centerGlow;
      
      // Ensure color bounds
      finalColor = clamp(finalColor, 0.0, 1.0);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ BackgroundMaterial });

export const AnimatedBackground = () => {
  const materialRef = useRef();
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom);
  const [isBoosting] = useAtom(isBoostingAtom);
  const [boostActivationTime] = useAtom(boostActivationTimeAtom);
  const setIsBoosting = useSetAtom(isBoostingAtom);
  const setBoostActivationTime = useSetAtom(boostActivationTimeAtom);

  // Boost parameters - keeping your addictive curve
  const BOOST_DURATION = 2000;
  const currentBoostIntensity = useRef(0);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta;
      
      // Smooth music transition
      materialRef.current.uMusicPlaying = THREE.MathUtils.lerp(
        materialRef.current.uMusicPlaying,
        isMusicPlayingValue ? 1.0 : 0.0,
        0.05
      );

      // Your addictive boost curve - Fast start (80%) + gradual decay (20%)
      let targetBoostIntensity = 0;
      if (isBoosting) {
        const timeSinceBoost = Date.now() - boostActivationTime;
        if (timeSinceBoost < BOOST_DURATION) {
          const progress = timeSinceBoost / BOOST_DURATION;
          
          // Super fast initial pickup that gradually slows down
          const fastStart = Math.exp(-progress * 5); // Fast initial acceleration
          const slowEnd = Math.pow(1 - progress, 1.5); // Gradual decay
          
          // Your addictive formula: 80% fast start + 20% gradual decay
          targetBoostIntensity = (fastStart * 0.8 + slowEnd * 0.2);
        } else {
          setIsBoosting(false);
        }
      }
      
      // Smooth transitions for aesthetic appeal
      currentBoostIntensity.current = THREE.MathUtils.lerp(
        currentBoostIntensity.current,
        targetBoostIntensity,
        isBoosting ? 0.25 : 0.15
      );
      
      materialRef.current.uBoostIntensity = currentBoostIntensity.current;
    }
  });

  const handleBackgroundClick = (event) => {
    event.stopPropagation(); 
    console.log("Galaxy boost initiated!");
    setIsBoosting(true);
    setBoostActivationTime(Date.now());
  };

  return (
    <mesh 
      scale={[150, 150, 150]} 
      frustumCulled={false}
      onClick={handleBackgroundClick}
    >
      <sphereGeometry args={[1, 64, 32]} />
      {/* @ts-ignore */}
      <backgroundMaterial ref={materialRef} side={THREE.BackSide} />
    </mesh>
  );
};