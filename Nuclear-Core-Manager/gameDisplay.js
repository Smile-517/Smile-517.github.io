import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";
import * as uiClass from "./uiClass.js";

import { ASPECT_RATIO } from "./params.js";

export let rect;

export function init() {
  update();
}

export function update() {
  const windowAspect = window.innerWidth / window.innerHeight;
  let newWidth, newHeight;
  if (windowAspect > ASPECT_RATIO) {
    newWidth = window.innerHeight * ASPECT_RATIO;
    newHeight = window.innerHeight;
  } else {
    newWidth = window.innerWidth;
    newHeight = window.innerWidth / ASPECT_RATIO;
  }
  const offsetX = (window.innerWidth - newWidth) / 2;
  const offsetY = (window.innerHeight - newHeight) / 2;

  // 이제부터 gameDisplay가 16:9 비율의 영역을 나타냄 - 전체 게임 창의 영역
  rect = {
    x: offsetX,
    y: offsetY,
    width: newWidth,
    height: newHeight,
  };
}

// 1920x1080 기준 픽셀 좌표들을 인풋으로 받아 현재 화면에 맞게 render에서 쓸 수 있는 좌표를 반환한다.
// 반환되는 좌표는 현재 화면 전체에 상대적이다.
// botLeftX: 1920x1080 기준 왼쪽 아래 x 좌표
// botLeftY: 1920x1080 기준 왼쪽 아래 y 좌표
// topRightX: 1920x1080 기준 오른쪽 위 x 좌표
// topRightY: 1920x1080 기준 오른쪽 위 y 좌표
export function calcRect(botLeftX, botLeftY, topRightX, topRightY) {
  return {
    x: botLeftX * (rect.width / 1920) + rect.x,
    y: botLeftY * (rect.height / 1080) + rect.y,
    width: (topRightX - botLeftX) * (rect.width / 1920),
    height: (topRightY - botLeftY) * (rect.height / 1080),
  };
}

// 현재 화면에서의 좌표를 받아 1920x1080 게임 영역의 좌표로 변환한다.
export function calcGameCoords(x, y) {
  return {
    x: (x - rect.x) * (1920 / rect.width),
    y: (y - rect.y) * (1080 / rect.height),
  };
}
