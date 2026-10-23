// ─────────────────────────────────────────────────────────────
// موتور رندر V2 — صحنه، نور، زمین، اسمبل کاراکتر KayKit و
// رجیستری انیمیشن چندمنبعی (KayKit + UAL + رویه‌ای + مدل واردی)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildKaykitCharacter, loadBody, type CharacterBuild, type WeaponMode, type GripTweak } from '../character';
import { buildV3Character, V3_BODIES, type V3Build } from '../character/universal';
import type { CharConfig } from '../character/types';
import { buildClipLibrary, ANIM_DEFS } from '../animation/clips';
import { AntiClip } from '../animation/anticlip';
import { OffHandGrip } from '../character/offhand-grip';
import { assetUrl } from '../base-path';
import {
  importExternalModel, detectHumanoidBones, measureRest, measureSourceRest,
  retargetClipCustom, retargetClipFromRest,
  type ImportedClipDef, type ImportedModel, type BoneMapping, type TargetRest, type SourceRest, type LibraryClipDef,
} from '../animation/retarget';

export type AnimOrigin = 'kaykit' | 'ual' | 'proc' | 'model';
export type AnimCat = 'combat' | 'loco' | 'magic' | 'social' | 'other';

export interface EngineAnimInfo {
  id: string;
  label: string;
  cat: AnimCat;
  loop: boolean;
  origin: AnimOrigin;
}

// ── برچسب/دسته‌بندی انیمیشن‌های KayKit ───────────────────────
const KK: Record<string, [string, AnimCat, boolean]> = {
  Idle: ['ایستادن', 'loco', true],
  Unarmed_Idle: ['ایستادن بی‌سلاح', 'loco', true],
  Walking_A: ['راه رفتن آهسته', 'loco', true],
  Walking_B: ['راه رفتن سریع', 'loco', true],
  Walking_C: ['راه رفتن قدم‌بلند', 'loco', true],
  Walking_Backwards: ['راه رفتن به عقب', 'loco', true],
  Running_A: ['دویدن', 'loco', true],
  Running_B: ['دویدن تند', 'loco', true],
  Running_Strafe_Left: ['دویدن جانبی چپ', 'loco', true],
  Running_Strafe_Right: ['دویدن جانبی راست', 'loco', true],
  Jump_Start: ['شروع پرش', 'loco', false],
  Jump_Idle: ['معلق در هوا', 'loco', true],
  Jump_Land: ['فرود', 'loco', false],
  Jump_Full_Short: ['پرش کوتاه', 'loco', false],
  Jump_Full_Long: ['پرش بلند', 'loco', false],
  Block: ['دفاع', 'combat', true],
  Blocking: ['دفاع نگه‌داشته', 'combat', true],
  Block_Attack: ['ضربه از دفاع', 'combat', false],
  Block_Hit: ['دفاع زیر ضربه', 'combat', false],
  Cheer: ['شادی پیروزی', 'social', false],
  Death_A: ['مرگ — ریزش به عقب', 'combat', false],
  Death_B: ['مرگ — ریزش به جلو', 'combat', false],
  Dodge_Backward: ['جاخالی به عقب', 'combat', false],
  Dodge_Forward: ['جاخالی به جلو', 'combat', false],
  Dodge_Left: ['جاخالی به چپ', 'combat', false],
  Dodge_Right: ['جاخالی به راست', 'combat', false],
  Hit_A: ['ضربه خوردن الف', 'combat', false],
  Hit_B: ['ضربه خوردن ب', 'combat', false],
  Interact: ['تعامل', 'social', false],
  Lie_Down: ['دراز کشیدن', 'social', false],
  Lie_Idle: ['دراز کشیده', 'social', true],
  Lie_StandUp: ['بلند شدن', 'social', false],
  PickUp: ['برداشتن', 'social', false],
  Sit_Chair_Down: ['نشستن روی صندلی', 'social', false],
  Sit_Chair_Idle: ['نشسته روی صندلی', 'social', true],
  Sit_Chair_StandUp: ['بلند شدن از صندلی', 'social', false],
  Sit_Floor_Down: ['نشستن روی زمین', 'social', false],
  Sit_Floor_Idle: ['نشسته روی زمین', 'social', true],
  Sit_Floor_StandUp: ['بلند شدن از زمین', 'social', false],
  Spellcast_Long: ['افسون بلند', 'magic', false],
  Spellcast_Raise: ['افزودن انرژی', 'magic', false],
  Spellcast_Shoot: ['پرتاب افسون', 'magic', false],
  Spellcasting: ['افسون‌خوانی', 'magic', true],
  Throw: ['پرتاب', 'combat', false],
  Unarmed_Melee_Attack_Kick: ['لگد', 'combat', false],
  Unarmed_Melee_Attack_Punch_A: ['مشت چپ', 'combat', false],
  Unarmed_Melee_Attack_Punch_B: ['مشت راست', 'combat', false],
  Unarmed_Pose: ['پوز مشت‌زنی', 'combat', true],
  Use_Item: ['استفاده از وسیله', 'social', false],
  '1H_Melee_Attack_Chop': ['حمله یک‌دست — تبر', 'combat', false],
  '1H_Melee_Attack_Slice_Diagonal': ['حمله یک‌دست — مورب', 'combat', false],
  '1H_Melee_Attack_Slice_Horizontal': ['حمله یک‌دست — افقی', 'combat', false],
  '1H_Melee_Attack_Stab': ['حمله یک‌دست — ضربه‌زنی', 'combat', false],
  '1H_Melee_Attack_Jump_Chop': ['حمله پرشی', 'combat', false],
  '2H_Melee_Attack_Chop': ['حمله دو‌دست — تبر', 'combat', false],
  '2H_Melee_Attack_Slice': ['حمله دو‌دست — برش', 'combat', false],
  '2H_Melee_Attack_Spin': ['حمله دو‌دست — چرخش', 'combat', false],
  '2H_Melee_Attack_Spinning': ['حمله چرخشی پیوسته', 'combat', true],
  '2H_Melee_Attack_Stab': ['حمله دو‌دست — ضربه‌زنی', 'combat', false],
  '2H_Melee_Idle': ['ایستادن دو‌دست', 'combat', true],
  Dualwield_Melee_Attack_Chop: ['حمله دومسلح — تبر', 'combat', false],
  Dualwield_Melee_Attack_Slice: ['حمله دومسلح — برش', 'combat', false],
  Dualwield_Melee_Attack_Stab: ['حمله دومسلح — ضربه‌زنی', 'combat', false],
  '1H_Ranged_Aiming': ['نشانه‌گیری', 'combat', true],
  '1H_Ranged_Reload': ['خشاب‌گذاری', 'combat', false],
  '1H_Ranged_Shoot': ['شلیک', 'combat', false],
  '1H_Ranged_Shooting': ['شلیک نگه‌داشته', 'combat', true],
  '2H_Ranged_Aiming': ['نشانه‌گیری سنگین', 'combat', true],
  '2H_Ranged_Reload': ['خشاب‌گذاری سنگین', 'combat', false],
  '2H_Ranged_Shoot': ['شلیک سنگین', 'combat', false],
  '2H_Ranged_Shooting': ['شلیک سنگین پیوسته', 'combat', true],
};

