import * as state from './_state';

import gsap from 'gsap';
import dat from 'dat.gui';
import Stats from 'stats.js';


/* debug */
export const _DEBUG = location.search.indexOf('debug') > -1 ? {} : null;
if (_DEBUG) {
	document.documentElement.classList.add('_debug');

  // gui
	_DEBUG.gui = new dat.GUI();
	_DEBUG.gui.domElement.parentNode.style.zIndex = 100;
	
  // stats
	_DEBUG.stats = new Stats();
	document.body.appendChild(_DEBUG.stats.dom);
	gsap.ticker.add(() => _DEBUG.stats.update());
} else {
	console.warn = () => {};
}

/* controls */
export const _CONTROL = location.search.indexOf('control') > -1 ? {} : null;
if (_CONTROL) {
	document.documentElement.classList.add('_control');
}

/* area size */
export let areaWidth = window.innerWidth;
export let areaHeight = window.innerHeight;

/* path */
export const RESOURCES_PATH = '../';
export const IMAGE_PATH = '../images/';
export const MODEL_PATH = '../models/';
export const HDR_PATH = '../hdr/';
export const FONT_PATH = '../fonts/';

/* dom */
export const $html = document.documentElement;
export const $body = document.body;

/* world value */
export let pixelRatio = getPixelRatio();
export const PI = Math.PI;
export const PI2 = PI * 2;

/* useAgent - browser */
const userAgent = navigator.userAgent;
export const isMobile = (/(ip(ad|hone|od)|android)/i).test(userAgent) || (navigator.platform.toLowerCase() === 'macintel' && navigator.maxTouchPoints > 1);
export const isAndroid = (/android/i).test(userAgent);
export const isEdge = (/(edge|edg)/i).test(userAgent);
export const isFirefox = (/firefox/i).test(userAgent);
export const isSafari = (/safari/i).test(userAgent) && !(/chrome/i).test(userAgent);

isMobile && $html.classList.add('mobile');
isEdge && $html.classList.add('edge');
isSafari && $html.classList.add('safari');
isFirefox && $html.classList.add('firefox');

/* on resize */
let media;
function onResize () {
  // area size
  areaWidth = window.innerWidth;
  areaHeight = window.innerHeight;

  /* world value */
  pixelRatio = getPixelRatio();

  // area size - js -> css
	$html.style.setProperty('--aw', areaWidth + 'px');
	$html.style.setProperty('--ah', areaHeight + 'px');
  
  // state - dispatch resize
  state.dispatch('resize', areaWidth, areaHeight, pixelRatio);

  // state - dispatch media change
  media = window.innerWidth < 1024 ? 'mobile' : 'pc';
  if (state.states.media !== media) {
    state.dispatch('mediachange', media);
  }

  onScroll();
}

/* on scroll */
function onScroll () {
	const scrollTop = window.pageYOffset;

	state.dispatch('scroll', scrollTop);
}

/* on asset load */
const assetsLoadList = {
	page: false,
	model: false,
	env: false,
};
export function onAssetLoaded (flag) {
	if (assetsLoadList[flag] !== undefined) {
		assetsLoadList[flag] = true;
	}

	let itemsLoaded = 0, itemsTotal = 0;
	for (let name in assetsLoadList) {
		itemsTotal++;
		if (assetsLoadList[name]) {
			itemsLoaded++;
		}
	}
	
	if (itemsLoaded !== itemsTotal) return;


	$html.classList.add('ready');
	onResize();
	gsap.delayedCall(0.5, () => {
		state.dispatch('ready');
	});

	// setLoadingIndicator(itemsLoaded / itemsTotal);
	// gsap.to($cover, { opacity: 0, duration: 1, delay: 0.7, ease: 'quad.out', onComplete: () => {
	// 	$cover.parentNode.removeChild($cover);
	// 	$cover = null;
	// }});
	// gsap.to($loading, { scaleX: 0, duration: 1, delay: 0, ease: 'expo.inOut', onComplete: () => {
	// 	$loading.parentNode.removeChild($loading);
	// 	$loading = null;
	// }});
}

/* window event */
window.addEventListener('scroll', onScroll);
window.addEventListener('resize', onResize);
window.addEventListener('load', () => { onAssetLoaded('page'); });

/* utill */
function getPixelRatio () {
	return Math.min(2, window.devicePixelRatio);
}

function setLoadingIndicator (ratio) {
	$loading.style.setProperty('--loaded-ratio', ratio);
}