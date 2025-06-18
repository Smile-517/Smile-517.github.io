import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

import * as gameDisplay from "./gameDisplay.js";
import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";

let renderer;

let buttons; // UI 중 버튼들을 저장하는 배열
let bars; // UI 중 바들을 저장하는 배열
let barIndicators;
export let tempBar;
let throttleBars; // UI 중 스로틀 바들을 저장하는 배열
let throttleObj; // 스로틀 오브젝트를 저장하는 변수
let mouseClicked;
let selectedUi;
export let defaultColor; // 기본 바 색상
export let defaultColorFloat;
export let alertColor; // 경고 바 색상
export let alertColorFloat;
let loadedFont;

// 16:9 게임 영역에 UI를 그리기 위한 씬
export let scene;
export let camera;

export async function init() {
  renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.
  buttons = [];
  bars = [];
  barIndicators = [];
  throttleBars = [];
  mouseClicked = false;
  defaultColor = 0x4caf50;
  defaultColorFloat = new THREE.Color(defaultColor);
  alertColor = 0xff0000;
  alertColorFloat = new THREE.Color(alertColor);

  // scene
  scene = new THREE.Scene();
  scene.background = null;

  // camera
  camera = new THREE.OrthographicCamera(
    0, // left
    1920, // right
    1080, // top
    0, // bottom
    -1000, // near
    1000 // far
  );
  camera.position.set(0, 0, 100); // 카메라 위치 설정

  // light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(0, 0, 100).normalize();
  scene.add(directionalLight);

  // 폰트 로딩
  const fontLoader = new FontLoader();
  try {
    loadedFont = await fontLoader.loadAsync(
      "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json"
    );
  } catch (err) {
    console.error("Font load error:", err);
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    mouseClicked = true;
    setSomeUiClicked();
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    mouseClicked = false;
    resetClickedUi();
  });

  _makeThrottle();
}

function _makeThrottle() {
  const columnGeometry = new THREE.CylinderGeometry(
    8, // top radius
    8, // bottom radius
    40, // height
    32 // radial segments
  );
  const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });
  const columnMesh = new THREE.Mesh(columnGeometry, columnMaterial);
  columnMesh.position.set(1110, 50 + 16, 2);
  columnMesh.rotation.z = Math.PI / 2; // X축을 기준으로 90도 회전

  const leftGeometry = new THREE.CylinderGeometry(
    20, // top radius
    12, // bottom radius
    30, // height
    32 // radial segments
  );
  const leftMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfdfdf,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });
  const leftMesh = new THREE.Mesh(leftGeometry, leftMaterial);
  columnMesh.add(leftMesh);
  leftMesh.position.set(0, 20, 2);

  const rightGeometry = new THREE.CylinderGeometry(
    12, // top radius
    20, // bottom radius
    30, // height
    32 // radial segments
  );
  const rightMesh = new THREE.Mesh(rightGeometry, leftMaterial);
  columnMesh.add(rightMesh);
  rightMesh.position.set(0, -20, 2);

  scene.add(columnMesh);
  throttleObj = columnMesh;
}

export function createThrottleBar(
  botLeftX,
  botLeftY,
  topRightX,
  topRightY,
  value,
  min,
  max,
  direction,
  offset = 32
) {
  // 바깥쪽
  const width = topRightX - botLeftX;
  const height = topRightY - botLeftY;

  const outerGeometry = new THREE.PlaneGeometry(width, height);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial);
  outerMesh.position.set(botLeftX + width / 2, botLeftY + height / 2, 0);

  // 안쪽
  const innerWidth = width - offset; // 안쪽 바의 너비는 바깥쪽 바의 80%
  const innerHeight = height - offset; // 안쪽 바의 높이는 바깥쪽 바의 80%
  const innerGeometry = new THREE.PlaneGeometry(innerWidth, innerHeight);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
  innerMesh.position.set(
    botLeftX + width / 2,
    botLeftY + height / 2,
    0.1 // 바깥쪽 메쉬보다 약간 위에 위치
  );

  const bar = {
    outerMesh: outerMesh,
    innerMesh: innerMesh,
    outerWidth: width,
    outerHeight: height,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    value: value, // 이 바가 나타내는 값 (alias)
    min: min,
    max: max,
    direction: direction, // "up", "down", "left", "right"
    offset: offset,
  };

  throttleBars.push(bar);
  scene.add(outerMesh);
  scene.add(innerMesh);
}

