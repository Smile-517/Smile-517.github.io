import * as THREE from "three";

import * as gameDisplay from "../gameDisplay.js";
import * as windowHandler from "../windowHandler.js";
import * as cityScene from "./cityScene.js";
import * as roomScene from "./roomScene.js";
import * as renderClass from "../renderClass.js";
import * as controls from "../controls.js";
import * as states from "../states.js";
import * as mouseMove from "../mouseMove.js";
import * as uiClass from "../uiClass.js";

import {
  RENDER_DEBUG,
  LOG_DEBUG,
  TICKS_PER_SECOND,
  MAX_NEUTRONS,
  P_NEUTRON,
  CONTROL_ROD_SPEED,
  FUEL_ROD_HEAT,
  CONTROL_ROD_HEAT,
} from "../params.js";

let renderer;

// 객체 내부 변수들
export let scene;
export let camera;
let cameraNear;
let cameraFar;
let cameraMode; // 카메라 모드: 0: perspective, 1: orthographic
let oldCameraPos;
export let spotLight;
let reactor;
let axesHelper;
let spotLightHelper;

let isStartingUp; // 원자로의 시동을 걸기 위해 중성자를 방출하는지 여부

// 원자로 연료봉, 제어봉 관련 변수들
let coreRadius;
let coreHeight;
let rodPositions; // 7x7 행렬로 각 봉의 중심점 위치를 저장
let whichRods; // 각 봉이 연료봉인지 제어봉인지 구분하는 배열 (0: 사용 안 함, 1: 연료봉, 2: 제어봉)
let controlRods; // 제어봉 객체들은 따로 관리함
let numFuelRods;
let numControlRods;
let rodRadius; // 연료봉, 제어봉의 반지름
let rodOffset; // 봉의 위치 오프셋 (원자로 표면 위에 위치하도록), z-fighting 회피.
let controlRodOperation; // 제어봉에게 내리는 명령의 상태: -1: 내리기, 0: 유지, 1: 올리기
export let controlRodPosY;

// 연료봉, 제어봉 그래픽 관련 변수들
export let fuelRodMaterial;
let fuelRodSphereGeometry;
let fuelRodGeometry;
export let fuelRodBasicSphereMaterial;
export let fuelRodBasicSphereDefaultColor;
export let fuelRodBasicSphereHeatedColor;
let controlRodMaterial;
let controlRodSphereGeometry;
let controlRodGeometry;
let controlRodBasicSphereMaterial;

// 중성자 관련 변수들
let maxNeutrons;
let neutronMaterial;
let particles;
// 중성자 풀
let positions; // Float32Array
let velocities; // Float32Array
let inUse; // boolean[]
let available; // number[] (stack of free indices)
let activeCount;

export function init() {
  renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.

  // 변수 초기화
  cameraMode = 0; // perspective
  cameraNear = 0.015625;
  cameraFar = 512;
  coreRadius = 2;
  coreHeight = 4;
  rodPositions = [];
  whichRods = [];
  controlRods = [];
  numFuelRods = 0;
  numControlRods = 0;
  rodOffset = 0.001;
  neutronMaterial = new THREE.PointsMaterial({
    size: 0.1,
    color: 0xffff00,
  });
  controlRodPosY = 0; // 제어봉의 Y 위치
  controlRodOperation = 0; // 제어봉의 현재 상태: -1: 내리기, 0: 유지, 1: 올리기

  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // 배경색을 검은색으로 설정

  // neutron material
  neutronMaterial = new THREE.PointsMaterial({
    map: _createCircleTexture(),
    transparent: false,
    alphaTest: 0.5,
    depthWrite: true,
    depthTest: true,
  });

  // Pool 초기화
  maxNeutrons = MAX_NEUTRONS;
  positions = new Float32Array(maxNeutrons * 3);
  velocities = new Float32Array(maxNeutrons * 3);
  inUse = new Array(maxNeutrons).fill(false);
  available = Array.from({ length: maxNeutrons }, (_, i) => i).reverse();
  activeCount = 0;

  // BufferGeometry 하나를 만들어서 모든 중성자를 관리
  const neutronGeometry = new THREE.BufferGeometry();
  neutronGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  neutronGeometry.setDrawRange(0, 0); // 초기에는 안 보이게

  particles = new THREE.Points(neutronGeometry, neutronMaterial);
  particles.renderOrder = 1;
  particles.frustumCulled = false;
  scene.add(particles);

  _setupCamera();
  _setupLights();
  _setupReactor();
  _setupRods();
  if (RENDER_DEBUG) _setupHelpers();

  uiClass.createThrottleBar(
    1085,
    50,
    1135,
    515,
    "nukeScene.controlRodPosY",
    0,
    4,
    "up"
  );

  updateNeutronSize(); // 초기 중성자 크기 설정
}

