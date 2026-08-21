"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type FilterKey =
  | "exposure"
  | "brilliance"
  | "brightness"
  | "contrast"
  | "blackPoint"
  | "saturation"
  | "vibrance"
  | "highlights"
  | "shadows"
  | "temperature"
  | "tint"
  | "sharpness"
  | "definition"
  | "noiseReduction"
  | "fade"
  | "grain"
  | "vignette";

type FilterValues = Record<FilterKey, number>;

type Preset = {
  id: string;
  name: string;
  scene: string;
  tone: string;
  swatch: string;
  values: FilterValues;
};

type PhotoProfile = {
  brightness: number;
  saturation: number;
  warmth: number;
  highlightClip: number;
  shadowClip: number;
  labels: string[];
};

type RecipeAdaptation = {
  values: FilterValues;
  message: string;
};

type PhotoItem = {
  id: string;
  image: HTMLImageElement;
  name: string;
  objectUrl: string;
  thumbnail: string;
  profile: PhotoProfile | null;
  values: FilterValues;
  selectedPreset: string;
  recipeBaseline: FilterValues | null;
};

const DEFAULT_VALUES: FilterValues = {
  exposure: 0,
  brilliance: 0,
  brightness: 0,
  contrast: 0,
  blackPoint: 0,
  saturation: 0,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  definition: 0,
  noiseReduction: 0,
  fade: 0,
  grain: 0,
  vignette: 0,
};

const completeValues = (values: Partial<FilterValues>): FilterValues => ({ ...DEFAULT_VALUES, ...values });

const PRESETS: Preset[] = [
  {
    id: "dark-cool",
    name: "暗黑清冷",
    scene: "夜景 · 情绪",
    tone: "低饱和冷调",
    swatch: "linear-gradient(135deg, #111a25 0%, #40505b 52%, #99a7aa 100%)",
    values: completeValues({ brilliance: 47, shadows: -79, brightness: 33, blackPoint: 27, saturation: -24, temperature: -11, sharpness: 43, definition: 51 }),
  },
  {
    id: "bright-clear",
    name: "明亮清透",
    scene: "日常 · 人像",
    tone: "明亮通透",
    swatch: "linear-gradient(135deg, #b9dce3 0%, #f3ead7 52%, #fffdf4 100%)",
    values: completeValues({ exposure: 10, brilliance: 56, highlights: -35, contrast: 32, shadows: 20, saturation: 8, temperature: 10, sharpness: 80 }),
  },
  {
    id: "appetite",
    name: "食欲感调色",
    scene: "美食 · 日常",
    tone: "暖润鲜活",
    swatch: "linear-gradient(135deg, #8f442d 0%, #dc8b51 52%, #f5d99c 100%)",
    values: completeValues({ exposure: 10, brilliance: 65, highlights: -20, shadows: -30, contrast: 10, brightness: 20, blackPoint: 20, vibrance: -8, temperature: 20, tint: 5, sharpness: 60, definition: 5 }),
  },
];

const CONTROLS: { key: FilterKey; label: string; hint: string }[] = [
  { key: "exposure", label: "曝光", hint: "整体明暗" },
  { key: "brilliance", label: "鲜明度", hint: "细节与层次" },
  { key: "highlights", label: "高光", hint: "亮部细节" },
  { key: "shadows", label: "阴影", hint: "暗部细节" },
  { key: "contrast", label: "对比度", hint: "明暗层次" },
  { key: "brightness", label: "亮度", hint: "提亮画面" },
  { key: "blackPoint", label: "黑点", hint: "最深黑位" },
  { key: "saturation", label: "饱和度", hint: "整体色彩" },
  { key: "vibrance", label: "自然饱和度", hint: "优先增强淡色" },
  { key: "temperature", label: "色温", hint: "冷暖倾向" },
  { key: "tint", label: "色调", hint: "绿色与品红" },
  { key: "sharpness", label: "锐度", hint: "强化边缘" },
  { key: "definition", label: "清晰度", hint: "局部对比" },
  { key: "noiseReduction", label: "降噪", hint: "平滑噪点" },
  { key: "vignette", label: "晕影", hint: "边缘明暗" },
  { key: "fade", label: "褪色", hint: "灰调空气感" },
  { key: "grain", label: "颗粒", hint: "胶片质感" },
];

const CONTROL_GROUPS = [
  { name: "iPhone 相册基础调节", count: "15 项", controls: CONTROLS.slice(0, 15) },
  { name: "质感扩展", count: "2 项", controls: CONTROLS.slice(15) },
];

