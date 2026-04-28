import {
  AmbientLight,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene as ThreeScene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3
} from 'three';
import type { AABB } from './build/BuildPiece';
import {
  createArenaWallMaterial,
  createCrateMaterial,
  createGroundMaterial,
  createTrimMaterial
} from './Materials';

export type GameScene = {
  scene: ThreeScene;
  staticAABBs: AABB[];
  raycastObjects: Object3D[];
  targetPositions: Vector3[];
};

const ARENA_SIZE = 136;
const WALL_HEIGHT = 7;
const WALL_THICKNESS = 2;

export function createScene(): GameScene {
  const scene = new ThreeScene();
  scene.background = new Color(0x8fc9ff);
  scene.fog = new Fog(0xaad4ff, 82, 230);

  const staticAABBs: AABB[] = [];
  const raycastObjects: Object3D[] = [];

  addLights(scene);
  addSkyDome(scene);
  addGround(scene, raycastObjects);
  addArenaBoundary(scene, staticAABBs, raycastObjects);
  addArenaProps(scene, staticAABBs, raycastObjects);
  addArenaAccents(scene);
  addClouds(scene);

  return {
    scene,
    staticAABBs,
    raycastObjects,
    targetPositions: [
      new Vector3(-10, 0, -12),
      new Vector3(11, 0, -18),
      new Vector3(-22, 0, -34),
      new Vector3(24, 0, -42),
      new Vector3(0, 1.78, -11),
      new Vector3(-38, 0, 8),
      new Vector3(38, 0, 6)
    ]
  };
}

function addLights(scene: ThreeScene): void {
  const hemisphere = new HemisphereLight(0xd9f0ff, 0x42505e, 1.05);
  scene.add(hemisphere);

  const ambientLight = new AmbientLight(0xffffff, 0.34);
  scene.add(ambientLight);

  const sun = new DirectionalLight(0xfff0cf, 2.25);
  sun.position.set(38, 72, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 190;
  sun.shadow.camera.left = -86;
  sun.shadow.camera.right = 86;
  sun.shadow.camera.top = 86;
  sun.shadow.camera.bottom = -86;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
}

function addSkyDome(scene: ThreeScene): void {
  const sky = new Mesh(
    new SphereGeometry(440, 48, 24),
    new MeshBasicMaterial({
      map: createSkyTexture(),
      side: BackSide,
      fog: false
    })
  );
  scene.add(sky);

  const sunGlow = new Mesh(
    new SphereGeometry(8, 24, 12),
    new MeshBasicMaterial({ color: 0xffe7a8, fog: false })
  );
  sunGlow.position.set(120, 150, -95);
  scene.add(sunGlow);
}

function addGround(scene: ThreeScene, raycastObjects: Object3D[]): void {
  const ground = new Mesh(
    new PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 32, 32),
    createGroundMaterial()
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  raycastObjects.push(ground);

  const grid = new GridHelper(ARENA_SIZE, 34, 0xffffff, 0x2a3340);
  grid.position.y = 0.018;
  (grid.material as LineBasicMaterial).transparent = true;
  (grid.material as LineBasicMaterial).opacity = 0.18;
  scene.add(grid);
}

function addArenaBoundary(
  scene: ThreeScene,
  staticAABBs: AABB[],
  raycastObjects: Object3D[]
): void {
  const wallMaterial = createArenaWallMaterial();
  const darkTrim = createTrimMaterial(0x1d2933);
  const accentTrim = createTrimMaterial(0x2bbfa9);
  const half = ARENA_SIZE / 2;
  const wallY = WALL_HEIGHT / 2;

  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS],
    position: [0, wallY, -half],
    material: wallMaterial
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS],
    position: [0, wallY, half],
    material: wallMaterial
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE],
    position: [-half, wallY, 0],
    material: wallMaterial
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE],
    position: [half, wallY, 0],
    material: wallMaterial
  });

  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [ARENA_SIZE + 3, 0.7, 0.7],
    position: [0, WALL_HEIGHT + 0.2, -half],
    material: darkTrim
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [ARENA_SIZE + 3, 0.7, 0.7],
    position: [0, WALL_HEIGHT + 0.2, half],
    material: darkTrim
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [0.7, 0.7, ARENA_SIZE + 3],
    position: [-half, WALL_HEIGHT + 0.2, 0],
    material: darkTrim
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [0.7, 0.7, ARENA_SIZE + 3],
    position: [half, WALL_HEIGHT + 0.2, 0],
    material: darkTrim
  });

  for (const z of [-42, -14, 14, 42]) {
    addStaticBox(scene, staticAABBs, raycastObjects, {
      size: [0.35, 2.2, 12],
      position: [-half + 0.35, 3.1, z],
      material: accentTrim
    });
    addStaticBox(scene, staticAABBs, raycastObjects, {
      size: [0.35, 2.2, 12],
      position: [half - 0.35, 3.1, z],
      material: accentTrim
    });
  }
}

