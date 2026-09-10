import { useEffect } from "react";
import * as THREE from "three";

/**
 * Sets up the rotating wireframe sphere + rings hologram inside
 * containerRef, and pulses it based on speakingLevelRef.current
 * (0 = idle, 1 = speaking). speakingLevelRef is read every animation
 * frame directly (not via React state) to avoid re-rendering React
 * 60 times a second.
 */
export function useHologram(containerRef, speakingLevelRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.45
      })
    );
    scene.add(sphere);

    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.9 + i * 0.25, 0.015, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 })
      );
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      scene.add(ring);
      rings.push(ring);
    }

    const light = new THREE.PointLight(0x00ffff, 2, 100);
    light.position.set(0, 0, 3);
    scene.add(light);

    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      sphere.rotation.x += 0.003;
      sphere.rotation.y += 0.006;
      rings.forEach((ring, i) => {
        ring.rotation.x += 0.002 + i * 0.001;
        ring.rotation.y += 0.003 + i * 0.001;
      });
      const level = speakingLevelRef?.current || 0;
      const pulse = 1 + level * 0.12;
      sphere.scale.set(pulse, pulse, pulse);
      light.intensity = 1.5 + level * 3;
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
