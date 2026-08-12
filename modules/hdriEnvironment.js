import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { PMREMGenerator } from "three/src/extras/PMREMGenerator.js";

/** Vite serves `public/` at site root — same path as TextureLoader URLs */
export const DEFAULT_CLOUDY_HDRI_PATH = "/HDRI/cloudySky/DaySkyHDRI021B_1K_HDR.exr";

/**
 * Equirect EXR HDR: visible sky (`scene.background`) + IBL (`scene.environment` for Std/Mat materials).
 */
export function loadHDRIEnvironment(scene, renderer, hdriUrl = DEFAULT_CLOUDY_HDRI_PATH) {
  const pmrem = new PMREMGenerator(renderer);

  const loader = new EXRLoader();
  loader.load(
    hdriUrl,
    (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;

      scene.background = tex;

      const target = pmrem.fromEquirectangular(tex);
      scene.environment = target.texture;

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;

      pmrem.dispose();
    },
    undefined,
    (err) => {
      console.warn("HDRI failed, skipping env map:", hdriUrl, err);
      pmrem.dispose();
    }
  );
}