const ALIASES: Record<FilterKey, string[]> = {
  exposure: ["曝光度", "曝光", "exposure"],
  brilliance: ["鲜明度", "鲜明", "brilliance"],
  brightness: ["光感", "亮度", "明亮度", "brightness"],
  contrast: ["对比度", "对比", "contrast"],
  blackPoint: ["黑点", "black point", "blackpoint"],
  saturation: ["饱和度", "饱和", "saturation"],
  vibrance: ["自然饱和度", "自然饱和", "vibrance"],
  highlights: ["高光", "亮部", "highlights", "highlight"],
  shadows: ["阴影", "暗部", "shadows", "shadow"],
  temperature: ["色温", "暖色调", "冷暖", "temperature", "warmth"],
  tint: ["色调", "色偏", "tint"],
  sharpness: ["锐化", "锐度", "sharpness", "sharpen"],
  definition: ["清晰度", "结构", "definition", "clarity"],
  noiseReduction: ["降噪", "噪点消除", "noise reduction", "denoise"],
  fade: ["褪色", "退色", "fade"],
  grain: ["颗粒感", "颗粒", "grain"],
  vignette: ["暗角", "晕影", "vignette"],
};

const UNSUPPORTED = ["纹理", "HSL", "曲线", "色阶", "色轮"];
const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));

function boxBlurPixels(source: Uint8ClampedArray, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(source.length);
  const output = new Uint8ClampedArray(source.length);
  const diameter = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const pixel = (row + Math.max(0, Math.min(width - 1, offset))) * 4;
      red += source[pixel];
      green += source[pixel + 1];
      blue += source[pixel + 2];
    }
    for (let x = 0; x < width; x += 1) {
      const target = (row + x) * 4;
      horizontal[target] = red / diameter;
      horizontal[target + 1] = green / diameter;
      horizontal[target + 2] = blue / diameter;
      horizontal[target + 3] = source[target + 3];
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      const remove = (row + removeX) * 4;
      const add = (row + addX) * 4;
      red += source[add] - source[remove];
      green += source[add + 1] - source[remove + 1];
      blue += source[add + 2] - source[remove + 2];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const pixel = (Math.max(0, Math.min(height - 1, offset)) * width + x) * 4;
      red += horizontal[pixel];
      green += horizontal[pixel + 1];
      blue += horizontal[pixel + 2];
    }
    for (let y = 0; y < height; y += 1) {
      const target = (y * width + x) * 4;
      output[target] = red / diameter;
      output[target + 1] = green / diameter;
      output[target + 2] = blue / diameter;
      output[target + 3] = source[target + 3];
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      const remove = (removeY * width + x) * 4;
      const add = (addY * width + x) * 4;
      red += horizontal[add] - horizontal[remove];
      green += horizontal[add + 1] - horizontal[remove + 1];
      blue += horizontal[add + 2] - horizontal[remove + 2];
    }
  }
  return output;
}

function applySpatialAdjustments(pixels: Uint8ClampedArray, width: number, height: number, values: FilterValues) {
  if (values.noiseReduction !== 0) {
    const softened = boxBlurPixels(pixels, width, height, 1);
    const amount = values.noiseReduction / 100 * 0.72;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = clamp(pixels[i] + (softened[i] - pixels[i]) * amount);
      pixels[i + 1] = clamp(pixels[i + 1] + (softened[i + 1] - pixels[i + 1]) * amount);
      pixels[i + 2] = clamp(pixels[i + 2] + (softened[i + 2] - pixels[i + 2]) * amount);
    }
  }

  if (values.definition !== 0) {
    const localAverage = boxBlurPixels(pixels, width, height, 2);
    const amount = values.definition / 100 * 1.05;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      const midtoneWeight = 0.55 + (1 - Math.abs(luminance - 128) / 128) * 0.45;
      pixels[i] = clamp(pixels[i] + (pixels[i] - localAverage[i]) * amount * midtoneWeight);
      pixels[i + 1] = clamp(pixels[i + 1] + (pixels[i + 1] - localAverage[i + 1]) * amount * midtoneWeight);
      pixels[i + 2] = clamp(pixels[i + 2] + (pixels[i + 2] - localAverage[i + 2]) * amount * midtoneWeight);
    }
  }

  if (values.sharpness !== 0 && width > 2 && height > 2) {
    const source = new Uint8ClampedArray(pixels);
    const amount = values.sharpness / 100 * 0.48;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const center = source[pixel + channel];
          const laplacian = center * 4
            - source[pixel - 4 + channel]
            - source[pixel + 4 + channel]
            - source[pixel - width * 4 + channel]
            - source[pixel + width * 4 + channel];
          pixels[pixel + channel] = clamp(center + laplacian * amount);
        }
      }
    }
  }
}

