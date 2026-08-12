import React, { useState, useEffect } from 'react';

function FPSCounter() {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    // Listen for FPS updates from the render loop
    const handleFpsUpdate = (event) => {
      setFps(event.detail.fps);
    };

    window.addEventListener('fpsUpdate', handleFpsUpdate);

    return () => {
      window.removeEventListener('fpsUpdate', handleFpsUpdate);
    };
  }, []);

  return (
    <div id="fps-counter">
      <span>{fps} FPS</span>
    </div>
  );
}

export default FPSCounter;