// 원형 스프라이트 캔버스 생성
function _createCircleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffff00";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function _setupCamera() {
  camera = new THREE.PerspectiveCamera();
  camera.near = cameraNear;
  camera.far = cameraFar;
  camera.position.set(1.5, 8, 3.5); // 초기 위치 설정
  // camera.lookAt(new THREE.Vector3(0, 0, 0));  // 여기 말고 OrbitControls에서 설정해야 함
  camera.updateProjectionMatrix();
  scene.add(camera);
}

function _setupLights() {
  // ambient light (전체 조명)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // 약한 전체 조명
  scene.add(ambientLight);

  // spotlight (원자로를 비추는 조명)
  spotLight = new THREE.SpotLight(0xffffff, 1.0);
  spotLight.position.set(0, 15, 0); // 원자로 위에서 비추도록 설정
  spotLight.castShadow = true;
  spotLight.angle = Math.PI / 4; // 조명의 각도 설정
  spotLight.penumbra = 0.4; // 페넘브라 설정 (부드러운 그림자)
  spotLight.intensity = 400; // 조명 강도 설정
  spotLight.shadow.mapSize.width = 2048;
  spotLight.shadow.mapSize.height = 2048;
  scene.add(spotLight);
}

function _setupReactor() {
  // 바닥
  const floorGeometry = new THREE.CircleGeometry(32768);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // 바닥을 수평으로 회전
  floor.receiveShadow = true; // 그림자 받기
  floor.position.set(0, -0.01, 0); // 바닥 위치 조정
  scene.add(floor);

  // 원자로 껍데기 (샘플로 간단한 실린더 사용)
  const reactorGeometry = new THREE.CylinderGeometry(
    coreRadius,
    coreRadius,
    coreHeight,
    256
  );
  const reactorMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.5,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  reactor = new THREE.Mesh(reactorGeometry, reactorMaterial);
  reactor.castShadow = true;
  reactor.position.set(0, coreHeight / 2 + rodOffset, 0); // 원자로 위치 설정
  reactor.renderOrder = 0;
  scene.add(reactor);
}

