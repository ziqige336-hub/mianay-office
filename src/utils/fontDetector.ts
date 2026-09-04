/**
 * System font detection & enumeration utility
 * Supports modern queryLocalFonts API with high-accuracy canvas/document.fonts fallback
 */

export interface SystemFontOption {
  family: string;
  name: string;
  category: 'chinese' | 'english' | 'mono';
  previewText?: string;
}

export const COMMON_SYSTEM_FONTS: SystemFontOption[] = [
  // Common Chinese Fonts
  { family: 'PingFang SC', name: '苹方 (PingFang SC)', category: 'chinese' },
  { family: 'Microsoft YaHei', name: '微软雅黑 (Microsoft YaHei)', category: 'chinese' },
  { family: 'SimSun', name: '宋体 (SimSun)', category: 'chinese' },
  { family: 'SimHei', name: '黑体 (SimHei)', category: 'chinese' },
  { family: 'KaiTi', name: '楷体 (KaiTi)', category: 'chinese' },
  { family: 'FangSong', name: '仿宋 (FangSong)', category: 'chinese' },
  { family: 'Hiragino Sans GB', name: '冬青黑体 (Hiragino Sans)', category: 'chinese' },
  { family: 'STHeiti', name: '华文黑体 (STHeiti)', category: 'chinese' },
  { family: 'STKaiti', name: '华文楷体 (STKaiti)', category: 'chinese' },
  { family: 'STSong', name: '华文宋体 (STSong)', category: 'chinese' },
  { family: 'STFangsong', name: '华文仿宋 (STFangsong)', category: 'chinese' },
  { family: 'Source Han Sans SC', name: '思源黑体 (Source Han Sans)', category: 'chinese' },
  { family: 'Source Han Serif SC', name: '思源宋体 (Source Han Serif)', category: 'chinese' },
  { family: 'HarmonyOS Sans SC', name: '鸿蒙黑体 (HarmonyOS Sans)', category: 'chinese' },
  { family: 'LiSu', name: '隶书 (LiSu)', category: 'chinese' },
  { family: 'YouYuan', name: '幼圆 (YouYuan)', category: 'chinese' },

  // Common English Fonts
  { family: 'Arial', name: 'Arial', category: 'english' },
  { family: 'Helvetica', name: 'Helvetica', category: 'english' },
  { family: 'Times New Roman', name: 'Times New Roman', category: 'english' },
  { family: 'Calibri', name: 'Calibri', category: 'english' },
  { family: 'Cambria', name: 'Cambria', category: 'english' },
  { family: 'Georgia', name: 'Georgia', category: 'english' },
  { family: 'Garamond', name: 'Garamond', category: 'english' },
  { family: 'Verdana', name: 'Verdana', category: 'english' },
  { family: 'Tahoma', name: 'Tahoma', category: 'english' },
  { family: 'Trebuchet MS', name: 'Trebuchet MS', category: 'english' },
  { family: 'Segoe UI', name: 'Segoe UI', category: 'english' },

  // Monospace Fonts
  { family: 'JetBrains Mono', name: 'JetBrains Mono', category: 'mono' },
  { family: 'SF Mono', name: 'SF Mono', category: 'mono' },
  { family: 'Menlo', name: 'Menlo', category: 'mono' },
  { family: 'Monaco', name: 'Monaco', category: 'mono' },
  { family: 'Consolas', name: 'Consolas', category: 'mono' },
  { family: 'Courier New', name: 'Courier New', category: 'mono' },
];

/**
 * Detect whether a specific font family is installed on the local system
 */
export function isFontAvailable(fontFamily: string): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Try document.fonts.check API
  try {
    if (document.fonts && document.fonts.check(`16px "${fontFamily}"`)) {
      // document.fonts.check can return true for fallbacks, so verify with canvas test
    }
  } catch {
    // Ignore error and use canvas
  }

  // 2. Canvas font width difference metric
  const testString = 'mmmmmmmmmmlli中文测试1234';
  const testSize = '72px';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return true; // Fallback to true if context fails

  let matchedDifferences = 0;

  for (const base of baseFonts) {
    context.font = `${testSize} ${base}`;
    const baseWidth = context.measureText(testString).width;

    context.font = `${testSize} "${fontFamily}", ${base}`;
    const testWidth = context.measureText(testString).width;

    if (baseWidth !== testWidth) {
      matchedDifferences++;
    }
  }

  return matchedDifferences > 0;
}

/**
 * Get all available system fonts asynchronously
 */
export async function getSystemFonts(): Promise<SystemFontOption[]> {
  const result: SystemFontOption[] = [];
  const addedFamilies = new Set<string>();

  // 1. Try modern queryLocalFonts API (Chromium local font access)
  if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
    try {
      const localFonts: any[] = await (window as any).queryLocalFonts();
      for (const font of localFonts) {
        const family = font.family;
        if (!addedFamilies.has(family)) {
          addedFamilies.add(family);
          const isChinese = /[\u4e00-\u9fa5]/.test(font.fullName || family) ||
            ['PingFang', 'YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong', 'Songti', 'Heiti', 'Kaiti', 'Fangsong'].some(k => family.includes(k));
          const isMono = ['Mono', 'Code', 'Console', 'Menlo', 'Monaco', 'Courier'].some(k => family.includes(k));

          result.push({
            family,
            name: font.fullName || family,
            category: isMono ? 'mono' : isChinese ? 'chinese' : 'english',
          });
        }
      }
      if (result.length > 0) {
        return result;
      }
    } catch {
      // Permission denied or not supported, proceed to detector
    }
  }

  // 2. Fallback: Filter common font list with detection
  for (const font of COMMON_SYSTEM_FONTS) {
    if (isFontAvailable(font.family)) {
      if (!addedFamilies.has(font.family)) {
        addedFamilies.add(font.family);
        result.push(font);
      }
    }
  }

  // If very few detected (due to restrictive environment), return full curated list
  if (result.length < 5) {
    return COMMON_SYSTEM_FONTS;
  }

  return result;
}