export function updateThrottleBars() {
  for (const bar of throttleBars) {
    let value = eval(bar.value);
    // 바의 현재 값이 최소값과 최대값 사이에 있는지 확인
    if (value < bar.min) {
      value = bar.min;
    } else if (value > bar.max) {
      value = bar.max;
    }
    const ratio = (value - bar.min) / (bar.max - bar.min);

    // 안쪽 바의 크기를 현재 값에 맞게 조정
    switch (bar.direction) {
      case "up":
        // 바 안쪽의 실제 이동 가능한 높이
        const travel = bar.innerHeight;
        // 바의 아래 끝 위치 (outerMesh 중심 – outerHeight/2 + offset/2)
        const minY = bar.outerMesh.position.y - bar.innerHeight / 2;
        // 실제 레버 위치는 minY에서 travel만큼 올라간 위치의 중간
        // (여기선 travel의 1/2 만큼 올린 뒤, ratio만큼 더 올립니다)
        throttleObj.position.y = minY + travel * ratio;
        break;
      case "down":
        break;
      case "left":
        break;
      case "right":
        break;
    }
  }
}

export function createBar(
  botLeftX,
  botLeftY,
  topRightX,
  topRightY,
  value,
  min,
  max,
  direction,
  offset, // 안쪽 바와 바깥쪽 바의 크기 차이
  specialBarName = null // 특별한 바 이름이 있는 경우
) {
  // 바깥쪽
  const width = topRightX - botLeftX;
  const height = topRightY - botLeftY;

  const outerGeometry = new THREE.PlaneGeometry(width, height);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial);
  outerMesh.position.set(botLeftX + width / 2, botLeftY + height / 2, 0);

  // 안쪽
  const innerWidth = width - offset;
  const innerHeight = height - offset;

  const innerGeometry = new THREE.PlaneGeometry(innerWidth, innerHeight);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x4caf50, // 기본 색상
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
  innerMesh.position.set(
    botLeftX + width / 2,
    botLeftY + height / 2,
    0.1 // 바깥쪽 메쉬보다 약간 위에 위치
  );

  const bar = {
    outerMesh: outerMesh,
    innerMesh: innerMesh,
    outerWidth: width,
    outerHeight: height,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    value: value, // 이 바가 나타내는 값 (alias)
    min: min,
    max: max,
    direction: direction, // "up", "down", "left", "right"
    offset: offset,
  };

  bars.push(bar);
  if (specialBarName === "tempBar") {
    tempBar = bar; // 특별한 바 이름이 있는 경우 tempBar로 저장
  }
  scene.add(outerMesh);
  scene.add(innerMesh);
}

export function updateBars() {
  for (const bar of bars) {
    let value = eval(bar.value);
    // 바의 현재 값이 최소값과 최대값 사이에 있는지 확인
    if (value < bar.min) {
      value = bar.min;
    } else if (value > bar.max) {
      value = bar.max;
    }
    const ratio = (value - bar.min) / (bar.max - bar.min);

    // tempBar의 컬러 보간은 states.js에서 처리

    // 안쪽 바의 크기를 현재 값에 맞게 조정
    switch (bar.direction) {
      case "up":
        bar.innerMesh.scale.y = ratio;
        // 안쪽 바의 위치를 바깥쪽 바의 아래에 맞추기
        bar.innerMesh.position.y =
          bar.outerMesh.position.y -
          bar.outerHeight / 2 +
          (bar.innerHeight * ratio) / 2 +
          bar.offset / 2;
        break;
      case "down":
        bar.innerMesh.scale.y = ratio;
        bar.innerMesh.position.y =
          bar.outerMesh.position.y - (bar.outerMesh.scale.y * ratio) / 2;
        break;
      case "left":
        bar.innerMesh.scale.x = ratio;
        break;
      case "right":
        bar.innerMesh.scale.x = ratio;
        bar.innerMesh.position.x =
          bar.outerMesh.position.x - (bar.outerMesh.scale.x * ratio) / 2;
        break;
    }
  }
}