function addArenaProps(
  scene: ThreeScene,
  staticAABBs: AABB[],
  raycastObjects: Object3D[]
): void {
  const crateMaterial = createCrateMaterial();
  const trimMaterial = createTrimMaterial(0x27313d);
  const orangeTrim = createTrimMaterial(0xf2a849);

  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [14, 1.1, 14],
    position: [0, 0.55, -10],
    material: trimMaterial
  });
  addStaticBox(scene, staticAABBs, raycastObjects, {
    size: [10, 0.65, 10],
    position: [0, 1.45, -10],
    material: createTrimMaterial(0x3d4b58)
  });

  for (let index = 0; index < 4; index += 1) {
    const stepHeight = 0.32 + index * 0.28;
    addStaticBox(scene, staticAABBs, raycastObjects, {
      size: [8.6, stepHeight, 2.1],
      position: [0, stepHeight / 2, -1.5 - index * 2.1],
      material: trimMaterial
    });
  }

  const cratePositions: Array<[number, number, number, number, number, number]> = [
    [-18, 1.2, -6, 4.2, 2.4, 4.2],
    [18, 1.2, -3, 4.2, 2.4, 4.2],
    [-28, 1.6, -28, 5.4, 3.2, 5.4],
    [30, 1.6, -30, 5.4, 3.2, 5.4],
    [-42, 1, 17, 5.8, 2, 3.4],
    [42, 1, 16, 5.8, 2, 3.4],
    [-9, 1, -44, 3.2, 2, 6],
    [9, 1, -46, 3.2, 2, 6]
  ];

  for (const [x, y, z, width, height, depth] of cratePositions) {
    addStaticBox(scene, staticAABBs, raycastObjects, {
      size: [width, height, depth],
      position: [x, y, z],
      material: crateMaterial
    });
  }

  for (const x of [-52, 52]) {
    for (const z of [-52, 52]) {
      addStaticBox(scene, staticAABBs, raycastObjects, {
        size: [7, 5, 7],
        position: [x, 2.5, z],
        material: trimMaterial
      });
      addStaticBox(scene, staticAABBs, raycastObjects, {
        size: [5.8, 0.35, 5.8],
        position: [x, 5.35, z],
        material: orangeTrim
      });
    }
  }

  addJumpPad(scene, -21, -15);
  addJumpPad(scene, 22, -18);
  addJumpPad(scene, -31, 28);
  addJumpPad(scene, 31, 28);
}

