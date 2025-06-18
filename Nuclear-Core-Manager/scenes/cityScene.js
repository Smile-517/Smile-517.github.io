import * as THREE from "three";
import * as states from "../states.js";
import { RENDER_DEBUG, LATITUDE } from "../params.js";
import { createNoise2D } from 'simplex-noise';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';

// 객체 내부 변수들
export let scene;
export let camera;
let dirLight;
let axesHelper;
let dirLightHelper;
let oceanMixer;
let clock = new THREE.Clock();
const loader = new GLTFLoader();
let lastTime = 0;

export function init() {
  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd0e0f0);

  // camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(30, 25, 15);
  camera.lookAt(new THREE.Vector3(0, -11, 0));
  camera.updateProjectionMatrix();
  scene.add(camera);

  // directional light (태양 광원 역할)
  // 동쪽: +X, 서쪽: -X, 남쪽: +Z, 북쪽: -Z
  dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  // 초기에는 동쪽에서 빛이 오도록 설정
  dirLight.position.set(50, 50, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.target.position.set(0, 0, 0);
  scene.add(dirLight);

  // ambient light (기본 조명)
  const ambientLight = new THREE.AmbientLight(0xc5d1eb, 0.3);
  scene.add(ambientLight);
  scene.background = new THREE.Color(0x000029);
  
  createIsland();
  createWater();
  createNuclearPowerPlant();
  createBuilding();

  // 디버그 모드일 때만 헬퍼 추가
  if (RENDER_DEBUG) {
    // 축 헬퍼 (월드 기준 XYZ 축 표시)
    axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // directional light 헬퍼 (광원 방향 시각화)
    dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 1);
    scene.add(dirLightHelper);
  }
}

function createIsland() {
  const noise = createNoise2D();
  const islandSize = 60;
  const segments = 128;
  const peakHeight = 15;
  const geometry = new THREE.PlaneGeometry(islandSize, islandSize, segments, segments);
  const positionAttribute = geometry.attributes.position;
  const colors = [];

  const sandColor = new THREE.Color(0xc2b280);
  const grassColor = new THREE.Color(0x4caf50);
  const rockColor = new THREE.Color(0x808080);
  const snowColor = new THREE.Color(0xffffff);

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);

    // 해안선에 노이즈를 추가하여 울퉁불퉁하게 만듦
    const angle = Math.atan2(y, x); // 각 꼭짓점의 중심으로부터의 각도 계산
    const radiusNoise = noise(Math.cos(angle) * 2, Math.sin(angle) * 2) * 3.0; // 각도를 기반으로 노이즈 생성
    const distanceToCenter = Math.sqrt(x * x + y * y) + radiusNoise; // 원래 거리에 노이즈를 더해 해안선을 왜곡

    // 중앙이 높고 가장자리가 낮은 기본 돔 모양 생성
    const normalizedDistance = distanceToCenter / (islandSize / 2);
    const saturatedDistance = Math.max(0, Math.min(1, normalizedDistance));
    const islandFalloff = Math.pow(1.0 - saturatedDistance, 1.5);
    let finalHeight = islandFalloff * peakHeight;
    
    // 섬 표면에도 약간의 노이즈를 추가하여 디테일을 살림
    const surfaceNoise = noise(x / 10, y / 10) * islandFalloff * 2.0;
    finalHeight += surfaceNoise;

    finalHeight = Math.max(0, finalHeight); // 높이가 0보다 낮아지지 않도록 함

    positionAttribute.setZ(i, finalHeight);

    // 높이에 따라 색상 결정
    const color = new THREE.Color();
    if (finalHeight < 1.5) color.copy(sandColor);
    else if (finalHeight < 7) color.copy(grassColor);
    else if (finalHeight < 12) color.copy(rockColor);
    else color.copy(snowColor);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    depthTest: true,
    depthWrite: true,
  });

  const islandMesh = new THREE.Mesh(geometry, material);
  islandMesh.rotation.x = -Math.PI / 2;
  islandMesh.receiveShadow = true;
  islandMesh.castShadow = true;
  scene.add(islandMesh);
}

function createWater() {
  loader.load('./assets/models/ocean.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(-40, 0.5, -40);
    model.scale.set(150, 150, 150);
    
    // 모델의 모든 메시에 대해 설정
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = false;
        child.material.depthWrite = true;
        child.material.depthTest = true;
        child.material.side = THREE.DoubleSide;
        
        // specular 강도 조절
        if (child.material.specular) {
          child.material.specular.set(0x111111);  // specular 색상을 어둡게
        }
        child.material.shininess = 10;
        child.material.metalness = 0.1;
        child.material.roughness = 0.8;
      }
    });

    // 애니메이션 설정
    if (gltf.animations && gltf.animations.length) {
      oceanMixer = new THREE.AnimationMixer(model);
      const action = oceanMixer.clipAction(gltf.animations[0]);
      action.play();
    }
    
    scene.add(model);
  });
}

function createNuclearPowerPlant() {
  const material = new THREE.MeshStandardMaterial({ 
    color: 0xced4da,
    metalness: 0.2,
    roughness: 0.6,
    depthTest: true,
    depthWrite: true,
  });
  const cylinderRadius = 2.5;
  const cylinderHeight = 4;
  const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32);
  const cylinder = new THREE.Mesh(cylinderGeometry, material);
  cylinder.position.set(17.5, 4, 7);
  cylinder.castShadow = true;
  cylinder.receiveShadow = true;
  const sphereGeometry = new THREE.SphereGeometry(cylinderRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const hemisphere = new THREE.Mesh(sphereGeometry, material);
  hemisphere.position.y = cylinderHeight / 2;
  cylinder.add(hemisphere);
  // smoke
  loader.load('./assets/models/smoke.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(-2.5, 3.3, 2);
    model.rotation.set(0, Math.PI*0.85, 0);
    model.scale.set(0.6, 0.6, 0.6);
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.9;
        child.material.depthWrite = true;
        child.material.depthTest = true;
      }
    });
    cylinder.add(model);
  });
  scene.add(cylinder);
}

function createBuilding() {
  loader.load('./assets/models/buildings.glb', (gltf) => {
    const model = gltf.scene;
    
    // 모델의 모든 메시에 대해 설정
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material.depthTest = true;
        child.material.depthWrite = true;
      }
    });
    model.scale.set(0.82, 0.82, 0.82);
    model.rotation.z = Math.PI/10;
    model.position.set(23.5, 3, -1);
    scene.add(model);
  });
}

export function update(time) {
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  // 바다 애니메이션 업데이트
  if (oceanMixer) {
    oceanMixer.update(deltaTime);
  }

  // 최대 고도(고도각) 계산 (Latitude 기반)
  const maxElevationRad = (90 - LATITUDE) * (Math.PI / 180);

  // states.dayTime ∈ [0, 1]로 가정 → 0~1을 일일 사이클(2π)로 매핑
  const theta = states.dayTime * 2 * Math.PI;
  // 사인 값에 따라 고도각을 조절
  const phi = Math.sin(states.dayTime * 2 * Math.PI) * maxElevationRad;

  // 구 좌표계로 변환하여 x, y, z 얻기
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(theta);

  // directional light 위치 갱신
  dirLight.position.set(x, y, z);

  // 디버그 모드면 헬퍼도 함께 갱신
  if (RENDER_DEBUG && dirLightHelper) {
    dirLightHelper.update();
  }
}
