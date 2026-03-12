import * as THREE from 'three';
import { _DEBUG, areaHeight, areaWidth } from './_common';


export function setHelper (options) {
  const defaults = {
    axesActive: true,
    axesSize: 20,

    gridActive: true,
    gridSize: 20,
    gridDivisions: 10,
  }
  options = Object.assign(defaults, options);


  // AXES
  const axesHelper =  options.axesActive ? new THREE.AxesHelper(options.axesSize) : '';

  // GRID
  const gridHelper = options.gridActive ? new THREE.GridHelper(options.gridSize, options.gridDivisions) : '';

  return [axesHelper, gridHelper]
}

export function setGuiLight (lights) {
  /***
   * lights = array || light object3d
  */
  if ( !_DEBUG || !_DEBUG.gui ) return;

  const folderLights = _DEBUG.gui.addFolder('Light');
  
  !Array.isArray(lights) && (lights = [lights]);

  lights.forEach(light => {
    const folderLight = folderLights.addFolder(light.type);

    folderLight.add(light, 'intensity', 0, 2, 0.01).name('light intensity');
    folderLight.add(light.position, 'x', -30, 30, 0.01).name('light X');
    folderLight.add(light.position, 'y', -30, 30, 0.01).name('light Y');
    folderLight.add(light.position, 'z', -30, 30, 0.01).name('light Z');
  });
}

// pip = guide 생성
export function setPIP (scene, tools, options) {
  if ( !_DEBUG ) return;

  /******
   * tools = {
   *  camera,
   *  cameraOffset,
   *  cameraTarget,
   *  cameraRotateGroupX,
   *  cameraRotateGroupY,
   *  modelSize,
   * }
  ******/

  const defaults = {
    pip: false,
    pipCameraPosition: [20, 20, 20],
    pipCameraTargetSize: [1, 8, 4],
    pipIsLineYFollowCamera: true,
  }
  options = Object.assign(defaults, options);

  // PIP
  const fog = scene.fog;
  const pip = {
    width: 400, 
    height: 300, 
    camera: new THREE.PerspectiveCamera(70, 400/300, 0.1, 999),
    cameraHelper: null,
    cameraTargetHelper: null,
    lineX: null, 
    lineY: null,
    lineZ: null,
    beforeRender: () => {
      fog && (scene.fog = null);
      if ( pip.lineX ) {
        pip.lineX.scale.set(1, 1, 1);
        pip.lineX.scale.multiplyScalar(tools.camera.position.z);
        pip.lineX.rotation.z = tools.cameraRotateGroupX.rotation.y;
        scene.add(pip.lineX);
        scene.add(pip.cameraHelper);
        pip.cameraTargetHelper.position.copy(tools.cameraTarget);
        scene.add(pip.cameraTargetHelper);
      }
    },
    afterRender: () => {
      fog && (scene.fog = fog);
      scene.remove(pip.lineX);
      scene.remove(pip.cameraHelper);
      // scene.remove(pip.cameraTargetHelper);
    }
  }
    
  // - pip - camera helper
  pip.cameraHelper = new THREE.CameraHelper(tools.camera);
  pip.camera.position.set(...options.pipCameraPosition);
  pip.camera.lookAt(scene.position);
  pip.camera.updateProjectionMatrix();
  // - pip - camera target helper
  pip.cameraTargetHelper = new THREE.Mesh(
    new THREE.SphereGeometry(...options.pipCameraTargetSize),
    new THREE.MeshBasicMaterial({ color: 'blue', depthTest: false , wireframe: true})
  );
  pip.cameraTargetHelper.renderOrder = 1;
  // - pip - line x, y
  pip.lineX = (() => {
    const shape = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2); // shape 
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(shape.getPoints(50)), 
      new THREE.LineBasicMaterial({ color: 0xff0000 })
    );
    line.rotation.x = -Math.PI / 2;
    options.pipIsLineYFollowCamera && (line.position.y = tools.camera.position.y);
    return line;
  })();
  pip.lineY = (() => {
    const line = new THREE.Line(
      pip.lineX.geometry, 
      new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.y = Math.PI / 2;
    pip.lineX.add(line);
    return line;
  })();
  pip.lineX.scale.set(1, 1, 1);
  pip.lineX.scale.multiplyScalar(tools.camera.position.z);
  pip.lineX.rotation.z = tools.cameraRotateGroupX.rotation.y;
  scene.add(pip.lineX);


  // GUI add pip
  // gui - pip visible
  // const folderControls = _DEBUG.gui.addFolder('Controls');
  // const pipSetting = { visible: location.search.indexOf('pip') > -1 ? true : false }
  // folderControls.add(pipSetting, 'visible').name('pip visible').onChange(() => { !pipSetting.visible &&  renderer.setSize(areaWidth, areaHeight); });

  // gui - camera
  const cameraControls = _DEBUG.gui.addFolder('Camera');
  // cameraControls.add(camera, 'zoom', 1, 10, 0.01).name('zoom x');
  cameraControls.add(tools.camera.position, 'x', -50, 50, 0.01).name('position x');
  cameraControls.add(tools.camera.position, 'y', -50, 50, 0.01).name('position y');
  cameraControls.add(tools.camera.position, 'z', -50, 50, 0.01).name('position z');
  cameraControls.add(tools.cameraRotateGroupX.rotation, 'y', -3.14, 3.14, 0.001).name('rotate x');
  cameraControls.add(tools.cameraRotateGroupY.rotation, 'x', -3.14, 3.14, 0.001).name('rotate y');
  const fovControl = cameraControls.add(tools.camera, 'fov', 1, 150).name('fov');
  fovControl.onChange(function(value) {
    tools.camera.fov = value;
    tools.camera.updateProjectionMatrix();
  });

  // gui - target
  const folderTarget = _DEBUG.gui.addFolder('Target');
  folderTarget.add(tools.cameraTarget, 'x', -40, 40, 0.001).onChange(() => { tools.camera.lookAt(tools.cameraTarget); });
  folderTarget.add(tools.cameraTarget, 'y', 0, 40, 0.001).onChange(() =>   { tools.camera.lookAt(tools.cameraTarget); });
  folderTarget.add(tools.cameraTarget, 'z', -40, 40, 0.001).onChange(() => { tools.camera.lookAt(tools.cameraTarget); });


  // assign
  _DEBUG.pip = pip;
}

