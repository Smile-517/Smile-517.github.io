import * as THREE from "three";

// 객체 내부 변수들
export let scene;
export let camera;

export function init() {
  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // camera
  camera = new THREE.OrthographicCamera(
    0, // left
    1920, // right
    1080, // top
    0, // bottom
    -1000, // near
    1000 // far
  );
  camera.position.set(0, 0, 100);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  camera.updateProjectionMatrix();
  scene.add(camera);

  // plane 추가
  const planeGeometry = new THREE.PlaneGeometry(1920, 1080);
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load("assets/textures/SMPTE_Color_Bars.png"),
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.set(1920 / 2, 1080 / 2, 0);
  scene.add(plane);
}
