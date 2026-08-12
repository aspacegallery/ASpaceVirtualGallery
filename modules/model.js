// model.js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

// Detect mobile for performance optimizations
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function createWelcomeBillboardTexture() {
  const W = 1024;
  const H = 768;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0004ff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('Hi! Welcome to', W / 2, H / 2 - 52);
  ctx.fillText('A Space Virtual Gallery', W / 2, H / 2 + 52);
  ctx.fillText('👁️👄👁️💧', W / 2, H / 2 + 180);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export const loadStatueModel = (scene, onLoad) => {
  const loader = new GLTFLoader();

  loader.load(
    "/models/statue/manSitting.glb",
    (gltf) => {
      const statue = gltf.scene;

      // console.log("STATUE", gltf);

      // Position the statue at the center of the floor
      statue.position.set(37, -3.2, -16);

      // Scale if necessary
      statue.scale.set(5, 5, 5);

      // Rotate (in degrees)
      statue.rotation.y = THREE.MathUtils.degToRad(150);

      // Iterate through all the meshes in the statue and update their materials
      statue.traverse((child) => {
        if (child.isMesh) {
          map: child.material.map,
            // Modify child.material here to improve appearance
            (child.material.metalness = 0.0),
            (child.material.roughness = 0.7),
            // Cast shadow (disabled on mobile)
            (child.castShadow = !isMobile);

          // console.log("Statue Material:", child.material);
        }
      });

      // Store metadata for trigger system
      statue.userData = {
        type: 'statue',
        info: {
          title: 'Man Sitting',
          artist: 'Unknown Artist',
          description: 'A contemplative sculpture of a seated figure.'
        },
        triggerBox: {
          width: 7,
          height: 15,
          depth: 8,
          position: statue.position.clone()
        }
      };

      // Add the statue to the scene
      scene.add(statue);

      // Create 2x2 plane next to the statue
      const planeGeometry = new THREE.PlaneGeometry(2, 1.5);
      const welcomeMap = createWelcomeBillboardTexture();
      const planeMaterial = new THREE.MeshBasicMaterial({
        map: welcomeMap,
        side: THREE.DoubleSide,
      });
      
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.position.set(
        statue.position.x + 1.5, // 3 units to the right
        statue.position.y + 4.5, // 1 unit above statue base
        statue.position.z
      );
      plane.name = 'billboardPlane'; // Name it for easy identification
      plane.visible = false; // Initially hidden
      scene.add(plane);

      // Store plane reference in statue userData
      statue.userData.billboardPlane = plane;

      // Call the callback with the loaded statue
      if (onLoad) onLoad(statue);
    },
    undefined,
    (error) => {
      console.error("An error occurred while loading the model.", error);
    }
  );
};

export const loadRockingHorseModel = (scene) => {
  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();

  mtlLoader.setPath('/models/rockingHorse/');
  mtlLoader.load(
    'Rocking%20Horse.mtl',
    (materials) => {
      materials.preload();

      Object.values(materials.materials).forEach((material) => {
        material.metalness = 0;
        material.roughness = 1;
      });

      objLoader.setMaterials(materials);
      objLoader.setPath('/models/rockingHorse/');
      objLoader.load(
        'Rocking%20Horse.obj',
        (horse) => {
          horse.position.set(-15, -3.5, 5);
          horse.scale.set(1.7, 1.7, 1.7);
          horse.rotation.x = THREE.MathUtils.degToRad(20);
          horse.rotation.y = THREE.MathUtils.degToRad(45);
          horse.rotation.z = THREE.MathUtils.degToRad(10);

          horse.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = !isMobile;
              child.receiveShadow = !isMobile;
            }
          });

          scene.add(horse);
          console.log('Rocking horse loaded successfully');
        },
        undefined,
        (error) => {
          console.error('An error occurred while loading the rocking horse OBJ.', error);
        }
      );
    },
    undefined,
    (error) => {
      console.error('An error occurred while loading the rocking horse materials.', error);
    }
  );
};

/**
 * Generic OBJ + MTL loader for scene props (furniture etc.).
 * @param {THREE.Scene} scene
 * @param {Object} cfg
 * @param {string} cfg.basePath   - folder containing the .mtl and .obj (with trailing slash)
 * @param {string} cfg.mtlName    - MTL filename (URL-encode spaces as %20)
 * @param {string} cfg.objName    - OBJ filename (URL-encode spaces as %20)
 * @param {number[]} [cfg.position=[0,-3.2,0]]
 * @param {number|number[]} [cfg.scale=1]        - uniform, or [x,y,z]
 * @param {number} [cfg.rotationY=0]             - degrees (legacy — use `rotation` for full 3-axis)
 * @param {number[]} [cfg.rotation]              - [x, y, z] degrees; overrides rotationY when set
 * @param {string} [cfg.name='model']            - console log label
 * @param {boolean} [cfg.wireframe=false]        - draw a cube outline around the model's bounding box
 * @param {number} [cfg.wireframeColor=0x000000] - outline color
 * @param {(obj: THREE.Object3D) => void} [cfg.onLoad]
 */
