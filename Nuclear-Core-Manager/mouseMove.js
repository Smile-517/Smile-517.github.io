import * as gameDisplay from "./gameDisplay.js";
import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as uiClass from "./uiClass.js";

let renderer;

// 객체 내부 변수들
export let mouseClicked;
export let mouseX;
export let mouseY;

export function init() {
  renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.
  mouseClicked = false;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    mouseClicked = true;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    mouseClicked = false;
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    mouseX = event.clientX - canvasRect.left;
    const mouseY0 = event.clientY - canvasRect.top;
    const canvasHeight = canvasRect.height;
    mouseY = canvasHeight - mouseY0;

    // nuke 뷰포트 영역 체크 및 OrbitControls 활성화
    controls.setOrbicControls(mouseX, mouseY);

    uiClass.isMouseOver();
  });
}
