import * as THREE from "three";

// create a function that takes a scene and a textureLoader as arguments that will be passed in from main.js where the createCeiling is called
export const createCeiling = (scene, textureLoader) => {
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  // Load only essential textures (reduced from 7 to 3 to save texture units)
  const colorTexture = textureLoader.load(
    "ceilingTexture/OfficeCeiling004_1K-JPG_Color.jpg"
  );
  const normalGLTexture = textureLoader.load(
    "ceilingTexture/OfficeCeiling004_1K-JPG_NormalGL.jpg"
  );
  const roughnessTexture = textureLoader.load(
    "ceilingTexture/OfficeCeiling004_1K-JPG_Roughness.jpg"
  );

  // Set texture parameters
  const ceilingWidth = 80;
  const ceilingDepth = 40;
  const repeatX = ceilingWidth / 40;  // Adjust divisor to control tile size
  const repeatY = ceilingDepth / 40;  // Adjust divisor to control tile size
  
  // Performance optimizations for all textures
  const textures = [colorTexture, normalGLTexture, roughnessTexture];
  textures.forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2; // Lower anisotropy on mobile
  });
  
  colorTexture.colorSpace = THREE.SRGBColorSpace; // Color texture should be in sRGB

  const ceilingGeometry = new THREE.PlaneGeometry(ceilingWidth, ceilingDepth);
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: colorTexture,
    normalMap: normalGLTexture,
    normalMapType: THREE.TangentSpaceNormalMap,
    roughnessMap: roughnessTexture,
    metalness: 0.0, // Non-metallic surface
    roughness: 1.0, // Fully rough/matte
    side: THREE.DoubleSide,
  });
  const ceilingPlane = new THREE.Mesh(ceilingGeometry, ceilingMaterial);

  ceilingPlane.rotation.x = Math.PI / 2;

  ceilingPlane.position.y = 10;

  scene.add(ceilingPlane);
};