function applyFilterValues(frame: ImageData, width: number, height: number, values: FilterValues) {
  const pixels = frame.data;
  const exposureGain = Math.pow(2, values.exposure / 100);
  const brillianceFactor = values.brilliance / 100;
  const contrastValue = values.contrast * 1.55 + values.brilliance * 0.12;
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const saturationFactor = 1 + values.saturation / 100;
  const fadeFactor = Math.max(0, values.fade) / 100;
  const grainAmount = Math.max(0, values.grain) * 0.42;
  const vignetteAmount = values.vignette / 100;
  const cx = width / 2;
  const cy = height / 2;
  const maxDistance = Math.sqrt(cx * cx + cy * cy);
  let seed = 9187;

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i] * exposureGain + values.brightness * 0.75;
    let g = pixels[i + 1] * exposureGain + values.brightness * 0.75;
    let b = pixels[i + 2] * exposureGain + values.brightness * 0.75;
    const beforeTone = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowWeight = Math.pow(1 - clamp(beforeTone) / 255, 1.7);
    const highlightWeight = Math.pow(clamp(beforeTone) / 255, 1.7);
    const midtoneWeight = 1 - Math.min(1, Math.abs(clamp(beforeTone) - 128) / 128);
    const brillianceShift = brillianceFactor * (8 + midtoneWeight * 18 + shadowWeight * 10);
    const blackPointShift = -values.blackPoint * Math.pow(shadowWeight, 1.45) * 0.72;
    const toneShift = values.shadows * shadowWeight * 0.62 + values.highlights * highlightWeight * 0.62 + brillianceShift + blackPointShift;
    r += toneShift + values.temperature * 0.48;
    g += toneShift + values.temperature * 0.06 - values.tint * 0.34;
    b += toneShift - values.temperature * 0.48 + values.tint * 0.22;
    r += values.tint * 0.22;
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luminance + (r - luminance) * saturationFactor;
    g = luminance + (g - luminance) * saturationFactor;
    b = luminance + (b - luminance) * saturationFactor;
    const colorfulness = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const vibranceFactor = 1 + values.vibrance / 100 * (1 - clamp(colorfulness, 0, 1)) * 0.9;
    r = luminance + (r - luminance) * vibranceFactor;
    g = luminance + (g - luminance) * vibranceFactor;
    b = luminance + (b - luminance) * vibranceFactor;
    r = r * (1 - fadeFactor * 0.28) + 132 * fadeFactor * 0.28;
    g = g * (1 - fadeFactor * 0.28) + 128 * fadeFactor * 0.28;
    b = b * (1 - fadeFactor * 0.28) + 123 * fadeFactor * 0.28;
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * grainAmount;
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDistance;
    const vignette = 1 - Math.max(0, distance - 0.28) ** 1.7 * vignetteAmount * 0.82;
    pixels[i] = clamp((r + noise) * vignette);
    pixels[i + 1] = clamp((g + noise) * vignette);
    pixels[i + 2] = clamp((b + noise) * vignette);
  }
  applySpatialAdjustments(pixels, width, height, values);
}

function analyzePhoto(image: HTMLImageElement): PhotoProfile | null {
  const maxSide = 320;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let luminanceTotal = 0;
  let saturationTotal = 0;
  let warmthTotal = 0;
  let highlightCount = 0;
  let shadowCount = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    luminanceTotal += luminance;
    saturationTotal += maximum === 0 ? 0 : (maximum - minimum) / maximum;
    warmthTotal += red - blue;
    if (luminance >= 242) highlightCount += 1;
    if (luminance <= 18) shadowCount += 1;
    count += 1;
  }

  const brightness = luminanceTotal / count;
  const saturation = saturationTotal / count;
  const warmth = warmthTotal / count;
  return {
    brightness,
    saturation,
    warmth,
    highlightClip: highlightCount / count,
    shadowClip: shadowCount / count,
    labels: [
      brightness < 92 ? "偏暗" : brightness > 174 ? "偏亮" : "光线均衡",
      saturation < 0.2 ? "低饱和" : saturation > 0.48 ? "色彩浓郁" : "色彩自然",
      warmth < -11 ? "偏冷" : warmth > 11 ? "偏暖" : "冷暖自然",
    ],
  };
}

