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
  const [values, setValues] = useState<FilterValues>(DEFAULT_VALUES);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [recipeText, setRecipeText] = useState("曝光-19，鲜明度-40，对比度+6，亮度-14，饱和度-15，锐化+18，清晰度+29");
  const [sourceApp, setSourceApp] = useState("iPhone 相册");
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseRecipe> | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("");
  const [compare, setCompare] = useState(32);
  const compareRef = useRef(compare);
  const [toast, setToast] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedName = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedPreset)?.name || "自定义配方",
    [selectedPreset],
  );
  const adjustedCount = useMemo(
    () => Object.values(values).filter((value) => value !== 0).length,
    [values],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const drawComparison = useCallback(() => {
    const display = displayCanvasRef.current;
    const source = sourceCanvasRef.current;
    const processed = processedCanvasRef.current;
    if (!display || !source || !processed || !source.width) return;
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

  const loadFile = useCallback((file?: File) => {
    if (!file || !file.type.startsWith("image/")) {
      showToast("请选择一张图片");
      return;
    }
    const url = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = () => {
      setImage(nextImage);
      setImageName(file.name);
      setCompare(32);
      URL.revokeObjectURL(url);
    };
    nextImage.onerror = () => showToast("这张图片暂时无法读取");
    nextImage.src = url;
  }, [showToast]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const applyPreset = (preset: Preset) => {
    setValues(preset.values);
    setSelectedPreset(preset.id);
    setParseResult(null);
    showToast(`已应用「${preset.name}」`);
  };

  const analyzeRecipe = () => {
    const result = parseRecipe(recipeText);
    setParseResult(result);
    if (!result.recognized.length) {
      showToast("还没找到可识别的数值参数");
      return;
    }
    setValues({ ...DEFAULT_VALUES, ...result.values });
    setSelectedPreset("");
    showToast(`已识别 ${result.recognized.length} 项参数`);
  };

  const updateValue = (key: FilterKey, value: number) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSelectedPreset("");
  };

  const resetValues = () => {
    setValues(DEFAULT_VALUES);
    setSelectedPreset("");
    setParseResult(null);
    showToast("已恢复原图参数");
  };

  const getOutputDataUrl = () => processedCanvasRef.current?.toDataURL("image/jpeg", 0.94) || "";

  const saveImage = async () => {
    if (!image) {
      showToast("请先选择照片");
      return;
    }
    const dataUrl = getOutputDataUrl();
    const bridge = (window as unknown as { xhs?: { miniTool?: { writeTempFile?: (options: { data: string }) => Promise<{ filePath: string }>; saveImageToPhotosAlbum?: (options: { filePath: string }) => Promise<unknown> } } }).xhs?.miniTool;
    if (bridge?.writeTempFile && bridge?.saveImageToPhotosAlbum) {
      try {
        const { filePath } = await bridge.writeTempFile({ data: dataUrl });
        await bridge.saveImageToPhotosAlbum({ filePath });
        showToast("已保存到系统相册");
      } catch {
        showToast("保存失败，请稍后再试");
      }
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `滤镜照做-${selectedName}-${Date.now()}.jpg`;
    anchor.click();
    showToast("已下载本地预览图");
  };

  const publishImage = async () => {
    if (!image) {
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
        mediaInfo: { image_resources: [{ url: getOutputDataUrl() }] },
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
              <h2>{image ? imageName : "先选一张想调的照片"}</h2>
            </div>
            {image && <button className="text-button" onClick={() => inputRef.current?.click()}>换一张</button>}
          </div>

          <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={onFileChange} />
          {!image ? (
            <div
              className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div className="upload-art" aria-hidden="true"><span className="sun-dot" /><span className="mountain mountain-one" /><span className="mountain mountain-two" /></div>
              <h3>拖入照片，或从电脑选择</h3>
              <p>JPG、PNG、WEBP · 图片只在本地处理</p>
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
              <p className="panel-intro">已收录 3 款调色配方，选择后即可预览效果。</p>
              <div className="preset-grid">
                {PRESETS.map((preset) => (
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
        </section>
      </section>

      <section className={`adjustment-card card ${isAdjustmentOpen ? "is-open" : ""}`}>
        <div className="adjustment-summary">
          <button
            className="adjustment-toggle"
            type="button"
            aria-expanded={isAdjustmentOpen}
            aria-controls="adjustment-content"
            onClick={() => setIsAdjustmentOpen((open) => !open)}
          >
            <span className="adjustment-title">
              <span className="step-label">03 · 微调</span>
              <strong>{selectedPreset ? `微调「${selectedName}」` : "微调参数"}</strong>
              <small>{adjustedCount > 0 ? `当前已应用 ${adjustedCount} 项参数` : "当前为原图参数"} · {isAdjustmentOpen ? "点击收起" : "需要时点击展开"}</small>
            </span>
            <span className="adjustment-chevron" aria-hidden="true">⌄</span>
          </button>
          {isAdjustmentOpen && <button className="text-button adjustment-reset" onClick={resetValues}>恢复原图</button>}
        </div>
        {isAdjustmentOpen && (
          <div className="adjustment-content" id="adjustment-content">
            {CONTROL_GROUPS.map((group) => (
              <div className="control-group" key={group.name}>
                <div className="control-group-title"><strong>{group.name}</strong><span>{group.count}</span></div>
                <div className="controls-grid">
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
        )}
      </section>

      <section className="export-bar">
        <div><span className="step-label">完成</span><strong>照片只在你的设备上处理</strong></div>
        <div className="export-actions"><button className="secondary-button" onClick={saveImage}>保存照片</button><button className="primary-button" onClick={publishImage}>去发布 <span>↗</span></button></div>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
