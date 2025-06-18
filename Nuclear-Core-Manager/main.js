import * as gameDisplay from "./gameDisplay.js";
import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as nukeEndScene from "./scenes/nukeEndScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";
import * as uiClass from "./uiClass.js";

import { TICKS_PER_SECOND, RENDER_DEBUG } from "./params.js";

renderClass.init();
gameDisplay.init();
await uiClass.init();
cityScene.init();
nukeScene.init();
nukeEndScene.init();
roomScene.init();
const renderer = renderClass.renderer; // 렌더러는 유일하므로 클래스에서 빼낸다.
windowHandler.init();
controls.init();
states.init();
mouseMove.init();

nukeScene.initUi();

const intervalId = setInterval(() => {
  if (states.isGameOver) {
    clearInterval(intervalId); // 게임 오버 시 interval 중지
    return;
  }
  nukeScene.tick();
  states.tick();
}, 1000 / TICKS_PER_SECOND);

// 로딩 화면 관리
const loadingScreen = document.getElementById('loading-screen');
let loadingCount = 0;

export const showLoading = () => {
  loadingCount++;
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }
};

export const hideLoading = () => {
  loadingCount--;
  if (loadingCount <= 0 && loadingScreen) {
    loadingCount = 0;
    loadingScreen.style.display = 'none';
  }
};

// 초기 로딩 화면 표시
showLoading();

function animate() {
  controls.update();
  if (nukeScene.camera.position.y < 0) {
    nukeScene.camera.position.y = 0; // 카메라가 바닥 아래로 내려가지 않도록 제한
  }
  cityScene.update();
  uiClass.updateBars();
  roomScene.update();

  // 1. 전체 캔버스를 '레터박스 색'으로 지운다
  // viewport/scissor를 캔버스 전체로 설정
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  // clearColor를 레터박스 색으로 지정하고 clear()
  renderer.setClearColor(0xf0d0e0);
  renderer.clear();

  // 2. 16:9 비율의 영역을 게임 영역으로 설정
  let rect = gameDisplay.rect;
  renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
  renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
  // clearColor를 게임 영역 색으로 지정하고 clear()
  renderer.setClearColor(0xe0f0d0);
  renderer.clear();

  // 3. 도시 씬을 렌더링
  rect = windowHandler.cityDisplay;
  renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
  renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
  renderer.render(cityScene.scene, cityScene.camera);

  // 4. 핵 코어 씬을 렌더링
  rect = windowHandler.nukeDisplay;
  renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
  renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
  if (!states.isNukeExploded) {
    renderer.render(nukeScene.scene, nukeScene.camera);
  } else {
    renderer.render(nukeEndScene.scene, nukeEndScene.camera);
  }

  // 5. 방 씬을 렌더링
  rect = windowHandler.roomDisplay;
  renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
  renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
  renderer.render(roomScene.scene, roomScene.camera);

  // 6. UI 렌더링
  rect = gameDisplay.rect;
  renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
  renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
  renderer.render(uiClass.scene, uiClass.camera);

  requestAnimationFrame(animate);
}

animate(); // 애니메이션 시작
