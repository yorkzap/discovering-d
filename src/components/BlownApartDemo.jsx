// src/components/BlownApartDemo.jsx
import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AnimatedBasText } from './AnimatedBasText';

const BlownApartDemo = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentText, setCurrentText] = useState("BLOWN APART");
  const [animationParams, setAnimationParams] = useState({
    letterTimeOffset: 0.15,
    enableParticles: true,
    enableLights: true,
  });

  const textExamples = [
    "BLOWN APART",
    "EXPLODING TEXT",
    "FRAGMENTS",
    "PARTICLES",
    "AMAZING EFFECT"
  ];

  const handleAnimationComplete = (id, visible) => {
    console.log(`Text ${id} animation complete: ${visible ? 'shown' : 'hidden'}`);
  };

  const toggleAnimation = () => {
    setIsVisible(!isVisible);
  };

  const changeText = () => {
    const randomText = textExamples[Math.floor(Math.random() * textExamples.length)];
    setCurrentText(randomText);
  };

  const updateLetterTimeOffset = (value) => {
    setAnimationParams(prev => ({
      ...prev,
      letterTimeOffset: parseFloat(value)
    }));
  };

  const toggleParticles = () => {
    setAnimationParams(prev => ({
      ...prev,
      enableParticles: !prev.enableParticles
    }));
  };

  const toggleLights = () => {
    setAnimationParams(prev => ({
      ...prev,
      enableLights: !prev.enableLights
    }));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* 3D Scene */}
      <Canvas
        camera={{ position: [0, 0, 2], fov: 75 }}
        style={{ background: '#000012' }}
      >
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        
        <AnimatedBasText
          id="demo-text"
          text={currentText}
          targetPosition={[0, 0, 0]}
          visible={isVisible}
          initialDelay={0}
          textParams={{
            size: 0.12,
            depth: 0.02,
            curveSegments: 4,
            bevelEnabled: false,
          }}
          animationParams={animationParams}
          baseColor="#ffffff"
          emissiveColor="#4488ff"
          onAnimationComplete={handleAnimationComplete}
        />
        
        <OrbitControls 
          enableZoom={true} 
          enablePan={true} 
          enableRotate={true}
          maxDistance={5}
          minDistance={1}
        />
      </Canvas>

      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        zIndex: 1000,
        minWidth: '250px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#4488ff' }}>Blown Apart Text Demo</h3>
        
        {/* Animation Controls */}
        <div style={{ marginBottom: '15px' }}>
          <button 
            onClick={toggleAnimation}
            style={{
              background: isVisible ? '#ff4444' : '#44ff44',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {isVisible ? 'Hide Text' : 'Show Text'}
          </button>
          
          <button 
            onClick={changeText}
            style={{
              background: '#4488ff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Random Text
          </button>
        </div>

        {/* Text Input */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Custom Text:</label>
          <input
            type="text"
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            style={{
              width: '100%',
              padding: '5px',
              borderRadius: '3px',
              border: '1px solid #666',
              background: '#333',
              color: 'white'
            }}
            maxLength={20}
          />
        </div>

        {/* Animation Parameters */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Letter Delay: {animationParams.letterTimeOffset.toFixed(2)}s
          </label>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.01"
            value={animationParams.letterTimeOffset}
            onChange={(e) => updateLetterTimeOffset(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Feature Toggles */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={animationParams.enableParticles}
              onChange={toggleParticles}
              style={{ marginRight: '8px' }}
            />
            Enable Particles
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={animationParams.enableLights}
              onChange={toggleLights}
              style={{ marginRight: '8px' }}
            />
            Enable Dynamic Lights
          </label>
        </div>

        {/* Instructions */}
        <div style={{ 
          fontSize: '12px', 
          color: '#aaa', 
          borderTop: '1px solid #444', 
          paddingTop: '10px',
          marginTop: '15px'
        }}>
          <p style={{ margin: '0 0 5px 0' }}>• Click and drag to rotate view</p>
          <p style={{ margin: '0 0 5px 0' }}>• Scroll to zoom in/out</p>
          <p style={{ margin: '0' }}>• Text will explode when shown</p>
        </div>
      </div>

      {/* Performance Info */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#aaa',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        Text: "{currentText}"<br/>
        Visible: {isVisible ? 'Yes' : 'No'}<br/>
        Particles: {animationParams.enableParticles ? 'On' : 'Off'}<br/>
        Lights: {animationParams.enableLights ? 'On' : 'Off'}
      </div>
    </div>
  );
};

export default BlownApartDemo;