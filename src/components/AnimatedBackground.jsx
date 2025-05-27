// src/components/AnimatedBackground.jsx

import { useFrame, extend } from '@react-three/fiber';
import { useAtom, useSetAtom } from 'jotai'; // Added useSetAtom
import { useRef } from 'react';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
// Make sure to import the new atoms and isMusicPlayingAtom from the correct central atoms file
import { isMusicPlayingAtom, isBoostingAtom, boostActivationTimeAtom } from './atoms';

// ... (simplexNoise3D and shader definition remain the same)
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
    uColor1: new THREE.Color(0x0a0a23),
    uColor2: new THREE.Color(0x1f1f3d),
    uColor3: new THREE.Color(0x4a2a66),
  },
  `
    varying vec3 vPosition;
    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform float uMusicPlaying; 
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    varying vec3 vPosition;

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

    void main() {
      vec3 normalizedPos = normalize(vPosition); 
      float timeSpeedFactor = 0.3 + uMusicPlaying * 0.7;
      float noiseLayer1 = fbm(normalizedPos * 1.5, timeSpeedFactor * 0.5);
      float noiseLayer2 = fbm(normalizedPos * 3.0 + 0.5, timeSpeedFactor * 1.0);
      float combinedNoise = smoothstep(-0.2, 0.2, noiseLayer1) * 0.7 + smoothstep(-0.1, 0.1, noiseLayer2) * 0.3;
      vec3 color = mix(uColor1, uColor2, smoothstep(-1.0, 1.0, normalizedPos.y * 0.8 + 0.2)); 
      float musicIntensity = uMusicPlaying * 0.5 + 0.1; 
      color = mix(color, uColor3, combinedNoise * musicIntensity * 1.5);
      color += uMusicPlaying * (sin(uTime * 2.5) * 0.01 + 0.01);
      color = clamp(color, 0.0, 1.0);
      gl_FragColor = vec4(color, 1.0);
    }
  `
);

extend({ BackgroundMaterial });

export const AnimatedBackground = () => {
  const materialRef = useRef();
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom); // Renamed to avoid conflict

  // Atoms for boost
  const setIsBoosting = useSetAtom(isBoostingAtom);
  const setBoostActivationTime = useSetAtom(boostActivationTimeAtom);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta;
      materialRef.current.uMusicPlaying = THREE.MathUtils.lerp(
        materialRef.current.uMusicPlaying,
        isMusicPlayingValue ? 1.0 : 0.0,
        0.05
      );
    }
  });

  const handleBackgroundClick = (event) => {
    // Important: stop propagation if this click should not be handled by deeper elements
    // For now, we assume clicks on background are meant for boost if not on other UI
    event.stopPropagation(); 
    console.log("Background clicked, initiating boost!");
    setIsBoosting(true);
    setBoostActivationTime(Date.now());
  };

  return (
    <mesh 
      scale={[150, 150, 150]} 
      frustumCulled={false}
      onClick={handleBackgroundClick} // Added onClick handler
    >
      <sphereGeometry args={[1, 64, 32]} />
      {/* @ts-ignore */}
      <backgroundMaterial ref={materialRef} side={THREE.BackSide} />
    </mesh>
  );
};