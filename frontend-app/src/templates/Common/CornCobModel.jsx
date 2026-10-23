import { useEffect, useRef, useState } from 'react';
import fallbackPhoto from '../../assets/landing/field-decisions.jpg';

const MODEL_DIRECTORY = './models/maiz/';

function disposeMaterial(material) {
  const textures = new Set(Object.values(material).filter((value) => value?.isTexture));
  textures.forEach((texture) => texture.dispose());
  material.dispose();
}

function addNaturalGrainVariation(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      #ifdef USE_MAP
        // Restrict the variation to warm kernels; the pale husk keeps its original texture.
        float kernelWarmth = diffuseColor.r - diffuseColor.g;
        float kernelChroma = diffuseColor.r - diffuseColor.b;
        float kernelMask = smoothstep(0.22, 0.39, kernelWarmth)
          * smoothstep(0.42, 0.62, kernelChroma);
        vec2 kernelCell = floor(vMapUv * vec2(104.0, 104.0));
        float kernelSeed = fract(sin(dot(kernelCell, vec2(127.1, 311.7))) * 43758.5453);
        float paleKernel = 1.0 - smoothstep(0.06, 0.19, kernelSeed);
        float amberKernel = smoothstep(0.82, 0.96, kernelSeed);
        vec3 kernelTint = vec3(1.0);
        kernelTint = mix(kernelTint, vec3(1.05, 1.15, 1.22), paleKernel * 0.52);
        kernelTint = mix(kernelTint, vec3(1.03, 0.79, 0.71), amberKernel * 0.43);
        diffuseColor.rgb *= mix(vec3(1.0), kernelTint, kernelMask);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'zeasys-natural-kernel-colors-v1';
}

