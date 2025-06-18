import * as THREE from "three";

// 객체 내부 변수들
export let renderer;

export function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);
}