// برچسب انیمیشن‌های UAL
const UAL: Record<string, [string, AnimCat, boolean]> = {
  A_TPose: ['پوز T', 'other', true],
  Crouch_Fwd_Loop: ['خمیده راه رفتن', 'loco', true],
  Crouch_Idle_Loop: ['خمیده ایستادن', 'loco', true],
  Dance_Loop: ['رقص', 'social', true],
  Death01: ['مرگ', 'combat', false],
  Driving_Loop: ['رانندگی', 'other', true],
  Fixing_Kneeling: ['تعمیر زانوزده', 'social', true],
  Hit_Chest: ['ضربه به سینه', 'combat', false],
  Hit_Head: ['ضربه به سر', 'combat', false],
  Idle_Loop: ['ایستادن', 'loco', true],
  Idle_Talking_Loop: ['گفت‌وگو', 'social', true],
  Idle_Torch_Loop: ['ایستادن با مشعل', 'loco', true],
  Interact: ['تعامل', 'social', false],
  Jog_Fwd_Loop: ['آهسته دویدن', 'loco', true],
  Jump_Land: ['فرود', 'loco', false],
  Jump_Loop: ['معلق در هوا', 'loco', true],
  Jump_Start: ['شروع پرش', 'loco', false],
  PickUp_Table: ['برداشتن از میز', 'social', false],
  Pistol_Aim_Down: ['نشانه‌گیری پایین', 'combat', true],
  Pistol_Aim_Neutral: ['نشانه‌گیری میانه', 'combat', true],
  Pistol_Aim_Up: ['نشانه‌گیری بالا', 'combat', true],
  Pistol_Idle_Loop: ['ایستادن مسلح', 'combat', true],
  Pistol_Reload: ['خشاب‌گذاری', 'combat', false],
  Pistol_Shoot: ['شلیک', 'combat', false],
  Punch_Cross: ['ضربه کراس', 'combat', false],
  Punch_Enter: ['ورود به گارد', 'combat', true],
  Punch_Jab: ['ضربه جب', 'combat', false],
  Push_Loop: ['هل دادن', 'other', true],
  Roll: ['غلت از ایستادن', 'loco', false],
  Roll_RM: ['غلت با حرکت', 'loco', false],
  Sitting_Enter: ['نشستن', 'social', false],
  Sitting_Exit: ['بلند شدن', 'social', false],
  Sitting_Idle_Loop: ['نشسته', 'social', true],
  Sitting_Talking_Loop: ['نشسته گفت‌وگو', 'social', true],
  Spell_Simple_Enter: ['ورود به حالت جادو', 'magic', true],
  Spell_Simple_Exit: ['خروج از حالت جادو', 'magic', false],
  Spell_Simple_Idle_Loop: ['افسون‌خوانی ایستاده', 'magic', true],
  Spell_Simple_Shoot: ['پرتاب افسون', 'magic', false],
  Sprint_Loop: ['دویدن سرعتی', 'loco', true],
  Swim_Fwd_Loop: ['شنای رو به جلو', 'loco', true],
  Swim_Idle_Loop: ['شناور ماندن', 'loco', true],
  Sword_Attack: ['حمله شمشیر', 'combat', false],
  Sword_Attack_RM: ['حمله شمشیر متحرک', 'combat', false],
  Sword_Idle: ['ایستادن شمشیر', 'combat', true],
  Walk_Formal_Loop: ['راه رفتن رسمی', 'loco', true],
  Walk_Loop: ['راه رفتن', 'loco', true],
};

