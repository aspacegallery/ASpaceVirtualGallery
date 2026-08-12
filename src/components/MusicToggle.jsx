import React, { useState, useRef } from 'react';

function MusicToggle({ audio }) {
  const [isMuted, setIsMuted] = useState(false);
  // Remember the volume at the moment of muting so we can restore it exactly.
  const savedVolume = useRef(null);

  const toggleMusic = () => {
    if (!audio) {
      console.log('Audio not ready yet');
      return;
    }

    if (isMuted) {
      // Unmute — restore the pre-mute volume (fall back to default if missing).
      audio.setVolume(savedVolume.current ?? 0.7);
      setIsMuted(false);
      console.log('Music unmuted');
    } else {
      // Mute — snapshot the current volume, then silence.
      savedVolume.current = audio.getVolume();
      audio.setVolume(0);
      setIsMuted(true);
      console.log('Music muted');
    }
  };

  const iconSrc = isMuted ? '/otherAssets/icon/mute.png' : '/otherAssets/icon/unmute.png';

  return (
    <div id="music-toggle" onClick={toggleMusic}>
      <img 
        src={iconSrc} 
        alt={isMuted ? 'Unmute' : 'Mute'} 
      />
    </div>
  );
}

export default MusicToggle;