export function createBarIndicator(
  botLeftX,
  botLeftY,
  topRightX,
  topRightY,
  value,
  min,
  max,
  direction,
  offset
) {
  const width = topRightX - botLeftX;

  const indicarotPosition = new THREE.Mesh(); // 빈 메쉬 생성
  indicarotPosition.position.set(
    botLeftX + (topRightX - botLeftX) / 2,
    botLeftY + (topRightY - botLeftY) / 2,
    0
  );

  const geometry = new THREE.BufferGeometry();
  const a = 25; // 삼각형의 한 변의 길이
  const vertices = new Float32Array([
    0,
    (Math.sqrt(3) / 3) * a,
    0, // A
    -a / 2,
    (-Math.sqrt(3) / 6) * a,
    0, // B
    a / 2,
    (-Math.sqrt(3) / 6) * a,
    0, // C
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: 0xff8c00,
    side: THREE.DoubleSide,
  });
  const lTriangleMesh = new THREE.Mesh(geometry, material);
  lTriangleMesh.rotation.z = -Math.PI / 2;
  lTriangleMesh.position.set(-width / 2 - a / Math.sqrt(3), 0, 0.1);
  indicarotPosition.add(lTriangleMesh);
  const rTriangleMesh = new THREE.Mesh(geometry, material);
  rTriangleMesh.rotation.z = Math.PI / 2;
  rTriangleMesh.position.set(width / 2 + a / Math.sqrt(3), 0, 0.1);
  indicarotPosition.add(rTriangleMesh);

  scene.add(indicarotPosition);
  barIndicators.push({
    position: indicarotPosition,
    value: value, // 이 인디케이터가 나타내는 값 (alias)
    min: min,
    max: max,
    botLeftY: botLeftY, // 인디케이터의 위치를 계산하는 데 사용되는 바닥 왼쪽 Y 좌표
    topRightY: topRightY,
    direction: direction, // "up", "down", "left", "right"
    offset: offset, // 인디케이터의 위치 조정에 사용되는 오프셋
  });
}

export function updateBarIndicator() {
  for (const indicator of barIndicators) {
    let currentValue = eval(indicator.value);
    // 인디케이터의 현재 값이 최소값과 최대값 사이에 있는지 확인
    if (currentValue < indicator.min) {
      currentValue = indicator.min;
    } else if (currentValue > indicator.max) {
      currentValue = indicator.max;
    }
    const ratio =
      (currentValue - indicator.min) / (indicator.max - indicator.min);

    // 인디케이터의 위치를 현재 값에 맞게 조정
    switch (indicator.direction) {
      case "up":
        indicator.position.position.y =
          indicator.botLeftY +
          indicator.offset / 2 +
          (indicator.topRightY - indicator.botLeftY - indicator.offset) * ratio;
        break;
      case "down":
        break;
      case "left":
        break;
      case "right":
        break;
    }
  }
}

