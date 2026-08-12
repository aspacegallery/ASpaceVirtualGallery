import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { loadPaintingData } from './paintingData.js';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
const MODEL_EXT = /\.(glb|gltf)(\?.*)?$/i;

function isVideoSrc(src) {
  return VIDEO_EXT.test(src);
}

function isModelSrc(src) {
  return MODEL_EXT.test(src);
}

const gltfLoader = new GLTFLoader();

/**
 * Loads a GLB/GLTF model and attaches it to the given painting wrapper mesh.
 * The model is uniformly scaled to fit the declared width x height (preserving
 * aspect ratio) and positioned so its back face sits on the front of the
 * wrapper box, extending outward from the wall.
 */
function attachModelToPainting(painting, src, paintingDepth, targetWidth, targetHeight, isMobile, modelRotation) {
  gltfLoader.load(
    src,
    (gltf) => {
      const model = gltf.scene;

      // Optional per-artwork rotation (degrees). Accepts a number (Y axis only)
      // or { x, y, z }. Applied on a wrapper so it doesn't fight bbox math.
      const rot = { x: 0, y: 0, z: 0 };
      if (typeof modelRotation === 'number') {
        rot.y = modelRotation;
      } else if (modelRotation && typeof modelRotation === 'object') {
        rot.x = modelRotation.x || 0;
        rot.y = modelRotation.y || 0;
        rot.z = modelRotation.z || 0;
      }

      const wrapper = new THREE.Group();
      wrapper.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z)
      );
      wrapper.add(model);

      // Bounding box of the (rotated) model in world-equivalent local space.
      const box = new THREE.Box3().setFromObject(wrapper);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      if (size.x === 0 || size.y === 0) {
        console.warn('[Model] zero-sized bounding box for', src);
        painting.add(wrapper);
        return;
      }

      const scale = Math.min(targetWidth / size.x, targetHeight / size.y);
      wrapper.scale.setScalar(scale);

      // Re-center the wrapper so its bbox is at the origin, then push it
      // forward so the back face aligns with the front of the painting box.
      wrapper.position.x = -center.x * scale;
      wrapper.position.y = -center.y * scale;
      wrapper.position.z = -center.z * scale + paintingDepth / 2 + (size.z * scale) / 2;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = !isMobile;
          child.receiveShadow = !isMobile;
        }
      });

      painting.add(wrapper);
    },
    undefined,
    (err) => console.error('[Model] failed to load', src, err)
  );
}

function mediaErrorMessage(video) {
  const e = video.error;
  if (!e) return '(no MediaError)';
  const codes = {
    1: 'MEDIA_ERR_ABORTED',
    2: 'MEDIA_ERR_NETWORK',
    3: 'MEDIA_ERR_DECODE',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
  };
  return `${codes[e.code] || 'UNKNOWN'} (${e.code}) ${e.message || ''}`.trim();
}

function readyStateLabel(n) {
  const labels = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  return labels[n] ?? String(n);
}

