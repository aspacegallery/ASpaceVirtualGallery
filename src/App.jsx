import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import ThreeScene from './components/ThreeScene';
import Menu from './components/Menu';
import InfoPanel from './components/InfoPanel';
import AboutOverlay from './components/AboutOverlay';
import MusicToggle from './components/MusicToggle';
import FPSCounter from './components/FPSCounter';
import LocationDisplay from './components/LocationDisplay';
import ConstructionOverlay from './components/ConstructionOverlay';
import { setInputLocked } from '../modules/inputLock.js';

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [controls, setControls] = useState(null);
  const [audio, setAudio] = useState(null);
  const [sceneData, setSceneData] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [infoPanelVisible, setInfoPanelVisible] = useState(true);
  const [infoPanelStateBeforeAbout, setInfoPanelStateBeforeAbout] = useState(null);
  const [menuStateBeforeAbout, setMenuStateBeforeAbout] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [controlType, setControlType] = useState('desktop');

  // Detect if mobile device
  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = ('ontouchstart' in window) || 
                       (navigator.maxTouchPoints > 0) || 
                       (navigator.msMaxTouchPoints > 0);
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth <= 1024;
      
      return hasTouch && (mobileUA || isSmallScreen);
    };
    
    const isMobileDevice = checkMobile();
    setIsMobile(isMobileDevice);
    setControlType(isMobileDevice ? 'mobile' : 'desktop');
  }, []);

  const handlePlay = async () => {
    // Guard against clicks that slip through before the scene has finished
    // loading (button should be visually disabled in that state).
    if (!sceneReady) return;

    // These must fire synchronously during the click so the browser keeps the
    // user gesture (needed for pointer lock and audio autoplay policies).
    if (!isMobile && controls && controls.lock) {
      controls.lock();
    }
    if (audio && !audio.isPlaying) {
      audio.play();
    }

    // Wait for shader compilation + GPU upload before removing the menu so
    // the first visible frame is already warm (no stutter on first look-around).
    const warmup = window.warmupShaders ? window.warmupShaders() : Promise.resolve();
    try {
      await warmup;
    } catch (e) {}
    // Give the GPU a couple of frames to actually upload the compiled programs.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    setShowMenu(false);
  };

  const handleAboutOpen = () => {
    // Save current info panel state before opening about
    setInfoPanelStateBeforeAbout(infoPanelVisible);
    // Collapse info panel
    setInfoPanelVisible(false);
    // Remember whether the main menu was open, then hide it so About is on top
    setMenuStateBeforeAbout(showMenu);
    setShowMenu(false);
    setShowAbout(true);
  };

  const handleAboutClose = () => {
    setShowAbout(false);
    // Restore info panel state to what it was before about opened
    if (infoPanelStateBeforeAbout !== null) {
      setInfoPanelVisible(infoPanelStateBeforeAbout);
      setInfoPanelStateBeforeAbout(null);
    }
    // If the menu was open before About, bring it back
    if (menuStateBeforeAbout) {
      setShowMenu(true);
    }
    setMenuStateBeforeAbout(null);
  };

  useEffect(() => {
    // Make menu visibility functions available globally for eventListeners module
    window.hideMenu = () => setShowMenu(false);
    window.showMenu = () => setShowMenu(true);

    return () => {
      delete window.hideMenu;
      delete window.showMenu;
    };
  }, []);

  // Lock movement and handheld-item interactions while menu or about is shown
  useEffect(() => {
    setInputLocked(showMenu || showAbout);
  }, [showMenu, showAbout]);

  return (
    <>
      {showMenu && <Menu onPlay={handlePlay} onAbout={handleAboutOpen} ready={sceneReady} />}
      {showAbout && <AboutOverlay onClose={handleAboutClose} />}
      <InfoPanel 
        isVisible={infoPanelVisible} 
        setIsVisible={setInfoPanelVisible}
        controlType={controlType}
      />
      <MusicToggle audio={audio} />
      <FPSCounter />
      {sceneData && (
        <LocationDisplay
          camera={sceneData.camera}
          rooms={sceneData.rooms}
          doorways={sceneData.doorways}
        />
      )}
      <div id="painting-info" style={{ display: showMenu ? 'none' : 'block' }}></div>
      
      {/* Mobile menu button - bottom left */}
      {isMobile && !showMenu && (
        <button
          id="mobile-menu-button"
          onClick={() => setShowMenu(true)}
        >
          MENU
        </button>
      )}
      
      <ThreeScene
        onControlsReady={setControls}
        onAudioReady={setAudio}
        onSceneReady={setSceneData}
        onReady={() => setSceneReady(true)}
      />
      <ConstructionOverlay />
      <Analytics />
    </>
  );
}

export default App;