function _setupRods() {
  // 각 봉의 중심점을 보관하는 7x7 행렬을 생성
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      // 각 봉의 위치를 계산
      const z = i * 0.5; // Z축으로 간격을 두고 배치
      const x = j * 0.5; // X축으로 간격을 두고 배치
      rodPositions.push([x, z]);
    }
  }

  // 어떤 봉이 연료봉인지 제어봉인지 설정
  // 0: 사용 안 함, 1: 연료봉, 2: 제어봉
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if (
        (i == -3 && (j <= -2 || j >= 2)) ||
        (i == -2 && (j == -3 || j == 3)) ||
        (i == 2 && (j == -3 || j == 3)) ||
        (i == 3 && (j <= -2 || j >= 2))
      ) {
        whichRods.push(0);
      } else if (
        (i == -2 && (j == -2 || j == 0 || j == 2)) ||
        (i == 0 && (j == -2 || j == 0 || j == 2)) ||
        (i == 2 && (j == -2 || j == 0 || j == 2))
      ) {
        whichRods.push(2);
        numControlRods++;
      } else {
        whichRods.push(1);
        numFuelRods++;
      }
    }
  }

  // 행렬을 이용해 연료봉 생성
  rodRadius = 0.1; // 연료봉, 제어봉의 반지름 설정
  const r = rodRadius;
  const h = coreHeight - 0.01;
  fuelRodGeometry = new THREE.CylinderGeometry(r, r, h, 32);
  fuelRodSphereGeometry = new THREE.SphereGeometry(r, 32, 32);
  fuelRodMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f7f7f,
    metalness: 0.8,
    roughness: 0.4,
    emissive: 0xff0000,
    emissiveIntensity: 0.0, // 초기에는 발광하지 않음
  });
  fuelRodBasicSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x7f7f7f,
    visible: false,
  });
  fuelRodBasicSphereDefaultColor = fuelRodBasicSphereMaterial.color.clone();
  fuelRodBasicSphereHeatedColor = new THREE.Color(0xff7f7f); // 연료봉이 가열되면 이 색으로 변경
  for (let i = 0; i < rodPositions.length; i++) {
    if (whichRods[i] != 1) continue;
    const [x, z] = rodPositions[i];
    const fuelRod = new THREE.Mesh(fuelRodGeometry, fuelRodMaterial);
    const fuelRodSphere = new THREE.Mesh(
      fuelRodSphereGeometry,
      fuelRodMaterial
    );
    const fuelRodSphereBasic = new THREE.Mesh(
      fuelRodSphereGeometry,
      fuelRodBasicSphereMaterial
    );
    fuelRod.add(fuelRodSphere); // 연료봉의 상단에 구체를 추가하여 시각적으로 강조
    fuelRod.add(fuelRodSphereBasic);
    fuelRodSphere.position.set(0, h / 2, 0); // 구체를 봉의 상단에 위치시킴
    fuelRodSphereBasic.position.set(0, h / 2 + 1, 0);
    fuelRod.position.set(x, coreHeight / 2 + rodOffset, z); // X, Z축으로 간격을 두고 배치
    fuelRod.castShadow = false;
    scene.add(fuelRod);
  }

  // 행렬을 이용해 제어봉 생성
  controlRodGeometry = new THREE.CylinderGeometry(r, r, h, 32);
  controlRodSphereGeometry = new THREE.SphereGeometry(r, 32, 32);
  controlRodMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fdf7f,
    metalness: 0.8,
    roughness: 0.4,
  });
  controlRodBasicSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x9fdf7f,
    visible: false,
  });
  for (let i = 0; i < rodPositions.length; i++) {
    if (whichRods[i] != 2) continue;
    const [x, z] = rodPositions[i];
    const controlRod = new THREE.Mesh(controlRodGeometry, controlRodMaterial);
    const controlRodSphere = new THREE.Mesh(
      controlRodSphereGeometry,
      controlRodMaterial
    );
    const controlRodSphereBasic = new THREE.Mesh(
      controlRodSphereGeometry,
      controlRodBasicSphereMaterial
    );
    controlRod.add(controlRodSphere); // 제어봉의 상단에 구체를 추가하여 시각적으로 강조
    controlRod.add(controlRodSphereBasic);
    controlRodSphere.position.set(0, h / 2, 0); // 구체를 봉의 상단에 위치시킴
    controlRodSphereBasic.position.set(0, h / 2 + 1, 0);
    controlRod.position.set(x, coreHeight / 2 + rodOffset, z); // X, Z축으로 간격을 두고 배치
    controlRod.castShadow = false;
    controlRods.push(controlRod);
    scene.add(controlRod);
  }
}

export function setFuelRodBasicSphereColor(color) {
  fuelRodBasicSphereMaterial.color.set(color);
}

function _setupHelpers() {
  // 축 헬퍼 (월드 기준 XYZ 축 표시)
  axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // spotlight 헬퍼 (조명 방향 시각화)
  spotLightHelper = new THREE.SpotLightHelper(spotLight);
  scene.add(spotLightHelper);
}