function createThumbnail(image: HTMLImageElement) {
  const size = 160;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function createRecipeAdaptation(values: FilterValues, profile: PhotoProfile): RecipeAdaptation | null {
  const adapted = { ...values };
  const reasons: string[] = [];

  if (profile.brightness > 174) {
    const originalExposure = adapted.exposure;
    const originalBrightness = adapted.brightness;
    if (adapted.exposure > 0) adapted.exposure = Math.round(adapted.exposure * 0.45);
    if (adapted.brightness > 0) adapted.brightness = Math.round(adapted.brightness * 0.45);
    if (profile.highlightClip > 0.015) adapted.highlights = Math.min(adapted.highlights, -20);
    if (adapted.exposure !== originalExposure || adapted.brightness !== originalBrightness || adapted.highlights !== values.highlights) {
      reasons.push("原图光线较强，建议减弱提亮并保护高光");
    }
  } else if (profile.brightness < 92) {
    const boost = profile.brightness < 64 ? 16 : 10;
    adapted.exposure = clamp(adapted.exposure + Math.round(boost * 0.45), -100, 100);
    adapted.brightness = clamp(adapted.brightness + boost, -100, 100);
    reasons.push("原图偏暗，建议增加一点整体光感");
  }

  if (profile.saturation > 0.48 && (adapted.saturation > 0 || adapted.vibrance > 0)) {
    if (adapted.saturation > 0) adapted.saturation = Math.round(adapted.saturation * 0.4);
    if (adapted.vibrance > 0) adapted.vibrance = Math.round(adapted.vibrance * 0.45);
    reasons.push("原图颜色已经比较浓，建议减弱增色力度");
  } else if (profile.saturation < 0.16 && (adapted.saturation < 0 || adapted.vibrance < 0)) {
    if (adapted.saturation < 0) adapted.saturation = Math.round(adapted.saturation * 0.55);
    if (adapted.vibrance < 0) adapted.vibrance = Math.round(adapted.vibrance * 0.55);
    reasons.push("原图颜色较淡，建议减少褪色程度");
  }

  if (profile.shadowClip > 0.08 && (adapted.shadows < -35 || adapted.blackPoint > 0)) {
    adapted.shadows = Math.max(adapted.shadows, -35);
    adapted.blackPoint = Math.round(adapted.blackPoint * 0.6);
    reasons.push("原图暗部较重，建议保留更多阴影细节");
  }

  const changed = (Object.keys(adapted) as FilterKey[]).some((key) => adapted[key] !== values[key]);
  if (!changed) return null;
  return { values: adapted, message: `${reasons.slice(0, 2).join("；")}。` };
}

function parseRecipe(text: string) {
  const normalized = text.replace(/＋/g, "+").replace(/[−–—]/g, "-").replace(/：/g, ":").replace(/，/g, ",");
  const values: Partial<FilterValues> = {};
  const recognized: { key: FilterKey; label: string; value: number }[] = [];

  CONTROLS.forEach(({ key, label }) => {
    const aliases = [...ALIASES[key]].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = normalized.match(new RegExp(`${escaped}([^\\d+\\-]{0,10})([+\\-]?\\d{1,3})`, "i"));
      if (!match) continue;
      let value = Number(match[2]);
      if (/(降低|减少|下降|调低|往下|降)/.test(match[1]) && value > 0) value *= -1;
      if (/(增加|提高|上升|调高|往上|加)/.test(match[1]) && value < 0) value *= -1;
      value = Math.max(-100, Math.min(100, value));
      values[key] = value;
      recognized.push({ key, label, value });
      break;
    }
  });

  const unsupported = UNSUPPORTED.filter((item) => normalized.toLowerCase().includes(item.toLowerCase()));
  return { values, recognized, unsupported };
}