export function setGuiModel (scene, model, options) {
  if ( !_DEBUG ) return;

  const defaults = {
    name: 'Model',
    boxActive: true,
    boxPosition: new THREE.Vector3().copy(model.position)
  }
  options = Object.assign(defaults, options);
  
  const materialValue = { opacity: 1 }
  
  const modelSize = new THREE.Box3().setFromObject(model);
  const modelWidth = modelSize.max.x - modelSize.min.x;
  const modelHeight = modelSize.max.y - modelSize.min.y;
  const modelDepth = modelSize.max.z - modelSize.min.z;

  // gui - model opacity 
  const folderModel = _DEBUG.gui.addFolder(options.name);
  folderModel.add(model, 'visible').name('visible');
  folderModel.add(materialValue, 'opacity', 0, 1, 0.01).name('opacity').onChange(function(value) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.opacity = materialValue.opacity;
      }
    });
  });

  // gui - model
  folderModel.add(model.position, 'x', -10, 10, 0.01).name('position X');
  folderModel.add(model.position, 'y', -10, 10, 0.01).name('position Y');
  folderModel.add(model.position, 'z', -10, 10, 0.01).name('position Z');
  folderModel.add(model.rotation, 'x', -10, 10, 0.01).name('rotation X');
  folderModel.add(model.rotation, 'y', -10, 10, 0.01).name('rotation Y');
  folderModel.add(model.rotation, 'z', -10, 10, 0.01).name('rotation Z');
  if ( model.isMesh ) {
    folderModel.add(model.material, 'wireframe').name('wireframe');
    folderModel.add(model.material, 'depthTest').name('depthTest');
    folderModel.add(model.material, 'depthWrite').name('depthWrite');
    model.material.roughness !== undefined && folderModel.add(model.material, 'roughness', 0, 1, 0.001).name('roughness');
    model.material.metalness !== undefined && folderModel.add(model.material, 'metalness', 0, 1, 0.001).name('metalness');
    model.material.thickness !== undefined && folderModel.add(model.material, 'thickness', 0, 3, 0.0001);
    model.material.alphaToCoverage !== undefined && folderModel.add(model.material, 'alphaToCoverage');
    model.material.alphaTest !== undefined && folderModel.add(model.material, 'alphaTest', 0, 1, 0.001);
    model.material.ior !== undefined && folderModel.add(model.material, 'ior', 0, 3, 0.0001);
    model.material.anisotropyRotation !== undefined && folderModel.add(model.material, 'anisotropyRotation', 0, 5, 0.0001);
    model.material.anisotropy !== undefined && folderModel.add(model.material, 'anisotropy', 0, 1, 0.0001);
    model.material.transmission !== undefined && folderModel.add(model.material, 'transmission', 0, 1, 0.0001);
    model.material.iridescence !== undefined && folderModel.add(model.material, 'iridescence', 0, 1, 0.0001);
    model.material.iridescenceIOR !== undefined && folderModel.add(model.material, 'iridescenceIOR', 0, 5, 0.0001);
    model.material.sheen !== undefined && folderModel.add(model.material, 'sheen', 0, 1, 0.0001);
    model.material.sheenRoughness !== undefined && folderModel.add(model.material, 'sheenRoughness', 0, 1, 0.0001);
    model.material.clearcoat !== undefined && folderModel.add(model.material, 'clearcoat', 0, 1, 0.0001);
    model.material.clearcoatRoughness !== undefined && folderModel.add(model.material, 'clearcoatRoughness', 0, 1, 0.0001);
    model.material.envMapIntensity !== undefined && folderModel.add(model.material, 'envMapIntensity', 0, 3, 0.0001);
    model.material.reflectivity !== undefined && folderModel.add(model.material, 'reflectivity', 0, 1, 0.0001);
  }

  // gui - model box
  if ( options.boxActive ) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(modelWidth, modelHeight, modelDepth),
      new THREE.MeshBasicMaterial({ wireframe: true, color: 'red' })
    );
    box.position.copy(options.boxPosition);
    box.visible = false;
    const folderModelBox = _DEBUG.gui.addFolder(options.name ? options.name + 'Box' : 'Box');
    folderModelBox.add(box, 'visible').name('visible');
    folderModelBox.add(box.scale, 'x', 0, 1, 0.01).name('scale x');
    folderModelBox.add(box.scale, 'y', 0, 1, 0.01).name('scale y');
    folderModelBox.add(box.scale, 'z', 0, 1, 0.01).name('scale z');
    folderModelBox.add(box.position, 'x', -modelWidth/2, modelWidth/2, 0.01).name('position x');
    folderModelBox.add(box.position, 'y', -modelHeight/2, modelHeight/2, 0.01).name('position y');
    folderModelBox.add(box.position, 'z', -modelDepth/2, modelDepth/2, 0.01).name('position z');
    scene.add(box);
  }
}