export const loadOBJMTL = (scene, cfg) => {
  const {
    basePath,
    mtlName,
    objName,
    position = [0, -3.2, 0],
    scale = 1,
    rotationY = 0,
    rotation,
    name = 'model',
    wireframe = false,
    wireframeColor = 0x000000,
    onLoad,
  } = cfg;

  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();

  mtlLoader.setPath(basePath);
  mtlLoader.load(
    mtlName,
    (materials) => {
      materials.preload();
      Object.values(materials.materials).forEach((material) => {
        material.metalness = 0;
        material.roughness = 1;
      });

      objLoader.setMaterials(materials);
      objLoader.setPath(basePath);
      objLoader.load(
        objName,
        (object) => {
          object.position.set(position[0], position[1], position[2]);
          const s = Array.isArray(scale) ? scale : [scale, scale, scale];
          object.scale.set(s[0], s[1], s[2]);
          const rot = Array.isArray(rotation) ? rotation : [0, rotationY, 0];
          object.rotation.set(
            THREE.MathUtils.degToRad(rot[0]),
            THREE.MathUtils.degToRad(rot[1]),
            THREE.MathUtils.degToRad(rot[2])
          );

          object.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = !isMobile;
              child.receiveShadow = !isMobile;
            }
          });

          scene.add(object);

          // Outer cube outline around the whole object (bounding box)
          if (wireframe) {
            const bbox = new THREE.Box3().setFromObject(object);
            const helper = new THREE.Box3Helper(bbox, wireframeColor);
            scene.add(helper);
          }

          console.log(`✓ Loaded ${name}`);
          if (onLoad) onLoad(object);
        },
        undefined,
        (error) => console.error(`Error loading ${name} OBJ`, error)
      );
    },
    undefined,
    (error) => console.error(`Error loading ${name} MTL`, error)
  );
};

export const loadFireExtinguisherModel = (scene) => {
  const mtlLoader = new MTLLoader();
  const objLoader = new OBJLoader();

  // Load MTL file first
  mtlLoader.load(
    "/models/fireExtinguisher/fireExtinguisher.mtl",
    (materials) => {
      materials.preload();
      
      // Set materials to use flat shading
      Object.values(materials.materials).forEach((material) => {
        material.metalness = 0;
        material.roughness = 1;
      });

      // Set the materials for the OBJ loader
      objLoader.setMaterials(materials);

      // Now load the OBJ file with the materials
      objLoader.load(
        "/models/fireExtinguisher/fireExtinguisher.obj",
        (object) => {
          // Position the fire extinguisher
          object.position.set(-39, -3.2, -19);  // Adjust position as needed

          // Scale if necessary
          object.scale.set(0.02, 0.02, 0.02);  // Adjust scale as needed

          // Rotate (in degrees)
          object.rotation.y = THREE.MathUtils.degToRad(0);

          // Setup shadows
          object.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = !isMobile; // Disabled on mobile
              child.receiveShadow = !isMobile;
            }
          });

          // Add the fire extinguisher to the scene
          scene.add(object);
          console.log("Fire extinguisher loaded successfully");
        },
        undefined,
        (error) => {
          console.error("An error occurred while loading the fire extinguisher.", error);
        }
      );
    },
    undefined,
    (error) => {
      console.error("An error occurred while loading the fire extinguisher materials.", error);
    }
  );
};

export const loadWineBottles = (scene) => {
  const objLoader = new OBJLoader();
  const textureLoader = new THREE.TextureLoader();

  // Wine bottle configurations (rotation in degrees)
  const wineBottles = [
    { name: 'wineBottle01', position: { x: 36, y: -3.2, z: -18 }, rotation: { x: 0, y: -20, z: 0 }, scale: 2.8 },
    { name: 'wineBottle02', position: { x: 35.5, y: -3.2, z: -17.6 }, rotation: { x: 0, y: 20, z: 0 }, scale: 2.8 },
    { name: 'wineBottle03', position: { x: 35.3, y: -3.2, z: -16.9 }, rotation: { x: 0, y: -15, z: 0 }, scale: 2.8 },
    { name: 'wineBottle04', position: { x: 35.5, y: -3, z: -16 }, rotation: { x: 90, y: 0, z: -20 }, scale: 2.8 },
    { name: 'wineBottle05', position: { x: 39, y: -3.2, z: -16.5 }, rotation: { x: 0, y: -25, z: 0 }, scale: 2.8 },
    { name: 'wineBottle06', position: { x: 38.5, y: -3.2, z: -16 }, rotation: { x: 0, y: 60, z: 0 }, scale: 2.8 },
  ];

  // Load each wine bottle
  wineBottles.forEach((bottleConfig) => {
    // Load texture first
    const texture = textureLoader.load(
      `/models/wineBottles/${bottleConfig.name}Texture.png`,
      () => {
        console.log(`✓ Loaded texture for ${bottleConfig.name}`);
      },
      undefined,
      (error) => {
        console.error(`Error loading texture for ${bottleConfig.name}:`, error);
      }
    );

    // Configure texture with performance optimizations
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2; // Reduced for GPU texture unit limit

    // Load OBJ file
    objLoader.load(
      `/models/wineBottles/${bottleConfig.name}.obj`,
      (object) => {
        // Apply texture to all meshes
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              metalness: 0,
              roughness: 1,
              side: THREE.DoubleSide
            });
            child.castShadow = !isMobile; // Disabled on mobile
            child.receiveShadow = !isMobile;
          }
        });

        // Position the wine bottle
        object.position.set(
          bottleConfig.position.x,
          bottleConfig.position.y,
          bottleConfig.position.z
        );

        // Scale
        object.scale.set(
          bottleConfig.scale,
          bottleConfig.scale,
          bottleConfig.scale
        );

        // Rotate on all three axes (convert degrees to radians)
        object.rotation.x = THREE.MathUtils.degToRad(bottleConfig.rotation.x);
        object.rotation.y = THREE.MathUtils.degToRad(bottleConfig.rotation.y);
        object.rotation.z = THREE.MathUtils.degToRad(bottleConfig.rotation.z);

        // Add to the scene
        scene.add(object);
        console.log(`${bottleConfig.name} loaded successfully with texture`);
      },
      undefined,
      (error) => {
        console.error(`An error occurred while loading ${bottleConfig.name}:`, error);
      }
    );
  });
};
