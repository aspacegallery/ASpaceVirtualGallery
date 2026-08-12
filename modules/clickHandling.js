import * as THREE from 'three';

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function clickHandling(renderer, camera, paintings) {
  // Handle mouse clicks (desktop)
  renderer.domElement.addEventListener(
    'mousedown',
    (event) => {
      // Only handle left-clicks (button 0), ignore right-clicks (button 2)
      if (event.button !== 0) {
        return;
      }
      
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      onClick(camera, paintings);
    },
    false
  );

  // Handle touch events (mobile)
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  
  renderer.domElement.addEventListener('touchstart', (event) => {
    touchStartTime = Date.now();
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }
  }, { passive: true });
  
  renderer.domElement.addEventListener('touchend', (event) => {
    if (event.touches.length > 0) return; // Only handle single finger
    
    const touchDuration = Date.now() - touchStartTime;
    const touch = event.changedTouches[0];
    const touchMoved = Math.sqrt(
      Math.pow(touch.clientX - touchStartX, 2) + 
      Math.pow(touch.clientY - touchStartY, 2)
    );
    
    // If it was a quick tap (not a swipe)
    if (touchDuration < 300 && touchMoved < 20) {
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      
      // Check if we hit a painting
      const didClickPainting = onClick(camera, paintings);
      
      // Store result globally so tap-to-move can check it
      window.lastTapHitPainting = didClickPainting;
    }
  }, { passive: true });
}

function onClick(camera, paintings) {
  raycaster.setFromCamera(mouse, camera);

  // Recursive so we can hit child meshes (e.g. inside a GLB attached to a painting wrapper).
  const intersects = raycaster.intersectObjects(paintings, true);

  if (intersects.length > 0) {
    let painting = intersects[0].object;
    while (painting && !(painting.userData && painting.userData.info)) {
      painting = painting.parent;
    }

    if (painting && painting.userData.info) {
      console.log('Clicked painting:', painting.userData.info.title);
      if (painting.userData.info.link) {
        window.open(painting.userData.info.link, '_blank');
      }
      return true;
    }
  }
  return false;
}

export { clickHandling };
