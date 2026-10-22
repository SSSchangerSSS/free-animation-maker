// ─────────────────────────────────────────────────────────────
// موتور رندر — صحنه، نور، زمین، مدیریت شخصیت و انیمیشن
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildCharacter, updateCharacterMaterials, type CharacterBuild, type CharacterMaterials } from '../character';
import type { CharConfig } from '../character/types';
import { buildClipLibrary, ANIM_DEFS } from '../animation/clips';
import { importExternalModel, type ImportedModel } from '../animation/retarget';

export interface EngineAnimInfo {
  id: string;
  label: string;
  loop: boolean;
  origin: 'library' | 'model';
}

export class Engine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private ro?: ResizeObserver;
  private container: HTMLElement;

  private character?: CharacterBuild;
  private lastStructural = '';
  private mixer?: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private currentAnim = 'idle';
  private anims: EngineAnimInfo[] = [];
  private clips: Record<string, THREE.AnimationClip> = {};
  private libraryClips: Record<string, THREE.AnimationClip>;
  private mixerRoot?: THREE.Object3D;

  private imported?: ImportedModel;
  private lastConfig?: CharConfig;
  public mode: 'creator' | 'imported' = 'creator';
  onImportedChange?: (imported: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.libraryClips = buildClipLibrary();
    this.initRenderer();
    this.initScene();
    this.initLights();
    this.initGround();
    this.initControls();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── راه‌اندازی ────────────────────────────────────────────
  private initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f0c08');
    this.scene.fog = new THREE.Fog('#0f0c08', 7, 16);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    this.scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(
      38, this.container.clientWidth / Math.max(1, this.container.clientHeight), 0.1, 60,
    );
    this.camera.position.set(1.8, 1.55, 3.2);
  }

  private initLights() {
    const hemi = new THREE.HemisphereLight('#8a7a5c', '#241c10', 0.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffe8c2', 2.6);
    key.position.set(2.4, 4.2, 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2.5;
    key.shadow.camera.right = 2.5;
    key.shadow.camera.top = 3.5;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.00018;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#a8dcc4', 1.15);
    rim.position.set(-2.8, 3.4, -2.6);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight('#c9b18f', 0.45);
    fill.position.set(-1.6, 1.4, 2.8);
    this.scene.add(fill);
  }

  private initGround() {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.62, 0.05, 64),
      new THREE.MeshStandardMaterial({ color: '#1c150c', roughness: 0.92, metalness: 0.08 }),
    );
    disc.position.y = -0.025;
    disc.receiveShadow = true;
    this.scene.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.011, 10, 90),
      new THREE.MeshStandardMaterial({
        color: '#2a2113', emissive: '#c8a24a', emissiveIntensity: 1.4, roughness: 0.4,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    this.scene.add(ring);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({ color: '#15100a', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 7;
    this.controls.maxPolarAngle = 1.52;
    this.controls.autoRotateSpeed = 1.6;
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    this.mixer?.update(dt);
    this.imported?.mixer.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ── شخصیت‌ساز ─────────────────────────────────────────────
  setCharacter(cfg: CharConfig) {
    this.lastConfig = cfg;
    const structural = `${cfg.race}|${cfg.hair}|${cfg.beard}|${cfg.weapon}|${cfg.height.toFixed(3)}|${cfg.bulk.toFixed(3)}`;
    if (structural !== this.lastStructural || !this.character) {
      this.lastStructural = structural;
      if (this.mode !== 'creator') this.exitImported();
      const prev = this.character;
      const build = buildCharacter(cfg);
      if (prev) {
        this.scene.remove(prev.root);
        prev.dispose();
      }
      this.character = build;
      this.scene.add(build.root);

      this.mixer?.stopAllAction();
      this.mixer = new THREE.AnimationMixer(build.root);
      this.mixerRoot = build.root;
      // بعد از کلیپ‌های یک‌بارمصرف به idle برگرد — به‌جز مرگ که روی زمین می‌ماند
      this.mixer.addEventListener('finished', (e) => {
        const name = (e as { action?: THREE.AnimationAction }).action?.getClip().name;
        if (name !== 'death') this.play('idle', true);
      });
      this.setupActions(this.libraryClips, 'library');
      this.anims = ANIM_DEFS.map((d) => ({ id: d.id, label: d.label, loop: d.loop, origin: 'library' as const }));
      // پخش دوباره‌ی انیمیشن فعلی بعد از بازسازی
      this.play(this.currentAnim, true);
    } else {
      updateCharacterMaterials(this.character.materials as unknown as CharacterMaterials, cfg);
    }
  }

  private setupActions(clips: Record<string, THREE.AnimationClip>, origin: 'library' | 'model') {
    this.actions = {};
    this.anims = [];
    for (const [id, clip] of Object.entries(clips)) {
      this.actions[id] = this.mixer!.clipAction(clip);
      this.anims.push({ id, label: id, loop: true, origin });
    }
  }

  /** ثبت لیست رسمی انیمیشن‌ها (برای UI) */
  defineAnims(defs: EngineAnimInfo[]) {
    this.anims = defs;
  }

  play(id: string, instant = false) {
    const next = this.actions[id];
    if (!next || !this.mixer) return;
    const info = this.anims.find((a) => a.id === id);
    next.setLoop(info?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = info?.loop === false;
    const prev = this.actions[this.currentAnim];
    if (prev && prev !== next && !instant) {
      next.reset().fadeIn(0.28).play();
      prev.fadeOut(0.28);
    } else {
      next.reset().play();
      if (prev && prev !== next) prev.stop();
    }
    this.currentAnim = id;
  }

  setSpeed(s: number) {
    if (this.mixer) this.mixer.timeScale = s;
    if (this.imported) this.imported.mixer.timeScale = s;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  getAnimList(): EngineAnimInfo[] {
    return this.anims;
  }

  // ── Import مدل خارجی ─────────────────────────────────────
  async importGLB(buffer: ArrayBuffer): Promise<ImportedModel['report']> {
    const imp = await importExternalModel(buffer);
    // پاک‌سازی شخصیت‌ساز
    if (this.character) {
      this.mixer?.stopAllAction();
      this.scene.remove(this.character.root);
      this.character.dispose();
      this.character = undefined;
      this.lastStructural = '';
    }
    if (this.imported) {
      this.scene.remove(this.imported.wrapper);
      this.imported.dispose();
    }
    this.imported = imp;
    this.mixer = imp.mixer;
    this.mixerRoot = imp.wrapper;
    this.mixer.addEventListener('finished', (e) => {
      const name = (e as { action?: THREE.AnimationAction }).action?.getClip().name;
      if (name !== 'death') this.play('idle', true);
    });

    // ثبت اکشن‌ها
    this.actions = {};
    this.anims = imp.clips.map((c) => ({ id: c.id, label: c.label, loop: c.loop, origin: c.origin }));
    for (const c of imp.clips) {
      const action = imp.mixer.clipAction(c.clip);
      this.actions[c.id] = action;
    }
    this.mode = 'imported';
    this.scene.add(imp.wrapper);
    this.play('idle', true);
    this.onImportedChange?.(true);
    return imp.report;
  }

  exitImported() {
    if (!this.imported) return;
    this.mixer?.stopAllAction();
    this.scene.remove(this.imported.wrapper);
    this.imported.dispose();
    this.imported = undefined;
    this.actions = {};
    this.anims = [];
    this.mode = 'creator';
    // بازسازی شخصیت‌ساز
    if (this.lastConfig) this.setCharacter(this.lastConfig);
    this.onImportedChange?.(false);
  }

  get isImported() { return this.mode === 'imported'; }

  // ── Export ────────────────────────────────────────────────
  exportGLB(): Promise<Blob> {
    const target = this.mode === 'imported' ? this.imported?.wrapper : this.character?.root;
    if (!target) return Promise.reject(new Error('چیزی برای خروجی گرفتن نیست'));
    const exporter = new GLTFExporter();
    const animations = Object.values(this.mode === 'imported'
      ? Object.fromEntries((this.imported?.clips ?? []).map((c) => [c.id, c.clip]))
      : this.libraryClips);
    return new Promise((res, rej) => {
      exporter.parse(
        target,
        (result) => res(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
        (err) => rej(err),
        { binary: true, animations },
      );
    });
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    this.character?.dispose();
    this.imported?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
