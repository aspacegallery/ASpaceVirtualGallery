import * as THREE from 'three';

/**
 * Sets up background music for the virtual gallery
 * @param {THREE.Camera} camera - The camera to attach the audio listener to
 * @returns {THREE.Audio} - The audio object for potential controls
 */
export function setupBackgroundMusic(camera) {
  // Create an AudioListener and add it to the camera
  const listener = new THREE.AudioListener();
  camera.add(listener);

  // Create a global audio source
  const sound = new THREE.Audio(listener);

  // Load the audio file
  const audioLoader = new THREE.AudioLoader();
  const audioPath = '/sounds/music/Backroom.mp3';
  
  audioLoader.load(
    audioPath,
    function (buffer) {
      sound.setBuffer(buffer);
      sound.setLoop(true); // Loop the audio
      sound.setVolume(0.7); // Set volume to 10%
    }
  );

  return sound;
}

/**
 * Helper function to play music with user interaction (for autoplay policy)
 * Call this function on a user interaction event if autoplay doesn't work
 */
export function playMusic(sound) {
  if (sound && !sound.isPlaying) {
    sound.play();
  }
}

/**
 * Helper function to pause music
 */
export function pauseMusic(sound) {
  if (sound && sound.isPlaying) {
    sound.pause();
  }
}

