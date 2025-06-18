import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import * as gameDisplay from "./gameDisplay.js";
import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";
import * as uiClass from "./uiClass.js";

import { LOG_DEBUG } from "./params.js";

let renderer;

// 객체 내부 변수들
let nukeOrbitControls;
let roomOrbitControls;
let isWDown;
let isSDown;

export function init() {
  renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.

  isWDown = false;
  isSDown = false;

  settingOrbitControls(renderer);

  _addStartupListener();
  _addControlRodsListener();
}

export function settingOrbitControls(renderer) {
  renderer = renderer;
  nukeOrbitControls = new OrbitControls(nukeScene.camera, renderer.domElement);
  nukeOrbitControls.enableDamping = true; // 관성효과, 바로 멈추지 않고 부드럽게 멈춤
  nukeOrbitControls.dampingFactor = 0.5; // 감속 정도를 더 빠르게 조정
  nukeOrbitControls.rotateSpeed = 1.5; // 회전 속도 증가
  nukeOrbitControls.zoomSpeed = 1.2; // 줌 속도 조정
  nukeOrbitControls.enablePan = false; // 팬 기능 비활성화
  nukeOrbitControls.target.set(0, 2, 0); // 초기 위치 설정
  nukeOrbitControls.minDistance = 3;
  nukeOrbitControls.maxDistance = 17;
  
  // 성능 개선을 위한 추가 설정
  nukeOrbitControls.screenSpacePanning = false; // 카메라 공간 기준 이동
  nukeOrbitControls.staticMoving = true; // 정적 이동 활성화
  nukeOrbitControls.dynamicDampingFactor = 0.2; // 동적 감쇠 계수 조정
  
  // 초기에는 비활성화 상태로 시작
  nukeOrbitControls.enableRotate = false;
  nukeOrbitControls.enableZoom = false;

  roomOrbitControls = new OrbitControls(roomScene.camera, renderer.domElement);
  roomOrbitControls.enableDamping = true; // 관성효과, 바로 멈추지 않고 부드럽게 멈춤
  roomOrbitControls.dampingFactor = 0.5; // 감속 정도를 더 빠르게 조정
  roomOrbitControls.rotateSpeed = 1.5; // 회전 속도 증가
  roomOrbitControls.zoomSpeed = 1.2; // 줌 속도 조정
  roomOrbitControls.enablePan = false; // 팬 기능 비활성화
  roomOrbitControls.target.set(0, 2, 0); // 초기 위치 설정
  roomOrbitControls.minDistance = 6;
  roomOrbitControls.maxDistance = 10;
  
  // 성능 개선을 위한 추가 설정
  roomOrbitControls.screenSpacePanning = false; // 카메라 공간 기준 이동
  roomOrbitControls.staticMoving = true; // 정적 이동 활성화
  roomOrbitControls.dynamicDampingFactor = 0.2; // 동적 감쇠 계수 조정
  
  // y축 회전만 가능하도록 설정
  roomOrbitControls.minPolarAngle = Math.PI / 2; // 수직 회전 제한 (90도)
  roomOrbitControls.maxPolarAngle = Math.PI / 2; // 수직 회전 제한 (90도)
  roomOrbitControls.minAzimuthAngle = -Infinity; // 수평 회전 제한 없음
  roomOrbitControls.maxAzimuthAngle = Infinity; // 수평 회전 제한 없음
  
  // 초기에는 비활성화 상태로 시작
  roomOrbitControls.enableRotate = false;
  roomOrbitControls.enableZoom = false;

  // target 설정을 유효하게 하기 위한 업데이트
  nukeOrbitControls.update();
  roomOrbitControls.update();
}

function _addStartupListener() {
  // space키를 누르고 있을 때 isStartingUp이 true을 유지하며, space키를 떼면 false로 설정
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === " ") { // " "가 space를 의미
      nukeScene.setIsStartingUp(true);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key.toLowerCase() === " ") {
      nukeScene.setIsStartingUp(false);
    }
  });
}

function _addControlRodsListener() {
  // w키를 누르면 controlRods를 올리고, s키를 누르면 controlRods를 내림
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "w") {
      isWDown = true;
      if (isSDown === false) {
        nukeScene.setControlRodOperation(1);
      } else {
        nukeScene.setControlRodOperation(0); // w와 s가 동시에 눌리면 아무 동작도 하지 않음
      }
    } else if (event.key.toLowerCase() === "s") {
      isSDown = true;
      if (isWDown === false) {
        nukeScene.setControlRodOperation(-1);
      } else {
        nukeScene.setControlRodOperation(0); // w와 s가 동시에 눌리면 아무 동작도 하지 않음
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key.toLowerCase() === "w") {
      isWDown = false;
      if (isSDown === false) {
        nukeScene.setControlRodOperation(0); // w가 떼어지면 controlRods를 멈춤
      } else {
        nukeScene.setControlRodOperation(-1); // s가 눌려있으면 controlRods를 내림
      }
    } else if (event.key.toLowerCase() === "s") {
      isSDown = false;
      if (isWDown === false) {
        nukeScene.setControlRodOperation(0); // s가 떼어지면 controlRods를 멈춤
      } else {
        nukeScene.setControlRodOperation(1); // w가 눌려있으면 controlRods를 올림
      }
    }
  });
}

export function update() {
  // 마우스가 nuke 뷰포트 안에 있을 때만 update
  if (isInNukeArea(windowHandler.mouseX, windowHandler.mouseY)) {
    nukeOrbitControls.update();
  }
  if (isInRoomArea(windowHandler.mouseX, windowHandler.mouseY)) {
    roomOrbitControls.update();
  }
}

// 마우스가 nukeDisplay 내부면 orbitControls를 활성화하는 함수
export function setOrbicControls(mouseX, flippedY) {
  if (isInNukeArea(mouseX, flippedY)) {
    nukeOrbitControls.enableRotate = true;
    nukeOrbitControls.enableZoom = true;
  } else {
    nukeOrbitControls.enableRotate = false;
    nukeOrbitControls.enableZoom = false;
  }
  if (isInRoomArea(mouseX, flippedY)) {
    roomOrbitControls.enableRotate = true;
    roomOrbitControls.enableZoom = true;
  } else {
    roomOrbitControls.enableRotate = false;
    roomOrbitControls.enableZoom = false;
  }
}

// 이벤트가 발생한 지점이 nukeDisplay 내부인지 검사하는 헬퍼 함수
export function isInNukeArea(mouseX, flippedY) {
  const rect = windowHandler.nukeDisplay;
  return (
    mouseX >= rect.x &&
    mouseX <= rect.x + rect.width &&
    flippedY >= rect.y &&
    flippedY <= rect.y + rect.height
  );
}

// 이벤트가 발생한 지점이 roomDisplay 내부인지 검사하는 헬퍼 함수
export function isInRoomArea(mouseX, flippedY) {
  const rect = windowHandler.roomDisplay;
  return (
    mouseX >= rect.x &&
    mouseX <= rect.x + rect.width &&
    flippedY >= rect.y &&
    flippedY <= rect.y + rect.height
  );
}