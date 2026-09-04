import { createWorker } from 'tesseract.js';
import type { OcrResult } from '../types';

/**
 * Get or initialize Tesseract.js worker with progress callback
 */
export async function runRealTesseractOcr(
  imageSource: string | File | Blob | HTMLCanvasElement,
  language: string = 'chi_sim+eng',
  onProgress?: (progress: number, status: string) => void
): Promise<OcrResult> {
  try {
    if (onProgress) {
      onProgress(0.1, '正在加载 Tesseract 核心引擎...');
    }

    const worker = await createWorker(language, 1, {
      logger: (m: any) => {
        if (onProgress) {
          if (m.status === 'loading tesseract core') {
            onProgress(0.2, '加载 WASM 核心模块...');
          } else if (m.status === 'loading language traineddata') {
            onProgress(0.4, `加载语言包 (${language}) ${Math.round((m.progress || 0) * 100)}%...`);
          } else if (m.status === 'initializing api') {
            onProgress(0.6, '初始化 OCR 识别接口...');
          } else if (m.status === 'recognizing text') {
            const pct = 0.6 + (m.progress || 0) * 0.38;
            onProgress(pct, `正在识别文字 ${Math.round((m.progress || 0) * 100)}%...`);
          }
        }
      },
    });

    const ret: any = await worker.recognize(imageSource);
    await worker.terminate();

    if (onProgress) {
      onProgress(1.0, '识别完成');
    }

    const lines = Array.isArray(ret?.data?.lines)
      ? ret.data.lines.map((l: any) => ({
          text: l.text,
          confidence: (l.confidence || 90) / 100,
          bbox: l.bbox,
        }))
      : [];

    return {
      text: ret?.data?.text || '',
      confidence: (ret?.data?.confidence || 95) / 100,
      lines,
    };
  } catch (err: any) {
    console.error('Tesseract OCR error:', err);
    throw new Error(err?.message || 'OCR 引擎识别失败，请检查图像格式');
  }
}

/**
 * Client-side Canvas Image Compression
 */
export async function compressImageClientSide(
  file: File,
  quality: number = 0.8,
  targetFormat: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context error'));
        return;
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw image
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL(targetFormat, quality);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              dataUrl,
              width: canvas.width,
              height: canvas.height,
            });
          } else {
            reject(new Error('Blob conversion failed'));
          }
        },
        targetFormat,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
  });
}
