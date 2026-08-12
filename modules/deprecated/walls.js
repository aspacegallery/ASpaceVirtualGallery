import * as THREE from "three";

export function createWalls(scene, textureLoader) {
  let wallGroup = new THREE.Group();
  scene.add(wallGroup);
  
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const normalTexture = textureLoader.load(
    "wallTexture/leather_white_nor_gl_4k.jpg"
  );
  const roughnessTexture = textureLoader.load(
    "wallTexture/leather_white_rough_4k.jpg"
  );

  // Wall dimensions
  const wallWidth = 80;
  const wallHeight = 20;
  const sideWallWidth = 40; // Left and right walls (room depth)
  
  // Calculate texture repeat (adjust divisor to control tile size)
  const repeatX = wallWidth / 10;   // Horizontal repeat
  const repeatY = wallHeight / 10;  // Vertical repeat
  const sideRepeatX = sideWallWidth / 10; // Side walls horizontal repeat

  // Performance optimizations for wall textures
  normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.repeat.set(repeatX, repeatY);
  normalTexture.generateMipmaps = true;
  normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
  normalTexture.anisotropy = isMobile ? 1 : 2; // Lower anisotropy on mobile
  
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.repeat.set(repeatX, repeatY);
  roughnessTexture.generateMipmaps = true;
  roughnessTexture.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessTexture.anisotropy = isMobile ? 1 : 2; // Lower anisotropy on mobile

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xadadae,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    side: THREE.DoubleSide,
  });
  // Front Wall
  const frontWall = new THREE.Mesh( 
    new THREE.BoxGeometry(wallWidth, wallHeight, 0.001), 
    wallMaterial 
  );

  frontWall.position.z = -20; 

  // Left Wall
  const leftWallMaterial = new THREE.MeshStandardMaterial({
    color: 0xadadae,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    side: THREE.DoubleSide,
  });
  
  // Set different texture repeat for side walls
  const leftNormalTexture = normalTexture.clone();
  const leftRoughnessTexture = roughnessTexture.clone();
  leftNormalTexture.wrapS = leftNormalTexture.wrapT = THREE.RepeatWrapping;
  leftNormalTexture.repeat.set(sideRepeatX, repeatY);
  leftRoughnessTexture.wrapS = leftRoughnessTexture.wrapT = THREE.RepeatWrapping;
  leftRoughnessTexture.repeat.set(sideRepeatX, repeatY);
  
  leftWallMaterial.normalMap = leftNormalTexture;
  leftWallMaterial.roughnessMap = leftRoughnessTexture;
  
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(sideWallWidth, wallHeight, 0.001), 
    leftWallMaterial
  );

  leftWall.rotation.y = Math.PI / 2; 
  leftWall.position.x = -40; 

  // Right Wall
  const rightWallMaterial = new THREE.MeshStandardMaterial({
    color: 0xadadae,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    side: THREE.DoubleSide,
  });
  
  // Set different texture repeat for side walls
  const rightNormalTexture = normalTexture.clone();
  const rightRoughnessTexture = roughnessTexture.clone();
  rightNormalTexture.wrapS = rightNormalTexture.wrapT = THREE.RepeatWrapping;
  rightNormalTexture.repeat.set(sideRepeatX, repeatY);
  rightRoughnessTexture.wrapS = rightRoughnessTexture.wrapT = THREE.RepeatWrapping;
  rightRoughnessTexture.repeat.set(sideRepeatX, repeatY);
  
  rightWallMaterial.normalMap = rightNormalTexture;
  rightWallMaterial.roughnessMap = rightRoughnessTexture;
  
  const rightWall = new THREE.Mesh( 
    new THREE.BoxGeometry(sideWallWidth, wallHeight, 0.001), 
    rightWallMaterial
  );

  rightWall.position.x = 40;
  rightWall.rotation.y = Math.PI / 2; 

  // Back Wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallWidth, wallHeight, 0.001),
    wallMaterial 
  );
  backWall.position.z = 20;

  wallGroup.add(frontWall, backWall, leftWall, rightWall);

  return wallGroup;
}