export default function CornCobModel() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let resizeObserver;
    let loadObserver;
    let renderer;
    let model;
    let detachControls = () => {};

    const initialise = async () => {
      try {
        const [THREE, { MTLLoader }, { OBJLoader }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/MTLLoader.js'),
          import('three/examples/jsm/loaders/OBJLoader.js'),
        ]);

        if (disposed) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0.08, 6.9);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.className = 'zeasys-corn-model-canvas';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xfff3da, 0x183b28, 1.65));
        const keyLight = new THREE.DirectionalLight(0xffe6ac, 3.1);
        keyLight.position.set(3.5, 4.5, 5);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xe3f4dc, 1.25);
        fillLight.position.set(-3, -1, 4);
        scene.add(fillLight);
        const rimLight = new THREE.DirectionalLight(0x8edb92, 2.15);
        rimLight.position.set(-4, 1.5, -2.5);
        scene.add(rimLight);

        const modelDirectory = new URL(MODEL_DIRECTORY, document.baseURI).href;
        const materialLoader = new MTLLoader();
        materialLoader.setPath(modelDirectory);
        materialLoader.setResourcePath(modelDirectory);
        const materials = await materialLoader.loadAsync('material.mtl');
        if (disposed) return;
        materials.preload();

        const objectLoader = new OBJLoader();
        objectLoader.setPath(modelDirectory);
        objectLoader.setMaterials(materials);
        model = await objectLoader.loadAsync('corn-cob.obj');
        if (disposed) return;

        const upgradedMaterials = new Map();
        model.traverse((child) => {
          if (!child.isMesh) return;
          if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
          const upgrade = (material) => {
            if (upgradedMaterials.has(material)) return upgradedMaterials.get(material);
            const colorMap = material.map;
            if (colorMap) {
              colorMap.colorSpace = THREE.SRGBColorSpace;
              colorMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            }
            const surface = new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              map: colorMap,
              roughness: 0.71,
              metalness: 0,
              clearcoat: 0.09,
              clearcoatRoughness: 0.8,
              bumpMap: colorMap,
              bumpScale: 0.025,
            });
            if (colorMap) addNaturalGrainVariation(surface);
            upgradedMaterials.set(material, surface);
            return surface;
          };
          child.material = Array.isArray(child.material)
            ? child.material.map(upgrade)
            : upgrade(child.material);
        });
        upgradedMaterials.forEach((surface, original) => {
          if (surface !== original) original.dispose();
        });

        const bounds = new THREE.Box3().setFromObject(model);
        const centre = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        model.position.sub(centre);
        model.scale.setScalar(3.5 / Math.max(size.y, 0.001));
        model.rotation.z = -0.29;
        model.rotation.x = 0.06;
        model.rotation.y = -0.58;
        scene.add(model);

        const renderScene = () => renderer.render(scene, camera);
        const resize = () => {
          if (!mount || !renderer) return;
          const width = Math.max(mount.clientWidth, 1);
          const height = Math.max(mount.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderScene();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        let dragging = false;
        let pointerId = null;
        let previousX = 0;
        let previousY = 0;
        let rotationX = model.rotation.x;
        let rotationY = model.rotation.y;

        const updateRotation = () => {
          model.rotation.x = rotationX;
          model.rotation.y = rotationY;
          renderScene();
        };
        const handlePointerDown = (event) => {
          dragging = true;
          pointerId = event.pointerId;
          previousX = event.clientX;
          previousY = event.clientY;
          mount.setPointerCapture?.(event.pointerId);
          mount.classList.add('is-dragging');
        };
        const handlePointerMove = (event) => {
          if (!dragging || event.pointerId !== pointerId) return;
          event.preventDefault();
          const deltaX = event.clientX - previousX;
          const deltaY = event.clientY - previousY;
          previousX = event.clientX;
          previousY = event.clientY;
          rotationY += deltaX * 0.012;
          rotationX = Math.max(-0.48, Math.min(0.48, rotationX + deltaY * 0.008));
          updateRotation();
        };
        const handlePointerEnd = (event) => {
          if (event.pointerId !== pointerId) return;
          dragging = false;
          pointerId = null;
          if (mount.hasPointerCapture?.(event.pointerId)) mount.releasePointerCapture(event.pointerId);
          mount.classList.remove('is-dragging');
        };
        const handleKeyDown = (event) => {
          const rotationStep = 0.14;
          if (event.key === 'ArrowLeft') rotationY -= rotationStep;
          else if (event.key === 'ArrowRight') rotationY += rotationStep;
          else if (event.key === 'ArrowUp') rotationX = Math.max(-0.48, rotationX - rotationStep);
          else if (event.key === 'ArrowDown') rotationX = Math.min(0.48, rotationX + rotationStep);
          else if (event.key === 'Home') {
            rotationX = 0.06;
            rotationY = -0.58;
          } else {
            return;
          }
          event.preventDefault();
          updateRotation();
        };

        mount.addEventListener('pointerdown', handlePointerDown);
        mount.addEventListener('pointermove', handlePointerMove, { passive: false });
        mount.addEventListener('pointerup', handlePointerEnd);
        mount.addEventListener('pointercancel', handlePointerEnd);
        mount.addEventListener('keydown', handleKeyDown);
        detachControls = () => {
          mount.removeEventListener('pointerdown', handlePointerDown);
          mount.removeEventListener('pointermove', handlePointerMove);
          mount.removeEventListener('pointerup', handlePointerEnd);
          mount.removeEventListener('pointercancel', handlePointerEnd);
          mount.removeEventListener('keydown', handleKeyDown);
        };

        setStatus('ready');
        renderScene();
      } catch (error) {
        console.error('No se pudo cargar el modelo 3D de maíz.', error);
        if (!disposed) setStatus('error');
      }
    };

    if ('IntersectionObserver' in window) {
      loadObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        loadObserver.disconnect();
        initialise();
      }, { rootMargin: '480px 0px' });
      loadObserver.observe(mount);
    } else {
      initialise();
    }

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      loadObserver?.disconnect();
      detachControls();
      if (model) {
        const disposedMaterials = new Set();
        model.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry?.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (disposedMaterials.has(material)) return;
            disposedMaterials.add(material);
            disposeMaterial(material);
          });
        });
      }
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  return (
    <div className={`zeasys-corn-model-stage is-${status}`}>
      <div
        className="zeasys-corn-model-viewport"
        ref={mountRef}
        role="group"
        tabIndex={status === 'ready' ? 0 : -1}
        aria-label="Modelo tridimensional interactivo de una mazorca de maíz"
      />
      <div className="zeasys-corn-model-glow" aria-hidden="true" />
      {status === 'loading' && <span className="zeasys-corn-model-loading">Preparando modelo 3D</span>}
      {status === 'error' && <img className="zeasys-corn-model-fallback" src={fallbackPhoto} alt="Cultivo de maíz" />}
    </div>
  );
}
