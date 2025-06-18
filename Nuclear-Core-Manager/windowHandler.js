import * as THREE from "three";

import * as gameDisplay from "./gameDisplay.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";
import * as uiClass from "./uiClass.js";

import { ASPECT_RATIO, LOG_DEBUG } from "./params.js";

let renderer;

// 객체 내부 변수들
export let cityDisplay;
export let nukeDisplay;
export let roomDisplay;

export let width;

export function init() {
  renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.

  // 화면 크기들을 계산
  onResize();
  window.addEventListener("resize", () => this.onResize(), false);
}

export function onResize() {
  width = window.innerWidth;
  nukeScene.updateNeutronSize();
  gameDisplay.update();
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);

  // 여기서 각 창들의 위치와 크기를 변경할 수 있다.
  cityDisplay = gameDisplay.calcRect(985, 565, 1870, 1030);
  nukeDisplay = gameDisplay.calcRect(1185, 50, 1870, 515);
  roomDisplay = gameDisplay.calcRect(100, 200, 935, 1030);

  // 카메라들의 비율을 업데이트
  cityScene.camera.aspect = cityDisplay.width / cityDisplay.height;
  nukeScene.camera.aspect = nukeDisplay.width / nukeDisplay.height;
  roomScene.camera.aspect = roomDisplay.width / roomDisplay.height;
  cityScene.camera.updateProjectionMatrix();
  nukeScene.camera.updateProjectionMatrix();
  roomScene.camera.updateProjectionMatrix();
}