/* timline sequence */
export function addTimelineSequence ($area, cameraDistance, tools, animator, settings) {
  /** 
   * tools = {
   *  camera,
   *  cameraOffset,
   *  cameraTarget,
   *  cameraRotateGroupX,
   *  cameraRotateGroupY,
   *  modelSize,
   * }
   * animator = {
   *  timeline,
   *  timelineSequenceIndex,
   *  timelineTimeStamps,
   * }
   * settings = {
   *  rotateX: 0,
   *  rotateY: 0,
   *  target: [0, 0, 0],
   *  fovDistance: 0,
   *  position: [0, 0],
   *  ease: '',
   * }
  */
  if ( !animator.timeline ) return;

  const name = 'seq' + animator.timelineSequenceIndex;
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

  animator.timeline.to(tools.cameraRotateGroupX.rotation, { y: settings.rotateX || 0, duration, ease }, name);
  animator.timeline.to(tools.cameraRotateGroupY.rotation, { x: settings.rotateY || 0, duration, ease }, name);
  animator.timeline.to(tools.cameraTarget, { ...cameraTargetPosition, duration, ease }, name);
  animator.timeline.to(tools.camera.position, { ...cameraPosition, duration, ease }, name);
  animator.timeline.to(tools.camera, { fov: getCameraFov(areaInfo.height, tools.modelSize.height, cameraDistance + (settings.fovDistance || 0)), duration, ease }, name);
  animator.timeline.to(tools.cameraOffset, { ...getCameraOffset(areaInfo), duration, ease }, name);
  // animator.timeline.to(scene.fog, { near: cameraDistance, far: cameraDistance + 10, duration, ease }, name);

  animator.timelineTimeStamps.push(animator.timeline.totalDuration());
  animator.timelineSequenceIndex++;

  return {
    animator
  }
}
function getCameraFov (meshAreaHeight, meshHeight, cameraDistance) {
  const targetHeight = meshHeight * areaHeight / meshAreaHeight;
  return 2 * (180 / Math.PI) * Math.atan(targetHeight / (2 * cameraDistance));
}
function getCameraOffset (areaInfo) {
  return {
    x: areaWidth / 2 - areaInfo.width / 2 - areaInfo.left,
    y: areaHeight / 2 - areaInfo.height / 2 - areaInfo.top,
  };
}
function getAreaInfo ($target, selector) {
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

export function resetNodes($target) {
  [].forEach.call($target.querySelectorAll('*'), ($node) => {
    $node._gsap && gsap.set($node, { clearProps: true });
  });
}




export function filterMessage (message) {
	return message.replace(/[\b]/g, '');
}

export function isEditingMode (mode) {
	return (/^(create|edit)$/).test(mode);
}

// 마우스 x, y 값 가져오기
export function getEventPoint(e) {
	if (e.touches) {
		e = e.touches[0] || e.changedTouches[0];
	}
	return [e.pageX || e.clientX, e.pageY || e.clientY];
}


export function avoidTouchPropagation ($node) {
	$node.addEventListener('touchstart', stopPropagation);
	$node.addEventListener('touchmove', stopPropagation);
}

// 이벤트 전파 방지
export function stopPropagation(e) {
	e && e.stopPropagation && e.stopPropagation();
}


// 3D 모델 크기 구하기
export function getObjectSize(model) {
  let bbox = new THREE.Box3().setFromObject(model);
  return bbox.getSize(new THREE.Vector3());
}





// Get the top and left coordinates of the caret in a <textarea> or <input type="text">, in pixels.
// https://github.com/component/textarea-caret-position

// We'll copy the properties below into the mirror div.
// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
const properties = [
	'direction',  // RTL support
	'boxSizing',
	'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
	'height',
	'overflowX',
	'overflowY',  // copy the scrollbar for IE

	'borderTopWidth',
	'borderRightWidth',
	'borderBottomWidth',
	'borderLeftWidth',
	'borderStyle',

	'paddingTop',
	'paddingRight',
	'paddingBottom',
	'paddingLeft',

	// https://developer.mozilla.org/en-US/docs/Web/CSS/font
	'fontStyle',
	'fontVariant',
	'fontWeight',
	'fontStretch',
	'fontSize',
	'fontSizeAdjust',
	'lineHeight',
	'fontFamily',

	'textAlign',
	'textTransform',
	'textIndent',
	'textDecoration',  // might not make a difference, but better be safe

	'letterSpacing',
	'wordSpacing',

	'tabSize',
	'MozTabSize'
];

const isBrowser = (typeof window !== 'undefined');
const isFirefox = (isBrowser && window.mozInnerScreenX != null);

export function getCaretCoordinates(element, position, options) {
	if (!isBrowser) {
		throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
	}

	var debug = options && options.debug || false;
	if (debug) {
		var el = document.querySelector('#input-textarea-caret-position-mirror-div');
		if (el) el.parentNode.removeChild(el);
	}

	// The mirror div will replicate the textarea's style
	var div = document.createElement('div');
	div.id = 'input-textarea-caret-position-mirror-div';
	document.body.appendChild(div);

	var style = div.style;
	var computed = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9
	var isInput = element.nodeName === 'INPUT';

	// Default textarea styles
	style.whiteSpace = 'pre-wrap';
	if (!isInput)
		style.wordWrap = 'break-word';  // only for textarea-s

	// Position off-screen
	style.position = 'absolute';  // required to return coordinates properly
	if (!debug)
		style.visibility = 'hidden';  // not 'display: none' because we want rendering

	// Transfer the element's properties to the div
	properties.forEach(function (prop) {
		if (isInput && prop === 'lineHeight') {
			// Special case for <input>s because text is rendered centered and line height may be != height
			if (computed.boxSizing === "border-box") {
				var height = parseInt(computed.height);
				var outerHeight =
					parseInt(computed.paddingTop) +
					parseInt(computed.paddingBottom) +
					parseInt(computed.borderTopWidth) +
					parseInt(computed.borderBottomWidth);
				var targetHeight = outerHeight + parseInt(computed.lineHeight);
				if (height > targetHeight) {
					style.lineHeight = height - outerHeight + "px";
				} else if (height === targetHeight) {
					style.lineHeight = computed.lineHeight;
				} else {
					style.lineHeight = 0;
				}
			} else {
				style.lineHeight = computed.height;
			}
		} else {
			style[prop] = computed[prop];
		}
	});

	if (isFirefox) {
		// Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
		if (element.scrollHeight > parseInt(computed.height))
			style.overflowY = 'scroll';
	} else {
		style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
	}

	div.textContent = element.value.substring(0, position);
	// The second special handling for input type="text" vs textarea:
	// spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
	if (isInput)
		div.textContent = div.textContent.replace(/\s/g, '\u00a0');

	var span = document.createElement('span');
	// Wrapping must be replicated *exactly*, including when a long word gets
	// onto the next line, with whitespace at the end of the line before (#7).
	// The  *only* reliable way to do that is to copy the *entire* rest of the
	// textarea's content into the <span> created at the caret position.
	// For inputs, just '.' would be enough, but no need to bother.
	span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
	div.appendChild(span);

	var coordinates = {
		top: span.offsetTop + parseInt(computed['borderTopWidth']),
		left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
		height: parseInt(computed['lineHeight'])
	};

	if (debug) {
		span.style.backgroundColor = '#aaa';
	} else {
		document.body.removeChild(div);
	}

	return coordinates;
}