/** Debug logging for intermittent black VideoTextures (chatty events logged once per element) */
function createVideoTexture(src, meta = {}) {
  const title = meta.title ?? '(no title)';
  const idx = meta.index ?? '?';
  const prefix = `[VideoTexture #${idx}]`;

  const log = (msg, extra) => {
    if (extra !== undefined) console.log(prefix, title, `| ${src}`, msg, extra);
    else console.log(prefix, title, `| ${src}`, msg);
  };
  const warn = (msg, extra) => {
    if (extra !== undefined) console.warn(prefix, title, `| ${src}`, msg, extra);
    else console.warn(prefix, title, `| ${src}`, msg);
  };
  const err = (msg, extra) => {
    if (extra !== undefined) console.error(prefix, title, `| ${src}`, msg, extra);
    else console.error(prefix, title, `| ${src}`, msg);
  };

  const once = { suspend: false, waiting: false, stalled: false };
  const logOnce = (key, level, msg, extra) => {
    if (once[key]) return;
    once[key] = true;
    const note = ' (logged once; browser may repeat)';
    if (level === 'warn') warn(msg + note, extra);
    else log(msg + note, extra);
  };

  log('creating element');

  const video = document.createElement('video');
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.preload = 'auto';

  // Mobile Chrome/Safari frequently fail to decode video frames when the
  // <video> element is not attached to the DOM. Park them in a hidden host so
  // the browser treats them as live elements while still rendering nothing.
  let host = document.getElementById('video-texture-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'video-texture-host';
    host.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;';
    document.body.appendChild(host);
  }
  host.appendChild(video);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  const snapshot = () => ({
    readyState: readyStateLabel(video.readyState),
    networkState: video.networkState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    currentSrc: video.currentSrc || video.src,
  });

  let sawMetadata = false;

  video.addEventListener('loadstart', () => log('loadstart'));
  video.addEventListener('loadedmetadata', () => {
    sawMetadata = true;
    log('loadedmetadata', snapshot());
  });
  video.addEventListener('canplay', () => log('canplay (enough to start)', snapshot()));
  video.addEventListener('playing', () => log('playing'));
  video.addEventListener('stalled', () =>
    logOnce('stalled', 'warn', 'stalled (buffer stalled — often network or too many <video>)')
  );
  video.addEventListener('waiting', () =>
    logOnce('waiting', 'warn', 'waiting (rebuffering)')
  );
  video.addEventListener('suspend', () =>
    logOnce(
      'suspend',
      'log',
      'suspend (browser paused loading/decoding — common with many concurrent videos)'
    )
  );
  video.addEventListener('abort', () => warn('abort'));
  video.addEventListener('error', () => {
    err('error', {
      mediaError: mediaErrorMessage(video),
      networkState: video.networkState,
      currentSrc: video.currentSrc || video.src,
    });
  });

  const tryPlay = () => {
    video
      .play()
      .then(() => log('play() ok', snapshot()))
      .catch((e) => err('play() rejected (autoplay policy or decode)', e?.message || e));
  };
  video.addEventListener('canplay', tryPlay, { once: true });

  // Mobile fallback: if autoplay was rejected (common on mobile Chrome before
  // any user gesture), retry play() on the first user interaction.
  const gestureRetry = () => {
    if (video.paused) {
      video
        .play()
        .then(() => log('play() ok after gesture', snapshot()))
        .catch(() => {});
    }
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, gestureRetry, { once: false, passive: true })
  );

  const watchdogMs = 25000;
  setTimeout(() => {
    if (video.error) return;
    if (video.readyState < 2) {
      warn(`no frame after ${watchdogMs}ms`, {
        ...snapshot(),
        sawMetadata,
        paused: video.paused,
        hint: sawMetadata
          ? 'had metadata but still no frame data — decode/bandwidth contention'
          : 'never reached loadedmetadata — check URL, network, or format',
      });
    }
  }, watchdogMs);

  return { texture, video };
}

