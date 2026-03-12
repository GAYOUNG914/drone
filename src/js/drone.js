import './_common.js';

import * as THREE from 'three';
import { DRACOLoader, GLTFLoader, OrbitControls, RGBELoader } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';

import * as state from './_state';
import { $html, $body, areaWidth, areaHeight, _DEBUG, MODEL_PATH, onAssetLoaded, RESOURCES_PATH, HDR_PATH, PI, _CONTROL, PI2 } from './_common';
import { setGuiLight, setGuiModel, setPIP } from './_utils.js';

import Lenis from 'lenis'

/* 
  ✅ 체크사항
  * gltf 로드 후, onAssetLoaded('model'); 해주기
  * env 로드 후, onAssetLoaded('env'); 해주기 -> 두개 다 해줘야 ready가 찍힘
*/


(()=>{

  //모델 불러오기
  const $modelConWrap = document.querySelector('#modelCon');
  const $model = document.querySelector('#model');
  const $footer = document.querySelector('#footer');

  const $wrap = document.querySelector('#DRONE');
  const $sections = Array.from($wrap.children);
  const numSections = $sections.length;

  // mesh area dom setting
  let $meshAreaWraps = [];
  let $meshAreas = Array.from(document.querySelectorAll('.mesh-area'));
  $meshAreas.forEach(($meshArea) => {
    let $meshAreaWrap = $meshArea.parentNode;
    $meshAreaWraps.push($meshAreaWrap);
  });
  let $timelineMarkers = $meshAreas.map(($meshArea) => {
    return $meshArea.parentNode;
  });
  let numTimelineMarkers = $timelineMarkers.length;

  // GSAP 타임라인 설정
  const timeline = gsap.timeline({ paused: true });
  let timelineTimeStamps = [0];
  let totalDuration = 0;
  let modelSize, modelHeight;
  let cameraTarget;
  const cameraOffset = { x: 0, y: 0 };  

  const cameraRotateGroupX = new THREE.Group();
  const cameraRotateGroupY = new THREE.Group(); 
  const btnShowroom_fixed = document.querySelector('.btn-showroom.fixed');
  const btnShowrrom_this = document.querySelector('.section-6 .btn-showroom');
  const $toggleButton = document.querySelector('.propeller-toggle');


  let isPropellerActive = true;
  let requestToRender = true;
  
  let gltfLoader = new GLTFLoader();
  let dracoLoader = new DRACOLoader();

  let scene, camera, renderer, controls, mixer, model, pip, modelWrap, propellermodel, clock = new THREE.Clock();
  let currentGltf, contentHeight, currentSection;
  let ambientLight, directionalLight, pointLight, shadowLight;
  let lenis;

	let timelineSequenceIndex;




  const modelMeshes = {
    body: null,
    propeller1: null,
    propeller2: null,
    propeller3: null,
    propeller4: null,
  }

  const tools = {
    camera,
    cameraOffset,
    cameraTarget,
    cameraRotateGroupX,
    cameraRotateGroupY,
    modelSize: null, // 모델 로드 후 설정됨
    ground: null,
    shadowLight: null
  };

  const settings = {
    tone: 'Linear'
  };

  //로더 세팅
  function setLoaders () {
    dracoLoader.setDecoderPath(RESOURCES_PATH + 'draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
  }


  // 캔버스 세팅 - 씬, 카메라, 렌더러, 컨트롤
  function setCanvas(){

    // 씬 생성
    scene = new THREE.Scene();
    scene.background = null;

    // 카메라 설정
    camera = new THREE.PerspectiveCamera(
      45,  // FOV (시야각)
      areaWidth / areaHeight,  // 화면 비율
      0.1,  // near (가까운 클리핑 평면)
      9999  // far (먼 클리핑 평면)
    );
    camera.position.set(0, 0, 10);  // 카메라 위치  

    // tools 객체 업데이트
    tools.camera = camera;  // 여기에 camera 참조 업데이트 추가

    // 카메라 그룹 설정
    // cameraTarget = scene.position.clone();
    cameraTarget = new THREE.Vector3(0, 0, 0); // 카메라가 바라볼 중심점을 원점으로 설정
    tools.cameraTarget = cameraTarget;
    camera.lookAt(cameraTarget);

    cameraRotateGroupX.rotation.y = 0;
    cameraRotateGroupX.add(cameraRotateGroupY);//이들을 중첩해서 사용함으로써 X축과 Y축 회전을 독립적으로 제어할 수 있습니다
    cameraRotateGroupY.add(camera);//카메라를 가장 안쪽 그룹에 추가함으로써, 부모 그룹들의 회전이 카메라에 누적되어 적용됩니다 
    scene.add(cameraRotateGroupX);//-> 짐벌 같은 효과

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({ 
      antialias: true  // 계단현상 방지
      , alpha: true // 투명도 활성화
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(areaWidth, areaHeight);
    renderer.setClearColor(0x000000, 0);  // 배경색 // 두 번째 파라미터로 0을 주면 완전 투명
    // 렌더러에 그림자 설정 활성화
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

    //기본적인 컨트롤 추가:
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false;
    controls.enableDamping = true;  // 부드러운 카메라 움직임
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.7;
    // controls.dampingFactor = 0.05;    
    controls.addEventListener('change', () => {
      renderRequest();
    })

    $model.appendChild(renderer.domElement);  

    setLight();
    setModel();
  }

  // 조명세팅
  function setLight(){
    // 1. 환경광(AmbientLight) - 장면 전체를 부드럽게 비춤, 전체적인 밝기
    ambientLight = new THREE.AmbientLight(
        0xffffff,  // 색상 (흰색)
        5        // 강도 (기존 0.5에서 증가)
    );
    scene.add(ambientLight);

    // 2. 직사광(DirectionalLight) - 태양광처럼 한 방향에서 비춤,  주요 그림자와 하이라이트
    directionalLight = new THREE.DirectionalLight(
        0xffffff,  // 색상
        2          // 강도 (기존 1에서 증가)
    );
    // 위치 조정 (오른쪽 위에서 비추도록)
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // 3. 포인트 라이트 추가 (전구처럼 한 점에서 모든 방향으로 빛남), 특정 부분을 강조
    pointLight = new THREE.PointLight(
        0xffffff,  // 색상
        1,         // 강도
        100        // 빛이 도달하는 최대 거리
    );

    if (_DEBUG) {  // 디버그 모드일 때만 표시
      const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
      scene.add(directionalLightHelper);

      const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.5);
      scene.add(pointLightHelper);
  }

    pointLight.position.set(-5, 5, 5);  // 왼쪽 위에 배치
    scene.add(pointLight);

    // GUI에 새로운 조명도 추가
    setGuiLight([ambientLight, directionalLight, pointLight]);
  }

  // 원래 상태를 저장할 변수들 추가
// const originalState = {
//   position: { x: 0, y: 0, z: 0 },
//   rotation: { x: 0, y: 0, z: 0 },
//   scale: { x: 1, y: 1, z: 1 }
// };

// // 초기 상태 저장 함수
// function saveOriginalState() {
//   originalState.position = {
//       x: model.position.x,
//       y: model.position.y,
//       z: model.position.z
//   };
//   originalState.rotation = {
//       x: model.rotation.x,
//       y: model.rotation.y,
//       z: model.rotation.z
//   };
//   originalState.scale = {
//       x: model.scale.x,
//       y: model.scale.y,
//       z: model.scale.z
//   };
// }

  // 모델 로드
  function setModel() {
    gltfLoader.load(MODEL_PATH + 'drone/' + 'drone33.glb', (gltf) => {

      modelWrap = gltf;
      model = gltf.scene;
      
      model.rotation.set(0, 0, 0); 
      model.position.set(0, 0, 0);
      // model.scale.multiplyScalar(3);

      // 바닥 평면 생성 (그림자를 받을 면)
      const groundGeometry = new THREE.PlaneGeometry(20, 20);
      const groundMaterial = new THREE.ShadowMaterial({
          opacity: 0.2,
          transparent: true
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      ground.receiveShadow = true; //그림자가 생기기 위한 모델에도 cast,receiveShadow 해줘야함
      scene.add(ground);

      // 그림자를 만들 조명 설정
      shadowLight = new THREE.DirectionalLight(0xffffff, 1);
      shadowLight.position.set(0.01, 8, 0.7);
      shadowLight.castShadow = true;
      
      // 그림자 품질 설정
      shadowLight.shadow.mapSize.width = 768;
      shadowLight.shadow.mapSize.height = 768;
      shadowLight.shadow.camera.near = 1;
      shadowLight.shadow.camera.far = 20;
      shadowLight.shadow.camera.left = -5;
      shadowLight.shadow.camera.right = 5;
      shadowLight.shadow.camera.top = 5;
      shadowLight.shadow.camera.bottom = -5;
      shadowLight.shadow.bias = -0.001;
      
      scene.add(shadowLight);

      // DEBUG 모드일 때 그림자 카메라 헬퍼 추가
      if (_DEBUG) {
          const shadowCameraHelper = new THREE.CameraHelper(shadowLight.shadow.camera);
          scene.add(shadowCameraHelper);
          
          const shadowLightHelper = new THREE.DirectionalLightHelper(shadowLight, 2);
          scene.add(shadowLightHelper);

          // GUI 컨트롤 추가
          const shadowFolder = _DEBUG.gui.addFolder('Shados-Light');
          const groundFolder = _DEBUG.gui.addFolder('Shadow-Ground');
          shadowFolder.add(shadowLight.position, 'x', -10, 10).name('Light X');
          shadowFolder.add(shadowLight.position, 'y', 0, 20).name('Light Y');
          shadowFolder.add(shadowLight.position, 'z', -10, 10).name('Light Z');
          shadowFolder.add(shadowLight, 'intensity', 0, 3).name('Intensity');
          shadowFolder.add(ground.material, 'opacity', 0, 1).name('Shadow Opacity');

          groundFolder.add(ground.position, 'x', -10, 10).name('ground X');
          groundFolder.add(ground.position, 'y', -10, 10).name('ground y');
          groundFolder.add(ground.position, 'z', -10, 10).name('ground z');
          groundFolder.add(ground.scale, 'x', -10, 10).name('scale x');
          groundFolder.add(ground.scale, 'y', -10, 10).name('scale y');
          groundFolder.add(ground.scale, 'z', -10, 10).name('scale z');
      }

      // 부유 효과에서 그림자 제어를 위한 참조 저장
      tools.ground = ground;
      tools.shadowLight = shadowLight;

      currentGltf = gltf;

      if(_DEBUG){
        propellermodel = _DEBUG.gui.addFolder('propeller Model');
      }  

      model.traverse((child) => {

        if(child.isObject3D) {
          // gui추가
          if (child.name == 'PROPELLER1_low') {
              modelMeshes.propeller1 = child;
            if(_DEBUG){
              propellermodel.add(child.rotation, 'z', -10, 10, 0.01).name('propeller1_Z');
              propellermodel.add(child.rotation, 'y', -10, 10, 0.01).name('propeller1_Y');
            }
          }
          if (child.name == 'PROPELLER2_low') {
            modelMeshes.propeller2 = child;
            if(_DEBUG){
              propellermodel.add(child.rotation, 'z', -10, 10, 0.01).name('propeller2_Z');
            }
          }
          if (child.name == 'PROPELLER3_low') {
            modelMeshes.propeller3 = child;
            if(_DEBUG){
              propellermodel.add(child.rotation, 'z', -10, 10, 0.01).name('propeller3_Z');
            }
          }
          if (child.name == 'PROPELLER4_low') {
            modelMeshes.propeller4 = child;
            if(_DEBUG){
              propellermodel.add(child.rotation, 'z', -10, 10, 0.01).name('propeller4_Z');
            }
          }
        }
        
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material.transparent = true;

          if(child.name.indexOf('COQUE') > -1){
            modelMeshes.body = child;
            child.material.roughness = 0.6;
          }
        }

      });      

    // GUI controls 추가 -> util 함수 썼음
    // if (_DEBUG) {
    //   const folderModel = _DEBUG.gui.addFolder('Drone Model');
      
    //   folderModel.add(model.position, 'x', -10, 10, 0.01).name('position X');
    //   folderModel.add(model.position, 'y', -10, 10, 0.01).name('position Y');
    //   folderModel.add(model.position, 'z', -10, 10, 0.01).name('position Z');
    //   folderModel.add(model.rotation, 'x', -10, 10, 0.01).name('rotation X');
    //   folderModel.add(model.rotation, 'y', -10, 10, 0.01).name('rotation Y');
    //   folderModel.add(model.rotation, 'z', -10, 10, 0.01).name('rotation Z');
    //   folderModel.add(model.scale, 'x', 0, 5, 0.01).name('scale X');
    //   folderModel.add(model.scale, 'y', 0, 5, 0.01).name('scale Y');
    //   folderModel.add(model.scale, 'z', 0, 5, 0.01).name('scale Z');
      
    //   // 모델 전체 표시/숨김 컨트롤 추가
    //   const modelControls = {
    //     visible: true
    //   };
    //   folderModel.add(modelControls, 'visible')
    //     .name('Show Model')
    //     .onChange((value) => {
    //       model.visible = value;
    //     });
    // }

      // 여기에 모델 크기 정보 저장 코드 추가
      modelSize = new THREE.Box3().setFromObject(model);
      modelHeight = modelSize.max.y - modelSize.min.y;
      tools.modelSize = modelSize; // tools 객체에 모델 사이즈 저장

      saveCurrentState();
      
      scene.add(model);

      if (window._DEBUG) {
        onReady();
      } 
      else {

        // 모델 날아오는 효과 추가
        // model.position.set(0, -5, -10); // 시작 위치
        // model.rotation.set(-0.5, 0, 0); // 시작 각도

        // gsap.timeline()
        //  .to(model.position, {
        //    y: 0,
        //    z: 0,
        //    duration: 1.5, 
        //    ease: "power3.out"
        //  })
        //  .to(model.rotation, {
        //    x: 0,
        //    duration: 1.2,
        //    ease: "power2.out" 
        //  }, "-=1.2"); // 회전을 position 애니메이션과 동시에 시작        
      }

      onAssetLoaded('model');
      modelAnimation(model, gltf); //모든 모델 애니메이션 play
      // stopAnimation(0);
      onReady();

      createTimeline();
      onResize();

      gsap.ticker.add(animate);
    });
  }

  // 모델 애니메이션
  function modelAnimation(model, gltf) {
    mixer = new THREE.AnimationMixer(model);

    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
  });
  }

  // 화면 그리기
  function animate() {
    if (requestToRender) {
      _DEBUG && _DEBUG.stats.update();

      // 프로펠러 회전 애니메이션
      if (propellerAnimation.currentSpeed !== 0) {      

        if (modelMeshes.propeller1) {
            modelMeshes.propeller1.rotation.z += propellerAnimation.currentSpeed;
        }
        if (modelMeshes.propeller2) {
            modelMeshes.propeller2.rotation.z -= propellerAnimation.currentSpeed;
        }
        if (modelMeshes.propeller3) {
            modelMeshes.propeller3.rotation.z += propellerAnimation.currentSpeed;
        }
        if (modelMeshes.propeller4) {
            modelMeshes.propeller4.rotation.z -= propellerAnimation.currentSpeed;
        }
        renderRequest();
      }

      // 애니메이션 업데이트
      if (mixer) {
        mixer.update(clock.getDelta());
      }    
      // 카메라 원근 조절
      camera.setViewOffset(
        areaWidth,
        areaHeight,
        cameraOffset.x,
        cameraOffset.y,
        areaWidth,
        areaHeight
      );

      camera.lookAt(cameraTarget);
      controls.update();

      if (_DEBUG && _DEBUG.pip) {
        pip = _DEBUG.pip
        // 1
        renderer.setClearColor(0, 0);
        renderer.setViewport(0, 0, areaWidth, areaHeight);
        renderer.render(scene, camera);

        // 2
        renderer.setClearColor(0x8f8366, 1);
        renderer.clearDepth();
        renderer.setScissorTest(true);
        renderer.setScissor(areaWidth - pip.width - 20, 20, pip.width, pip.height);
        renderer.setViewport(areaWidth - pip.width - 20, 20, pip.width, pip.height);
        
        pip.beforeRender();
        renderer.render(scene, pip.camera);
        pip.afterRender();

        renderer.setScissorTest(false);
      } else {
        renderer.render(scene, camera);
      }
    }
  }

  // 프로펠러 회전 상태를 제어하는 함수들 추가
  const propellerAnimation = {
    isSpinning: false,
    currentSpeed: 0,
    targetSpeed: 0,

    start(speed = 0.3, duration = 1, ease = "power2.inOut") {

        this.isSpinning = true;
        this.setSpeed(speed, duration, ease);
        
        // 이륙할 때 그라운드 멀어지게
        gsap.to(tools.ground.position, {
            y: -2,
            duration: duration,
            ease: ease
        });
        
        // 이륙할 때 그림자 옅어지게
        gsap.to(tools.ground.material, {
            opacity: 0.1,
            duration: duration,
            ease: ease
        });

        renderRequest();

    },
  
    stop(duration = 1.3) {
        // 현재 속도에서 0까지 부드럽게 감속
        this.setSpeed(0, duration, "power3.out");
        
        // 착륙할 때 그라운드 가까워지게
        gsap.to(tools.ground.position, {
            y: -1.5,
            duration: duration,
            ease: "power3.out"
        });
        
        // 착륙할 때 그림자 진해지게 
        gsap.to(tools.ground.material, {
            opacity: 0.4,
            duration: duration,
            ease: "power3.out"
        });
        
        // 완전히 멈춘 후에 isSpinning을 false로 설정
        gsap.delayedCall(duration, () => {
            this.isSpinning = false;
        });
        
        renderRequest();
    },
    
    setSpeed(newSpeed, duration = 1, ease = "power2.inOut") {
        this.targetSpeed = newSpeed;

        // 이륙할 때 그라운드 멀어지게
        gsap.to(tools.ground.position, {
          y: -2,
          duration: duration,
          ease: ease
        });
        
        // 이륙할 때 그림자 옅어지게
        gsap.to(tools.ground.material, {
            opacity: 0.1,
            duration: duration,
            ease: ease
        });
      
        
        // GSAP를 사용하여 부드러운 속도 전환
        gsap.to(this, {
            currentSpeed: newSpeed,
            duration: duration,
            ease: ease,
            onUpdate: () => {
                renderRequest();
            }
        });
    }
  };
  if (_DEBUG) {
    const propellerFolder = _DEBUG.gui.addFolder('Propeller Animation');
    // propellerFolder.add(propellerAnimation, 'isSpinning').name('Spin Propellers');
    propellerFolder.add(propellerAnimation, 'currentSpeed', 0, 1, 0.1).name('Current Speed');
    propellerFolder.add(propellerAnimation, 'targetSpeed', 0, 1, 0.1).name('Target Speed');
  }

  // 드론 부유 효과 컨트롤러
  const floatingAnimation = {
    isFloating: false,
    animations: [],
    originalY: 0,
    
    start() {
        if (this.isFloating) return;
        this.isFloating = true;

        // saveCurrentState();
        // console.log('저장함?')
        
        const verticalTween = gsap.to(model.position, {
            y: "+=0.1",
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            onUpdate: () => {
                // 높이에 따라 그림자 투명도만 조정
              //   const distance = model.position.y + 2;
              //   // tools.ground.material.opacity = Math.max(0.05, 0.2 - (distance * 0.05));
              //   gsap.to(tools.ground.material, {
              //     opacity: Math.max(0.05, 0.2 - (distance * 0.05)),
              // });
            }
        });
        
        // 회전 움직임
        const rotationTween = gsap.to(model.rotation, {
            x: "+=0.02",
            y: "+=0.07",
            // z: "+=0.02",
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        });
        
        this.animations = [verticalTween, rotationTween];
    },
    
    stop(duration = 1) {
        if (!this.isFloating) return;
        this.isFloating = false;
        
        this.animations.forEach(tween => tween.kill());
        this.animations = [];

        // 원래 위치와 회전으로 부드럽게 복귀
      //   gsap.to(model.position, {
      //       x: originalState.position.x,
      //       y: originalState.position.y,
      //       z: originalState.position.z,
      //       duration: duration,
      //       ease: "power2.out"
      //   });
        
      //   gsap.to(model.rotation, {
      //       x: originalState.rotation.x,
      //       y: originalState.rotation.y,
      //       z: originalState.rotation.z,
      //       duration: duration,
      //       ease: "power2.out"
      //   });

      //   gsap.to(model.scale, {
      //     x: originalState.scale.x,
      //     y: originalState.scale.y,
      //     z: originalState.scale.z,
      //     duration: duration,
      //     ease: "power2.out"
      // });

      gsap.to(model.position, {
        y: 0,
        duration: duration,
        ease: "power2.out"
    });

      gsap.to(model.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: "power2.out"
    });
        
        this.animations = [];
    },

    stopInBackground(duration = 1) {
      if (!this.isFloating) return;
      this.isFloating = false;
      
      // 기존 애니메이션들 중지
      this.animations.forEach(tween => tween.kill());
      this.animations = [];
    
    // 원래 위치와 회전으로 부드럽게 복귀
    gsap.to(model.position, {
        y: 0,
        duration: duration,
        ease: "power2.out"
    });
    
    gsap.to(model.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: duration,
        ease: "power2.out"
    });

            // 원래 위치와 회전으로 부드럽게 복귀
        //     gsap.to(model.position, {
        //       x: originalState.position.x,
        //       y: originalState.position.y,
        //       z: originalState.position.z,
        //       duration: duration,
        //       ease: "power2.out"
        //   });
          
        //   gsap.to(model.rotation, {
        //       x: originalState.rotation.x,
        //       y: originalState.rotation.y,
        //       z: originalState.rotation.z,
        //       duration: duration,
        //       ease: "power2.out"
        //   });
  
        //   gsap.to(model.scale, {
        //     x: originalState.scale.x,
        //     y: originalState.scale.y,
        //     z: originalState.scale.z,
        //     duration: duration,
        //     ease: "power2.out"
        // });
    
    this.animations = [];
  }
    
  };

  function onScroll() {
    const scrollTop = window.scrollY;

    let $currentSection, currentSectionRect, currentSectionIndex;
    for (let i = 0; i < numSections; i++) {
      const $section = $sections[i];
      const sectionRect = $section.getBoundingClientRect();
      $currentSection = $section;
      currentSectionRect = sectionRect;
      currentSectionIndex = i;
      if (sectionRect.bottom >= 0) {
        break;
      }
    }

    const progress = -currentSectionRect.top / currentSectionRect.height;

    const timelineStartAt = timelineTimeStamps[currentSectionIndex];
    const timelineEndAt = timelineTimeStamps[Math.min(numSections - 1, currentSectionIndex + 1)] || 1;
    timeline.time(Math.min(timelineStartAt + (timelineEndAt - timelineStartAt) * progress, totalDuration)); // scrub 같은 역할임, 1.5 

    // console.log(progress, timelineStartAt, timelineEndAt, Math.min(timelineStartAt + (timelineEndAt - timelineStartAt) * progress, totalDuration))
    // console.log('adjfd')

    // footer 아래로 내려갈때
    const footerRect = document.querySelector('#footer').getBoundingClientRect();
    const footerProgress = 1 - Math.min(1, (footerRect.bottom-areaHeight)/footerRect.height );

    if ( footerProgress > 0 ) {
      const toRotateY = footerProgress*(Math.PI*0.04);
      if ( totalDuration - timeline.time() < 0.001 ) {
        cameraRotateGroupY.rotation.x = toRotateY;
        cameraTarget.y = footerProgress;
      }
    }    
  }

  function onReady() {

    setGuiModel(scene, model, {boxPosition: new THREE.Vector3(0, 0, 0)});

    setPIP(scene, tools, {
      pipCameraPosition: [20, 20, 20],
      pipCameraTargetSize: [.4, 4, 2],
    });

    showroomSet();
    sectionAniSet();
    setLenis();

  }

  function createTimeline() {
    timeline.clear();
    timelineTimeStamps = [];
    totalDuration = 0;
    timelineSequenceIndex = 0;

    // KV - 정면
    addTimelineSequence($sections[0], 10, {
      rotateX: 0,        // 회전 초기화  
      rotateY: 0,        // 회전 초기화
      target: [0, 0, 0], // 중앙 타겟팅
      position: [0, 0],  // 중앙 포지션
      modelX: 0,         // 모델 위치 중앙
      modelY: 0,         // 모델 위치 중앙
      modelPX: 0,
      modelPY: 0,
      modelPZ: 0,
      scale: 1.5,
      duration: 1.5,
      ease: 'power2.inOut' // 부드러운 이징 적용
    });
  
    // 드론 좌측
    // // addTimelineSequence($sections[1], 3, {
    // addTimelineSequence($sections[1], 10, {
    //   // rotateX: Math.PI / 4,
    //   rotateX: Math.PI / 2,
    //   rotateY: 0, 
    //   target: [0, 0, 0],
    //   // position: [2.8, 0],
    //   // modelX: 1,

    //   position: [4, -1, 9],

    //   modelPX: 1, //이거 넣으면 리사이즈 때 뚝뚝 끊김
    //   // fovDistance: 19, 
    //   fovDistance: 7,
    // });

        addTimelineSequence($sections[1], 3, {
            rotateX: Math.PI / 4,
            rotateY: 0, 
            target: [0, 0, 0],
            position: [2.8, 0],      
            modelPX: 1,
            fovDistance: 19, 
          });
  
    // 카메라 소개, 정면
    addTimelineSequence($sections[2], 6, {
      rotateX: Math.PI * 2,
      rotateY: Math.PI / 4,
      target: [0, 0, 0],
      position: [0.1, 8, 8],
      modelX: 0, //건들면 뚝뚝 끊기네?
      // modelPY: 0.7,
      fovDistance: 16, 
    });
  
    // 프로펠러
    addTimelineSequence($sections[3], 10, {
      rotateX: Math.PI / 1,
      rotateY: -Math.PI / 4,
      target: [0, 0, 0],
      position: [0, 8]
    });
  
    // 이미지마스킹
    addTimelineSequence($sections[4], 5, {
      rotateX: Math.PI / 8,
      rotateY: -Math.PI / 6,
      target: [0, -1, 0],
      position: [Math.cos(Math.PI / 6), 0.5, Math.sin(Math.PI / 6)],
      fovDistance: 12, 
    });
  
    // 다시 정면
    addTimelineSequence($sections[5], 10, {
      rotateX: Math.PI / 4,
      rotateY: 0,
      target: [0, 0, 0],
      position: [0, 0],
      modelPX: 0,
      fovDistance: 6, 
      // scale: 2 // 스케일 추가
    });
  
    // 정면 중앙
    addTimelineSequence($sections[6], 15, {
      rotateX: 0,
      rotateY: 0,
      target: [0, 0, 0],
      position: [0, 0],
      fovDistance: 1, 
      // scale: 2 // 스케일 추가
    });
  
    totalDuration = timeline.totalDuration();
    timelineTimeStamps.push(totalDuration);

    onScroll(); //리사이즈 시 모델의 부드러운 전환을 위함
  }
  
  function addTimelineSequence($area, cameraDistance, settings) {
    const name = 'seq' + timelineSequenceIndex;
    const areaInfo = getAreaInfo($area);
    const duration = settings.duration || 1;
    const ease = settings.ease || 'cubic.inOut';
  
    const cameraTargetPosition = {
      x: settings.target[0],
      y: settings.target[1],
      z: settings.target[2],
    };
    const cameraPosition = {
      x: settings.position[0],
      y: settings.position[1],
      z: cameraDistance,
    };
    
  
    timeline.to(cameraRotateGroupX.rotation, { y: settings.rotateX || 0, duration, ease }, name);
    timeline.to(cameraRotateGroupY.rotation, { x: settings.rotateY || 0, duration, ease }, name);
    timeline.to(cameraTarget, { ...cameraTargetPosition, duration, ease }, name);
    timeline.to(camera.position, { ...cameraPosition, duration, ease }, name);
    timeline.to(camera, { 
      fov: getCameraFov(areaInfo.height, cameraDistance + (settings.fovDistance || 0)), 
      duration, 
      ease,
      onUpdate: updateCameraProjectionMatrix 
    }, name);
    timeline.to(cameraOffset, { ...getCameraOffset(areaInfo), duration, ease }, name);
  
    if(settings.modelX) {
      timeline.to(model.position, { x: settings.modelX, duration, ease }, name);
    }

    timeline.to(model.position, { x: settings.modelPX || 0, duration, ease }, name);
    timeline.to(model.position, { y: settings.modelPY || 0, duration, ease }, name);
    timeline.to(model.position, { z: settings.modelPZ || 0, duration, ease }, name);

    if (settings.scale) {
      timeline.to(model.scale, {
        x: settings.scale,
        y: settings.scale,
        z: settings.scale,
        duration,
        ease
      }, name);
    }
  
    timelineTimeStamps.push(timeline.totalDuration());
    timelineSequenceIndex++;

    // timeline.time(1.5); //0124 여기 다시 보기!!
    
  }

  let isturnning = false;

  // 엘리먼트 스크롤이벤트
  function sectionAniSet() {

    // kv 섹션 애니메이션
    const kvSection = (function() {
      const $section = document.querySelector('.section-0'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelector('h1'); // 애니메이션 적용할 요소
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          // console.log(isPropellerActive)
          if(progress > 0 && progress < 1 && isPropellerActive){
            propellerAnimation.start(0.7);
            propellerAnimation.setSpeed(0.7, 0.1, "power3.in");
            floatingAnimation.start();
          }
        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 블러 효과 애니메이션
        // 전체 타임라인을 1로 봤을 때 0.05 지점(5%)에서 애니메이션이 완료되도록 설정
        timeline.fromTo($title, 
          { filter: 'blur(0px)', opacity: 1 }, 
          { 
            filter: 'blur(35px)', 
            opacity: 0, 
            ease: 'none',
            duration: 0.05  // 전체 타임라인의 5% 지점에서 완료
          }, 
          'seq-1'
        );
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })();
  
    // 첫 번째 섹션 애니메이션 - 바디
    const firstSection = (function() {
      const $section = document.querySelector('.section-1'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2'); // 애니메이션 적용할 요소
      const $text = $section.querySelectorAll('p'); // 애니메이션 적용할 요소
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top - areaHeight) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          if(progress > 0 && progress < 1 && isPropellerActive){
            propellerAnimation.start(0.7);
            propellerAnimation.setSpeed(0.7, 0.1, "power3.in");
            floatingAnimation.start();
          }
        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $text], 
          { y: 50, opacity: 0, color: '#fff'}, 
          {
             y: 0, opacity: 1, color: '#000', ease: 'none' 
            }, 
          0.4
        ).to([$title, $text], { duration: 0.3 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })();

    // 두 번째 섹션 애니메이션 - 카메라
    const secondSection = (function() {
      const $section = document.querySelector('.section-2'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2'); // 애니메이션 적용할 요소
      const $text = $section.querySelectorAll('p'); // 애니메이션 적용할 요소
      const $video = $section.querySelectorAll('.video'); // 애니메이션 적용할 요소
      let isAnimating = false;
      let animationTimeout;
      let isInRange = false;
      let hasStarted = false;
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = -(rect.top - areaHeight) / sectionHeight;
          timeline && timeline.progress(Math.max(0, progress));

        if(progress > 0 && progress < 1 && isPropellerActive){
          propellerAnimation.start(0.05);
          propellerAnimation.setSpeed(0.05, 0.1, "power3.in");
          floatingAnimation.start();
          }
          
    
          if (progress > 0.4 && progress < 1.5) {
            isInRange = true;
            // 애니메이션이 아직 시작되지 않았을 때만 실행
            if (!hasStarted) {
              startAnimation();
            }
            for(let vid of $video){
              vid.querySelector('video').play();
            }

          } else {
            isInRange = false;
            stopCurrentAnimation();
            for(let vid of $video){
              vid.querySelector('video').pause();
              vid.querySelector('video').currentTime = 0;
            }
            hasStarted = false; // 범위를 벗어나면 flag 리셋
          }
        } else {
          isInRange = false;
          stopCurrentAnimation();
          for(let vid of $video){
            vid.querySelector('video').pause();
            vid.querySelector('video').currentTime = 0;
          }
          hasStarted = false; // 섹션을 벗어나면 flag 리셋
        }
      }

      function startAnimation() {
        if (hasStarted) return; // 이미 시작되었다면 실행하지 않음
        
        hasStarted = true;
        isAnimating = true;
        clearTimeout(animationTimeout);
        
        // playAnimation(0);
        // playAnimation(3);

        // 모든 프로펠러 애니메이션 재생
        const originalAction = mixer.clipAction(modelWrap.animations[0]);
        const propellerAction = mixer.clipAction(modelWrap.animations[1]); // propeller_spin 애니메이션
        
        // console.log('Original Animation:', modelWrap.animations[0]);
        // console.log('Propeller Animation:', modelWrap.animations[1]);
        
        // 애니메이션 설정
        propellerAction.setLoop(THREE.LoopRepeat);
        propellerAction.clampWhenFinished = false;
        propellerAction.timeScale = 1;
        
        // 애니메이션 재생
        originalAction.play();
        propellerAction.play();

        
        animationTimeout = setTimeout(() => {
          if (isInRange) {
            pauseCurrentAnimation();
          }
        }, 4480);
      }
    
      function stopCurrentAnimation() {
        clearTimeout(animationTimeout);
        isAnimating = false;
        stopAnimation(0);
      }

      function pauseCurrentAnimation() {
        clearTimeout(animationTimeout);
        isAnimating = false;
        pauseAnimation(0);
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $text], 
          { y: 50, opacity: 0, color: '#fff'}, 
          {
              y: 0, opacity: 1, color: '#000', ease: 'ease' 
            }, 
          // 'seq-1'
          0.5
        ).to([$title, $text], { duration: 0.4 }, 1);
        
        timeline.fromTo([$video], 
          { y: 100, opacity: 0}, 
          {
              y: 0, opacity: 1, ease: 'ease' 
            }, 
          // 'seq-1'
          0.8
        ).to([$video], { duration: 0.4 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }

      // 클린업 함수 추가
      function cleanup() {
        clearTimeout(animationTimeout);
        stopAnimation(0);
        isAnimating = false;
        isInRange = false;
        hasStarted = false;
      }
      
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);

      // 페이지 언로드 시 클린업
      window.addEventListener('unload', cleanup);

      // 섹션 객체 반환
      return {
        cleanup,
        stopAnimation: stopCurrentAnimation
      };
    })();

    // 세 번째 섹션 애니메이션 - 프로펠러
    const thirdSection = (function() {
      const $section = document.querySelector('.section-3'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2'); // 애니메이션 적용할 요소
      const $text = $section.querySelectorAll('p'); // 애니메이션 적용할 요소
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top - areaHeight) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          if(progress > 0 && progress < 1 && isPropellerActive){
            propellerAnimation.start(0.05);
            propellerAnimation.setSpeed(0.05, 0.1, "power1.inOut");
          }

        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $text], 
          { y: 50, opacity: 0, color: '#fff'}, 
          {
              y: 0, opacity: 1, color: '#000', ease: 'ease' 
            }, 
          // 'seq-1'
          0.6
        ).to([$title, $text], { duration: 0.4 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })();

    // 네 번째 섹션 애니메이션
    const fourthSection = (function() {
      const $section = document.querySelector('.section-4'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2'); // 애니메이션 적용할 요소
      const $text = $section.querySelectorAll('p'); // 애니메이션 적용할 요소
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top - areaHeight) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          if(progress > 0 && progress < 1 && isPropellerActive){
            propellerAnimation.start(0.05);
            propellerAnimation.setSpeed(0.05, 0.1, "power1.inOut");
          }

        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $text], 
          { y: 50, opacity: 0, color: '#fff'}, 
          {
              y: 0, opacity: 1, color: '#000', ease: 'ease' 
            }, 
          // 'seq-1'
          0.9
        ).to([$title, $text], { duration: 0.1 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })();    

    // 다섯 번째 섹션 애니메이션
    const fifthSection = (function() {
      const $section = document.querySelector('.section-5'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2'); // 애니메이션 적용할 요소
      const $text = $section.querySelectorAll('p'); // 애니메이션 적용할 요소
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top - areaHeight) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          if(progress > 0 && progress < 1 && isPropellerActive){
            propellerAnimation.start(0.05);
            propellerAnimation.setSpeed(0.05, 0.1, "power1.inOut");
          }

          if(progress <= 1){
            isturnning = false;
            // console.log('no turning')
          }

        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $text], 
          { y: 50, opacity: 0, color: '#fff'}, 
          {
              y: 0, opacity: 1, color: '#000', ease: 'ease' 
            }, 
          // 'seq-1'
          0.9
        ).to([$title, $text], { duration: 0.1 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })(); 

    // 여섯 번째 섹션 애니메이션
    const sixthSection = (function() {
      const $section = document.querySelector('.section-6'); // 섹션 클래스명 맞게 수정
      let timeline;
      let sectionHeight = $section.offsetHeight;
      const $title = $section.querySelectorAll('h2');
      const $colorChip_sec6 = $section.querySelector('.color-chip');
      
      function scrollAni() {
        const rect = $section.getBoundingClientRect();
        if (rect.top < areaHeight && rect.bottom > 0) {
          const progress = Math.min(1, -(rect.top - areaHeight) / sectionHeight);
          timeline && timeline.progress(Math.max(0, progress));

          // if(progress > 0.4){
            
          //   btnShowroom_fixed.classList.remove('on')
          //   btnShowrrom_this.classList.add('on')
            
          // }else{
          //   btnShowroom_fixed.classList.add('on')
          //   btnShowrrom_this.classList.remove('on')
          // }
          // console.log(progress)

          if(progress <= 0){
            isturnning = false;
          }

          if(progress > 0 && progress < 1 && isPropellerActive){
            if(!isturnning){
              propellerAnimation.start(0.7);
              propellerAnimation.setSpeed(0.7, 0.1, "power3.in");
              floatingAnimation.start();

              isturnning = true;
            }
          }else if(progress >= 1){
            if(isturnning){
              propellerAnimation.stop(1.3);
              setTimeout(()=>{
                floatingAnimation.stopInBackground(1);
              },100)
              isturnning = false;
            }
          }
        }
      }
  
      function createSectionTimeline() {
        timeline && timeline.kill();
        timeline = gsap.timeline({ paused: true });
        
        // 텍스트 슬라이드 업 + 페이드인 효과
        timeline.fromTo([$title, $colorChip_sec6], 
          { opacity: 0, color: '#fff'}, 
          {
              opacity: 1, color: '#000', ease: 'ease' 
            }, 
          0.9
        ).to([$title, $colorChip_sec6], { duration: 0.1 }, 1);
      }
  
      function sectionResize() {
        sectionHeight = $section.offsetHeight;
        createSectionTimeline();
        scrollAni();
      }
  
      sectionResize();
      window.addEventListener('scroll', scrollAni);
      window.addEventListener('resize', sectionResize);
    })(); 

  }


  // mesh color change
  function colorChange(){
    const $bodyColorBox = document.querySelectorAll('.color-chip');
    if ($bodyColorBox.length > 0) {
      const color3 = new THREE.Color();
  
      $bodyColorBox.forEach($color => {
        const onColorChange = function (e) {
          const color = typeof(e) === 'string' ? e : this.value;
          color3.setStyle(color);
  
          const idToMeshMap = {
            'body': modelMeshes.body,
            'propeller1': modelMeshes.propeller1,
            'propeller2': modelMeshes.propeller2,
            'propeller3': modelMeshes.propeller3,
            'propeller4': modelMeshes.propeller4,
          };
  
          for (const key in idToMeshMap) {
            if (this.id.indexOf(key) > -1) {
                gsap.to(idToMeshMap[key].material.color, { 
                    r: color3.r, 
                    g: color3.g, 
                    b: color3.b, 
                    duration: 0.75, 
                    ease: 'cubic.out', 
                    onUpdate: renderRequest 
                });
                break;
            }
          }
        };
    
        const $bodyColorSelectors = [].slice.call($color.querySelectorAll('input[type="radio"]'));
        $bodyColorSelectors.forEach(($radio) => {
          $radio.addEventListener('change', onColorChange);
          $radio.nextElementSibling.style.setProperty('--color', $radio.dataset.color);
        });
      })
    }
  }

  // page loading
  function pageLoading(){
    const loadingProgress = document.querySelector('.loading__progress');
    const loading = document.querySelector('.loading');
    const loadingBar = document.querySelector('.loading__bar');
  
    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
      const loadProgress = Math.round((itemsLoaded / itemsTotal) * 100);

      // loadingProgress.textContent = `${loadProgress}%`;
      loadingBar.style.width = `${loadProgress}%`;

      if (itemsLoaded === itemsTotal) {
        // lenis.scrollTo(0, {
        //   immediate: true // 즉시 이동
        // });
        lenis.scrollTo(10, {
          immediate: true
        });
        setTimeout(() => {
          createTimeline();
          // onScroll(); // 현재 스크롤 위치에 맞는 상태로 초기화
          lenis.scrollTo(0, {
            immediate: true
          });
        }, 100);

          btnShowroom_fixed.classList.add('on')
          setTimeout(() => {
            loading.classList.add('is-hidden');
  
          // if(window.pageYOffset < $kvAniSec / 1.5){
          //   gsap.fromTo(model.position, { y: -3, z : 3}, { y: -0.7, z : 0, duration: 1.5, ease:   'sine.out', onComplete: createTimeline() });
          //   gsap.fromTo(model.rotation, { x: 3 }, { x: -0.23, duration: 1.7, ease: 'sine.out', onComplete: createTimeline() });
          // }else{
          //   model.position.y = -0.7,
          //   model.position.z = 0,
          //   model.rotation.x = -0.23
          // }

          if(model){
          //   const timeline = gsap.timeline({
          //     onComplete: () => {
          //         // 등장 후 부유 효과 시작
          //         floatingAnimation.start(1);
          //     }
          // });

          //   model.position.set(0, -5, -10); // 시작 위치
          //   model.rotation.set(-0.5, 0, 0); // 시작 각도
  
          //     // 모델 날아오는 효과 추가
          //     timeline
          //      .to(model.position, {
          //        y: 0.1,
          //        z: 0,
          //        duration: 1.5, 
          //        ease: "power3.out"
          //      })
          //      .to(model.rotation, {
          //        x: 0.02,
          //        y: 0.07,
          //        duration: 1.2,
          //        ease: "power2.out" 
          //      }, "-=1.2"); // 회전을 position 애니메이션과 동시에 시작    
          }
        }, 500);
      }
    };
  }

    // Custom open 시 상태 저장  
    let initialState = {
        camera: {
            position: {},
            target: {},
            offset: {},
            rotationX: null,
            rotationY: null,
            fov: null
        },
        model: {
            positionX: null,
            positionY: null,
            rotationX: null,
            rotationY: null,
            rotationZ: null,
            seperateTop: null,
            seperateMd: null,
            seperateBt: null,
        }
    };
    let resizeState = {
      camera: {
          position: {},
          target: {},
          offset: {},
          rotationX: null,
          rotationY: null,
          fov: null
      },
              model: {
            positionX: null,
            positionY: null,
            rotationX: null,
            rotationY: null,
            rotationZ: null,
            seperateTop: null,
            seperateMd: null,
            seperateBt: null,
        }
    };

      // 360전 상태 저장
    function saveCurrentState() {
        initialState.camera.position = { ...camera.position };
        initialState.camera.target = { ...cameraTarget };
        initialState.camera.offset = { ...cameraOffset };
        initialState.camera.rotationX = cameraRotateGroupX.rotation.y;
        initialState.camera.rotationY = cameraRotateGroupY.rotation.x;
        initialState.camera.fov = camera.fov;

        initialState.camera.distance = camera.position.z;
        initialState.model.rotationX = model.rotation.x;
        initialState.model.rotationY = model.rotation.y;
        initialState.model.rotationZ = model.rotation.z;
        initialState.model.positionX = model.position.x;
        initialState.model.positionY = model.position.y;
        initialState.model.scale = model.scale.x; // 스케일 저장
        // initialState.model.seperateTop = modelMeshes.seperateTop[0].position.y;
        // initialState.model.seperateMd = modelMeshes.midsole[0].position.z;
        // initialState.model.seperateBt = modelMeshes.bottom.position.y;

            // 현재 타임라인 상태도 저장
          initialState.timeline = {
            progress: timeline ? timeline.progress() : 0,
            time: timeline ? timeline.time() : 0
        };
    }

    function saveResizeState() {
      resizeState.camera.position = { ...camera.position };
      resizeState.camera.target = { ...cameraTarget };
      resizeState.camera.offset = { ...cameraOffset };
      resizeState.camera.rotationX = cameraRotateGroupX.rotation.y;
      resizeState.camera.rotationY = cameraRotateGroupY.rotation.x;
      resizeState.camera.fov = camera.fov;

      resizeState.camera.distance = camera.position.z;
      resizeState.model.rotationX = model.rotation.x;
      resizeState.model.rotationY = model.rotation.y;
      resizeState.model.rotationZ = model.rotation.z;
      resizeState.model.positionX = model.position.x;
      resizeState.model.positionY = model.position.y;
      resizeState.model.scale = model.scale.x; // 스케일 저장
    }

  // 쇼룸세팅
  function showroomSet() {
    const aniDuration = 1;
    const aniEase = 'cubic.inOut';

    let isControl = false;
    let isSrOpen = false
  
    const $showroom = document.querySelector('#srMeshCon');
    const $resetStateBtn = document.querySelectorAll('.btn-showroom');
    const $colorChipWrap = document.querySelector('.color-chip');

    function applyState(state, animate = true) {
        const commonOptions = { duration: aniDuration, ease: aniEase,
          onComplete: function(){
            controls.enabled = state.controls.enabled;
            controls.minDistance = state.controls.minDistance;
            controls.maxDistance = state.controls.maxDistance;
         }
        };
        
        if (animate) {
            gsap.to($showroom, { zIndex: state.showroomZIndex, ...commonOptions });
            gsap.to($showroom, { opacity: state.showroomOpacity, ...commonOptions });
            gsap.to($modelConWrap, { zIndex: state.modelConWrapZIndex, ...commonOptions });
            gsap.to(camera.position, { ...state.camera.position, ...commonOptions });
            gsap.to(cameraTarget, { ...state.camera.target, ...commonOptions });
            gsap.to(cameraRotateGroupX.rotation, { y: state.camera.rotationX, ...commonOptions });
            gsap.to(cameraRotateGroupY.rotation, { x: state.camera.rotationY, ...commonOptions });
            gsap.to(camera, { fov: state.camera.fov, ...commonOptions });
            gsap.to(cameraOffset, { ...state.camera.offset, ...commonOptions });
            gsap.to(model.rotation, { z: state.model.rotationZ, ...commonOptions });
            gsap.to(model.position, { x: state.model.positionX, ...commonOptions });
            gsap.to(model.position, { y: state.model.positionY, ...commonOptions });
            gsap.to(model.scale, {
              x: state.model.scale,
              y: state.model.scale,
              z: state.model.scale,
            });
            // modelMeshes.seperateTop.forEach((mesh) => {
            //   gsap.to(mesh.position, { y: state.model.seperateTop, ...commonOptions });
            // });
            // modelMeshes.midsole.forEach((mesh) => {
            //   gsap.to(mesh.position, { z: state.model.seperateMd, ...commonOptions });
            // });
            // gsap.to(modelMeshes.bottom.position, { y: state.model.seperateBt, ...commonOptions });
            // gsap.to($modelPoint, { opacity: state.pointDesc.opacity, visibility : state.pointDesc.visibility, duration: aniDuration, ease: aniEase });
            // gsap.to(directionalLight2.position, { ...state.light.position, ...commonOptions });
        } else {
            $showroom.style.zIndex = state.showroomZIndex;
            $showroom.style.opacity = state.showroomOpacity;
            $modelConWrap.style.zIndex = state.modelConWrapZIndex;
            Object.assign(camera.position, state.camera.position);
            Object.assign(cameraTarget, state.camera.target);
            cameraRotateGroupX.rotation.y = state.camera.rotationX;
            cameraRotateGroupY.rotation.x = state.camera.rotationY;
            camera.fov = state.camera.fov;
            Object.assign(cameraOffset, state.camera.offset);
            model.rotation.z = state.model.rotationZ;
            model.position.x = state.model.positionX;
            model.position.y = state.model.positionY;
            Object.assign(model.scale, state.model.scale);
            // modelMeshes.seperateTop.forEach((mesh) => {
            //   gsap.to(mesh.position, { y: state.model.seperateTop, ...commonOptions });
            // });
            // modelMeshes.midsole.forEach((mesh) => {
            //   gsap.to(mesh.position, { z: state.model.seperateMd, ...commonOptions });
            // });
            // gsap.to(modelMeshes.bottom.position, { y: state.model.seperateBt, ...commonOptions });
            // gsap.to($modelPoint, { opacity: state.pointDesc.opacity, visibility : state.pointDesc.visibility, duration: aniDuration, ease: aniEase });
            // gsap.to(directionalLight2.position, { ...state.light.position, ...commonOptions });
        }

        // console.log('camera.position : ' ,  camera.position)
        // console.log('model.position : ' ,  model.position)
    }
  
    
    // 공통 상태 설정 함수
    function updateState(isOpen, isControl = false, animate = true) {
      const areaInfo = getAreaInfo($showroom);
      const cameraFov = getCameraFov(areaInfo.height, 30 + (settings.fovDistance || 0));
      const cameraOffset = getCameraOffset(areaInfo);

      const targetState = isOpen ? {
        showroomZIndex: 11,
        showroomOpacity: 1,
        modelConWrapZIndex: 12,
        camera: {
            position: { x: 0, y: 0, z: 30 },
            target: { x: 0, y: 0, z: 0 },
            rotationX: 0,
            rotationY: 0,
            fov: cameraFov,
            offset: cameraOffset
        },
        model: {
            positionX: 0,
            positionY: 0.5,//쇼룸에서의 positionY..
            // positionY: 0,//쇼룸에서의 positionY..
            rotationZ: 0,
            seperateTop: 0,
            seperateMd: 0,
            seperateBt: 0,
            scale: 1.5 // 쇼룸에서의 스케일
            // scale: 1 // 쇼룸에서의 스케일
        },
        controls: {
            enabled: true,
            minDistance: 10,
            maxDistance: 50
        },
        // pointDesc:{
        //   opacity : 0,
        //   visibility : 'hidden'
        // },
        light:{
          position: { x: -16, y: -7, z: -2 },
        }
    } : {
        showroomZIndex: 0,
        showroomOpacity: 0,
        modelConWrapZIndex: 9,
        camera: {
            position: initialState.camera.position,
            target: initialState.camera.target,
            rotationX: initialState.camera.rotationX,
            rotationY: initialState.camera.rotationY,
            fov: initialState.camera.fov,
            offset: initialState.camera.offset
        },
        model: {
            positionX: initialState.model.positionX,
            positionY: initialState.model.positionY,
            rotationX: initialState.model.rotationX,
            rotationY: initialState.model.rotationY,
            rotationZ: initialState.model.rotationZ,
            // seperateTop: initialState.model.seperateTop,
            // seperateMd: initialState.model.seperateMd,
            // seperateBt: initialState.model.seperateBt,
            scale: initialState.model.scale || 2
        },
        controls: {
            enabled: false,
            minDistance: 0,
            maxDistance: 100
        },
        // pointDesc:{
        //   opacity : 1,
        //   visibility : 'visible'
        // },
        light:{
          position: { x: 1.6, y: 10, z: -3 },
        }
    };
  
        applyState(targetState, animate);
        renderRequest();
    }

    controls.addEventListener('change', () => {
      saveResizeState();
      renderRequest();
    });
  
    // Custom open event
    for( let btn of $resetStateBtn){
      btn.addEventListener('click', (e) => {
        if(!isSrOpen){
          isControl = true;
          saveCurrentState(); //쇼룸 들어가서 리사이즈 후 빠져나오면, 리사이즈 전 상태를 불러옴. 당연함.. 이걸 우짠담
          $showroom.classList.add('active')
          btn.classList.add('open');
          $colorChipWrap.classList.add('active');
          lenis.stop();
  
          controls.enableZoom = true;  // 이 부분 추가
          // controls.minDistance = 10;   // 최소 줌인 거리
          controls.maxDistance = 50;   // 최대 줌아웃 거리
          controls.minPolarAngle = 0; // 최상단 (0도)
          controls.maxPolarAngle = Math.PI; // 최하단 (180도)
  
          contentHeight = $footer.offsetTop + $footer.getBoundingClientRect().height;
          $modelConWrap.style.height = `${contentHeight}px`

          propellerAnimation.stop();
          floatingAnimation.stop();

          if($toggleButton.classList.contains('active')){
            $toggleButton.classList.remove('active');
          }

          $model.querySelector('canvas').style.pointerEvents = 'auto';
          
          // console.log(e.currentTarget.parentNode)

          // if(e.currentTarget.parentNode.classList.contains('fake-content')){
          //   btnShowroom_fixed.classList.add('on')
          //   btnShowrrom_this.classList.remove('on')
          // }
  
          // point 영역에 있었는지 체크
          // const pointSecActive = $modelPoint.classList.contains('active');
          // if(pointSecActive) $modelPoint.classList.remove('active');
          // $modelPoint.setAttribute('data-point', pointSecActive);
  
          updateState(true);
          isSrOpen = true;
  
          // additionalDirectionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
          // directionalLight2.position.set(13, 5, -7).normalize();
          // scene.add(additionalDirectionalLight);
        }else{
          isControl = false;
          $showroom.classList.remove('active');
          btn.classList.remove('open');
          $colorChipWrap.classList.remove('active');
          lenis.start();
  
          controls.enableZoom = false;  // 이 부분 추가
  
          contentHeight = $footer.offsetTop;
          $modelConWrap.style.height = `${contentHeight}px`
  
          // const pointSecActive = $modelPoint.getAttribute('data-point') === 'true';
          // if(pointSecActive) $modelPoint.classList.add('active');
          // $modelPoint.removeAttribute('data-point');

          // 프로펠러와 부유 효과 처리 수정
          if($toggleButton.classList.contains('active')){
            // 먼저 현재 애니메이션 중지
            propellerAnimation.stop();
            floatingAnimation.stop();
            
            // 원래 위치로 돌아간 후에 애니메이션 재시작
            setTimeout(() => {
              propellerAnimation.start();
              floatingAnimation.start();
            }, 800); // 위치 복귀 애니메이션 시간과 맞춤
          }

          // if($toggleButton.classList.contains('active')){
          //   propellerAnimation.start();
          //   floatingAnimation.start();
          //   // $toggleButton.classList.add('active');
          // }
          $model.querySelector('canvas').style.pointerEvents = 'none';
  
          
          updateState(false);
          isSrOpen = false; 
        }
      });
    }
  }

  // 카메라 투영 행렬 업데이트 함수
  function updateCameraProjectionMatrix() {
    camera.updateProjectionMatrix();
  }

  // 카메라 FOV 계산 함수
  function calculateFOV(targetWidth, targetHeight, distance) {
    const aspect = targetWidth / targetHeight;
    const fov = 2 * Math.atan((targetHeight / 2) / distance) * (180 / Math.PI);
    return fov;
  }

  function getAreaInfo($target, selector) {
    const $area = $target.querySelector(selector || '.mesh-area');
    const rect = $area.getBoundingClientRect();
    const parentRect = $area.parentNode.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  // 카메라 offset 계산 함수
  function getCameraOffset(areaInfo) {
    return {
      x: areaWidth / 2 - areaInfo.width / 2 - areaInfo.left,
      y: areaHeight / 2 - areaInfo.height / 2 - areaInfo.top,
    };
  }

  // 카메라 FOV 계산 함수
  function getCameraFov(meshAreaHeight, cameraDistance) {
    if (!modelHeight) return 45; // 모델이 로드되기 전 기본값
    const targetHeight = modelHeight * areaHeight / meshAreaHeight;
    return 2 * (180 / Math.PI) * Math.atan(targetHeight / (2 * cameraDistance));
  }  

  // 애니메이션 제어 함수 - play
  function playAnimation(index) {
    if (!mixer || !currentGltf) return; // 안전장치 추가
    const action = mixer.clipAction(currentGltf.animations[index]);
    action.reset().play();
  }

  // 애니메이션 제어 함수 - 재시작
  function atPlayAnimation(index) {
    if (!mixer || !currentGltf) return; // 안전장치 추가
    const action = mixer.clipAction(currentGltf.animations[index]);
    action.play();
  }

  // 애니메이션 제어 함수 - pause
  function pauseAnimation(index) {
      if (!mixer || !currentGltf) return;
      const action = mixer.clipAction(currentGltf.animations[index]);
      action.paused = true;
  }

  // 애니메이션 제어 함수 - stop
  function stopAnimation(index) {
      if (!mixer || !currentGltf) return;
      const action = mixer.clipAction(currentGltf.animations[index]);
      action.stop();
  }

  // 애니메이션 제어 함수 - 변경
  function transitionToAnimation(fromIndex, toIndex, duration = 1) {
      if (!mixer || !currentGltf) return;
      const fromAction = mixer.clipAction(currentGltf.animations[fromIndex]);
      const toAction = mixer.clipAction(currentGltf.animations[toIndex]);
      
      fromAction.crossFadeTo(toAction, duration, true);
      toAction.play();
  }

  // lenis 세팅
  function setLenis () {
    lenis = new Lenis();

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)
  }

  function onResize () {
    const pixelRatio = Math.min(2, window.devicePixelRatio);
  
    camera.aspect = areaWidth / areaHeight;
    camera.updateProjectionMatrix();
  
    renderer.setSize(areaWidth, areaHeight);
    renderer.setPixelRatio(pixelRatio);

    // 모델 크기 업데이트 (있는 경우)
    if (model) {
      modelSize = new THREE.Box3().setFromObject(model);
      modelHeight = modelSize.max.y - modelSize.min.y;
    }

    contentHeight = $footer.offsetTop;
    $modelConWrap.style.height = `${contentHeight}px`


    // // 현재 보이는 섹션 찾기
    for (let i = 0; i < $sections.length; i++) {
      const rect = $sections[i].getBoundingClientRect();
      if (rect.bottom >= 0) {
        currentSection = $sections[i];
        break;
      }
    }

    //카메라 리사이즈 및 체크
    if (currentSection) {
      const areaInfo = getAreaInfo(currentSection);
      const cameraDistance = camera.position.z;
      camera.fov = getCameraFov(areaInfo.height, cameraDistance);
      camera.updateProjectionMatrix();
    }

    // console.log(areaWidth,areaHeight, pixelRatio, modelSize, modelHeight, contentHeight,currentSection)
    // console.log(modelSize)

    if(model) { // model이 있을 때만 실행
      createTimeline();
    }
    renderRequest();
  }

  function renderRequest () {
    requestToRender = true;
  }


function propellerToggle(){
  $toggleButton.addEventListener('click', () => {
      // 클릭 효과 애니메이션
      gsap.to($toggleButton, {
          scale: 0.95,
          duration: 0.1,
          yoyo: true,
          repeat: 1
      });
  
      if (isPropellerActive) {
        propellerAnimation.stop();
        floatingAnimation.stopInBackground(); //카메라섹션에서는 그냥 stop이어야하는데...//카메라 섹션에서는 모델을 y로 억지로 끌당해서 그럼.. 다른 방법 없나?
        $toggleButton.classList.remove('active');
        
        // 정지 시 감속 효과
        gsap.to(propellerAnimation, {
            speed: 0,
            duration: 0.5,
            ease: "power2.out"
        });
      } else {
        propellerAnimation.start(); //왜 멈춤
        // propellerAnimation.setSpeed(0.7, 0.1, "power3.in");
        floatingAnimation.start();
        $toggleButton.classList.add('active');
      }
      isPropellerActive = !isPropellerActive;
  });
}


  setLoaders();
  setCanvas();
  animate();
  pageLoading();

  stopAnimation(0);
  colorChange();
  propellerToggle();

  window.addEventListener('scroll', onScroll);
  window.addEventListener('resize', onResize);

})();