function addArenaAccents(scene: ThreeScene): void {
  const half = ARENA_SIZE / 2;
  const cyan = new MeshBasicMaterial({
    color: 0x48f2d4,
    transparent: true,
    opacity: 0.38,
    side: DoubleSide
  });
  const amber = new MeshBasicMaterial({
    color: 0xffbf5c,
    transparent: true,
    opacity: 0.42,
    side: DoubleSide
  });
  const blue = new MeshBasicMaterial({
    color: 0x7fd7ff,
    transparent: true,
    opacity: 0.28,
    side: DoubleSide
  });

  const banners: Array<{
    size: [number, number];
    position: [number, number, number];
    rotationY: number;
    material: MeshBasicMaterial;
  }> = [
    { size: [18, 2.8], position: [-34, 3.5, -half + 1.06], rotationY: 0, material: cyan },
    { size: [18, 2.8], position: [34, 3.5, -half + 1.06], rotationY: 0, material: amber },
    { size: [18, 2.8], position: [-34, 3.5, half - 1.06], rotationY: Math.PI, material: amber },
    { size: [18, 2.8], position: [34, 3.5, half - 1.06], rotationY: Math.PI, material: cyan },
    { size: [18, 2.8], position: [-half + 1.06, 3.5, -34], rotationY: Math.PI / 2, material: blue },
    { size: [18, 2.8], position: [-half + 1.06, 3.5, 34], rotationY: Math.PI / 2, material: cyan },
    { size: [18, 2.8], position: [half - 1.06, 3.5, -34], rotationY: -Math.PI / 2, material: cyan },
    { size: [18, 2.8], position: [half - 1.06, 3.5, 34], rotationY: -Math.PI / 2, material: blue }
  ];

  for (const banner of banners) {
    const mesh = new Mesh(new PlaneGeometry(...banner.size), banner.material);
    mesh.position.set(...banner.position);
    mesh.rotation.y = banner.rotationY;
    scene.add(mesh);
  }

  const ringMaterial = new MeshBasicMaterial({
    color: 0x52ffdb,
    transparent: true,
    opacity: 0.3,
    side: DoubleSide
  });

  for (const z of [-18, 18]) {
    const strip = new Mesh(new PlaneGeometry(54, 0.18), ringMaterial);
    strip.position.set(0, 0.05, z);
    strip.rotation.x = -Math.PI / 2;
    scene.add(strip);
  }

  for (const x of [-18, 18]) {
    const strip = new Mesh(new PlaneGeometry(54, 0.18), ringMaterial);
    strip.position.set(x, 0.055, 0);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = Math.PI / 2;
    scene.add(strip);
  }
}

function addStaticBox(
  scene: ThreeScene,
  staticAABBs: AABB[],
  raycastObjects: Object3D[],
  options: {
    size: [number, number, number];
    position: [number, number, number];
    material: MeshStandardMaterial;
  }
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...options.size), options.material);
  mesh.position.set(...options.position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  raycastObjects.push(mesh);

  const box = new Box3().setFromObject(mesh);
  staticAABBs.push({
    min: box.min.clone(),
    max: box.max.clone()
  });

  return mesh;
}

function addJumpPad(scene: ThreeScene, x: number, z: number): void {
  const base = new Mesh(
    new CylinderGeometry(2.2, 2.2, 0.22, 32),
    createTrimMaterial(0x18232d)
  );
  base.position.set(x, 0.11, z);
  base.receiveShadow = true;
  scene.add(base);

  const glow = new Mesh(
    new CylinderGeometry(1.72, 1.72, 0.24, 32),
    new MeshBasicMaterial({ color: 0x37e6cb, transparent: true, opacity: 0.72 })
  );
  glow.position.set(x, 0.16, z);
  scene.add(glow);
}

function addClouds(scene: ThreeScene): void {
  const cloudMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    fog: false
  });
  const cloudGeometry = new SphereGeometry(1, 12, 8);

  const cloudData: Array<[number, number, number, number]> = [
    [-92, 72, -120, 11],
    [-38, 86, -156, 15],
    [45, 80, -132, 13],
    [112, 70, -70, 10],
    [-120, 64, 24, 12],
    [86, 76, 58, 15]
  ];

  for (const [x, y, z, scale] of cloudData) {
    const cloud = new Group();
    cloud.position.set(x, y, z);

    for (let index = 0; index < 5; index += 1) {
      const puff = new Mesh(cloudGeometry, cloudMaterial);
      puff.position.set((index - 2) * scale * 0.42, Math.sin(index) * 1.4, Math.cos(index) * scale * 0.16);
      puff.scale.setScalar(scale * (0.42 + index * 0.035));
      cloud.add(puff);
    }

    scene.add(cloud);
  }
}

function createSkyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create sky texture.');
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#2d75d4');
  gradient.addColorStop(0.34, '#77c7ff');
  gradient.addColorStop(0.74, '#cfefff');
  gradient.addColorStop(1, '#eef8ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