// UAL Dance جایگزینِ رقص رویه‌ای جدید است — برچسب متمایز
UAL.Dance_Loop = ['رقص جهانی', 'social', true];

function prettify(name: string): string {
  return name.replace(/_/g, ' ').replace(/(\d+)$/, ' $1').trim();
}

// ── سیاست سلاح: کدام انیمیشن‌ها سلاح در دست می‌خواهند ────────
// انیمیشن‌های بومی KayKit با سلاح ریس شده‌اند ⇒ دست؛ ریتارگت‌شده‌ها
// و تعاملات اجتماعی ⇒ سلاح پشت کمر تا تیغه وارد بدن نشود.
const KK_HAND_OFF = /^(Unarmed_|Sit_|Lie_|PickUp|Use_Item|Interact|Cheer)/;
// اندازه‌گیری‌شده با tests/collision-kk.test.ts — تیغه تا ۱۳cm داخل تنه
const KK_2H_BROKEN = /^2H_Melee_Attack/;
/**
 * سیاست سلاح — بدنه‌های V3: سلاح در دست برای همه‌ی حالت‌های طبیعی
 * (ایست/راه‌رفتن/رزم/جادو) و پشت کمر برای حرکاتی که دست‌ها کاملاً
 * مشغول‌اند (نشستن/درازکشیدن/رقص/شنا/…) — ضدنفوذ موتور anticlip
 * در حالت دست فعال است.
 */
const V3_HAND_OFF = /Dance|Sit_|Lie_|PickUp|Interact|Use_Item|Swim|Drive|Roll|Push_|Fixing|Death|Cheer|Wave|^bow$|^death$|^hit$|^dance$|^wave$|^cheer$/i;
export function weaponModeFor(animId: string, v3 = false): WeaponMode {
  const [src, name] = animId.includes(':') ? [animId.slice(0, animId.indexOf(':')), animId.slice(animId.indexOf(':') + 1)] : ['model', animId];
  if (v3) return V3_HAND_OFF.test(name) || V3_HAND_OFF.test(animId) ? 'back' : 'hand';
  // 2H_Melee_Attack_* روی KayKit: اندازه‌گیری هارنس (۱۲۰Hz) — تیغه تا ۱۳cm
  // در تنه؛ اصلاح مفصلی جواب نمی‌دهد ⇒ سیاستاً پشت تا بازنویسی proc per-weapon
  if (src === 'kk') return (KK_HAND_OFF.test(name) || KK_2H_BROKEN.test(name)) ? 'back' : 'hand';
  if (src === 'ual') return /^Sword_/.test(name) ? 'hand' : 'back';
  if (src === 'proc') return /^(guard|attack|attack2h|block)$/.test(name) ? 'hand' : 'back';
  return 'back';
}

// توییک چنگ سلاح برای انیمیشن‌های شمشیر ریتارگت‌شده از UAL
// (چنگ مبدأ با handslot تی‌کی‌یت نمی‌خواند — تیغه را می‌چرخانیم تا
// رو به بالا/بیرون بایستد و داخل پاها فرو نرود)
const GRIP_TWEAKS: [RegExp, GripTweak][] = [
  // توییک چنگ فقط برای بدنه‌های KayKit — بدنه‌های V3 پروفایل داده‌محور خودشان را دارند
];
function gripTweakFor(animId: string, v3 = false): GripTweak | null {
  if (v3) return null;
  for (const [re, tw] of GRIP_TWEAKS) if (re.test(animId)) return tw;
  return null;
}

