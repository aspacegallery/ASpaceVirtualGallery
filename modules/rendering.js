import * as THREE from "three";
import { displayPaintingInfo, hidePaintingInfo } from "./paintingInfo.js";
import { updateControls } from "./controlsManager.js";
import { pauseMusic, playMusic } from "./music.js";

export const setupRendering = (
  scene,
  camera,
  renderer,
  paintings,
  controls,
  walls,
  floor,
  models = {},
  backgroundMusic = null
) => {
  let prevAudioFocusPainting = null;
  let bgMusicSuspendedForArtwork = null;
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  const clock = new THREE.Clock();
  let frameCount = 0;
  
  // FPS counter variables
  let lastTime = performance.now();
  let frames = 0;
  let fps = 60;
  
  // Persist painting to show across frames
  let paintingToShow = null;

  let render = function () {
    const delta = clock.getDelta();
    frameCount++;
    frames++;
    
    // Calculate FPS every second
    const currentTime = performance.now();
    if (currentTime >= lastTime + 1000) {
      fps = Math.round((frames * 1000) / (currentTime - lastTime));
      
      // Dispatch FPS update event for React component
      window.dispatchEvent(new CustomEvent('fpsUpdate', { detail: { fps } }));
      
      frames = 0;
      lastTime = currentTime;
    }

    // Update controls based on device type (mobile or desktop)
    updateControls(delta, camera, controls, walls);

    // Make billboard plane always face camera
    if (models.statue && models.statue.userData.billboardPlane) {
      models.statue.userData.billboardPlane.lookAt(camera.position);
    }

    // Cube trigger thresholds (must match values in paintings.js)
    const depthThreshold = 10;   // How far in front of painting (Z or X depending on wall)
    const widthMargin = 0;      // Extra space on sides
    const heightMargin = 1;     // Extra space above/below
    
    // Reset painting to show
    paintingToShow = null;
    // Grid artworks share ONE trigger box (their gridCenter + gridWidth/Height),
    // so we only run the trigger check for the first sub-canvas of each grid.
    const seenGridIds = new Set();

    // Check each painting using cube-based trigger
    paintings.forEach((painting) => {
      const gridId = painting.userData && painting.userData.gridId;
      let runTrigger = true;
      if (gridId) {
        if (seenGridIds.has(gridId)) runTrigger = false;
        else seenGridIds.add(gridId);
      }

      if (runTrigger) {
        // Grid: use unified block dimensions + center. Non-grid: mesh geometry.
        const paintingWidth = gridId ? painting.userData.gridWidth : painting.geometry.parameters.width;
        const paintingHeight = gridId ? painting.userData.gridHeight : painting.geometry.parameters.height;
        const cx = gridId ? painting.userData.gridCenter.x : painting.position.x;
        const cy = gridId ? painting.userData.gridCenter.y : painting.position.y;
        const cz = gridId ? painting.userData.gridCenter.z : painting.position.z;

        const relativePos = new THREE.Vector3(
          camera.position.x - cx,
          camera.position.y - cy,
          camera.position.z - cz
        );

        const rotationY = painting.rotation.y;
        let isInTrigger = false;

        if (Math.abs(rotationY) < 0.01 || Math.abs(rotationY - Math.PI * 2) < 0.01) {
          // Front wall (rotation 0): depth is Z-axis (positive Z is in front)
          isInTrigger = Math.abs(relativePos.x) < (paintingWidth / 2 + widthMargin) &&
                       Math.abs(relativePos.y) < (paintingHeight / 2 + heightMargin) &&
                       relativePos.z > 0 && relativePos.z < depthThreshold;
        } else if (Math.abs(rotationY - Math.PI) < 0.01) {
          // Back wall (rotation 180°): depth is Z-axis (negative Z is in front)
          isInTrigger = Math.abs(relativePos.x) < (paintingWidth / 2 + widthMargin) &&
                       Math.abs(relativePos.y) < (paintingHeight / 2 + heightMargin) &&
                       relativePos.z < 0 && Math.abs(relativePos.z) < depthThreshold;
        } else if (Math.abs(rotationY - Math.PI / 2) < 0.01) {
          // Left wall (rotation 90°): depth is X-axis (positive X is in front)
          isInTrigger = Math.abs(relativePos.z) < (paintingWidth / 2 + widthMargin) &&
                       Math.abs(relativePos.y) < (paintingHeight / 2 + heightMargin) &&
                       relativePos.x > 0 && relativePos.x < depthThreshold;
        } else if (Math.abs(rotationY + Math.PI / 2) < 0.01) {
          // Right wall (rotation -90°): depth is X-axis (negative X is in front)
          isInTrigger = Math.abs(relativePos.z) < (paintingWidth / 2 + widthMargin) &&
                       Math.abs(relativePos.y) < (paintingHeight / 2 + heightMargin) &&
                       relativePos.x < 0 && Math.abs(relativePos.x) < depthThreshold;
        }

        if (isInTrigger) {
          paintingToShow = painting;
        }
      }
      
      // Calculate distance to painting for performance optimization
      const distanceToPainting = camera.position.distanceTo(painting.position);
      
      // Optimize: Only update texture quality every 3 frames (skip on mobile for better performance)
      // Skip distance-based filter changes for VideoTexture (no mipmaps; wrong filter breaks look)
      if (!isMobile && frameCount % 3 === 0 && !painting.userData.isVideoTexture) {
        painting.visible = true;

        if (distanceToPainting > 20) {
          if (painting.material && painting.material.length) {
            painting.material.forEach((mat) => {
              if (mat.map) {
                mat.map.minFilter = THREE.NearestFilter;
              }
            });
          }
        } else {
          if (painting.material && painting.material.length) {
            painting.material.forEach((mat) => {
              if (mat.map) {
                mat.map.minFilter = THREE.LinearMipmapLinearFilter;
              }
            });
          }
        }
      }
    });

    // Statue trigger: welcome billboard only (no painting-info panel)
    if (models.statue && models.statue.userData && models.statue.userData.triggerBox) {
      const triggerBox = models.statue.userData.triggerBox;
      const relativePos = new THREE.Vector3(
        camera.position.x - triggerBox.position.x,
        camera.position.y - triggerBox.position.y,
        camera.position.z - triggerBox.position.z
      );

      const isInTrigger = Math.abs(relativePos.x) < triggerBox.width / 2 &&
                         Math.abs(relativePos.y) < triggerBox.height / 2 &&
                         Math.abs(relativePos.z) < triggerBox.depth / 2;

      if (models.statue.userData.billboardPlane) {
        models.statue.userData.billboardPlane.visible = isInTrigger;
      }
    }

    if (paintingToShow) {
      displayPaintingInfo(paintingToShow.userData.info);
    } else {
      hidePaintingInfo();
    }

    const audioFocusPainting =
      paintingToShow &&
      paintingToShow.userData.videoElement &&
      paintingToShow.userData.hasArtworkAudio
        ? paintingToShow
        : null;
    if (audioFocusPainting !== prevAudioFocusPainting) {
      if (prevAudioFocusPainting?.userData.videoElement) {
        prevAudioFocusPainting.userData.videoElement.muted = true;
      }
      if (audioFocusPainting) {
        const v = audioFocusPainting.userData.videoElement;
        v.muted = false;
        v.play().catch(() => {});
        if (bgMusicSuspendedForArtwork === null && backgroundMusic) {
          bgMusicSuspendedForArtwork = { wasPlaying: backgroundMusic.isPlaying };
          pauseMusic(backgroundMusic);
        }
      } else {
        if (bgMusicSuspendedForArtwork?.wasPlaying && backgroundMusic) {
          playMusic(backgroundMusic);
        }
        bgMusicSuspendedForArtwork = null;
      }
      prevAudioFocusPainting = audioFocusPainting;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  render();
};
