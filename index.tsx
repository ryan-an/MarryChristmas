
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * MERRY CHRISTMAS - Responsive Radiant Tree Edition
 * Refined Luminescence + Theme Switching + Fullscreen + Manual & Hand Controls
 */

const THEMES = {
  classic: {
    needle: 0x05331a,
    glow: 0x77cc99,
    ornaments: [0xffd700, 0xff3333, 0xffffff, 0xffbbbb]
  },
  gold: {
    needle: 0x5a4a15,
    glow: 0xffd700,
    ornaments: [0xffffff, 0xffe082, 0xffb74d, 0xffffff]
  },
  crimson: {
    needle: 0x3d0000,
    glow: 0xff4d4d,
    ornaments: [0xffffff, 0xffd700, 0xff9999, 0xffbbbb]
  },
  midnight: {
    needle: 0x001533,
    glow: 0x4dd2ff,
    ornaments: [0xffffff, 0x90caf9, 0xb3e5fc, 0x81d4fa]
  },
  snow: {
    needle: 0xe0e0e0,
    glow: 0xb3e5fc,
    ornaments: [0x4dd2ff, 0xffffff, 0x90caf9, 0xffd700]
  }
};

const CONFIG = {
  treeParticleCount: 100000, 
  galaxyParticleCount: 60000, 
  dustCount: 4000,
  treeHeight: 95,        
  treeRadius: 52,        
  tiers: 30,             
  bloom: {
    strength: 0.65,      
    radius: 0.7,         
    threshold: 0.45      
  }
};

type Mode = 'TREE' | 'SCATTER';
type ThemeName = keyof typeof THEMES;

interface AppState {
  mode: Mode;
  theme: ThemeName;
  handX: number;
  handY: number;
  // Interaction states
  isPointerDown: boolean;
  pointerX: number;
  pointerY: number;
  manualRotX: number;
  manualRotY: number;
  clickStartPos: { x: number, y: number };
}

class HolidayApp {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock: THREE.Clock;
  
  private treePoints: THREE.Points;
  private treeGeometry: THREE.BufferGeometry;
  private treeJitters: Float32Array;
  private treeBranchParams: Float32Array; 