function classifyKaykit(name: string): [string, AnimCat, boolean] {
  if (KK[name]) return KK[name];
  const loopOff = /Attack|Death|^Hit|PickUp|Interact|Throw|Shoot$|Dodge|Jump_Start|Jump_Land|_Down$|StandUp|Enter$|Exit$|Cross$|Jab$|Cheer|Land$/;
  const cat: AnimCat = /Attack|Death|^Hit|Block|Dodge|Throw|Punch|Kick|Shoot|Ranged/i.test(name)
    ? 'combat'
    : /Spell|Cast/i.test(name) ? 'magic'
    : /Sit|Lie|Cheer|Dance|Talk|Interact|PickUp|Use_Item/i.test(name) ? 'social'
    : 'loco';
  return [prettify(name), cat, !loopOff.test(name)];
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

  private character?: CharacterBuild | V3Build;
  private lastStructural = '';
  private lastColors = '';
  private mixer?: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private currentAnim = 'kk:Idle';
  private anims: EngineAnimInfo[] = [];
  private clips: Record<string, THREE.AnimationClip> = {};
  private procClips: Record<string, THREE.AnimationClip>;
  /** ضدنفوذ سلاح — فقط بدنه‌های V3 با سلاح در دست */
  private anticlip?: AntiClip;
  /** IK دست دوم برای سلاح دو‌دست (مأموریت §۲) */
  /** چنگ دو‌دستی — دست دوم به grip2؛ برندهٔ بنچمارک tests/offhand-grip.test.ts
   *  (CCD با ترقوه: قفل ≤0.3cm در همهٔ کلیپ‌ها در برابر 11-19cm تحلیلی دومفصلی) */
  private offhand?: OffHandGrip;

  private imported?: ImportedModel;
  private lastConfig?: CharConfig;
  public mode: 'creator' | 'imported' = 'creator';
  onImportedChange?: (imported: boolean) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** A11 — اطلاع تغییر انیمیشن فعال از موتور به UI (بازگشت از one-shot و…) */
  onAnimChange?: (id: string) => void;
  private lastLoopAnim = 'kk:Idle';

  // سرعت پخش — پس از بازسازی کاراکتر/import حفظ می‌شود (A11)
  private speed = 1;
  // A09 — نسل‌ها و پرچم‌های عمر موتور برای جلوگیری از مسابقه‌ی async
  private disposed = false;
  private importSeq = 0;
  private libraryGen = 0;

  // رجیستری مادر — بین بدنه‌ها مشترک
  private masterClips: Record<string, { clip: THREE.AnimationClip; info: EngineAnimInfo }> = {};
  private kaykitRetargeted = false;
  private ualReady = false;
  private ualLoading = false;
  private kaykitMapping?: BoneMapping;
  private kaykitRest?: TargetRest;
  /** A02 — منبع rest مرجع KayKit برای ریتارگت کلیپ‌های kk به مدل واردی */
  private kaykitSrcRest: SourceRest | null = null;
  /** A02 — کلیپ‌های خام UAL + rest مبدأ برای ریتارگت به مدل واردی */
  private ualRaw: { clips: THREE.AnimationClip[]; srcRest: SourceRest } | null = null;
  onLibraryChange?: () => void;

  // منابع محیط برای پاک‌سازی کامل (A20)
  private groundObjects: THREE.Object3D[] = [];
  private envTexture?: THREE.Texture;

  // پریست دوربین
  private camTween?: { t: number; dur: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.procClips = buildClipLibrary();
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
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#100d09');
    this.scene.fog = new THREE.Fog('#100d09', 8, 18);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      38, this.container.clientWidth / Math.max(1, this.container.clientHeight), 0.1, 60,
    );
    this.camera.position.set(1.9, 1.55, 3.7);
  }

  private initLights() {
    const hemi = new THREE.HemisphereLight('#9a8a6c', '#241c10', 0.65);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffe8c2', 2.4);
    key.position.set(2.4, 4.4, 1.9);
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

    const rim = new THREE.DirectionalLight('#9fc4e8', 1.1);
    rim.position.set(-2.8, 3.4, -2.6);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight('#c9b18f', 0.4);
    fill.position.set(-1.6, 1.4, 2.8);
    this.scene.add(fill);
  }

  private initGround() {
    // سنگ تیره با بافت نویز ملایم تولیدشده روی canvas
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
    grad.addColorStop(0, '#241c12');
    grad.addColorStop(1, '#15100a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const a = Math.random() * 0.05;
      g.fillStyle = Math.random() > 0.5 ? `rgba(255,235,200,${a})` : `rgba(0,0,0,${a * 1.6})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.68, 0.05, 64),
      new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.94, metalness: 0.06 }),
    );
    disc.position.y = -0.025;
    disc.receiveShadow = true;
    this.scene.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.012, 10, 96),
      new THREE.MeshStandardMaterial({
        color: '#2a2113', emissive: '#c8a24a', emissiveIntensity: 1.5, roughness: 0.4,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    this.scene.add(ring);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(10, 48),
      new THREE.MeshStandardMaterial({ color: '#120e09', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A20 — ردیابی برای آزادسازی کامل در dispose
    this.groundObjects = [disc, ring, ground];
  }

  private initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.9;
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
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.camTween) {
      const tw = this.camTween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
      this.camera.position.lerpVectors(tw.fromP, tw.toP, e);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, e);
      if (tw.t >= 1) this.camTween = undefined;
    }
    // A06 — فقط میکسر فعال یک بار آپدیت می‌شود؛ در حالت واردشده
    // this.mixer همان mixer مدل واردی است و قبلاً دوبار جلو می‌رفت
    this.mixer?.update(dt);
    this.character?.update(dt);
    // ضدنفوذ — بعد از انیمیشن/چنگ، قبل از رندر
    if (this.anticlip && this.character && 'weapon' in this.character && this.character.weapon
      && this.character.getWeaponMode() === 'hand' && this.kaykitMapping) {
      const w = this.character.weapon;
      const handBone = w.def.hand === 'l' ? this.character.handBones.l : this.character.handBones.r;
      if (handBone) {
        handBone.updateWorldMatrix(true, false);
        // تیغه در فضای محلی دست: ماتریس گروه × نقطه‌ی خام
        // ⚠️ نقطه‌ی خام دیگر در scale ضرب نمی‌شود — gm خودش scale دارد؛
        // ضرب دوم تیغه را به ۲۷٪ واقعی کوچک می‌کرد و AntiClip فقط
        // ابتدای تیغه را می‌دید (کشف با هارنس هندسی tests/collision-v3.test.ts)
        const gm = new THREE.Matrix4().compose(
          w.group.position, w.group.quaternion, new THREE.Vector3().setScalar(w.def.scale),
        );
        const from = new THREE.Vector3(...w.def.bladeFrom).applyMatrix4(gm);
        const to = new THREE.Vector3(...w.def.bladeTo).applyMatrix4(gm);
        this.anticlip.update(handBone, w.group, from, to);
      }
    }
    // چنگ دو‌دستی — دست دوم به grip2، بعد از AntiClip (اصلاح جلسهٔ ۲):
    // AntiClip مچ راست را می‌چرخاند و grip2 را جابه‌جا می‌کند؛ دست چپ باید
    // از وضعیت نهایی سلاح دنبال کند — وابستگی یک‌طرفه: کلیپ → سلاح →
    // دست دوم، بدون حلقهٔ بازخورد ⇒ حل‌کننده‌ها نجنگند (مأموریت §۲)
    if (this.offhand && this.character && 'weapon' in this.character && this.character.weapon
      && this.character.getWeaponMode() === 'hand') {
      this.offhand.update(dt);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ── پریست دوربین ──────────────────────────────────────────
  setCameraPreset(preset: 'portrait' | 'bust' | 'full') {
    const h = this.lastConfig?.height ? 1.78 * this.lastConfig.height : 1.75;
    const specs = {
      portrait: { p: new THREE.Vector3(0.3, h * 0.92, 1.3), t: new THREE.Vector3(0, h * 0.9, 0) },
      bust: { p: new THREE.Vector3(0.7, h * 0.7, 2.0), t: new THREE.Vector3(0, h * 0.7, 0) },
      full: { p: new THREE.Vector3(1.9, h * 0.6, 3.7), t: new THREE.Vector3(0, h * 0.5, 0) },
    } as const;
    const sp = specs[preset];
    this.camTween = {
      t: 0, dur: 0.7,
      fromP: this.camera.position.clone(), toP: sp.p.clone(),
      fromT: this.controls.target.clone(), toT: sp.t.clone(),
    };
  }

  // ── رجیستری مادر انیمیشن‌ها ───────────────────────────────
  private registerClip(id: string, label: string, cat: AnimCat, loop: boolean, origin: AnimOrigin, clip: THREE.AnimationClip) {
    if (this.masterClips[id]) return;
    this.masterClips[id] = { clip, info: { id, label, cat, loop, origin } };
  }

  /**
   * A19 — ابطال کش ریتارگت هنگام تغییر ساختار بدنه؛ کلیپ‌های proc/ual
   * با rest بدنه‌ی قبلی ساخته شده‌اند و باید از نو ساخته شوند.
   */
  private invalidateLibrary() {
    this.libraryGen++;
    for (const id of Object.keys(this.masterClips)) {
      if (id.startsWith('proc:') || id.startsWith('ual:')) delete this.masterClips[id];
    }
    this.kaykitRetargeted = false;
    this.ualReady = false;
  }

  private registerKaykitClips(anims: THREE.AnimationClip[]) {
    for (const a of anims) {
      const [label, cat, loop] = classifyKaykit(a.name);
      this.registerClip(`kk:${a.name}`, label, cat, loop, 'kaykit', a);
    }
  }

  /** پس از اولین لود بدنه: ریتارگت کلیپ‌های رویه‌ای + UAL به ریگ KayKit */
  private async buildRetargetedLibrary() {
    if (this.kaykitRetargeted || !this.character) return;
    const gen = this.libraryGen;
    const root = this.character.root;
    // A09 — بعد از هر await بررسی می‌شود؛ کار منقضی نتیجه‌ی بدنه‌ی جدید را خراب نمی‌کند
    const alive = () => !this.disposed && gen === this.libraryGen
      && this.mode === 'creator' && this.character?.root === root;
    const mapping = detectHumanoidBones(root);
    const rest = measureRest(root, mapping);
    this.kaykitMapping = mapping;
    this.kaykitRest = rest;

    // A02 — منبع rest مرجع KayKit (بدنه‌ی دست‌نخورده، بدون reshape) — یک‌بار
    if (!this.kaykitSrcRest && this.lastConfig?.body) {
      try {
        const loaded = await loadBody(this.lastConfig.body as Parameters<typeof loadBody>[0]);
        if (!alive()) return;
        this.kaykitSrcRest = measureSourceRest(loaded.pristine, mapping.target.hips?.name ?? 'hips');
      } catch { /* بدون منبع rest، کلیپ‌های kk به مدل واردی منتقل نمی‌شوند */ }
    }

    // ۱) کلیپ‌های رویه‌ای canonical → KayKit
    for (const def of ANIM_DEFS) {
      try {
        const rc = retargetClipCustom(this.procClips[def.id], mapping, rest);
        if (!alive()) return;
        this.registerClip(`proc:${def.id}`, def.label, def.id === 'cast' ? 'magic' : def.id === 'dance' ? 'social' : def.id === 'attack' || def.id === 'attack2h' || def.id === 'hit' || def.id === 'death' ? 'combat' : 'loco', def.loop, 'proc', rc);
      } catch { /* بی‌خیال کلیپ خراب */ }
    }
    this.kaykitRetargeted = true;
    this.rebuildActions();
    this.onLibraryChange?.();

    // ۲) UAL به‌صورت async chunked
    if (!this.ualReady) {
      this.ualLoading = true;
      try {
        const ual = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) =>
          new GLTFLoader().load(assetUrl('/models/UAL.glb'), (g) => res(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), undefined, rej));
        if (!alive()) return;
        const srcRest = measureSourceRest(ual.scene, 'pelvis');
        // A02 — نگهداری خام برای ریتارگت بعدی به مدل‌های واردی؛ صحنه دیگر لازم نیست
        this.ualRaw = { clips: ual.animations, srcRest };
        ual.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        });
        let i = 0;
        for (const clip of ual.animations) {
          const [label, cat, loop] = UAL[clip.name] ?? [prettify(clip.name), 'other' as AnimCat, true];
          try {
            const rc = retargetClipFromRest(clip, srcRest, mapping, rest);
            if (!alive()) return; // A09 — ثبت با rest قدیمی ممنوع
            this.registerClip(`ual:${clip.name}`, label, cat, loop, 'ual', rc);
          } catch (e) {
            console.error('UAL retarget fail', clip.name, e);
          }
          if (++i % 8 === 0) {
            this.rebuildActions();
            this.onLibraryChange?.();
            await new Promise((r) => setTimeout(r, 0));
            if (!alive()) return;
          }
        }
        if (gen === this.libraryGen) this.ualReady = true;
      } catch (e) {
        console.error('UAL load failed', e);
      } finally {
        if (gen === this.libraryGen) this.ualLoading = false;
      }
      if (alive()) {
        this.rebuildActions();
        this.onLibraryChange?.();
      }
    }
  }

  getLibraryProgress(): { total: number; origins: Record<string, number> } {
    const origins: Record<string, number> = {};
    for (const c of Object.values(this.masterClips)) origins[c.info.origin] = (origins[c.info.origin] ?? 0) + 1;
    return { total: Object.keys(this.masterClips).length, origins };
  }

  // ── شخصیت‌ساز ─────────────────────────────────────────────
  private buildSeq = 0;

  async setCharacter(cfg: CharConfig) {
    const seq = ++this.buildSeq;
    this.lastConfig = cfg;
    const ph = cfg.physique;
    const structural = `${cfg.race}|${cfg.body}|${cfg.hair}|${cfg.beard}|${cfg.ears}|${cfg.tusks}|${cfg.weapon}|${cfg.helmet}|${cfg.cape}|${cfg.height.toFixed(3)}|${cfg.bulk.toFixed(3)}`
      + `|${ph ? [ph.leg, ph.arm, ph.torso, ph.shoulder, ph.head, ph.muscle].map((v) => v.toFixed(3)).join(',') : '-'}`;
    const colors = `${cfg.skin}|${cfg.hairColor}|${cfg.beardColor}|${cfg.cloth}|${cfg.metal}|${cfg.bone}|${cfg.eye ?? '-'}`;

    if (structural === this.lastStructural && this.character) {
      if (colors !== this.lastColors) {
        this.lastColors = colors;
        this.character.applyColors(cfg);
      }
      return;
    }

    // A19 — تغییر ساختار بدنه ⇒ کش ریتارگت با rest قبلی باطل می‌شود
    this.invalidateLibrary();
    this.onLoadingChange?.(true);
    // ساخت ممکن است چند فریم طول بکشد — فرصت رندر به مرورگر بده
    await new Promise((r) => setTimeout(r, 20));
    if (this.disposed || seq !== this.buildSeq) return;
    try {
      if (this.mode !== 'creator') this.exitImported();
      if (this.disposed || seq !== this.buildSeq) return;
      const build: CharacterBuild | V3Build = cfg.body in V3_BODIES
        ? await buildV3Character(cfg)
        : await buildKaykitCharacter(cfg);
      if (this.disposed || seq !== this.buildSeq) { build.dispose(); return; }
      const prev = this.character;
      if (prev) {
        this.scene.remove(prev.root);
        prev.dispose();
      }
      this.character = build;
      this.scene.add(build.root);
      // دسترسی دیباگ در کنسول (تنظیم زنده‌ی اجزا)
      if (typeof window !== 'undefined') {
        (window as unknown as { __forge?: unknown }).__forge = { engine: this, build };
      }

      this.mixer?.stopAllAction();
      this.mixer = new THREE.AnimationMixer(build.root);
      // A11 — سرعت قبلی پس از بازسازی حفظ می‌شود
      this.mixer.timeScale = this.speed;
      this.mixer.addEventListener('finished', (e) => {
        const name = (e as { action?: THREE.AnimationAction }).action?.getClip().name ?? '';
        // مرگ روی زمین می‌ماند؛ بقیه‌ی کلیپ‌های یک‌بارمصرف به حلقه‌ی قبلی برمی‌گردند
        if (!name.includes('مرگ') && !/Death/i.test(name)) this.play(this.lastLoopAnim, true);
      });

      // ثبت کلیپ‌های این بدنه + ریتارگت کتابخانه‌ها
      this.registerKaykitClips(build.animations);
      await this.buildRetargetedLibrary();
      // ضدنفوذ — فقط V3 با سلاح (پروفایل داده‌محور از weapons3)
      this.anticlip?.dispose();
      this.anticlip = undefined;
      this.offhand = undefined;
      if (cfg.body in V3_BODIES && this.kaykitMapping && 'weapon' in build && build.weapon) {
        this.anticlip = new AntiClip({
          bones: this.kaykitMapping.target,
          bulk: cfg.bulk,
        });
        // چنگ دو‌دستی — CCD با ترقوه (برندهٔ بنچمارک head-to-head):
        // قفل ≤0.3cm روی همهٔ کلیپ‌ها؛ تحلیلی دومفصلی در idle/walk 11-19cm خطا داشت
        const ab = 'armBones' in build ? build.armBones?.l : undefined;
        const g2t = 'grip2Target' in build ? build.grip2Target : null;
        if (build.weapon.def.twoHanded && g2t && ab?.upper && ab?.lower && ab?.hand) {
          const chain = [ab.lower, ab.upper];
          if (ab.clavicle) chain.push(ab.clavicle);
          this.offhand = new OffHandGrip({ chain, effector: ab.hand, target: g2t });
        }
      }
      // A09 — بعد از await طولانی کتابخانه، درخواست جدیدتری در راه است؟
      if (this.disposed || seq !== this.buildSeq) return;

      this.rebuildActions();
      this.lastStructural = structural;
      this.lastColors = colors;

      // پخش انیمیشن فعلی (اگر وجود دارد) وگرنه Idle
      if (!this.actions[this.currentAnim]) {
        const idle = Object.keys(this.masterClips).find((k) => k === 'kk:Idle')
          ?? Object.keys(this.masterClips).find((k) => /Idle/i.test(k))
          ?? Object.keys(this.masterClips)[0];
        this.currentAnim = idle ?? '';
      }
      if (this.currentAnim) this.play(this.currentAnim, true);
    } finally {
      // A09 — لودینگ فقط توسط آخرین درخواست خاموش می‌شود
      if (seq === this.buildSeq && !this.disposed) this.onLoadingChange?.(false);
    }
  }

  private rebuildActions() {
    this.actions = {};
    this.anims = Object.values(this.masterClips).map((m) => m.info);
    for (const [id, m] of Object.entries(this.masterClips)) {
      if (this.mixer) this.actions[id] = this.mixer.clipAction(m.clip);
    }
  }

  defineAnims(defs: EngineAnimInfo[]) {
    this.anims = defs;
  }

  play(id: string, instant = false) {
    if (this.disposed) return;
    // انتخاب حرکت بر اساس نوع سلاح (مأموریت §۳): درخواست حملهٔ عمومی
    // با سلاح دو‌دست → کلیپ حملهٔ دو‌دست (دست دوم در بُرد می‌ماند)
    const isV3Body = !!this.lastConfig && this.lastConfig.body in V3_BODIES;
    if (id === 'proc:attack' && isV3Body
      && this.character && 'weapon' in this.character && this.character.weapon?.def.twoHanded) {
      id = 'proc:attack2h';
    }
    const next = this.actions[id];
    if (!next || !this.mixer) return;
    // A16 — اطلاعات کلیپ‌های مدل واردی از anims می‌آید (masterClips ندارند)
    const info = this.masterClips[id]?.info ?? this.anims.find((a) => a.id === id);
    next.setLoop(info?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = info?.loop === false;
    const prev = this.actions[this.currentAnim];
    if (info?.loop !== false) this.lastLoopAnim = id;
    if (prev && prev !== next && !instant) {
      next.reset().fadeIn(0.28).play();
      prev.fadeOut(0.28);
    } else {
      next.reset().play();
      if (prev && prev !== next) prev.stop();
    }
    this.currentAnim = id;
    // ── وضعیت سلاح برای این انیمیشن (فقط وقتی سلاح فعال داریم) ──
    if (this.character && this.lastConfig && this.lastConfig.weapon !== 'none') {
      const isV3 = this.lastConfig.body in V3_BODIES;
      this.character.setWeaponMode(weaponModeFor(id, isV3));
      // چنگ داده‌محور V3 توییک per-کلیپ ندارد (پروفایل در weapons3) —
      // فقط توییک‌های KayKit قدیمی فعال‌اند
      this.character.setGripTweak(isV3 ? null : gripTweakFor(id, isV3));
    }
    // A11 — UI از تغییر انیمیشن (شامل بازگشت از one-shot) باخبر می‌شود
    this.onAnimChange?.(id);
  }

  get currentAnimId() { return this.currentAnim; }

  setSpeed(s: number) {
    this.speed = s;
    if (this.mixer) this.mixer.timeScale = s;
    if (this.imported && this.imported.mixer !== this.mixer) this.imported.mixer.timeScale = s;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  getAnimList(): EngineAnimInfo[] {
    return this.anims;
  }

  // ── Import مدل خارجی ─────────────────────────────────────
  async importGLB(
    buffer: ArrayBuffer,
    resourceFiles?: Map<string, string>,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportedModel['report']> {
    const seq = ++this.importSeq;
    // A02 — هر کلیپ با قرارداد مبدأ خودش به مدل واردی ریتارگت می‌شود:
    //  • kk  → خام + SourceRest مرجع KayKit (مسیر عمومی retargetClipFromRest)
    //  • proc→ خام canonical (retargetClipCustom)
    //  • ual → خام + SourceRest مبدأ UAL
    const lib: LibraryClipDef[] = [];
    for (const [id, m] of Object.entries(this.masterClips)) {
      if (id.startsWith('kk:')) {
        if (!this.kaykitSrcRest) continue;
        lib.push({ id, label: m.info.label, loop: m.info.loop, cat: m.info.cat, origin: 'kaykit', clip: m.clip, kind: 'rest', srcRest: this.kaykitSrcRest });
      } else if (id.startsWith('proc:')) {
        const raw = this.procClips[id.slice(5)];
        if (raw) lib.push({ id, label: m.info.label, loop: m.info.loop, cat: m.info.cat, origin: 'proc', clip: raw, kind: 'canonical' });
      } else if (id.startsWith('ual:')) {
        const rawName = id.slice(4);
        const raw = this.ualRaw?.clips.find((c) => c.name === rawName);
        if (raw && this.ualRaw) lib.push({ id, label: m.info.label, loop: m.info.loop, cat: m.info.cat, origin: 'ual', clip: raw, kind: 'rest', srcRest: this.ualRaw.srcRest });
      }
    }
    const imp = await importExternalModel(buffer, {
      library: lib,
      onProgress,
      resourceFiles,
      // A09/A27 — لغو در صورت dispose یا import تازه‌تر
      shouldAbort: () => this.disposed || seq !== this.importSeq,
    });
    if (this.disposed || seq !== this.importSeq) {
      imp.dispose();
      throw new Error('IMPORT_STALE');
    }
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
    // A11 — سرعت فعال روی mixer جدید اعمال می‌شود
    this.mixer.timeScale = this.speed;
    this.mixer.addEventListener('finished', (e) => {
      const name = (e as { action?: THREE.AnimationAction }).action?.getClip().name ?? '';
      if (!name.includes('مرگ') && !/Death/i.test(name)) this.play(this.lastLoopAnim, true);
    });

    this.actions = {};
    // A16 — دسته/منشأ/حلقه از نتیجه‌ی واقعی import می‌آید
    this.anims = imp.clips.map((c: ImportedClipDef) => ({
      id: c.id, label: c.label,
      cat: (c.cat as AnimCat) ?? 'other',
      loop: c.loop,
      origin: (c.origin === 'model' ? 'model' : (c.source as AnimOrigin) ?? 'proc') as AnimOrigin,
    }));
    for (const c of imp.clips) {
      this.actions[c.id] = imp.mixer.clipAction(c.clip);
    }
    this.mode = 'imported';
    this.scene.add(imp.wrapper);
    const idle = imp.clips.find((c) => c.id === 'proc:idle') ?? imp.clips.find((c) => c.loop) ?? imp.clips[0];
    if (idle) this.play(idle.id, true);
    this.onImportedChange?.(true);
    return imp.report;
  }

  exitImported() {
    if (!this.imported) return;
    this.importSeq++; // A09 — import های در راه را منقضی کن
    this.mixer?.stopAllAction();
    this.scene.remove(this.imported.wrapper);
    this.imported.dispose();
    this.imported = undefined;
    this.actions = {};
    this.anims = [];
    this.mode = 'creator';
    if (this.lastConfig) void this.setCharacter(this.lastConfig);
    this.onImportedChange?.(false);
  }

  get isImported() { return this.mode === 'imported'; }

  // ── Export ────────────────────────────────────────────────
  /** فیلتر کلیپ‌های معتبر برای صحنه‌ی خروجی (A18) */
  private filterClipsForTarget(clips: THREE.AnimationClip[], target: THREE.Object3D): THREE.AnimationClip[] {
    const nodeNames = new Set<string>();
    target.traverse((o) => nodeNames.add(o.name));
    return clips.filter((c) =>
      c.tracks.length > 0 && c.tracks.every((t) => nodeNames.has(t.name.split('.')[0])));
  }

  exportGLB(): Promise<Blob> {
    const target = this.mode === 'imported' ? this.imported?.wrapper : this.character?.root;
    if (!target) return Promise.reject(new Error('چیزی برای خروجی گرفتن نیست'));
    const exporter = new GLTFExporter();
    const allClips = this.mode === 'imported'
      ? (this.imported?.clips ?? []).map((c) => c.clip)
      : Object.values(this.masterClips).map((m) => m.clip);
    // A18 — فقط کلیپ‌هایی که همه‌ی نودهایشان در همین صحنه موجودند صادر
    // می‌شوند تا خروجی در Blender/viewer دیگر با پیش‌نمایش یکی باشد
    const animations = this.filterClipsForTarget(allClips, target);
    return new Promise((res, rej) => {
      exporter.parse(
        target,
        (result) => res(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
        (err) => rej(err),
        // A18 — خروجی قطعی: مستقل از وضعیت visibility جاری
        { binary: true, animations, onlyVisible: false, truncateDrawRange: false },
      );
    });
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    // A09 — همه‌ی کارهای async در راه باطل می‌شوند
    this.disposed = true;
    this.anticlip?.dispose();
    this.anticlip = undefined;
    this.offhand = undefined;
    this.buildSeq++;
    this.importSeq++;
    this.libraryGen++;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    this.mixer?.stopAllAction();
    this.character?.dispose();
    this.character = undefined;
    this.imported?.dispose();
    this.imported = undefined;
    // A20 — پاک‌سازی کامل منابع محیط/زمین/تکسچرها و مرجع دیباگ
    for (const obj of this.groundObjects) {
      this.scene.remove(obj);
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat) {
          mat.map?.dispose();
          mat.dispose();
        }
      });
    }
    this.groundObjects = [];
    this.envTexture?.dispose();
    this.envTexture = undefined;
    this.scene.environment = null;
    if (typeof window !== 'undefined') {
      delete (window as unknown as { __forge?: unknown }).__forge;
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }
}
