import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

export const scene = new THREE.Scene(); // create a scene
let camera;
let controls;
let renderer;

export const setupScene = () => {
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  // PerspectiveCamera is a type of camera that mimics the way the human eye sees things. It takes 4 parameters: field of view, aspect ratio, near clipping plane, and far clipping plane. The field of view is the extent of the scene that is seen on the display at any given moment. The aspect ratio should be the width of the element divided by the height (in this case, the screen width and height). The camera will not render objects that are closer to the camera than the near clipping plane or further away than the far clipping plane. Objects that are exactly on the clipping plane will not be rendered.
  camera = new THREE.PerspectiveCamera(
    60, // fov = field of view
    window.innerWidth / window.innerHeight, // aspect ratio
    0.1, // near clipping plane
    isMobile ? 100 : 1000 // Reduced far plane on mobile - don't render distant objects
  );
  scene.add(camera); // add the camera to the scene
  camera.position.set(0, 2, 5); // move the camera up 3 units in the Y axis

  renderer = new THREE.WebGLRenderer({ 
    antialias: false,
    powerPreference: "high-performance", // Use GPU for better performance
    stencil: false, // Disable stencil buffer if not needed
    preserveDrawingBuffer: true // Keep buffer so canvas.toDataURL() works (camera screenshot)
  });
  
  // Internal resolution - much lower on mobile for better performance
  let INTERNAL_W, INTERNAL_H;
  if (isMobile) {
    // Mobile: 640x360 (360p) - 4x fewer pixels for much better FPS
    INTERNAL_W = 640;
    INTERNAL_H = 360;
    console.log('📱 Mobile detected - using 360p rendering for optimal performance');
  } else {
    // Desktop: 1280x720 (720p)
    INTERNAL_W = 1280;
    INTERNAL_H = 720;
    console.log('🖥️ Desktop detected - using 720p rendering');
  }
  
  renderer.setSize(INTERNAL_W, INTERNAL_H, false);
  renderer.setClearColor(0xffffff, 1);
  // Note: Canvas will be appended by React component, not here

  // Upscale canvas with smooth scaling to keep artworks clear
  Object.assign(renderer.domElement.style, {
    width: window.innerWidth + 'px',
    height: window.innerHeight + 'px',
    imageRendering: 'auto',  // smooth upscaling keeps artworks readable
  });

  // Set output color space for proper color rendering in Three.js v152+
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // Shadow optimizations - disable on mobile for better performance
  renderer.shadowMap.enabled = !isMobile; // Disabled on mobile
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true; // Only update shadows when needed

  controls = new PointerLockControls(camera, renderer.domElement); // create a PointerLockControls object that takes the camera and the renderer's domElement as arguments. PointerLockControls is a class that allows the camera to be controlled by the mouse and keyboard.
  // Note: In Three.js 0.181+, controls work directly with the camera. No need to add controls to scene since camera is already added above.

  window.addEventListener("resize", onWindowResize, false); // add an event listener to the window that calls the onWindowResize function when the window is resized. Its work is to update the camera's aspect ratio and the renderer's size. The third parameter is set to false to indicate that the event listener should be triggered in the bubbling phase instead of the capturing phase. The bubbling phase is when the event bubbles up from the target element to the parent elements. The capturing phase is when the event trickles down from the parent elements to the target element. The default value is false, so we don't need to include it, but I included it for clarity. The capturing phase is rarely used, so you can ignore it for now. You can read more about the capturing and bubbling phases here: https://javascript.info/bubbling-and-capturing

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight; // update the camera's aspect ratio
    camera.updateProjectionMatrix(); // update the camera's projection matrix. The projection matrix is used to determine how 3D points are mapped to the 2D space of the screen. It is used to calculate the frustum of the camera which is a truncated pyramid that represents the camera's field of view. Anything outside the frustum is not rendered. The projection matrix is used to calculate the frustum every time the window is resized.
    
    // Update CSS size only (keep internal resolution low for performance)
    renderer.domElement.style.width = window.innerWidth + 'px';
    renderer.domElement.style.height = window.innerHeight + 'px';
  }

  return { camera, controls, renderer }; // return the camera, controls, and renderer so that they can be used in other modules
};