  private galaxyFloor: THREE.Points;
  private dust: THREE.Points;
  private state: AppState;
  private mainGroup: THREE.Group;
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private heart: THREE.Mesh;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 15, 120); 
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.4; 
    document.body.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.mainGroup = new THREE.Group();
    this.mainGroup.position.set(0, 10, -5);
    this.scene.add(this.mainGroup);

    this.state = {
      mode: 'TREE',
      theme: 'classic',
      handX: 0,
      handY: 0,
      isPointerDown: false,
      pointerX: 0,
      pointerY: 0,
      manualRotX: 0,
      manualRotY: 0,
      clickStartPos: { x: 0, y: 0 }
    };

    this.initPostProcessing();
    this.initLights();
    this.initEnvironment();
    this.initHeart(); 
    this.initTreeParticles();
    this.initGalaxyFloor();
    this.initDust();
    this.initCV();
    this.initUI();

    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
  }

  private initPostProcessing() {
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      CONFIG.bloom.strength,
      CONFIG.bloom.radius,
      CONFIG.bloom.threshold
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
  }

  private initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3)); 
    const topLight = new THREE.PointLight(0xfff0dd, 5, 300); 
    topLight.position.set(0, 150, 0);
    this.scene.add(topLight);
  }

  private initEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  private initHeart() {
    const x = 0, y = 0;
    const heartShape = new THREE.Shape();
    heartShape.moveTo( x + 5, y + 5 );
    heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
    heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
    heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
    heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
    heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
    heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );

    const extrudeSettings = { 
      depth: 1.5, 
      bevelEnabled: true, 
      bevelSegments: 2, 
      steps: 2, 
      bevelSize: 0.8, 
      bevelThickness: 0.8 
    };

    const geometry = new THREE.ExtrudeGeometry( heartShape, extrudeSettings );
    geometry.center();
    geometry.rotateZ(Math.PI); 
    
    const scale = 0.11;
    geometry.scale(scale, scale, scale);

    const material = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 1.5, 
      metalness: 0.9,
      roughness: 0.1
    });

    this.heart = new THREE.Mesh(geometry, material);
    this.heart.position.y = CONFIG.treeHeight / 2 + 16;
    this.mainGroup.add(this.heart);
  }

  private initTreeParticles() {
    this.treeGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.treeParticleCount * 3);
    const colors = new Float32Array(CONFIG.treeParticleCount * 3);
    this.treeJitters = new Float32Array(CONFIG.treeParticleCount * 3);
    this.treeBranchParams = new Float32Array(CONFIG.treeParticleCount * 4); 

    const theme = THEMES[this.state.theme];

    for (let i = 0; i < CONFIG.treeParticleCount; i++) {
      const idx = i * 3;
      const bIdx = i * 4;
      
      positions[idx] = (Math.random() - 0.5) * 400;
      positions[idx+1] = (Math.random() - 0.5) * 400;
      positions[idx+2] = (Math.random() - 0.5) * 400;

      const isBranch = Math.random() < 0.3;
      const tier = Math.floor(Math.pow(Math.random(), 0.35) * CONFIG.tiers); 
      const branchesPerTier = 8 + tier;
      const branchAngle = (Math.random() * branchesPerTier) * (Math.PI * 2 / branchesPerTier);
      const distFromCenter = Math.random(); 

      this.treeBranchParams[bIdx] = distFromCenter;
      this.treeBranchParams[bIdx+1] = tier;
      this.treeBranchParams[bIdx+2] = branchAngle;
      this.treeBranchParams[bIdx+3] = isBranch ? 1 : 0;

      const jitterScale = isBranch ? 0.3 : 3.0; 
      this.treeJitters[idx] = (Math.random() - 0.5) * jitterScale;
      this.treeJitters[idx+1] = (Math.random() - 0.5) * jitterScale;
      this.treeJitters[idx+2] = (Math.random() - 0.5) * jitterScale;

      const r = Math.random();
      let color = new THREE.Color();
      
      if (isBranch) {
        color.setHex(theme.glow);
        color.multiplyScalar(1.02); 
      } else {
        if (r < 0.85) {
          color.setHex(theme.needle);
          color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
        } else {
          color.setHex(theme.ornaments[Math.floor(Math.random() * theme.ornaments.length)]);
          color.multiplyScalar(0.9);
        }
      }

      colors[idx] = color.r;
      colors[idx+1] = color.g;
      colors[idx+2] = color.b;
    }

    this.treeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.treeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.treePoints = new THREE.Points(this.treeGeometry, new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.mainGroup.add(this.treePoints);
  }

  private updateTreeColors() {
    const theme = THEMES[this.state.theme];
    const colors = this.treeGeometry.attributes.color.array as Float32Array;

    for (let i = 0; i < CONFIG.treeParticleCount; i++) {
      const idx = i * 3;
      const bIdx = i * 4;
      const isBranch = this.treeBranchParams[bIdx+3] === 1;
      
      let color = new THREE.Color();
      const r = Math.random();

      if (isBranch) {
        color.setHex(theme.glow);
        color.multiplyScalar(1.02);
      } else {
        if (r < 0.85) {
          color.setHex(theme.needle);
          color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
        } else {
          color.setHex(theme.ornaments[Math.floor(Math.random() * theme.ornaments.length)]);
          color.multiplyScalar(0.9);
        }
      }

      colors[idx] = color.r;
      colors[idx+1] = color.g;
      colors[idx+2] = color.b;
    }
    this.treeGeometry.attributes.color.needsUpdate = true;
  }

  private initGalaxyFloor() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(CONFIG.galaxyParticleCount * 3);
    const colors = new Float32Array(CONFIG.galaxyParticleCount * 3);
    
    const ringConfig = [
      { inner: 10, outer: 60, height: 8, colorBase: 0xffd700, type: 'TAICHI' }, 
      { inner: 74, outer: 135, height: 5, colorBase: 0xffffff, type: 'SPIRAL' }, 
      { inner: 175, outer: 275, height: 3, colorBase: 0x66ccff, type: 'SPIRAL' } 
    ];

    for (let i = 0; i < CONFIG.galaxyParticleCount; i++) {
      const idx = i * 3;
      const t = Math.random();
      let dist, angle, py = 0;
      let color = new THREE.Color();

      const isConnector = i % 100 < 20;

      if (isConnector) {
        const gapType = i % 2; 
        if (gapType === 0) {
          dist = 58 + t * 18; 
          color.lerpColors(new THREE.Color(0xffd700), new THREE.Color(0xffffff), t);
        } else {
          dist = 135 + t * 45; 
          color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0x66ccff), t);
        }
        angle = (i * 0.05) + (dist * 0.045) + (Math.random() - 0.5) * 2.0;
        py = (Math.random() - 0.5) * 3;
        color.multiplyScalar(0.3); 
      } else {
        const ringIdx = i % 3;
        const config = ringConfig[ringIdx];
        const rRange = config.outer - config.inner;
        dist = config.inner + t * rRange;

        if (config.type === 'TAICHI') {
          const arm = i % 2; 
          const baseAngle = arm === 0 ? 0 : Math.PI;
          const wind = dist * 0.05;
          const thickness = 0.5 + Math.sin(t * Math.PI) * 1.5; 
          angle = baseAngle + wind + (Math.random() - 0.5) * thickness;
          const bulgeHeight = Math.sin(t * Math.PI) * 12.0;
          py = (Math.random() - 0.5) * 4 + bulgeHeight;
        } else {
          const arms = 6 + ringIdx;
          const armIdx = i % arms;
          angle = (armIdx / arms) * Math.PI * 2 + (dist * 0.035) + (Math.random() - 0.5) * 1.0;
          py = Math.sin(t * Math.PI) * config.height + (Math.random() - 0.5) * 2.0;
        }

        const randomTone = Math.random();
        if (randomTone > 0.8) color.setHex(config.colorBase);
        else color.setHSL(0.6 + ringIdx * 0.05, 0.4, 0.4 + Math.random() * 0.3);
      }
      
      pos[idx] = Math.cos(angle) * dist * 1.6; 
      pos[idx + 1] = py; 
      pos[idx + 2] = Math.sin(angle) * dist * 1.6;

      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.galaxyFloor = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.28, 
      vertexColors: true,
      transparent: true,
      opacity: 0.75, 
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.galaxyFloor.position.y = -52; 
    this.mainGroup.add(this.galaxyFloor);
  }

  private initDust() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(CONFIG.dustCount * 3);
    for (let i = 0; i < CONFIG.dustCount * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 850;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x888888, 
      size: 0.06,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    }));
    this.scene.add(this.dust);
  }

  private async initCV() {
    try {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
      });
      this.video = document.getElementById('webcam') as HTMLVideoElement;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      if (stream && this.video) { this.video.srcObject = stream; this.video.addEventListener('loadeddata', () => this.hideLoader()); }
      else { this.hideLoader(); }
    } catch (e) { this.hideLoader(); }
  }

  private hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('ui-hidden'); setTimeout(() => loader.remove(), 800); }
  }

  private initUI() {
    window.addEventListener('keydown', (e) => { 
      if (e.key.toLowerCase() === 'h') {
        document.getElementById('ui-container')?.classList.toggle('ui-hidden'); 
        document.getElementById('top-controls')?.classList.toggle('ui-hidden');
        document.querySelector('.personalized-message')?.classList.toggle('ui-hidden');
      }
    });

    const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
    if (themeSelector) {
      themeSelector.addEventListener('change', (e) => {
        this.state.theme = (e.target as HTMLSelectElement).value as ThemeName;
        this.updateTreeColors();
      });
    }

    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          fsBtn.textContent = "Exit Full Screen";
        } else {
          document.exitFullscreen();
          fsBtn.textContent = "Full Screen";
        }
      });
    }
  }

  private onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'OPTION') return;
    
    this.state.isPointerDown = true;
    this.state.clickStartPos = { x: e.clientX, y: e.clientY };
    this.state.pointerX = e.clientX;
    this.state.pointerY = e.clientY;
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.state.isPointerDown) return;

    const dx = e.clientX - this.state.pointerX;
    const dy = e.clientY - this.state.pointerY;

    this.state.manualRotY += dx * 0.005;
    this.state.manualRotX += dy * 0.005;

    this.state.pointerX = e.clientX;
    this.state.pointerY = e.clientY;
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.state.isPointerDown) return;
    this.state.isPointerDown = false;

    // Detection for "Click" vs "Drag"
    const dist = Math.sqrt(
      Math.pow(e.clientX - this.state.clickStartPos.x, 2) + 
      Math.pow(e.clientY - this.state.clickStartPos.y, 2)
    );

    // If movement is small, it's a click: Toggle mode
    if (dist < 5) {
      const modes: Mode[] = ['TREE', 'SCATTER'];
      this.state.mode = modes[(modes.indexOf(this.state.mode) + 1) % modes.length];
    }
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public update() {
    const time = this.clock.getElapsedTime();

    if (this.handLandmarker && this.video && this.video.readyState >= 2) {
      const results = this.handLandmarker.detectForVideo(this.video, performance.now());
      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0];
        // Merge hand tracking with some damping
        this.state.handX = (hand[9].x - 0.5) * 2;
        this.state.handY = (hand[9].y - 0.5) * 2;
      }
    }

    // Combine manual and hand rotation
    const targetRotY = this.state.handX * 0.35 + this.state.manualRotY;
    const targetRotX = this.state.handY * 0.18 + this.state.manualRotX;

    this.mainGroup.rotation.y += (targetRotY - this.mainGroup.rotation.y) * 0.05;
    this.mainGroup.rotation.x += (targetRotX - this.mainGroup.rotation.x) * 0.05;

    this.galaxyFloor.rotation.y += 0.003; 
    
    const targetFloorY = this.state.mode === 'TREE' ? -52 : -140;
    this.galaxyFloor.position.y = THREE.MathUtils.lerp(this.galaxyFloor.position.y, targetFloorY, 0.05);
    (this.galaxyFloor.material as THREE.PointsMaterial).opacity = 0.75;

    const heartVisible = this.state.mode === 'TREE' ? 1 : 0;
    this.heart.scale.setScalar(THREE.MathUtils.lerp(this.heart.scale.x, heartVisible * (1 + Math.sin(time * 2.5) * 0.06), 0.1));
    this.heart.rotation.y += 0.006;
    (this.heart.material as any).emissiveIntensity = 1.5 + Math.sin(time * 4) * 0.7;

    const positions = this.treeGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < CONFIG.treeParticleCount; i++) {
      const idx = i * 3;
      const bIdx = i * 4;
      let tx, ty, tz;

      if (this.state.mode === 'TREE') {
        const distAlongBranch = this.treeBranchParams[bIdx];
        const tierIndex = this.treeBranchParams[bIdx+1];
        const branchAngle = this.treeBranchParams[bIdx+2];
        const isBranch = this.treeBranchParams[bIdx+3] === 1;

        const tierT = tierIndex / CONFIG.tiers;
        const tierHeight = (1 - tierT) * CONFIG.treeHeight - CONFIG.treeHeight / 2 + 12;
        
        const adjustedTierT = Math.pow(tierT, 1.1); 
        const tierRadiusMax = adjustedTierT * CONFIG.treeRadius;
        
        const subAngleScale = isBranch ? 0.2 : 2.5;
        const actualAngle = branchAngle + (Math.sin(i * 0.01) * subAngleScale * (1 - distAlongBranch));
        
        const droop = Math.pow(distAlongBranch, 1.4) * 7; 
        const sway = Math.sin(time * 0.4 + tierIndex * 0.6) * 0.15;
        
        const branchRadius = distAlongBranch * tierRadiusMax;
        
        tx = Math.cos(actualAngle + sway) * branchRadius + this.treeJitters[idx];
        let calculatedTy = tierHeight - droop + this.treeJitters[idx+1] + Math.sin(time * 0.8 + tierIndex) * 0.5;
        
        const floorLimit = -51.8;
        ty = Math.max(calculatedTy, floorLimit);
        
        tz = Math.sin(actualAngle + sway) * branchRadius + this.treeJitters[idx+2];
      } else {
        const t = i / CONFIG.treeParticleCount;
        const r = 90 + Math.sin(t * 300 + time) * 60;
        tx = Math.cos(t * Math.PI * 4 + time * 0.4) * r;
        ty = Math.sin(t * 180 + time * 0.2) * r;
        tz = Math.sin(t * Math.PI * 4 + time * 0.4) * r;
      }

      positions[idx] += (tx - positions[idx]) * 0.06;
      positions[idx+1] += (ty - positions[idx+1]) * 0.06;
      positions[idx+2] += (tz - positions[idx+2]) * 0.06;
    }
    this.treeGeometry.attributes.position.needsUpdate = true;

    this.composer.render();
  }
}

const app = new HolidayApp();
function animate() { requestAnimationFrame(animate); app.update(); }
animate();
