import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { PMREMGenerator } from "three/src/extras/PMREMGenerator.js";

/** Vite serves `public/` at site root — same path as TextureLoader URLs */
export const DEFAULT_HDRI_PATH = "/HDRI/nightEnvironment/NightEnvironmentHDRI001_1K_HDR.exr";

// ===== Lighting / color tuning knobs (adjust to taste) =====
/** Overall brightness after the HDRI loads. Higher = brighter scene. */
export const TONEMAP_EXPOSURE = 1.5;
/**
 * How strongly the HDRI lights & tints materials (image-based lighting).
 * This night HDRI is warm/yellow, so LOWER this to reduce the yellow cast on
 * the scene — the neutral white ambient + spotlights then dominate.
 * 1 = full HDRI influence, 0 = none (metal walls would stop reflecting the sky).
 */
export const ENVIRONMENT_INTENSITY = 0.15;
/** Brightness of the visible sky background. Lower to dim the yellow sky. */
export const BACKGROUND_INTENSITY = 1.0;

/**
 * Equirect EXR HDR: visible sky (`scene.background`) + IBL (`scene.environment` for Std/Mat materials).
 */
export function loadHDRIEnvironment(scene, renderer, hdriUrl = DEFAULT_HDRI_PATH) {
  const pmrem = new PMREMGenerator(renderer);

  const loader = new EXRLoader();
  loader.load(
    hdriUrl,
    (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;

      scene.background = tex;
      scene.backgroundIntensity = BACKGROUND_INTENSITY;

      const target = pmrem.fromEquirectangular(tex);
      scene.environment = target.texture;
      // Scale down the warm HDRI's influence so the scene isn't overly yellow.
      scene.environmentIntensity = ENVIRONMENT_INTENSITY;

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = TONEMAP_EXPOSURE;

      pmrem.dispose();
    },
    undefined,
    (err) => {
      console.warn("HDRI failed, skipping env map:", hdriUrl, err);
      pmrem.dispose();
    }
  );
}
