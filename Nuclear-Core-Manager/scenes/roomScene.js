import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RENDER_DEBUG } from "../params.js";
import * as controls from "../controls.js";
import * as renderClass from "../renderClass.js";
import * as states from "../states.js";
import { showLoading, hideLoading } from '../main.js';

// 객체 내부 변수들
export let scene;
export let camera;
export let pointLight;
let gltfLoader;
let axesHelper;
let pointLightHelper;
let mixer;
let clock = new THREE.Clock();
let monitorMixers = [];
let robot;
let originalModels = []; // 원래 모델들을 저장할 배열
let monitorModels = [];

let isDeathSequenceStarted = false;
let deathSequenceTimer = 0;
let colorBars;
let hasPlayedThumbsUp = false; // ThumbsUp 애니메이션 재생 여부를 추적

export function init() {
  // init 함수는 제공해주신 코드와 동일합니다.
  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd0e0f0);

  // camera
  camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, -8.5);
  camera.updateProjectionMatrix();
  scene.add(camera);

  // OrbitControls 설정
  controls.settingOrbitControls(renderClass.renderer);

  // ambient light (기본 조명)
  const ambientLight = new THREE.AmbientLight(0xc5d1eb, 0.25);
  scene.add(ambientLight);

  // point light (방 안의 조명)
  pointLight = new THREE.PointLight(0xffffff, 100.0);
  pointLight.position.set(0, 5, -1);
  pointLight.distance = 6.5;
  pointLight.decay = 1.5;
  pointLight.castShadow = true;
  scene.add(pointLight);

  // 방
  const roomGeometry = new THREE.BoxGeometry(15, 15, 15);
  const roomMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x868e96,
    side: THREE.BackSide
  });
  const room = new THREE.Mesh(roomGeometry, roomMaterial);
  room.position.set(0, 7.5, 0);
  room.receiveShadow = true;
  scene.add(room);

  // GLTFLoader 초기화
  gltfLoader = new GLTFLoader();

  // 모델 로딩을 Promise로 처리
  const loadModel = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          if (options.position) model.position.set(...options.position);
          if (options.scale) model.scale.set(...options.scale);
          if (options.rotation) model.rotation.y = options.rotation;
          model.castShadow = true;
          model.receiveShadow = true;
          scene.add(model);
          resolve({ model, gltf });
        },
        (xhr) => {},
        (error) => {
          console.error(`Error loading ${url}:`, error);
          reject(error);
        }
      );
    });
  };

  // 모든 모델을 동시에 로드
  Promise.all([
    loadModel('./assets/models/RobotExpressive.glb', {  // 로컬 파일로 변경
      position: [0, 0.3, 0.15], scale: [0.3, 0.3, 0.3], rotation: Math.PI
    }),
    loadModel('./assets/models/Office Chair.glb', {  // 파일명 수정
      position: [0, 0, 0.5], scale: [1.1, 1.1, 1.1], rotation: Math.PI
    }),
    loadModel('./assets/models/computer_desk.glb', {
      position: [0, 0, 0], scale: [0.015, 0.015, 0.015], rotation: 0
    }),
    loadModel('./assets/models/sci_fi_monitor.glb', {
      position: [0, 1.5, -1], scale: [5.0, 5.0, 5.0], rotation: 0
    }),
    loadModel('./assets/models/sci_fi_monitor.glb', {
      position: [-1.5, 1.5, -1], scale: [5.0, 5.0, 5.0], rotation: 0
    }),
    loadModel('./assets/models/sci_fi_monitor.glb', {
      position: [1.5, 1.5, -1], scale: [5.0, 5.0, 5.0], rotation: 0
    }),
    loadModel('./assets/models/sci_fi_monitor.glb', {
      position: [-0.75, 2.3, -1], scale: [5.0, 5.0, 5.0], rotation: 0
    }),
    loadModel('./assets/models/sci_fi_monitor.glb', {
      position: [0.75, 2.3, -1], scale: [5.0, 5.0, 5.0], rotation: 0
    }),
  ]).then(([robotResult, chair, desk, monitor1, monitor2, monitor3, monitor4, monitor5]) => {
    robot = robotResult;
    originalModels = [chair, desk, monitor1, monitor2, monitor3, monitor4, monitor5];
    monitorModels = [monitor1, monitor2, monitor3, monitor4, monitor5];
    
    desk.model.traverse(child => {
      if (child.isMesh) {
        child.material.depthTest = true; // 깊이 테스트 활성화
        child.material.depthWrite = true; // 깊이 쓰기 활성화
      }
    })

    if (robot && robot.model && robot.gltf && robot.gltf.animations) {
      mixer = new THREE.AnimationMixer(robot.model);
      const sittingClip = robot.gltf.animations.find(clip => clip.name === 'Sitting');
      if (sittingClip) {
        const action = mixer.clipAction(sittingClip);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();
      }
    }

    [monitor1, monitor2, monitor3, monitor4, monitor5].forEach((monitor) => {
      if (monitor && monitor.model && monitor.gltf && monitor.gltf.animations.length > 0) {
        const monitorMixer = new THREE.AnimationMixer(monitor.model);
        const action = monitorMixer.clipAction(monitor.gltf.animations[0]);
        action.setLoop(THREE.LoopRepeat);
        action.time = Math.random() * action.getClip().duration;
        action.timeScale = 0.8 + Math.random() * 0.4;
        action.play();
        monitorMixers.push(monitorMixer);
      }
    });

    hideLoading();
  }).catch(error => {
    console.error('Error loading models:', error);
    hideLoading();
  });

  if (RENDER_DEBUG) {
    axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
    scene.add(pointLightHelper);
  }
}

