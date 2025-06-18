import * as THREE from "three";

import * as gameDisplay from "./gameDisplay.js";
import * as windowHandler from "./windowHandler.js";
import * as cityScene from "./scenes/cityScene.js";
import * as nukeScene from "./scenes/nukeScene.js";
import * as roomScene from "./scenes/roomScene.js";
import * as renderClass from "./renderClass.js";
import * as controls from "./controls.js";
import * as states from "./states.js";
import * as mouseMove from "./mouseMove.js";
import * as uiClass from "./uiClass.js";

import {
  LEN_ONE_DAY,
  LOG_DEBUG,
  COOLING_RATE,
  TICKS_PER_SECOND,
  PROB_GAMR_OVER,
  STARTING_HEAT,
  DEMAND_CHANGE_RATE,
  PANELTY_RATE,
  MAX_DEMAND,
  MIN_DEMAND,
} from "./params.js";

// 객체 내부 변수들
let clock;
let gameStartTime;
let gameEndTime;
export let elapsedTime;
const MID_DEMAND = (MAX_DEMAND + MIN_DEMAND) / 2; // 요구 열의 중간값
export let dayTime;
export let coreTemp;
export let demendedHeat;
export let isGameStarted;
export let isGameOver; // 게임이 오버되면 true로 설정
export let isNukeExploded; // 게임이 오버된 이유가 핵 폭발일 때 true로 설정
export let isPowerOutage; // 게임이 오버된 이유가 정전일 때 true로 설정

export function init() {
  clock = new THREE.Clock();
  dayTime = 0; // 단위: 하루
  coreTemp = 25; // 단위: 섭씨
  demendedHeat = 0;
  isGameStarted = false;
  isGameOver = false;
  isNukeExploded = false;
  isPowerOutage = false;

  _initUi();
}

// 이 함수는 1초에 TICKS_PER_SECOND번 호출된다는 것을 유의
// -> TICKS_PER_SECOND로 나누어야 하는 계산이 있다.
export function tick() {
  // 계산 전에 게임이 오버되었는지 먼저 확인
  // 핵폭발 게임 오버
  if (isGameStarted && coreTemp > 2000) {
    // 온도가 2000도 이상이 되면 일정 확률로 게임 오버
    const diff = coreTemp - 2000;
    if (Math.random() < (diff * PROB_GAMR_OVER) / TICKS_PER_SECOND) {
      _explodeNuke();
    }
  }
  // 정전 게임 오버
  if (isGameStarted && coreTemp < demendedHeat) {
    // 온도가 요구 열보다 낮아지면 즉시 정전 게임 오버
    _powerOutage();
  }

  dayTime = clock.getElapsedTime() / LEN_ONE_DAY;

  // 요구 전력량 계산
  if (isGameStarted) {
    let change = 0;
    if (!isGameOver) {
      // 랜덤한 요구 열의 변화량을 생성
      let randomChange = (Math.random() - 0.5) * 2 * DEMAND_CHANGE_RATE; // -DEMAND_CHANGE_RATE ~ DEMAND_CHANGE_RATE 범위

      // 만약 요구 열이 최대값이나 최소값에 가까우면 그 방향의 randomChange를 줄인다
      let diffRatio = Math.abs(
        (demendedHeat - MID_DEMAND) / (MAX_DEMAND - MIN_DEMAND)
      );
      if (diffRatio > 1) diffRatio = 1; // diffRatio는 0~1 사이로 제한
      if (demendedHeat >= MID_DEMAND && randomChange > 0) {
        // 최대값에 가까울 때
        randomChange *= 1 - diffRatio;
      } else if (demendedHeat <= MID_DEMAND && randomChange < 0) {
        // 최소값에 가까울 때
        randomChange *= 1 - diffRatio;
      }
      change = randomChange;
    } else {
      // 게임이 끝났다면 요구 열을 서서히 0까지 감소시킨다.
      if (demendedHeat > 0) {
        change = -DEMAND_CHANGE_RATE / 4;
      }
    }

    // 요구 열을 업데이트
    if (demendedHeat >= 0) {
      demendedHeat += change / TICKS_PER_SECOND;
    } else {
      demendedHeat = 0; // 요구 열이 음수가 되지 않도록
    }
  }

  // 요구 열에 의한 UI 업데이트
  uiClass.updateBarIndicator();

  // 온도가 STARTING_HEAT 이상이 되면 게임 시작
  if (!isGameStarted && coreTemp >= STARTING_HEAT) {
    _gameStart();
  }

  // 온도가 25도 이상일 때 서서히 감소
  if (!isNukeExploded) {
    if (coreTemp > 25) {
      const diff = coreTemp - 25;
      coreTemp -= (diff * COOLING_RATE * 200) / TICKS_PER_SECOND;
    }
  }

  // 온도가 최대 온도의 75% 이상일 때 tempBar 색상과 연료봉 색상을 변경
  const ratio = coreTemp / 2000;
  if (ratio <= 0.75) {
    // tempBar
    uiClass.tempBar.innerMesh.material.color.setRGB(
      uiClass.defaultColorFloat.r,
      uiClass.defaultColorFloat.g,
      uiClass.defaultColorFloat.b
    );
    // 연료봉 emissive
    nukeScene.fuelRodMaterial.emissiveIntensity = 0;
    // 연료봉 위의 basic sphere 색상
    nukeScene.setFuelRodBasicSphereColor(
      nukeScene.fuelRodBasicSphereDefaultColor
    );
  } else {
    // tempBar
    const t = (ratio - 0.75) / 0.25;
    let r =
      uiClass.defaultColorFloat.r * (1 - t) + uiClass.alertColorFloat.r * t;
    let g =
      uiClass.defaultColorFloat.g * (1 - t) + uiClass.alertColorFloat.g * t;
    let b =
      uiClass.defaultColorFloat.b * (1 - t) + uiClass.alertColorFloat.b * t;
    uiClass.tempBar.innerMesh.material.color.setRGB(r, g, b);
    // 연료봉 emissive
    nukeScene.fuelRodMaterial.emissiveIntensity = t * 0.5;
    // 연료봉 위의 basic sphere 색상
    r =
      nukeScene.fuelRodBasicSphereDefaultColor.r * (1 - t) +
      nukeScene.fuelRodBasicSphereHeatedColor.r * t;
    g =
      nukeScene.fuelRodBasicSphereDefaultColor.g * (1 - t) +
      nukeScene.fuelRodBasicSphereHeatedColor.g * t;
    b =
      nukeScene.fuelRodBasicSphereDefaultColor.b * (1 - t) +
      nukeScene.fuelRodBasicSphereHeatedColor.b * t;
    nukeScene.setFuelRodBasicSphereColor(new THREE.Color(r, g, b));
  }
}

