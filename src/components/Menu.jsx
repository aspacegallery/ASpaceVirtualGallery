import React, { useState, useEffect } from 'react';

function Menu({ onPlay, onAbout, ready = true }) {
  const [glows, setGlows] = useState([]);
  
  const glowImages = [
    '/otherAssets/otherTexture/glow1.png',
    '/otherAssets/otherTexture/glow2.png',
    '/otherAssets/otherTexture/glow3.png'
  ];

  useEffect(() => {
    const minSize = 5; // Minimum size in percentage
    const maxSize = 10; // Maximum size in percentage
    
    const addGlow = () => {
      const newGlow = {
        id: Date.now() + Math.random(),
        image: glowImages[Math.floor(Math.random() * glowImages.length)],
        top: Math.random() * 100 - 50, // Random position between -50% and 50%
        left: Math.random() * 100 - 50,
        size: Math.random() * (maxSize - minSize) + minSize, // Random size between min and max
        visible: false
      };

      setGlows(prev => [...prev, newGlow]);

      // Fade in
      setTimeout(() => {
        setGlows(prev => 
          prev.map(g => g.id === newGlow.id ? { ...g, visible: true } : g)
        );
      }, 50);

      // Fade out and remove
      setTimeout(() => {
        setGlows(prev => 
          prev.map(g => g.id === newGlow.id ? { ...g, visible: false } : g)
        );
        
        setTimeout(() => {
          setGlows(prev => prev.filter(g => g.id !== newGlow.id));
        }, 500);
      }, Math.random() * 200 + 500); // Stay visible for 0.5-0.7 seconds
    };

    // Add glows at random intervals
    const interval = setInterval(() => {
      addGlow();
    }, Math.random() * 300 + 300); // New glow every 0.3-0.6 seconds

    // Initial glows
    addGlow();
    setTimeout(addGlow, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div id="menu">
        <div id="content">
          <div className="title">
            <h1>A Space Virtual Gallery</h1>
            {glows.map(glow => (
              <img 
                key={glow.id}
                src={glow.image} 
                alt="" 
                className={`title-glow ${glow.visible ? 'visible' : ''}`}
                style={{
                  top: `calc(50% + ${glow.top}%)`,
                  left: `calc(50% + ${glow.left}%)`,
                  width: `${glow.size}%`,
                  transform: `translate(-50%, -50%)`
                }}
              />
            ))}
          </div>
          <div className="title-info">
            <p>
            Founded in 2024, A Space Gallery is an incubator for emerging artists and new ideas in contemporary art. We support young talents by creating space to experiment, grow, and connect with broader audiences. This virtual gallery extends that mission beyond physical walls, offering immersive exhibitions and dynamic cultural experiences that explore bold perspectives and evolving forms of expression.
            </p>
            <p>
            Every refresh brings you into a slightly different space — rooms rearrange, furniture drifts, and quiet anomalies surface in the corners. No two visits are ever the same.
            </p>
          </div>

          <div
            id="play_button"
            className={ready ? '' : 'disabled'}
            onClick={ready ? onPlay : undefined}
          >
            <p>{ready ? 'EXPLORE ART' : 'LOADING...'}</p>
          </div>
          <div id="about_button_container">
            <button id="about_button" onClick={onAbout}>ABOUT EXHIBITION</button>
          </div>
        </div>
    </div>
  );
}

export default Menu;