export default function FilterStudio() {
  const [activeTab, setActiveTab] = useState<"presets" | "paste">("presets");
  const [recipeText, setRecipeText] = useState("");
  const [sourceApp, setSourceApp] = useState("iPhone 相册");
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseRecipe> | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activePhotoId, setActivePhotoId] = useState("");
  const [compare, setCompare] = useState(32);
  const compareRef = useRef(compare);
  const [toast, setToast] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isPresetLibraryOpen, setIsPresetLibraryOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const adjustmentCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePhoto = useMemo(
    () => photos.find((photo) => photo.id === activePhotoId) || photos[0] || null,
    [activePhotoId, photos],
  );
  const image = activePhoto?.image || null;
  const imageName = activePhoto?.name || "";
  const photoProfile = activePhoto?.profile || null;
  const values = activePhoto?.values || DEFAULT_VALUES;
  const selectedPreset = activePhoto?.selectedPreset || "";
  const recipeBaseline = activePhoto?.recipeBaseline || null;

  const selectedName = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedPreset)?.name || "自定义配方",
    [selectedPreset],
  );
  const adjustedCount = useMemo(
    () => Object.values(values).filter((value) => value !== 0).length,
    [values],
  );
  const recipeAdaptation = useMemo(
    () => photoProfile && recipeBaseline ? createRecipeAdaptation(recipeBaseline, photoProfile) : null,
    [photoProfile, recipeBaseline],
  );
  const filteredPresets = useMemo(() => {
    const query = presetSearch.trim().toLowerCase();
    if (!query) return PRESETS;
    return PRESETS.filter((preset) => `${preset.name} ${preset.scene} ${preset.tone}`.toLowerCase().includes(query));
  }, [presetSearch]);

  const updateActivePhoto = useCallback((updater: (photo: PhotoItem) => PhotoItem) => {
    if (!activePhotoId) return;
    setPhotos((current) => current.map((photo) => photo.id === activePhotoId ? updater(photo) : photo));
  }, [activePhotoId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const drawComparison = useCallback(() => {
    const source = sourceCanvasRef.current;
    const processed = processedCanvasRef.current;
    if (!source || !processed || !source.width) return;
    [displayCanvasRef.current, adjustmentCanvasRef.current].forEach((display) => {
      if (!display) return;
      const ctx = display.getContext("2d");
      if (!ctx) return;
      display.width = source.width;
      display.height = source.height;
      const split = Math.round((display.width * compareRef.current) / 100);
      ctx.clearRect(0, 0, display.width, display.height);
      ctx.drawImage(source, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(split, 0, display.width - split, display.height);
      ctx.clip();
      ctx.drawImage(processed, 0, 0);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.fillRect(Math.max(0, split - 1), 0, 2, display.height);
    });
  }, []);

  const renderImage = useCallback(() => {
    if (!image) return;
    const maxSide = 1200;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const source = sourceCanvasRef.current || document.createElement("canvas");
    const processed = processedCanvasRef.current || document.createElement("canvas");
    sourceCanvasRef.current = source;
    processedCanvasRef.current = processed;
    source.width = processed.width = width;
    source.height = processed.height = height;
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const processedCtx = processed.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx || !processedCtx) return;
    sourceCtx.drawImage(image, 0, 0, width, height);
    const frame = sourceCtx.getImageData(0, 0, width, height);
    applyFilterValues(frame, width, height, values);
    processedCtx.putImageData(frame, 0, 0);
    drawComparison();
  }, [drawComparison, image, values]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(renderImage);
    return () => window.cancelAnimationFrame(frame);
  }, [renderImage]);

  useEffect(() => {
    compareRef.current = compare;
    drawComparison();
  }, [compare, drawComparison]);

  useEffect(() => {
    if (!isAdjustmentOpen && !isPresetLibraryOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsAdjustmentOpen(false);
      setIsPresetLibraryOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    const frame = window.requestAnimationFrame(drawComparison);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.cancelAnimationFrame(frame);
    };
  }, [drawComparison, isAdjustmentOpen, isPresetLibraryOpen]);

  const openAdjustments = () => {
    if (!image) {
      showToast("请先选择照片");
      return;
    }
    setIsAdjustmentOpen(true);
  };

  const loadImageFile = useCallback((file: File) => new Promise<PhotoItem>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = () => resolve({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      image: nextImage,
      name: file.name,
      objectUrl,
      thumbnail: createThumbnail(nextImage),
      profile: analyzePhoto(nextImage),
      values: activePhoto?.values || DEFAULT_VALUES,
      selectedPreset: activePhoto?.selectedPreset || "",
      recipeBaseline: activePhoto?.recipeBaseline || null,
    });
    nextImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image-load-failed"));
    };
    nextImage.src = objectUrl;
  }), [activePhoto]);

  const loadFiles = useCallback(async (fileList?: FileList | File[]) => {
    const remaining = Math.max(0, 18 - photos.length);
    const validFiles = Array.from(fileList || []).filter((file) => file.type.startsWith("image/")).slice(0, remaining);
    if (!validFiles.length) {
      showToast(remaining === 0 ? "最多可以选择 18 张照片" : "请选择图片文件");
      return;
    }
    const loaded: PhotoItem[] = [];
    for (const file of validFiles) {
      try {
        loaded.push(await loadImageFile(file));
      } catch {
        // Skip unreadable files and continue loading the rest of the batch.
      }
    }
    if (!loaded.length) {
      showToast("这些照片暂时无法读取");
      return;
    }
    setPhotos((current) => [...current, ...loaded]);
    if (!activePhotoId) setActivePhotoId(loaded[0].id);
    setCompare(32);
    showToast(`已加入 ${loaded.length} 张照片${validFiles.length < Array.from(fileList || []).length ? "，最多保留 18 张" : ""}`);
  }, [activePhotoId, loadImageFile, photos.length, showToast]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadFiles(event.target.files || undefined);
    event.target.value = "";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void loadFiles(event.dataTransfer.files);
  };

  const removePhoto = (photoId: string) => {
    const photo = photos.find((item) => item.id === photoId);
    if (photo) URL.revokeObjectURL(photo.objectUrl);
    const remaining = photos.filter((item) => item.id !== photoId);
    setPhotos(remaining);
    if (activePhotoId === photoId) setActivePhotoId(remaining[0]?.id || "");
  };

  const applyPreset = (preset: Preset) => {
    if (!photos.length) {
      showToast("请先选择照片");
      return;
    }
    setPhotos((current) => current.map((photo) => ({
      ...photo,
      values: preset.values,
      recipeBaseline: preset.values,
      selectedPreset: preset.id,
    })));
    setParseResult(null);
    showToast(`已将「${preset.name}」应用到 ${photos.length} 张照片`);
  };

  const analyzeRecipe = () => {
    const result = parseRecipe(recipeText);
    setParseResult(result);
    if (!result.recognized.length) {
      showToast("还没找到可识别的数值参数");
      return;
    }
    if (!photos.length) {
      showToast("参数已识别，请先选择照片");
      return;
    }
    const parsedValues = { ...DEFAULT_VALUES, ...result.values };
    setPhotos((current) => current.map((photo) => ({ ...photo, values: parsedValues, recipeBaseline: parsedValues, selectedPreset: "" })));
    showToast(`已识别 ${result.recognized.length} 项参数并应用到全部照片`);
  };

  const updateValue = (key: FilterKey, value: number) => {
    updateActivePhoto((photo) => ({ ...photo, values: { ...photo.values, [key]: value }, recipeBaseline: null, selectedPreset: "" }));
  };

  const resetValues = () => {
    updateActivePhoto((photo) => ({ ...photo, values: DEFAULT_VALUES, recipeBaseline: null, selectedPreset: "" }));
    setParseResult(null);
    showToast("当前照片已恢复原图参数");
  };

  const applySmartAdaptation = () => {
    if (!recipeAdaptation) return;
    updateActivePhoto((photo) => ({ ...photo, values: recipeAdaptation.values, recipeBaseline: null }));
    showToast("已根据当前照片智能适配");
  };

  const applyCurrentValuesToAll = () => {
    if (!activePhoto || photos.length < 2) return;
    setPhotos((current) => current.map((photo) => ({
      ...photo,
      values: activePhoto.values,
      selectedPreset: activePhoto.selectedPreset,
      recipeBaseline: null,
    })));
    showToast(`已将当前参数应用到 ${photos.length} 张照片`);
  };

  const getOutputDataUrl = (sourceImage = image, filterValues = values) => {
    if (!sourceImage) return "";
    const maxSide = 3000;
    const ratio = Math.min(1, maxSide / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
    const width = Math.max(1, Math.round(sourceImage.naturalWidth * ratio));
    const height = Math.max(1, Math.round(sourceImage.naturalHeight * ratio));
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d", { willReadFrequently: true });
    if (!context) return "";
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    applyFilterValues(frame, width, height, filterValues);
    context.putImageData(frame, 0, 0);
    return output.toDataURL("image/jpeg", 0.98);
  };

  const dataUrlToFile = (dataUrl: string, fileName: string) => {
    const [header, payload] = dataUrl.split(",");
    const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
  };

  const saveImage = async () => {
    if (!photos.length) {
      showToast("请先选择照片");
      return;
    }
    showToast(`正在生成 ${photos.length} 张高清照片`);
    const outputs = photos.map((photo, index) => {
      const presetName = PRESETS.find((preset) => preset.id === photo.selectedPreset)?.name || "自定义配方";
      const dataUrl = getOutputDataUrl(photo.image, photo.values);
      const fileName = `滤镜照做-${presetName}-${index + 1}.jpg`;
      return { dataUrl, fileName };
    });
    const bridge = (window as unknown as { xhs?: { miniTool?: { writeTempFile?: (options: { data: string }) => Promise<{ filePath: string }>; saveImageToPhotosAlbum?: (options: { filePath: string }) => Promise<unknown> } } }).xhs?.miniTool;
    if (bridge?.writeTempFile && bridge?.saveImageToPhotosAlbum) {
      try {
        for (const output of outputs) {
          const { filePath } = await bridge.writeTempFile({ data: output.dataUrl });
          await bridge.saveImageToPhotosAlbum({ filePath });
        }
        showToast(`已保存 ${outputs.length} 张照片到系统相册`);
      } catch {
        showToast("保存失败，请稍后再试");
      }
      return;
    }

    const files = outputs.map((output) => dataUrlToFile(output.dataUrl, output.fileName));
    const shareData = { files, title: "保存调色照片" };
    const shareNavigator = navigator as Navigator & {
      canShare?: (data: typeof shareData) => boolean;
      share?: (data: typeof shareData) => Promise<void>;
    };
    if (shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare(shareData))) {
      try {
        showToast("请在系统菜单中选择存储照片");
        await shareNavigator.share(shareData);
      } catch (error) {
        showToast(error instanceof DOMException && error.name === "AbortError" ? "已取消保存" : "无法打开系统保存菜单");
      }
      return;
    }

    files.forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    });
    showToast(`已下载 ${files.length} 张本地预览图`);
  };

  const publishImage = async () => {
    if (!photos.length) {
      showToast("请先选择照片");
      return;
    }
    const bridge = (window as unknown as { xhs?: { miniTool?: { postNote?: (options: object) => Promise<unknown> } } }).xhs?.miniTool;
    if (!bridge?.postNote) {
      showToast("本地预览中，小红书发布接口尚未启用");
      return;
    }
    try {
      await bridge.postNote({
        pageType: "photo_publish",
        mediaInfo: { image_resources: photos.map((photo) => ({ url: getOutputDataUrl(photo.image, photo.values) })) },
      });
    } catch {
      showToast("暂时无法进入发布页");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>+</span><span>−</span></div>
          <div>
            <p className="eyebrow">滤镜照做</p>
            <h1>把调色攻略，直接变成照片效果。</h1>
          </div>
        </div>
        <div className="preview-badge"><span /> 本地效果预览</div>
      </header>

      <section className="studio-grid">
        <section className="photo-stage card">
          <div className="section-heading">
            <div>
              <span className="step-label">01 · 照片</span>
              <h2>{image ? `${photos.length} 张照片 · ${imageName}` : "选择想调色的照片"}</h2>
            </div>
            {image && photos.length < 18 && <button className="text-button" onClick={() => inputRef.current?.click()}>添加照片</button>}
          </div>

          <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={onFileChange} />
          {!image ? (
            <div
              className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div className="upload-art" aria-hidden="true"><span className="sun-dot" /><span className="mountain mountain-one" /><span className="mountain mountain-two" /></div>
              <h3>一次选择多张照片</h3>
              <p>最多 18 张 · JPG、PNG、WEBP · 只在本地处理</p>
              <button className="primary-button upload-button" onClick={() => inputRef.current?.click()}><span aria-hidden="true">+</span> 选择照片</button>
            </div>
          ) : (
            <div className="canvas-area">
              <div className="canvas-frame">
                <canvas ref={displayCanvasRef} aria-label="照片调色前后对比" />
                <div className="compare-label before-label">原图</div>
                <div className="compare-label after-label">效果</div>
              </div>
              <div className="compare-control">
                <span>原图</span>
                <input type="range" min="5" max="95" value={compare} onChange={(event) => setCompare(Number(event.target.value))} aria-label="调整前后对比位置" />
                <span>效果</span>
              </div>
              <div className="photo-strip" aria-label={`已选择 ${photos.length} 张照片`}>
                {photos.map((photo, index) => (
                  <div className={`photo-thumb-wrap ${photo.id === activePhoto?.id ? "active" : ""}`} key={photo.id}>
                    <button className="photo-thumb" type="button" onClick={() => { setActivePhotoId(photo.id); setCompare(32); }} aria-label={`查看第 ${index + 1} 张照片：${photo.name}`}>
                      <img src={photo.thumbnail} alt="" />
                      <span>{index + 1}</span>
                    </button>
                    <button className="remove-photo" type="button" onClick={() => removePhoto(photo.id)} aria-label={`移除第 ${index + 1} 张照片`}>×</button>
                  </div>
                ))}
                {photos.length < 18 && <button className="add-photo-tile" type="button" onClick={() => inputRef.current?.click()} aria-label="继续添加照片">+</button>}
              </div>
            </div>
          )}
          {image && (
            <button className="photo-adjustment-launch" type="button" onClick={openAdjustments}>
              <span aria-hidden="true">☷</span>
              <strong>微调</strong>
              <small>{adjustedCount > 0 ? `${adjustedCount} 项已调整` : "按需要调整参数"}</small>
            </button>
          )}
          {photoProfile && (
            <div className="photo-profile" aria-label="原图分析结果">
              <strong><span aria-hidden="true">✦</span> 原图分析</strong>
              <div>{photoProfile.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </div>
          )}
          <div className="privacy-note"><span aria-hidden="true">◇</span> 不上传、不存储、只在本地处理</div>
        </section>

        <section className="recipe-panel card">
          <div className="section-heading compact"><div><span className="step-label">02 · 配方</span><h2>今天想要什么感觉？</h2></div></div>
          <div className="tabs" role="tablist" aria-label="配方来源">
            <button className={activeTab === "presets" ? "active" : ""} onClick={() => setActiveTab("presets")}>配方库</button>
            <button className={activeTab === "paste" ? "active" : ""} onClick={() => setActiveTab("paste")}>粘贴攻略 <span className="new-dot" /></button>
          </div>

          {activeTab === "presets" ? (
            <div className="preset-content">
              <p className="panel-intro">选择后会应用到全部照片，每张照片仍可单独智能适配。</p>
              <div className="preset-toolbar">
                <strong>精选配方</strong>
                <button type="button" onClick={() => setIsPresetLibraryOpen(true)}>查看全部 · {PRESETS.length} <span>›</span></button>
              </div>
              <div className="preset-grid">
                {PRESETS.slice(0, 4).map((preset) => (
                  <button key={preset.id} className={`preset-card ${selectedPreset === preset.id ? "selected" : ""}`} onClick={() => applyPreset(preset)}>
                    <span className="preset-swatch" style={{ background: preset.swatch }}>{selectedPreset === preset.id && <span className="check-mark">✓</span>}</span>
                    <span className="preset-meta"><strong>{preset.name}</strong><small>{preset.scene}</small></span>
                    <span className="preset-tone">{preset.tone}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="paste-content">
              <p className="panel-intro">把帖子里的调色参数整段粘贴进来，无需手动整理。</p>
              <div className="source-row">
                <label htmlFor="source-app">参数来源</label>
                <select id="source-app" value={sourceApp} onChange={(event) => setSourceApp(event.target.value)}>
                  <option>自动判断</option><option>iPhone 相册</option><option>小红书</option><option>醒图</option><option>Lightroom</option><option>其他 / 通用</option>
                </select>
              </div>
              <textarea value={recipeText} onChange={(event) => setRecipeText(event.target.value)} placeholder="例如：曝光+10，高光-25，阴影+16……" rows={6} />
              <button className="analyze-button" onClick={analyzeRecipe}>识别参数并应用 <span>→</span></button>
              {parseResult && (
                <div className="parse-result">
                  <div className="parse-summary"><strong>已识别 {parseResult.recognized.length} 项参数</strong><span>{sourceApp}</span></div>
                  <div className="recognized-list">
                    {parseResult.recognized.map((item) => <span key={item.key}><b>✓</b>{item.label}<em>{item.value > 0 ? "+" : ""}{item.value}</em></span>)}
                    {parseResult.unsupported.map((item) => <span className="unsupported" key={item}><b>!</b>{item}<em>暂不支持</em></span>)}
                  </div>
                  <p>不同修图软件的算法有差异，当前为接近效果，可在下方继续微调。</p>
                </div>
              )}
            </div>
          )}
          {recipeAdaptation && (
            <div className="smart-suggestion">
              <span className="smart-icon" aria-hidden="true">✦</span>
              <div className="smart-copy">
                <strong>更适合这张照片</strong>
                <p>{recipeAdaptation.message}</p>
              </div>
              <button type="button" onClick={applySmartAdaptation}>一键适配</button>
            </div>
          )}
        </section>
      </section>

      <section className="export-bar">
        <div><span className="step-label">完成</span><strong>{photos.length > 1 ? `${photos.length} 张照片已准备好` : "照片只在你的设备上处理"}</strong></div>
        <div className="export-actions"><button className="secondary-button" onClick={saveImage}>保存{photos.length > 1 ? "全部" : "照片"}</button><button className="primary-button" onClick={publishImage}>去发布 <span>↗</span></button></div>
      </section>
      {isPresetLibraryOpen && (
        <div className="preset-library-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) setIsPresetLibraryOpen(false); }}>
          <section className="preset-library-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-library-title">
            <header className="preset-library-header">
              <div><span className="step-label">配方库</span><strong id="preset-library-title">选择一种照片感觉</strong></div>
              <button className="close-dialog" type="button" onClick={() => setIsPresetLibraryOpen(false)} aria-label="关闭配方库">×</button>
            </header>
            <div className="preset-library-body">
              <label className="preset-search">
                <span aria-hidden="true">⌕</span>
                <input value={presetSearch} onChange={(event) => setPresetSearch(event.target.value)} placeholder="搜索风格、场景或色调" autoFocus />
              </label>
              <div className="preset-library-count">{presetSearch ? `找到 ${filteredPresets.length} 个配方` : `全部配方 · ${PRESETS.length}`}</div>
              <div className="preset-library-grid">
                {filteredPresets.map((preset) => (
                  <button key={preset.id} className={`preset-card ${selectedPreset === preset.id ? "selected" : ""}`} onClick={() => { applyPreset(preset); setIsPresetLibraryOpen(false); }}>
                    <span className="preset-swatch" style={{ background: preset.swatch }}>{selectedPreset === preset.id && <span className="check-mark">✓</span>}</span>
                    <span className="preset-meta"><strong>{preset.name}</strong><small>{preset.scene}</small></span>
                    <span className="preset-tone">{preset.tone}</span>
                  </button>
                ))}
              </div>
              {!filteredPresets.length && <div className="preset-empty">没有找到相关配方</div>}
            </div>
          </section>
        </div>
      )}
      {isAdjustmentOpen && (
        <div className="adjustment-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) setIsAdjustmentOpen(false); }}>
          <section className="adjustment-dialog" id="adjustment-dialog" role="dialog" aria-modal="true" aria-labelledby="adjustment-dialog-title">
            <header className="adjustment-dialog-header">
              <div>
                <span className="step-label">实时微调</span>
                <strong id="adjustment-dialog-title">{selectedPreset ? `「${selectedName}」· ${imageName}` : imageName}</strong>
              </div>
              <div className="dialog-actions">
                {photos.length > 1 && <button className="dialog-text-button apply-all-button" type="button" onClick={applyCurrentValuesToAll}>应用到全部</button>}
                <button className="dialog-text-button" type="button" onClick={resetValues}>恢复原图</button>
                <button className="close-dialog" type="button" onClick={() => setIsAdjustmentOpen(false)} aria-label="关闭实时微调">×</button>
              </div>
            </header>
            <div className="adjustment-workspace">
              <div className={`adjustment-preview-pane ${image && image.naturalHeight > image.naturalWidth ? "is-portrait" : "is-landscape"}`}>
                <div className="adjustment-canvas-frame">
                  <canvas ref={adjustmentCanvasRef} aria-label="实时调色前后对比" />
                  <div className="compare-label before-label">原图</div>
                  <div className="compare-label after-label">效果</div>
                </div>
                <div className="compare-control dialog-compare-control">
                  <span>原图</span>
                  <input type="range" min="5" max="95" value={compare} onChange={(event) => setCompare(Number(event.target.value))} aria-label="实时调整前后对比位置" />
                  <span>效果</span>
                </div>
                {photos.length > 1 && (
                  <div className="adjustment-photo-strip" aria-label="切换正在微调的照片">
                    {photos.map((photo, index) => (
                      <button className={photo.id === activePhoto?.id ? "active" : ""} type="button" key={photo.id} onClick={() => { setActivePhotoId(photo.id); setCompare(32); }} aria-label={`微调第 ${index + 1} 张照片`}>
                        <img src={photo.thumbnail} alt="" />
                        <span>{index + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
                {photoProfile && <div className="dialog-profile">{photoProfile.labels.map((label) => <span key={label}>{label}</span>)}</div>}
              </div>
              <div className="adjustment-controls-pane">
                <div className="controls-intro"><strong>边调边看</strong><span>当前修改只影响这张照片</span></div>
                {CONTROL_GROUPS.map((group) => (
                  <div className="control-group" key={group.name}>
                    <div className="control-group-title"><strong>{group.name}</strong><span>{group.count}</span></div>
                    <div className="controls-grid dialog-controls-grid">
                      {group.controls.map((control) => (
                        <label className="control-item" key={control.key}>
                          <span className="control-name"><strong>{control.label}</strong><small>{control.hint}</small></span>
                          <input type="range" min="-100" max="100" value={values[control.key]} onChange={(event) => updateValue(control.key, Number(event.target.value))} />
                          <output className={values[control.key] !== 0 ? "changed" : ""}>{values[control.key] > 0 ? "+" : ""}{values[control.key]}</output>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