// 1초에 TICKS_PER_SECOND번 호출됨.
export function tick() {
  if (states.isNukeExploded) return; // 핵폭발에 의한 게임 오버 상태일 때는 계산하지 않음
  // 원자로가 시동 중이면 중성자를 방출
  if (!states.isGameStarted && isStartingUp) { // 게임이 시작되면 시동을 걸 수 없음
    // coreRadius, 2, 0 위치에서 중심 방향으로 1초에 10개의 중성자를 확률적으로 방출
    if (Math.random() < 10 / TICKS_PER_SECOND) {
      _startupNeutrons();
    }
  }

  // 제어봉 조작
  if (controlRodOperation != 0) {
    if (controlRodOperation === -1) {
      // 제어봉을 1초당 CONTROL_ROD_SPEED씩 내리기
      controlRodPosY -= CONTROL_ROD_SPEED / TICKS_PER_SECOND;
      if (controlRodPosY < 0) controlRodPosY = 0; // 최저 위치 제한
    } else {
      // controlRodOperation === 1
      // 제어봉을 1초당 CONTROL_ROD_SPEED씩 올리기
      controlRodPosY += CONTROL_ROD_SPEED / TICKS_PER_SECOND;
      if (controlRodPosY > coreHeight) controlRodPosY = coreHeight; // 최고 위치 제한
    }
    // 제어봉 위치 업데이트
    for (let i = 0; i < controlRods.length; i++) {
      const controlRod = controlRods[i];
      controlRod.position.y = controlRodPosY + coreHeight / 2 + rodOffset;
    }
    
    // UI 업데이트
    uiClass.updateThrottleBars();
  }

  // 각 중성자들에 대한 계산 시작
  const pos = positions;
  const vel = velocities;
  let i = 0;
  while (i < activeCount) {
    const base = i * 3;
    // 중성자 위치 업데이트
    pos[base] += vel[base];
    pos[base + 1] += vel[base + 1];
    pos[base + 2] += vel[base + 2];

    // 충돌 테스트를 위한 좌표 추출
    const x = pos[base],
      y = pos[base + 1],
      z = pos[base + 2];
    const twoD = Math.hypot(x, z);
    // 1. 원자로의 경계 검사
    if (y < 0 || y > coreHeight || twoD > coreRadius) {
      _removeNeutron(i);
      continue; // don't increment i
    }

    // 2. 연료봉과의 충돌 검사
    let collided = false;
    for (let j = 0; j < rodPositions.length; j++) {
      if (whichRods[j] !== 1) continue; // 연료봉만 검사
      const [rx, rz] = rodPositions[j];
      const dx = x - rx;
      const dz = z - rz;
      const distance = Math.hypot(dx, dz);
      if (distance < rodRadius) {
        // 충돌 발생
        collided = true;
        states.incrCoreTemp(FUEL_ROD_HEAT); // 원자로 온도 증가
        _removeNeutron(i);
        // P_NEUTRON의 확률로 3개의 중성자를 방출
        if (Math.random() < P_NEUTRON) {
          for (let k = 0; k < 3; k++) {
            // 충돌이 발생한 fuel rod에서 y값은 충돌 지점의 y값으로 하고, 랜덤한 각도를 설정하여 그 방향으로 중성자를 방출
            const angle = Math.random() * Math.PI * 2; // 0 ~ 2π 사이의 랜덤 각도
            const vX = Math.cos(angle);
            const vY = 2 * Math.random() - 1; // -1 ~ 1 사이의 랜덤 Y 속도
            const vZ = Math.sin(angle);
            // x와 z는 v의 방향 쪽으로 좀 더 이동
            const posX = rx + vX * rodRadius * 1.01;
            const posZ = rz + vZ * rodRadius * 1.01;
            _makeNeutron(posX, y, posZ, vX, vY, vZ);
          }
        }
        break;
      }
    }

    if (collided) continue; // 연료봉과 충돌했으면 다음 중성자로 넘어감

    // 3. 제어봉과의 충돌 검사
    collided = false;
    for (let j = 0; j < rodPositions.length; j++) {
      if (whichRods[j] !== 2) continue; // 제어봉만 검사
      if (y < controlRodPosY) continue; // 제어봉 아래에 있는 중성자는 검사하지 않음
      const [rx, rz] = rodPositions[j];
      const dx = x - rx;
      const dz = z - rz;
      const distance = Math.hypot(dx, dz);
      if (distance < rodRadius) {
        // 충돌 발생
        collided = true;
        states.incrCoreTemp(CONTROL_ROD_HEAT); // 원자로 온도 증가
        _removeNeutron(i);
        break;
      }
    }

    if (collided) continue; // 제어봉과 충돌했으면 다음 중성자로 넘어감

    i++;
  }

  // update draw range & flag
  particles.geometry.setDrawRange(0, activeCount);
  particles.geometry.attributes.position.needsUpdate = true;
}

function _removeNeutron(i) {
  // 마치 heap에서 entry를 제거하는 것처럼 동작
  const last = activeCount - 1;
  if (i !== last) {
    // 끝쪽 슬롯 데이터를 i 슬롯으로 복사
    const baseI = i * 3;
    const baseLast = last * 3;
    for (let k = 0; k < 3; k++) {
      positions[baseI + k] = positions[baseLast + k];
      velocities[baseI + k] = velocities[baseLast + k];
    }
    inUse[i] = inUse[last];
  }
  // 마지막 슬롯은 해제 -> 재사용 스택으로
  inUse[last] = false;
  available.push(last);
  // 활성 개수 한 칸 줄이기
  activeCount--;
}