export async function createPaintings(scene, textureLoader, roomConfig) {
 
  let paintings = [];

  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Load painting data from JSON
  const paintingData = await loadPaintingData(roomConfig);

  const videoEntries = paintingData.filter((d) => isVideoSrc(d.imgSrc));
  if (videoEntries.length > 0) {
    console.log(
      '[VideoTexture] loading',
      videoEntries.length,
      'video(s). Chatty events (suspend/waiting/stalled) log at most once each; 25s watchdog if still black.'
    );
  }

  paintingData.forEach((data) => {
    const useModel = isModelSrc(data.imgSrc);
    const useVideo = !useModel && isVideoSrc(data.imgSrc);
    let texture = null;
    let videoElement = null;
    if (useModel) {
      // Model is loaded async and attached as a child below; no texture needed.
    } else if (useVideo) {
      const { texture: vidTex, video } = createVideoTexture(data.imgSrc, {
        index: data.originalIndex,
        title: data.info?.title,
      });
      texture = vidTex;
      videoElement = video;
    } else {
      texture = textureLoader.load(data.imgSrc);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = isMobile ? 4 : 16;
    }

    let materials;
    if (useModel) {
      // Invisible wrapper: keeps geometry/position/rotation for the trigger
      // and click systems while letting the GLB itself be the visible artwork.
      const invisible = () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
      materials = [invisible(), invisible(), invisible(), invisible(), invisible(), invisible()];
    } else {
      // Front face: the artwork image. Other faces: white (sides/back of canvas).
      materials = [
        new THREE.MeshLambertMaterial({ color: 0xffffff }), // right side
        new THREE.MeshLambertMaterial({ color: 0xffffff }), // left side
        new THREE.MeshLambertMaterial({ color: 0xffffff }), // top
        new THREE.MeshLambertMaterial({ color: 0xffffff }), // bottom
        new THREE.MeshLambertMaterial({ map: texture }),     // front (artwork)
        new THREE.MeshLambertMaterial({ color: 0xffffff }), // back
      ];
    }
    
    const painting = new THREE.Mesh( 
      new THREE.BoxGeometry(data.width, data.height, data.depth),
      materials
    );

    // Position the painting so the back face is flush with the wall
    // Calculate offset based on wall rotation
    let offsetX = 0;
    let offsetZ = 0;
    
    if (data.rotationY === 0) {
      // Front wall - move forward (positive z)
      offsetZ = data.depth / 2;
    } else if (Math.abs(data.rotationY - Math.PI) < 0.01) {
      // Back wall - move forward (negative z)
      offsetZ = -data.depth / 2;
    } else if (Math.abs(data.rotationY - Math.PI / 2) < 0.01) {
      // Left wall - move forward (positive x)
      offsetX = data.depth / 2;
    } else if (Math.abs(data.rotationY + Math.PI / 2) < 0.01) {
      // Right wall - move forward (negative x)
      offsetX = -data.depth / 2;
    }

    painting.position.set(
      data.position.x + offsetX, 
      data.position.y, 
      data.position.z + offsetZ
    ); 
    painting.rotation.y = data.rotationY; 

    
    painting.userData = {
      type: 'painting',
      info: data.info,
      url: data.info.link,
      isVideoTexture: useVideo,
      isModel: useModel,
      videoElement,
      hasArtworkAudio: data.hasArtworkAudio,
      // Grid metadata (undefined for single-image artworks)
      gridId: data.gridId,
      gridWidth: data.gridWidth,
      gridHeight: data.gridHeight,
      gridCenter: data.gridCenter,
    };

    if (useModel) {
      attachModelToPainting(painting, data.imgSrc, data.depth, data.width, data.height, isMobile, data.modelRotation);
    }

    // Performance optimizations - disable shadows on mobile
    painting.castShadow = !isMobile; 
    painting.receiveShadow = !isMobile;
    painting.frustumCulled = true; // Don't render if outside camera view

    // Wireframe trigger box for visualization (uncomment to see trigger zones)
    // const depthThreshold = 6.5;
    // const widthMargin = 0;
    // const heightMargin = 1;
    // 
    // const triggerBoxGeometry = new THREE.BoxGeometry(
    //   data.width + widthMargin * 2,
    //   data.height + heightMargin * 2,
    //   depthThreshold
    // );
    // 
    // const triggerBoxMaterial = new THREE.MeshBasicMaterial({
    //   color: 0x00ff00,
    //   wireframe: true,
    //   transparent: true,
    //   opacity: 0.3
    // });
    // 
    // const triggerBox = new THREE.Mesh(triggerBoxGeometry, triggerBoxMaterial);
    // 
    // // Position trigger box: centered on painting, extending forward from wall
    // let triggerOffsetX = offsetX;
    // let triggerOffsetZ = offsetZ;
    // 
    // if (data.rotationY === 0) {
    //   // Front wall - extend forward in positive Z
    //   triggerOffsetZ += depthThreshold / 2;
    // } else if (Math.abs(data.rotationY - Math.PI) < 0.01) {
    //   // Back wall - extend forward in negative Z
    //   triggerOffsetZ -= depthThreshold / 2;
    // } else if (Math.abs(data.rotationY - Math.PI / 2) < 0.01) {
    //   // Left wall - extend forward in positive X
    //   triggerOffsetX += depthThreshold / 2;
    // } else if (Math.abs(data.rotationY + Math.PI / 2) < 0.01) {
    //   // Right wall - extend forward in negative X
    //   triggerOffsetX -= depthThreshold / 2;
    // }
    // 
    // triggerBox.position.set(
    //   data.position.x + triggerOffsetX,
    //   data.position.y,
    //   data.position.z + triggerOffsetZ
    // );
    // triggerBox.rotation.y = data.rotationY;
    // 
    // // Add trigger box to scene
    // scene.add(triggerBox);

    paintings.push(painting); 
  });

  return paintings; 
}
