import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace
} from 'three';

type TextureDraw = (context: CanvasRenderingContext2D, size: number) => void;

const textureCache = new Map<string, CanvasTexture>();

export function createGroundMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: getTexture('arena-floor', 512, drawArenaFloor, 18, 18),
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.03
  });
}

export function createArenaWallMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: getTexture('arena-wall', 512, drawArenaWall, 3, 1),
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.12
  });
}

export function createBuildMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: getTexture('build-wood', 512, drawBuildWood, 1.1, 1.1),
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.02
  });
}

export function createBuildTrimMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x4b2b18,
    roughness: 0.78,
    metalness: 0.02
  });
}

export function createCrateMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: getTexture('crate-panels', 384, drawCratePanels, 1, 1),
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.18
  });
}

export function createTrimMaterial(color = 0x2d3a46): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.48
  });
}

function getTexture(
  key: string,
  size: number,
  draw: TextureDraw,
  repeatX: number,
  repeatY: number
): CanvasTexture {
  const cached = textureCache.get(key);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(`Could not create texture canvas for ${key}.`);
  }

  draw(context, size);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

function drawArenaFloor(context: CanvasRenderingContext2D, size: number): void {
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3f4750');
  gradient.addColorStop(0.55, '#59626f');
  gradient.addColorStop(1, '#353d46');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  addNoise(context, size, 1500, 0.18);

  context.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  context.lineWidth = 3;
  for (let value = 0; value <= size; value += size / 4) {
    context.beginPath();
    context.moveTo(value, 0);
    context.lineTo(value, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, value);
    context.lineTo(size, value);
    context.stroke();
  }

  context.strokeStyle = 'rgba(65, 214, 196, 0.42)';
  context.lineWidth = 9;
  context.beginPath();
  context.moveTo(0, size * 0.5);
  context.lineTo(size, size * 0.5);
  context.stroke();

  context.strokeStyle = 'rgba(255, 174, 68, 0.52)';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(size * 0.5, 0);
  context.lineTo(size * 0.5, size);
  context.stroke();

  context.strokeStyle = 'rgba(15, 18, 22, 0.3)';
  context.lineWidth = 2;
  for (let index = 0; index < 18; index += 1) {
    const y = (index * 83) % size;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, (y + 28) % size);
    context.stroke();
  }
}

function drawArenaWall(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = '#9eb0bf';
  context.fillRect(0, 0, size, size);
  addNoise(context, size, 1000, 0.12);

  context.strokeStyle = 'rgba(22, 30, 38, 0.52)';
  context.lineWidth = 5;
  for (let x = 0; x <= size; x += size / 3) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, size);
    context.stroke();
  }

  for (let y = 0; y <= size; y += size / 4) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
  }

  context.fillStyle = 'rgba(18, 26, 32, 0.22)';
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 79) % size;
    const y = (index * 47) % size;
    context.fillRect(x, y, 9, 9);
  }

  context.strokeStyle = 'rgba(56, 222, 190, 0.45)';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(0, size * 0.18);
  context.lineTo(size, size * 0.18);
  context.stroke();
}

function drawBuildWood(context: CanvasRenderingContext2D, size: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#c98f49');
  gradient.addColorStop(0.5, '#a76c33');
  gradient.addColorStop(1, '#754620');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  addNoise(context, size, 1800, 0.16);

  context.strokeStyle = 'rgba(49, 24, 9, 0.48)';
  context.lineWidth = 6;
  for (let y = 0; y <= size; y += size / 4) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y + Math.sin(y) * 6);
    context.stroke();
  }

  context.strokeStyle = 'rgba(255, 228, 162, 0.23)';
  context.lineWidth = 2;
  for (let index = 0; index < 36; index += 1) {
    const y = (index * 31) % size;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(size * 0.3, y - 12, size * 0.6, y + 18, size, y - 4);
    context.stroke();
  }

  context.fillStyle = 'rgba(38, 20, 10, 0.58)';
  for (let index = 0; index < 44; index += 1) {
    const x = (index * 97) % size;
    const y = (index * 53) % size;
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
  }
}

function drawCratePanels(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = '#5d6a75';
  context.fillRect(0, 0, size, size);
  addNoise(context, size, 900, 0.15);

  context.strokeStyle = 'rgba(12, 16, 20, 0.55)';
  context.lineWidth = 8;
  context.strokeRect(20, 20, size - 40, size - 40);
  context.beginPath();
  context.moveTo(20, 20);
  context.lineTo(size - 20, size - 20);
  context.moveTo(size - 20, 20);
  context.lineTo(20, size - 20);
  context.stroke();

  context.strokeStyle = 'rgba(255, 184, 74, 0.46)';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(36, size * 0.5);
  context.lineTo(size - 36, size * 0.5);
  context.stroke();
}

function addNoise(
  context: CanvasRenderingContext2D,
  size: number,
  count: number,
  opacity: number
): void {
  for (let index = 0; index < count; index += 1) {
    const x = (index * 73 + index * index * 19) % size;
    const y = (index * 131 + index * index * 7) % size;
    const light = 70 + ((index * 37) % 95);
    const alpha = opacity * (0.25 + ((index * 17) % 70) / 100);
    context.fillStyle = `rgba(${light}, ${light}, ${light}, ${alpha})`;
    context.fillRect(x, y, 1 + (index % 3), 1 + ((index + 1) % 3));
  }
}
