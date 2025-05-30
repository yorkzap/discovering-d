// src/App.jsx
import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
import { BackgroundMusic } from "./components/BackgroundMusic";

function App() {
  const initialCameraZ = window.innerWidth > 800 ? 2.5 : 5; // For initial position

  return (
    <>
      <UI />
      <BackgroundMusic />
      <Loader />
      <Canvas
        shadows
        camera={{
          position: [-0.5, 1, initialCameraZ],
          fov: 45,
          near: 0.1, // Explicitly set near plane
          far: 200,  // Adjust based on your scene's depth requirements (e.g., TEXT_SPAWN_Z)
        }}
        // Consider logarithmicDepthBuffer as a last resort if issues persist
        // gl={{ logarithmicDepthBuffer: true }}
      >
        <group position-y={0}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>
      </Canvas>
    </>
  );
}

export default App;