export function update() {
    const delta = clock.getDelta();

    // 온도에 따른 로봇 표정 변화
    if (robot && robot.model && robot.gltf && robot.gltf.animations) {
      const ratio = states.coreTemp / 2000;
      if (ratio <= 0.75) {
        // 75% 이하일 때는 surprised를 0으로 유지
        if (robot.morphTargetDictionary && robot.morphTargetDictionary.surprised !== undefined) {
          robot.model.morphTargetInfluences[robot.morphTargetDictionary.surprised] = 0;
        }
      } else {
        // 75% 이상일 때는 온도에 따라 surprised 값을 증가
        const t = (ratio - 0.75) / 0.25; // 0에서 1 사이의 값으로 정규화
        if (robot.morphTargetDictionary && robot.morphTargetDictionary.surprised !== undefined) {
          robot.model.morphTargetInfluences[robot.morphTargetDictionary.surprised] = t;
        }
      }
    }

    // 정전으로 인한 게임 오버일 때 모니터 모델들만 제거
    if (states.isGameOver && states.isPowerOutage) {
      // 모든 모니터 애니메이션 중지
      monitorMixers.forEach(mixer => mixer.stopAllAction());
      
      // 모니터 모델들만 제거
      monitorModels.forEach(modelData => {
        if (modelData && modelData.model) {
          scene.remove(modelData.model);
          modelData.model.traverse(child => {
            if (child.isMesh) {
              child.geometry.dispose();
              if(child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          });
        }
      });
    }

    // 게임이 시작되면 ThumbsUp 애니메이션 재생
    if (states.isGameStarted && !hasPlayedThumbsUp && mixer) {
      hasPlayedThumbsUp = true; // 플래그를 먼저 올려 중복 실행 방지
      
      const thumbsUpClip = robot.gltf.animations.find(clip => clip.name === 'ThumbsUp');
      if (thumbsUpClip) {
          mixer.stopAllAction(); // 현재 애니메이션(Sitting)을 멈춤
          const thumbsUpAction = mixer.clipAction(thumbsUpClip);
          thumbsUpAction.setLoop(THREE.LoopOnce);
          thumbsUpAction.clampWhenFinished = true;
          thumbsUpAction.play();

          const onThumbsUpFinished = (event) => {
              // 이 이벤트가 ThumbsUp 애니메이션에 의해서만 발생했는지 확인
              if (event.action === thumbsUpAction) {
                  const sittingClip = robot.gltf.animations.find(clip => clip.name === 'Sitting');
                  if (sittingClip) {
                      mixer.stopAllAction(); // ThumbsUp을 멈추고
                      const sittingAction = mixer.clipAction(sittingClip);
                      sittingAction.setLoop(THREE.LoopOnce);
                      sittingAction.play();
                  }
                  mixer.removeEventListener('finished', onThumbsUpFinished);
              }
          };
          mixer.addEventListener('finished', onThumbsUpFinished);
      }
  }

    // 게임 오버 연출 시작 (단 한 번만 실행)
    if (states.isNukeExploded && !isDeathSequenceStarted) {
        isDeathSequenceStarted = true; // 플래그를 올려 다시는 이 코드가 실행되지 않게 함
        deathSequenceTimer = 0;

        // 진행 중이던 모든 애니메이션 정지
        monitorMixers.forEach(mixer => mixer.stopAllAction());
        if (mixer) mixer.stopAllAction();

        // 먼저 다른 모델들을 제거
        originalModels.forEach(modelData => {
            if (modelData && modelData.model) {
                scene.remove(modelData.model);
                modelData.model.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if(child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                });
            }
        });
        originalModels = [];

        // 그 다음 SMPTE 컬러바 생성 및 표시
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('assets/textures/SMPTE_Color_Bars.png', (texture) => {
            // 화면을 덮는 평면을 카메라의 자식으로 추가하여 항상 화면 앞에 보이게 함
            const planeHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 3;
            const planeWidth = planeHeight * camera.aspect;
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const material = new THREE.MeshBasicMaterial({ 
                map: texture, 
                depthTest: false,
                depthWrite: false
            });
            colorBars = new THREE.Mesh(geometry, material);
            colorBars.position.set(0, 0, -3); // 카메라 로컬 위치에서 3만큼 앞에 배치
            camera.add(colorBars); // 카메라의 자식으로 추가
        });
    }

    // 게임 오버 연출 (타이머 사용)
    if (isDeathSequenceStarted && deathSequenceTimer >= 0) {
        deathSequenceTimer += delta; // 델타 시간을 더해 타이머 진행

        // 1초가 지나면 다음 단계 실행
        if (deathSequenceTimer > 1.0) {
            // 컬러바 제거 및 리소스 정리
            if (colorBars) {
                camera.remove(colorBars);
                colorBars.geometry.dispose();
                if (colorBars.material.map) colorBars.material.map.dispose();
                colorBars.material.dispose();
                colorBars = null;
            }

            // 로봇 위치 조정 및 Death 애니메이션 재생
            if (robot && robot.model && mixer) {
                robot.model.position.set(0, 0, 0);
                robot.model.scale.set(0.4, 0.4, 0.4);
                
                const deathClip = robot.gltf.animations.find(clip => clip.name === 'Death');
                if (deathClip) {
                    const action = mixer.clipAction(deathClip);
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    action.play();
                }
            }

            // 타이머를 비활성화하여 이 블록이 더 이상 실행되지 않게 함
            deathSequenceTimer = -1;
        }
    }
    
    // 항상 애니메이션 믹서 업데이트
    if (mixer) {
        mixer.update(delta);
    }
    // 게임 중일 때만 모니터 애니메이션 업데이트
    if (!states.isGameOver) {
        monitorMixers.forEach(mixer => mixer.update(delta));
    }
}