function _startupNeutrons() {
  _makeNeutron(
    coreRadius - 0.001,
    2,
    0,
    -1,
    2 * Math.random() - 1,
    2 * Math.random() - 1
  );
}

function _makeNeutron(posX, posY, posZ, vX, vY, vZ) {
  if (available.length === 0) {
    if (LOG_DEBUG >= 3) console.log("No available neutrons");
    return;
  }
  const freeIdx = available.pop();
  const baseFree = freeIdx * 3;
  // 여유 슬롯에 데이터 기록
  positions[baseFree] = posX;
  positions[baseFree + 1] = posY;
  positions[baseFree + 2] = posZ;
  const v = new THREE.Vector3(vX, vY, vZ)
    .normalize()
    .multiplyScalar((1.5 + Math.random()) / TICKS_PER_SECOND);
  velocities[baseFree] = v.x;
  velocities[baseFree + 1] = v.y;
  velocities[baseFree + 2] = v.z;
  // 활성 영역 끝(activeCount)으로 swap
  const dstIdx = activeCount;
  if (freeIdx !== dstIdx) {
    const baseDst = dstIdx * 3;
    // 위치 swap
    for (let k = 0; k < 3; k++) {
      const tmp = positions[baseDst + k];
      positions[baseDst + k] = positions[baseFree + k];
      positions[baseFree + k] = tmp;
    }
    // 속도 swap
    for (let k = 0; k < 3; k++) {
      const tmp = velocities[baseDst + k];
      velocities[baseDst + k] = velocities[baseFree + k];
      velocities[baseFree + k] = tmp;
    }
    // swap 으로 비워진 freeIdx 슬롯은 다시 재사용 스택에
    available.push(freeIdx);
  }

  // activeCount 증가
  activeCount++;
  inUse[dstIdx] = true;
}

export function initUi() {
  uiClass.createButton(
    1785,
    430,
    1855,
    500,
    "assets/textures/tmpUi0.png",
    "assets/textures/tmpUi1.png",
    "assets/textures/tmpUi2.png",
    switchCamera.bind(this)
  );
}

export function switchCamera() {
  if (cameraMode === 0) {
    // perspective에서 orthographic으로 전환
    // 현재 카메라의 위치를 저장
    cameraMode = 1;
    oldCameraPos = camera.position.clone();
    const size = 2;
    const aspect =
      windowHandler.nukeDisplay.width / windowHandler.nukeDisplay.height;
    camera = new THREE.OrthographicCamera(
      -size * aspect,
      size * aspect,
      size,
      -size,
      0.1,
      1000
    );
    camera.position.set(0, 100, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.updateProjectionMatrix();
    // 각 봉의 basic sphere를 보이도록 설정
    fuelRodBasicSphereMaterial.visible = true;
    controlRodBasicSphereMaterial.visible = true;
    // 모든 중성자의 크기를 업데이트
    updateNeutronSize();
  } else {
    // orthographic에서 perspective로 전환
    cameraMode = 0;
    camera = new THREE.PerspectiveCamera();
    camera.near = cameraNear;
    camera.far = cameraFar;
    camera.position.set(oldCameraPos.x, oldCameraPos.y, oldCameraPos.z);
    // camera.lookAt(new THREE.Vector3(0, 0, 0));  // 여기 말고 OrbitControls에서 설정해야 함
    controls.settingOrbitControls(renderer);
    windowHandler.onResize();
    // 각 봉의 basic sphere를 보이지 않도록 설정
    fuelRodBasicSphereMaterial.visible = false;
    controlRodBasicSphereMaterial.visible = false;
    // 모든 중성자의 크기를 업데이트
    updateNeutronSize();
  }

  camera.updateProjectionMatrix();
  scene.add(camera);
}

export function updateNeutronSize() {
  if (cameraMode === 0) {
    neutronMaterial.sizeAttenuation = true;
    neutronMaterial.size = 0.025 * (windowHandler.width / 1920);
  } else {
    neutronMaterial.sizeAttenuation = false;
    neutronMaterial.size = 3 * (windowHandler.width / 1920);
  }
  neutronMaterial.needsUpdate = true;
}

export function setControlRodOperation(operation) {
  controlRodOperation = operation;
}

export function setIsStartingUp(value) {
  isStartingUp = value;
}
