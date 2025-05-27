// src/App.jsx
import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
import { BackgroundMusic } from "./components/BackgroundMusic"; // Import

function App() {
  return (
    <>
      <UI />
      <BackgroundMusic /> {/* Add the music player here */}
      <Loader />
      <Canvas shadows camera={{
          position: [-0.5, 1, window.innerWidth > 800 ? 2.5 : 5], // Dynamic initial camera distance
          fov: 45,
        }}>
        <group position-y={0}> {/* Adjust group position if needed */}
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>
      </Canvas>
    </>
  );
}

export default App;