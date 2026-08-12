import * as THREE from "three";

export const setupFloor = (scene) => {
  const textureLoader = new THREE.TextureLoader();
  
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Load only essential textures (reduced from 5 to 3 to save texture units)
  const colorTexture = textureLoader.load(
    "floorTexture/Concrete031_1K-PNG_Color.png"
  );
  const normalTexture = textureLoader.load(
    "floorTexture/Concrete031_1K-PNG_NormalGL.png"
  );
  const roughnessTexture = textureLoader.load(
    "floorTexture/Concrete031_1K-PNG_Roughness.png"
  );

  // Set texture parameters
  const floorWidth = 80;
  const floorDepth = 40;
  const repeatX = floorWidth / 40;  // Adjust divisor to control tile size
  const repeatY = floorDepth / 40;  // Adjust divisor to control tile size
  
  // Performance optimizations for all textures
  const textures = [colorTexture, normalTexture, roughnessTexture];
  textures.forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2; // Lower anisotropy on mobile
  });
  
  colorTexture.colorSpace = THREE.SRGBColorSpace; // Color texture should be in sRGB

  const planeGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: colorTexture,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    side: THREE.DoubleSide,
  });

  const floorPlane = new THREE.Mesh(planeGeometry, planeMaterial);

  floorPlane.rotation.x = Math.PI / 2;
  floorPlane.position.y = -Math.PI;

  scene.add(floorPlane);
  
  return floorPlane; // Return floor mesh for raycasting
};