// botLeftX, botLeftY, topRightX, topRightY, texture가 인수로 들어오면 그에 맞는 버튼을 생성하는 함수
export function createButton(
  botLeftX,
  botLeftY,
  topRightX,
  topRightY,
  texture0,
  texture1,
  texture2,
  functionName
) {
  const inputs = {
    botLeftX: botLeftX,
    botLeftY: botLeftY,
    topRightX: topRightX,
    topRightY: topRightY,
  };
  const width = topRightX - botLeftX;
  const height = topRightY - botLeftY;

  const geometry = new THREE.PlaneGeometry(width, height);
  const loader = new THREE.TextureLoader();
  const tex0 = loader.load(texture0);
  const tex1 = loader.load(texture1);
  const tex2 = loader.load(texture2);
  const material = new THREE.MeshBasicMaterial({
    map: tex0,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(botLeftX + width / 2, botLeftY + height / 2, 0);

  const button = {
    inputs: inputs,
    mesh: mesh,
    tex0: tex0,
    tex1: tex1,
    tex2: tex2,
    state: 0, // 0: 기본, 1: 마우스 오버, 2: 클릭
    functionName: functionName,
  };

  buttons.push(button);
  scene.add(mesh);
}

// 마우스 움직임이 감지되면 ui 위에 있는지 확인하는 함수
export function isMouseOver() {
  // gameDisplay.calcGameCoords 함수를 사용하여 현재 화면 좌표를 1920x1080 기준 좌표로 변환
  const coords = gameDisplay.calcGameCoords(mouseMove.mouseX, mouseMove.mouseY);
  const x = coords.x;
  const y = coords.y;
  for (const ui of buttons) {
    // UI의 위치와 크기를 기준으로 마우스가 UI 위에 있는지 확인
    if (
      x >= ui.inputs.botLeftX &&
      x <= ui.inputs.topRightX &&
      y >= ui.inputs.botLeftY &&
      y <= ui.inputs.topRightY
    ) {
      if (!mouseClicked) {
        ui.state = 1;
        ui.mesh.material.map = ui.tex1;
      } else if (selectedUi == ui && mouseClicked) {
        setSomeUiClicked();
      }
    } else {
      ui.state = 0;
      ui.mesh.material.map = ui.tex0;
    }
  }
}

// 마우스 클릭이 감지되면 ui 위에 있는지 확인하고 클릭 상태로 변경하는 함수
export function setSomeUiClicked() {
  const coords = gameDisplay.calcGameCoords(mouseMove.mouseX, mouseMove.mouseY);
  const x = coords.x;
  const y = coords.y;
  for (const ui of buttons) {
    // UI의 위치와 크기를 기준으로 마우스가 UI 위에 있는지 확인
    if (
      x >= ui.inputs.botLeftX &&
      x <= ui.inputs.topRightX &&
      y >= ui.inputs.botLeftY &&
      y <= ui.inputs.topRightY
    ) {
      ui.state = 2; // 클릭 상태로 변경
      ui.mesh.material.map = ui.tex2; // 클릭 상태의 텍스처로 변경
      selectedUi = ui; // 클릭된 UI를 저장
    } else {
      // 클릭 상태가 아닌 UI는 기본 상태로 되돌림
      if (ui.state === 2) {
        ui.state = 0;
        ui.mesh.material.map = ui.tex0; // 기본 상태의 텍스처로 변경
      }
    }
  }
}

// 마우스 클릭이 해제되면 클릭 상태를 해제하고 기본 상태로 되돌리는 함수
export function resetClickedUi() {
  for (const ui of buttons) {
    if (ui.state === 2) {
      ui.state = 1;
      ui.mesh.material.map = ui.tex1; // 기본 상태의 텍스처로 변경
      // 클릭된 UI의 함수 호출
      ui.functionName();
    }
  }
  selectedUi = null; // 클릭된 UI를 초기화
}

// 게임 오버 애니메이션이 모두 끝난 후 한 번 호출되는 함수
export function gameOver() {
  // 게임 오버 텍스트와 배경을 2초 후에 표시
  setTimeout(() => {
    const textMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });

    // Game Over! 라는 텍스트를 씬에 추가
    const textGeometry = new TextGeometry("Game Over!", {
      font: loadedFont,
      size: 100,
      height: 1,
      curveSegments: 12,
    });
    textGeometry.center();
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(960, 540, 113); // 화면 중앙에 위치


    // 텍스트 뒤에 반투명한 어두운 배경 추가
    const backgroundGeometry = new THREE.PlaneGeometry(1920, 1080); // 화면 전체 크기
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4
    });
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.position.set(960, 540, 109); // 화면 중앙에 위치 (1080/2 = 540)
    scene.add(backgroundMesh);
    scene.add(textMesh);

    // Score: 점수라는 텍스트를 씬에 추가
    // 이때 점수는 states.js의 elapsedTime를 이용하여 계산
    const score = states.elapsedTime;
    const viewedScore = score.toFixed(2);
    const scoreTextGeometry = new TextGeometry(`Score: ${viewedScore} seconds`, {
      font: loadedFont,
      size: 50,
      height: 1,
      curveSegments: 12,
    });
    scoreTextGeometry.center();
    const scoreTextMesh = new THREE.Mesh(scoreTextGeometry, textMaterial);
    scoreTextMesh.position.set(960, 720, 110); // 화면 중앙 위에 위치

    scene.add(scoreTextMesh);
  }, 2500); // 2초 지연
}