export function incrCoreTemp(value = 1) {
  coreTemp += value;
}

function _initUi() {
  // tempBar 초기화
  uiClass.createBar(
    985,
    50,
    1035,
    515,
    "states.coreTemp",
    0,
    2000,
    "up",
    8, // offset
    "tempBar"
  );

  // 요구 전력량 indicator 초기화
  uiClass.createBarIndicator(
    985,
    50,
    1035,
    515,
    "states.demendedHeat",
    0,
    2000,
    "up",
    8 // offset
  );
}

function _gameStart() {
  if (isGameStarted) return; // 이미 게임이 시작되었으면 무시
  isGameStarted = true;
  gameStartTime = clock.getElapsedTime(); // 게임 시작 시간 기록
  console.log("Game started! Core temperature: " + coreTemp.toFixed(2) + "°C");
}

// 일정 온도를 넘어 핵이 폭발하는 조건이 만족될 때 호출되는 함수
function _explodeNuke() {
  if (isNukeExploded || isGameOver) return; // 이미 게임 오버 상태면 리턴
  isNukeExploded = true; // 핵 폭발로 인한 게임 오버
  _gameOver();
  console.log(
    "Game Over! Core temperature exceeded safe limits. Core temperature: " +
      coreTemp.toFixed(2) +
      "°C"
  );
}

// 정전이 일어나는 조건이 만족될 때 호출되는 함수
function _powerOutage() {
  if (isPowerOutage || isGameOver) return; // 이미 게임 오버 상태면 리턴
  isPowerOutage = true; // 정전으로 인한 게임 오버
  _gameOver();
  console.log(
    "Game Over! Power outage due to low core temperature. Core temperature: " +
      coreTemp.toFixed(2) +
      "°C"
  );

  // 각 씬의 조명 끄기
  nukeScene.spotLight.intensity = 0;
  roomScene.pointLight.intensity = 0;
}

// 게임이 오버되는 조건을 만족할 때 호출되는 함수
function _gameOver() {
  if (isGameOver) return; // 이미 게임 오버 상태라면 무시
  isGameOver = true;
  gameEndTime = clock.getElapsedTime(); // 게임 종료 시간 기록
  elapsedTime = gameEndTime - gameStartTime; // 게임이 시작된 후 경과 시간 계산
  console.log("Game Over! Elapsed time: " + elapsedTime.toFixed(2) + " seconds");
  uiClass.gameOver();
  
}
