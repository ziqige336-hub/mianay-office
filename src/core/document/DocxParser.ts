import JSZip from 'jszip';
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom';
import type {
  PureDocument,
  DocumentModel,
  StructuredDocNode,
  FormattedRun,
  DocTableData,
  DocTableCell,
  DocPageLayoutSettings,
} from '../../types';
import { ProseMirrorAdapter } from './ProseMirrorAdapter';

export interface ParsedDocxResult {
  title: string;
  nodes: StructuredDocNode[];
  proseMirrorJson: any;
  documentModel: DocumentModel;
  pureDoc: PureDocument;
  layoutSettings?: DocPageLayoutSettings;
}

interface StyleMeta {
  name: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  isList?: boolean;
  isOrdered?: boolean;
  isQuote?: boolean;
  isCode?: boolean;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  size?: number;
  fontFamily?: string;
}

interface AbstractNumLevel {
  numFmt: string;
  lvlText?: string;
}

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  yellow: 'FFFF00',
  green: '00FF00',
  cyan: '00FFFF',
  magenta: 'FF00FF',
  blue: '0000FF',
  red: 'FF0000',
  darkBlue: '00008B',
  darkCyan: '008B8B',
  darkGreen: '006400',
  darkMagenta: '8B008B',
  darkRed: '8B0000',
  darkYellow: '808000',
  darkGray: '808080',
  lightGray: 'D3D3D3',
  black: '000000',
};

function parseXmlDocument(xml: string): any {
  if (typeof window !== 'undefined' && window.DOMParser) {
    return new window.DOMParser().parseFromString(xml, 'application/xml');
  }
  return new XMLDOMParser({
    onError: () => {},
  }).parseFromString(xml, 'application/xml');
}

function getNodeText(node: any): string {
  if (!node) return '';
  if (typeof node.textContent === 'string' && node.textContent) return node.textContent;
  if (typeof node.nodeValue === 'string' && node.nodeValue) return node.nodeValue;
  if (node.childNodes && node.childNodes.length > 0) {
    let s = '';
    for (let i = 0; i < node.childNodes.length; i++) {
      s += getNodeText(node.childNodes[i]);
    }
    return s;
  }
  return '';
}

function isTag(node: any, simpleName: string): boolean {
  if (!node || node.nodeType !== 1) return false;
  const name = (node.tagName || node.nodeName || '').toLowerCase();
  const local = (node.localName || '').toLowerCase();
  const target = simpleName.toLowerCase();
  return (
    name === target ||
    name === `w:${target}` ||
    name.endsWith(`:${target}`) ||
    local === target
  );
}

function getElements(parent: any, tagName: string): any[] {
  if (!parent) return [];
  const results: any[] = [];
  const targetLower = tagName.toLowerCase();
  const targetSimple = targetLower.replace(/^.*:/, '');

  const stack = [parent];
  while (stack.length > 0) {
    const curr = stack.shift();
    if (curr !== parent && curr.nodeType === 1) {
      if (isTag(curr, targetSimple)) {
        results.push(curr);
      }
    }
    if (curr.childNodes) {
      for (let i = 0; i < curr.childNodes.length; i++) {
        if (curr.childNodes[i].nodeType === 1) {
          stack.push(curr.childNodes[i]);
        }
      }
    }
  }
  return results;
}

function getFirstElement(parent: any, tagName: string): any | null {
  const els = getElements(parent, tagName);
  return els.length > 0 ? els[0] : null;
}

function getDirectChildren(parent: any, simpleName?: string): any[] {
  if (!parent || !parent.childNodes) return [];
  const res: any[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType === 1) {
      if (!simpleName || isTag(c, simpleName)) {
        res.push(c);
      }
    }
  }
  return res;
}

function getAttr(el: any, ...attrNames: string[]): string | null {
  if (!el || typeof el.getAttribute !== 'function') return null;
  for (const name of attrNames) {
    const val = el.getAttribute(name);
    if (val !== null && val !== undefined) return val;
    const targetSimple = name.replace(/^.*:/, '');
    const localVal = el.getAttribute(targetSimple);
    if (localVal !== null && localVal !== undefined) return localVal;
    const wVal = el.getAttribute(`w:${targetSimple}`);
    if (wVal !== null && wVal !== undefined) return wVal;
  }
  return null;
}

export class DocxParser {
  /**
   * Parse a DOCX binary (ArrayBuffer or Uint8Array) into Document AST and ProseMirror JSON.
   * Direct model bridge: DOCX OpenXML -> StructuredDocNode[] -> ProseMirror JSON.
   * Full OOXML compliant: Headings, Fonts, Colors, Alignments, Indents, Lists, Tables, Images, Spacing.
   */
  public static async parseDocx(
    data: ArrayBuffer | Uint8Array | Blob | any,
    fileName: string = ''
  ): Promise<ParsedDocxResult> {
    let zipInput = data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      zipInput = await data.arrayBuffer();
    } else if (data && typeof (data as any).arrayBuffer === 'function') {
      zipInput = await (data as any).arrayBuffer();
    }
    const zip = await JSZip.loadAsync(zipInput);

    // 1. Read word/_rels/document.xml.rels for media & hyperlinks
    const relsMap = new Map<string, string>();
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      try {
        const relsXml = await relsFile.async('string');
        const relsDoc = parseXmlDocument(relsXml);
        const relEls = getElements(relsDoc, 'Relationship');
        for (let i = 0; i < relEls.length; i++) {
          const el = relEls[i];
          const id = getAttr(el, 'Id');
          const target = getAttr(el, 'Target');
          if (id && target) {
            relsMap.set(id, target);
          }
        }
      } catch (err) {
        console.warn('Failed to parse document.xml.rels:', err);
      }
    }

    // 2. Read word/numbering.xml for lists (bullet vs ordered)
    const abstractNumMap = new Map<string, Map<number, AbstractNumLevel>>();
    const numIdMap = new Map<string, string>();
    const numberingFile = zip.file('word/numbering.xml');
    if (numberingFile) {
      try {
        const numXml = await numberingFile.async('string');
        const numDoc = parseXmlDocument(numXml);

        const abstractNumEls = getElements(numDoc, 'abstractNum');
        for (const absEl of abstractNumEls) {
          const absId = getAttr(absEl, 'w:abstractNumId', 'abstractNumId');
          if (!absId) continue;

          const levelMap = new Map<number, AbstractNumLevel>();
          const lvlEls = getElements(absEl, 'lvl');
          for (const lvlEl of lvlEls) {
            const ilvlStr = getAttr(lvlEl, 'w:ilvl', 'ilvl') || '0';
            const ilvl = parseInt(ilvlStr, 10);
            const numFmtEl = getFirstElement(lvlEl, 'numFmt');
            const numFmt = getAttr(numFmtEl, 'w:val', 'val') || 'decimal';
            const lvlTextEl = getFirstElement(lvlEl, 'lvlText');
            const lvlText = getAttr(lvlTextEl, 'w:val', 'val') || undefined;

            levelMap.set(ilvl, { numFmt: numFmt.toLowerCase(), lvlText });
          }
          abstractNumMap.set(absId, levelMap);
        }

        const numEls = getElements(numDoc, 'num');
        for (const nEl of numEls) {
          const numId = getAttr(nEl, 'w:numId', 'numId');
          const absRefEl = getFirstElement(nEl, 'abstractNumId');
          const absId = getAttr(absRefEl, 'w:val', 'val');
          if (numId && absId) {
            numIdMap.set(numId, absId);
          }
        }
      } catch (err) {
        console.warn('Failed to parse numbering.xml:', err);
      }
    }

    // Helper to determine list type for a given numId and ilvl
    const getListType = (numId: string, ilvl: number): 'bullet' | 'ordered' => {
      const absId = numIdMap.get(numId) || numId;
      if (absId) {
        const lvlMap = abstractNumMap.get(absId);
        const lvlInfo = lvlMap?.get(ilvl) || lvlMap?.get(0);
        if (lvlInfo) {
          const fmt = (lvlInfo.numFmt || '').toLowerCase();
          if (
            fmt === 'bullet' ||
            lvlInfo.lvlText === '' ||
            lvlInfo.lvlText === 'o' ||
            lvlInfo.lvlText === '§' ||
            lvlInfo.lvlText === '•'
          ) {
            return 'bullet';
          }
          return 'ordered';
        }
      }
      return 'ordered';
    };

    // 3. Read word/styles.xml for heading and style definitions
    const stylesMap = new Map<string, StyleMeta>();
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      try {
        const stylesXml = await stylesFile.async('string');
        const stylesDoc = parseXmlDocument(stylesXml);
        const styleEls = getElements(stylesDoc, 'style');
        for (let i = 0; i < styleEls.length; i++) {
          const s = styleEls[i];
          const styleId = getAttr(s, 'w:styleId', 'styleId');
          if (!styleId) continue;
          const nameEl = getFirstElement(s, 'name');
          const nameVal = getAttr(nameEl, 'w:val', 'val') || '';
          const lowerName = (nameVal || styleId).toLowerCase();
          const lowerId = styleId.toLowerCase();

          let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined;

          // Check outline level if present in style
          const pPrEl = getFirstElement(s, 'pPr');
          if (pPrEl) {
            const outlineLvlEl = getFirstElement(pPrEl, 'outlineLvl');
            if (outlineLvlEl) {
              const olVal = parseInt(getAttr(outlineLvlEl, 'w:val', 'val') || '-1', 10);
              if (olVal >= 0 && olVal <= 5) {
                headingLevel = (olVal + 1) as 1 | 2 | 3 | 4 | 5 | 6;
              }
            }
          }

          if (!headingLevel) {
            if (
              lowerName.includes('heading 1') ||
              lowerName === '1' ||
              lowerName === '标题 1' ||
              lowerName === '标题1' ||
              lowerId === 'heading1' ||
              lowerId === '1' ||
              lowerName === 'title' ||
              lowerName === '标题'
            ) {
              headingLevel = 1;
            } else if (
              lowerName.includes('heading 2') ||
              lowerName === '2' ||
              lowerName === '标题 2' ||
              lowerName === '标题2' ||
              lowerId === 'heading2' ||
              lowerId === '2' ||
              lowerName === 'subtitle' ||
              lowerName === '副标题'
            ) {
              headingLevel = 2;
            } else if (
              lowerName.includes('heading 3') ||
              lowerName === '3' ||
              lowerName === '标题 3' ||
              lowerName === '标题3' ||
              lowerId === 'heading3' ||
              lowerId === '3'
            ) {
              headingLevel = 3;
            } else if (
              lowerName.includes('heading 4') ||
              lowerName === '4' ||
              lowerName === '标题 4' ||
              lowerName === '标题4' ||
              lowerId === 'heading4' ||
              lowerId === '4'
            ) {
              headingLevel = 4;
            } else if (
              lowerName.includes('heading 5') ||
              lowerName === '5' ||
              lowerName === '标题 5' ||
              lowerName === '标题5' ||
              lowerId === 'heading5' ||
              lowerId === '5'
            ) {
              headingLevel = 5;
            } else if (
              lowerName.includes('heading 6') ||
              lowerName === '6' ||
              lowerName === '标题 6' ||
              lowerName === '标题6' ||
              lowerId === 'heading6' ||
              lowerId === '6'
            ) {
              headingLevel = 6;
            }
          }

          const isBullet =
            lowerName.includes('bullet') ||
            lowerName.includes('符号列表') ||
            lowerId.includes('bullet');
          const isOrdered =
            lowerName.includes('number') ||
            lowerName.includes('编号列表') ||
            lowerId.includes('number');
          const isQuote =
            lowerName.includes('quote') ||
            lowerName.includes('引用') ||
            lowerId.includes('quote');
          const isCode =
            lowerName.includes('code') ||
            lowerName.includes('preformatted') ||
            lowerName.includes('代码') ||
            lowerId.includes('code');

          // Extract default run formatting from style
          let bold = false;
          let italic = false;
          let color: string | undefined;
          let size: number | undefined;
          let fontFamily: string | undefined;

          const rPrEl = getFirstElement(s, 'rPr');
          if (rPrEl) {
            const bEl = getFirstElement(rPrEl, 'b');
            if (bEl && getAttr(bEl, 'w:val', 'val') !== '0' && getAttr(bEl, 'w:val', 'val') !== 'false') {
              bold = true;
            }
            const iEl = getFirstElement(rPrEl, 'i');
            if (iEl && getAttr(iEl, 'w:val', 'val') !== '0' && getAttr(iEl, 'w:val', 'val') !== 'false') {
              italic = true;
            }
            const colEl = getFirstElement(rPrEl, 'color');
            if (colEl) {
              const colVal = getAttr(colEl, 'w:val', 'val');
              if (colVal && colVal !== 'auto') color = colVal.toUpperCase();
            }
            const szEl = getFirstElement(rPrEl, 'sz');
            if (szEl) {
              const szNum = parseInt(getAttr(szEl, 'w:val', 'val') || '0', 10);
              if (szNum > 0) size = Math.round(szNum / 2);
            }
            const rFonts = getFirstElement(rPrEl, 'rFonts');
            if (rFonts) {
              fontFamily =
                getAttr(rFonts, 'w:eastAsia', 'eastAsia') ||
                getAttr(rFonts, 'w:ascii', 'ascii') ||
                getAttr(rFonts, 'w:hAnsi', 'hAnsi') ||
                undefined;
            }
          }

          stylesMap.set(styleId, {
            name: nameVal,
            headingLevel,
            isList: isBullet || isOrdered || lowerName.includes('list'),
            isOrdered,
            isQuote,
            isCode,
            bold: bold || undefined,
            italic: italic || undefined,
            color,
            size,
            fontFamily,
          });
        }
      } catch (err) {
        console.warn('Failed to parse styles.xml:', err);
      }
    }

    // 4. Read word/header*.xml and word/footer*.xml if present
    let headerText = '';
    let footerText = '';
    for (const fileNameInZip of Object.keys(zip.files)) {
      if (fileNameInZip.startsWith('word/header') && fileNameInZip.endsWith('.xml')) {
        try {
          const hXml = await zip.files[fileNameInZip].async('string');
          const hDoc = parseXmlDocument(hXml);
          const tEls = getElements(hDoc, 't');
          const texts = tEls.map((t) => getNodeText(t)).filter(Boolean);
          if (texts.length > 0 && !headerText) {
            headerText = texts.join(' ').trim();
          }
        } catch {}
      } else if (fileNameInZip.startsWith('word/footer') && fileNameInZip.endsWith('.xml')) {
        try {
          const fXml = await zip.files[fileNameInZip].async('string');
          const fDoc = parseXmlDocument(fXml);
          const tEls = getElements(fDoc, 't');
          const texts = tEls.map((t) => getNodeText(t)).filter(Boolean);
          if (texts.length > 0 && !footerText) {
            footerText = texts.join(' ').trim();
          }
        } catch {}
      }
    }

    // 5. Read word/document.xml
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      throw new Error('无效的 DOCX 文件：缺少 word/document.xml');
    }

    const docXml = await docFile.async('string');
    const docXmlDom = parseXmlDocument(docXml);
    const bodyEl = getFirstElement(docXmlDom, 'body');
    if (!bodyEl) {
      throw new Error('无效的 DOCX 文件：缺少 w:body 节点');
    }

    // Image cache and resolver
    const imageCache = new Map<string, string>();
    const resolveImageBase64 = async (rId: string): Promise<string | null> => {
      if (imageCache.has(rId)) return imageCache.get(rId)!;
      const target = relsMap.get(rId);
      if (!target) return null;

      let zipPath = target;
      if (zipPath.startsWith('../')) {
        zipPath = zipPath.replace('../', 'word/');
      } else if (!zipPath.startsWith('word/')) {
        zipPath = `word/${zipPath}`;
      }

      let imgFile = zip.file(zipPath);
      if (!imgFile) {
        // Fallback search
        const simpleName = zipPath.split('/').pop() || '';
        for (const k of Object.keys(zip.files)) {
          if (k.endsWith(simpleName)) {
            imgFile = zip.files[k];
            break;
          }
        }
      }

      if (!imgFile) return null;

      try {
        const base64 = await imgFile.async('base64');
        let mime = 'image/png';
        const lower = zipPath.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
        else if (lower.endsWith('.gif')) mime = 'image/gif';
        else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
        else if (lower.endsWith('.webp')) mime = 'image/webp';
        else if (lower.endsWith('.bmp')) mime = 'image/bmp';

        const dataUrl = `data:${mime};base64,${base64}`;
        imageCache.set(rId, dataUrl);
        return dataUrl;
      } catch (e) {
        console.warn('Failed to load image from zip:', zipPath, e);
        return null;
      }
    };

    const nodes: StructuredDocNode[] = [];

    // Helper to extract run styling and text
    const parseRunElement = (rEl: any): FormattedRun | null => {
      const rPr = getFirstElement(rEl, 'rPr');
      let bold = false;
      let italic = false;
      let underline = false;
      let strike = false;
      let color: string | undefined;
      let size: number | undefined;
      let fontFamily: string | undefined;
      let subscript = false;
      let superscript = false;
      let highlight: string | undefined;
      let vanished = false;

      if (rPr) {
        const vanishEl = getFirstElement(rPr, 'vanish');
        if (vanishEl) {
          const vVal = getAttr(vanishEl, 'w:val', 'val');
          if (vVal === null || vVal === undefined || (vVal !== '0' && vVal !== 'false')) {
            vanished = true;
          }
        }
        const bEl = getFirstElement(rPr, 'b') || getFirstElement(rPr, 'bCs');
        if (bEl && getAttr(bEl, 'w:val', 'val') !== '0' && getAttr(bEl, 'w:val', 'val') !== 'false') {
          bold = true;
        }
        const iEl = getFirstElement(rPr, 'i') || getFirstElement(rPr, 'iCs');
        if (iEl && getAttr(iEl, 'w:val', 'val') !== '0' && getAttr(iEl, 'w:val', 'val') !== 'false') {
          italic = true;
        }
        const uEl = getFirstElement(rPr, 'u');
        if (uEl && getAttr(uEl, 'w:val', 'val') !== 'none' && getAttr(uEl, 'w:val', 'val') !== '0') {
          underline = true;
        }
        const strikeEl = getFirstElement(rPr, 'strike') || getFirstElement(rPr, 'dstrike');
        if (strikeEl && getAttr(strikeEl, 'w:val', 'val') !== '0' && getAttr(strikeEl, 'w:val', 'val') !== 'false') {
          strike = true;
        }
        const colorEl = getFirstElement(rPr, 'color');
        if (colorEl) {
          const colVal = getAttr(colorEl, 'w:val', 'val');
          if (colVal && colVal !== 'auto') {
            color = colVal.replace('#', '').toUpperCase();
          }
        }
        const szEl = getFirstElement(rPr, 'sz') || getFirstElement(rPr, 'szCs');
        if (szEl) {
          const szVal = parseInt(getAttr(szEl, 'w:val', 'val') || '0', 10);
          if (szVal > 0) {
            size = Math.round(szVal / 2); // half-points to pt
          }
        }
        const rFonts = getFirstElement(rPr, 'rFonts');
        if (rFonts) {
          fontFamily =
            getAttr(rFonts, 'w:eastAsia', 'eastAsia') ||
            getAttr(rFonts, 'w:ascii', 'ascii') ||
            getAttr(rFonts, 'w:hAnsi', 'hAnsi') ||
            getAttr(rFonts, 'w:cs', 'cs') ||
            undefined;
        }
        const vertAlign = getFirstElement(rPr, 'vertAlign');
        if (vertAlign) {
          const v = getAttr(vertAlign, 'w:val', 'val');
          if (v === 'subscript') subscript = true;
          else if (v === 'superscript') superscript = true;
        }
        const highlightEl = getFirstElement(rPr, 'highlight');
        if (highlightEl) {
          const hlVal = getAttr(highlightEl, 'w:val', 'val');
          if (hlVal) {
            highlight = HIGHLIGHT_COLOR_MAP[hlVal] || hlVal.replace('#', '').toUpperCase();
          }
        }
        const shdEl = getFirstElement(rPr, 'shd');
        if (shdEl && !highlight) {
          const fill = getAttr(shdEl, 'w:fill', 'fill');
          if (fill && fill !== 'auto' && fill !== 'none' && fill !== 'clear') {
            highlight = fill.replace('#', '').toUpperCase();
          }
        }
      }

      // Extract text content and whitespace
      let textContent = '';
      if (rEl.childNodes) {
        for (let i = 0; i < rEl.childNodes.length; i++) {
          const child = rEl.childNodes[i];
          if (child.nodeType === 1) {
            if (isTag(child, 't')) {
              textContent += child.textContent || '';
            } else if (isTag(child, 'tab')) {
              textContent += '\t';
            } else if (isTag(child, 'br') || isTag(child, 'cr')) {
              const brType = getAttr(child, 'w:type', 'type');
              if (brType !== 'page') {
                textContent += '\n';
              }
            } else if (isTag(child, 'noBreakHyphen')) {
              textContent += '‑';
            } else if (isTag(child, 'softHyphen')) {
              textContent += '\u00AD';
            } else if (isTag(child, 'sym')) {
              const char = getAttr(child, 'w:char', 'char');
              if (char) {
                try {
                  textContent += String.fromCharCode(parseInt(char, 16));
                } catch {}
              }
            }
          }
        }
      }

      if (!textContent) return null;

      return {
        text: textContent,
        bold: bold || undefined,
        italic: italic || undefined,
        underline: underline || undefined,
        strike: strike || undefined,
        color,
        size,
        fontFamily,
        subscript: subscript || undefined,
        superscript: superscript || undefined,
        highlight,
        vanished: vanished || undefined,
      };
    };

    // Process a paragraph <w:p>
    const processParagraph = async (pEl: any): Promise<StructuredDocNode | null> => {
      const pPr = getFirstElement(pEl, 'pPr');
      let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
      let isBullet = false;
      let isOrdered = false;
      let isQuote = false;
      let isCode = false;
      let align: 'left' | 'center' | 'right' | 'justify' | undefined;
      let spacing: { before?: number; after?: number; line?: number } | undefined;
      let indent: { firstLine?: number; left?: number; right?: number } | undefined;

      if (pPr) {
        // Style check
        const pStyle = getFirstElement(pPr, 'pStyle');
        if (pStyle) {
          const styleId = getAttr(pStyle, 'w:val', 'val') || '';
          const meta = stylesMap.get(styleId);
          if (meta) {
            if (meta.headingLevel) headingLevel = meta.headingLevel;
            if (meta.isList) {
              if (meta.isOrdered) isOrdered = true;
              else isBullet = true;
            }
            if (meta.isQuote) isQuote = true;
            if (meta.isCode) isCode = true;
          }
        }

        // Outline level check directly on paragraph
        const outlineLvl = getFirstElement(pPr, 'outlineLvl');
        if (outlineLvl) {
          const lvlVal = parseInt(getAttr(outlineLvl, 'w:val', 'val') || '-1', 10);
          if (lvlVal >= 0 && lvlVal <= 5) {
            headingLevel = (lvlVal + 1) as 1 | 2 | 3 | 4 | 5 | 6;
          }
        }

        // Alignment
        const jc = getFirstElement(pPr, 'jc');
        if (jc) {
          const jcVal = getAttr(jc, 'w:val', 'val');
          if (jcVal === 'center') align = 'center';
          else if (jcVal === 'right') align = 'right';
          else if (jcVal === 'both' || jcVal === 'justify' || jcVal === 'distribute') align = 'justify';
          else align = 'left';
        }

        // Numbering / List detection
        const numPr = getFirstElement(pPr, 'numPr');
        if (numPr) {
          const numIdEl = getFirstElement(numPr, 'numId');
          const numId = numIdEl ? getAttr(numIdEl, 'w:val', 'val') : null;
          const ilvlEl = getFirstElement(numPr, 'ilvl');
          const ilvl = parseInt(getAttr(ilvlEl, 'w:val', 'val') || '0', 10);

          if (numId && numId !== '0') {
            const listType = getListType(numId, ilvl);
            if (listType === 'ordered') {
              isOrdered = true;
              isBullet = false;
            } else {
              isBullet = true;
              isOrdered = false;
            }
          }
        }

        // Spacing
        const spacingEl = getFirstElement(pPr, 'spacing');
        if (spacingEl) {
          const beforeVal = parseInt(getAttr(spacingEl, 'w:before', 'before') || '0', 10);
          const afterVal = parseInt(getAttr(spacingEl, 'w:after', 'after') || '0', 10);
          const lineVal = parseInt(getAttr(spacingEl, 'w:line', 'line') || '0', 10);
          spacing = {
            before: beforeVal > 0 ? Math.round(beforeVal / 20) : undefined,
            after: afterVal > 0 ? Math.round(afterVal / 20) : undefined,
            line: lineVal > 0 ? Number((lineVal / 240).toFixed(2)) : undefined,
          };
        }

        // Indentation (including Chinese 2-character indent)
        const indEl = getFirstElement(pPr, 'ind');
        if (indEl) {
          const firstLineChars = parseInt(getAttr(indEl, 'w:firstLineChars', 'firstLineChars') || '0', 10);
          const firstLine = parseInt(getAttr(indEl, 'w:firstLine', 'firstLine') || '0', 10);
          const left = parseInt(getAttr(indEl, 'w:left', 'left') || '0', 10);
          const right = parseInt(getAttr(indEl, 'w:right', 'right') || '0', 10);

          let firstLinePt = firstLine > 0 ? Math.round(firstLine / 20) : undefined;
          if (firstLineChars > 0 && !firstLinePt) {
            firstLinePt = Math.round((firstLineChars / 100) * 14); // Approximate ~28pt for 200 chars
          }

          if (firstLinePt || left > 0 || right > 0) {
            indent = {
              firstLine: firstLinePt,
              left: left > 0 ? Math.round(left / 20) : undefined,
              right: right > 0 ? Math.round(right / 20) : undefined,
            };
          }
        }

        // Page break before
        const pageBreakBefore = getFirstElement(pPr, 'pageBreakBefore');
        if (pageBreakBefore) {
          nodes.push({ type: 'page-break', runs: [] });
        }
      }

      // Extract runs, images, and page breaks from paragraph
      const runs: FormattedRun[] = [];
      const vanishedTexts: string[] = [];
      const images: { src: string; width?: number; height?: number; alt?: string; ocrText?: string }[] = [];
      let hasPageBreakRun = false;

      const walkParagraphElements = async (element: any) => {
        if (!element || !element.childNodes) return;

        for (let i = 0; i < element.childNodes.length; i++) {
          const child = element.childNodes[i];
          if (child.nodeType !== 1) continue;

          if (isTag(child, 'r')) {
            // Check for page break in run
            const brEls = getElements(child, 'br');
            for (const br of brEls) {
              if (getAttr(br, 'w:type', 'type') === 'page') {
                hasPageBreakRun = true;
              }
            }

            // Check for DrawingML pictures
            const blipEls = getElements(child, 'blip');
            if (blipEls.length > 0) {
              const docPrEl = getFirstElement(child, 'docPr');
              const docPrDescr = docPrEl ? getAttr(docPrEl, 'descr') || '' : '';
              const docPrTitle = docPrEl ? getAttr(docPrEl, 'title') || '' : '';
              const docPrName = docPrEl ? getAttr(docPrEl, 'name') || '' : '';
              const altText = docPrDescr || docPrTitle || docPrName || undefined;
              const ocrText = docPrDescr || undefined;

              for (const blip of blipEls) {
                const embedId = getAttr(blip, 'r:embed', 'embed') || getAttr(blip, 'r:link', 'link');
                if (embedId) {
                  const imgData = await resolveImageBase64(embedId);
                  if (imgData) {
                    let width: number | undefined;
                    let height: number | undefined;
                    const extentEl = getFirstElement(child, 'extent');
                    if (extentEl) {
                      const cx = parseInt(getAttr(extentEl, 'cx') || '0', 10);
                      const cy = parseInt(getAttr(extentEl, 'cy') || '0', 10);
                      if (cx > 0) width = Math.round(cx / 9525);
                      if (cy > 0) height = Math.round(cy / 9525);
                    }
                    images.push({ src: imgData, width, height, alt: altText, ocrText });
                  }
                }
              }
            }

            // Check for legacy VML pictures
            const imgDataEls = getElements(child, 'imagedata');
            for (const vmlImg of imgDataEls) {
              const rId = getAttr(vmlImg, 'r:id', 'id');
              if (rId) {
                const imgData = await resolveImageBase64(rId);
                if (imgData) {
                  images.push({ src: imgData });
                }
              }
            }

            const run = parseRunElement(child);
            if (run) {
              if (run.vanished) {
                vanishedTexts.push(run.text);
              } else {
                runs.push(run);
              }
            }
          } else if (isTag(child, 'hyperlink')) {
            // Hyperlink element containing runs
            const rEls = getElements(child, 'r');
            for (const r of rEls) {
              const run = parseRunElement(r);
              if (run) {
                if (run.vanished) {
                  vanishedTexts.push(run.text);
                } else {
                  runs.push(run);
                }
              }
            }
          } else if (isTag(child, 'drawing')) {
            // Direct drawing element in paragraph
            const blipEls = getElements(child, 'blip');
            if (blipEls.length > 0) {
              const docPrEl = getFirstElement(child, 'docPr');
              const docPrDescr = docPrEl ? getAttr(docPrEl, 'descr') || '' : '';
              const docPrTitle = docPrEl ? getAttr(docPrEl, 'title') || '' : '';
              const docPrName = docPrEl ? getAttr(docPrEl, 'name') || '' : '';
              const altText = docPrDescr || docPrTitle || docPrName || undefined;
              const ocrText = docPrDescr || undefined;

              for (const blip of blipEls) {
                const embedId = getAttr(blip, 'r:embed', 'embed') || getAttr(blip, 'r:link', 'link');
                if (embedId) {
                  const imgData = await resolveImageBase64(embedId);
                  if (imgData) {
                    let width: number | undefined;
                    let height: number | undefined;
                    const extentEl = getFirstElement(child, 'extent');
                    if (extentEl) {
                      const cx = parseInt(getAttr(extentEl, 'cx') || '0', 10);
                      const cy = parseInt(getAttr(extentEl, 'cy') || '0', 10);
                      if (cx > 0) width = Math.round(cx / 9525);
                      if (cy > 0) height = Math.round(cy / 9525);
                    }
                    images.push({ src: imgData, width, height, alt: altText, ocrText });
                  }
                }
              }
            }
          } else if (
            isTag(child, 'ins') ||
            isTag(child, 'smartTag') ||
            isTag(child, 'sdt') ||
            isTag(child, 'sdtContent') ||
            isTag(child, 'fldSimple')
          ) {
            // Recurse into nested containers
            await walkParagraphElements(child);
          }
        }
      };

      await walkParagraphElements(pEl);

      if (hasPageBreakRun) {
        nodes.push({ type: 'page-break', runs: [] });
      }

      // If images exist, push image nodes with alt and OCR text
      if (images.length > 0) {
        for (const img of images) {
          if (!img.ocrText && vanishedTexts.length > 0) {
            img.ocrText = vanishedTexts.join(' ').trim();
            if (!img.alt) img.alt = img.ocrText;
          }
          nodes.push({
            type: 'image',
            runs: [],
            imageData: {
              src: img.src,
              width: img.width,
              height: img.height,
              alt: img.alt,
              ocrText: img.ocrText,
            },
          });
        }
        if (runs.length === 0) {
          return null;
        }
      }

      const textOnly = runs.map((r) => r.text).join('').trim();
      if (!textOnly && images.length === 0) {
        return { type: 'paragraph', runs: [], align, spacing, indent };
      }

      if (headingLevel) {
        return { type: 'heading', level: headingLevel, runs, align, spacing, indent };
      }

      if (isBullet) {
        return { type: 'bullet', runs, align, spacing, indent };
      }

      if (isOrdered) {
        return { type: 'ordered', runs, align, spacing, indent };
      }

      if (isQuote) {
        return { type: 'quote', runs, align, spacing, indent };
      }

      if (isCode) {
        return { type: 'code', runs, align, spacing, indent };
      }

      return { type: 'paragraph', runs, align, spacing, indent };
    };

    // Process a table <w:tbl>
    const processTable = async (tblEl: any): Promise<StructuredDocNode> => {
      const tableRowsData: DocTableCell[][] = [];
      const trEls = getElements(tblEl, 'tr');

      // Grid tracking for vertical merges (rowspan)
      // colMergeMap: Map<colIndex, { startRowIdx: number; startCell: DocTableCell }>
      const colMergeMap = new Map<number, { startRowIdx: number; startCell: DocTableCell }>();

      for (let r = 0; r < trEls.length; r++) {
        const tr = trEls[r];
        const rowCells: DocTableCell[] = [];
        const trPr = getFirstElement(tr, 'trPr');
        const isHeader = !!getFirstElement(trPr, 'tblHeader');

        const tcEls = getElements(tr, 'tc');
        let currentVisualCol = 0;

        for (let c = 0; c < tcEls.length; c++) {
          const tc = tcEls[c];
          const tcPr = getFirstElement(tc, 'tcPr');

          let colSpan = 1;
          let bg: string | undefined;
          let vMerge: 'restart' | 'continue' | null = null;

          if (tcPr) {
            const gridSpan = getFirstElement(tcPr, 'gridSpan');
            if (gridSpan) {
              colSpan = parseInt(getAttr(gridSpan, 'w:val', 'val') || '1', 10);
            }
            const shd = getFirstElement(tcPr, 'shd');
            if (shd) {
              const fill = getAttr(shd, 'w:fill', 'fill');
              if (fill && fill !== 'auto' && fill !== 'none' && fill !== 'clear') {
                bg = fill.replace('#', '').toUpperCase();
              }
            }
            const vMergeEl = getFirstElement(tcPr, 'vMerge');
            if (vMergeEl) {
              const vmVal = getAttr(vMergeEl, 'w:val', 'val');
              vMerge = vmVal === 'restart' ? 'restart' : 'continue';
            }
          }

          // Extract text and runs from all paragraphs inside this cell
          const pEls = getElements(tc, 'p');
          const cellRuns: FormattedRun[] = [];
          const cellTexts: string[] = [];

          for (let p = 0; p < pEls.length; p++) {
            const pNode = await processParagraph(pEls[p]);
            if (pNode) {
              if (pNode.runs.length > 0) {
                cellRuns.push(...pNode.runs);
              }
              const t = pNode.runs.map((run) => run.text).join('');
              if (t) cellTexts.push(t);
            }
          }

          const cellText = cellTexts.join(' ');
          const isFirstRow = r === 0 || isHeader;

          const newCell: DocTableCell = {
            text: cellText,
            bold: isFirstRow || cellRuns.some((run) => run.bold),
            bg: bg || (isFirstRow ? 'F8FAFC' : undefined),
            colSpan: colSpan > 1 ? colSpan : undefined,
            runs: cellRuns.length > 0 ? cellRuns : undefined,
          };

          // Handle Vertical Merge / RowSpan
          if (vMerge === 'restart') {
            newCell.rowSpan = 1;
            colMergeMap.set(currentVisualCol, { startRowIdx: r, startCell: newCell });
            rowCells.push(newCell);
          } else if (vMerge === 'continue') {
            const existingMerge = colMergeMap.get(currentVisualCol);
            if (existingMerge) {
              existingMerge.startCell.rowSpan = (existingMerge.startCell.rowSpan || 1) + 1;
              if (cellText && !existingMerge.startCell.text.includes(cellText)) {
                existingMerge.startCell.text += ` ${cellText}`;
              }
            }
            // Do not insert merged continuation cell into DOM flow
          } else {
            colMergeMap.delete(currentVisualCol);
            rowCells.push(newCell);
          }

          currentVisualCol += colSpan;
        }

        if (rowCells.length > 0) {
          tableRowsData.push(rowCells);
        }
      }

      return {
        type: 'table',
        runs: [],
        tableData: { rows: tableRowsData },
      };
    };

    // Traverse body child nodes in sequential order
    const bodyChildren = getDirectChildren(bodyEl);
    for (let i = 0; i < bodyChildren.length; i++) {
      const el = bodyChildren[i];

      if (isTag(el, 'p')) {
        const node = await processParagraph(el);
        if (node) nodes.push(node);
      } else if (isTag(el, 'tbl')) {
        const node = await processTable(el);
        nodes.push(node);
      } else if (isTag(el, 'sdt')) {
        // Content Control wrapper
        const sdtContent = getFirstElement(el, 'sdtContent');
        if (sdtContent) {
          const sdtChildren = getDirectChildren(sdtContent);
          for (const sChild of sdtChildren) {
            if (isTag(sChild, 'p')) {
              const node = await processParagraph(sChild);
              if (node) nodes.push(node);
            } else if (isTag(sChild, 'tbl')) {
              const node = await processTable(sChild);
              nodes.push(node);
            }
          }
        }
      }
    }

    // Section Properties (Paper size, Margins, Orientation)
    let layoutSettings: DocPageLayoutSettings | undefined;
    const sectPrEl = getFirstElement(bodyEl, 'sectPr');
    if (sectPrEl || headerText || footerText) {
      let paperSize: 'A4' | 'Letter' | 'A3' | 'Legal' = 'A4';
      let orientation: 'portrait' | 'landscape' = 'portrait';
      let margins = { top: 36, bottom: 36, left: 36, right: 36 };

      if (sectPrEl) {
        const pgSzEl = getFirstElement(sectPrEl, 'pgSz');
        if (pgSzEl) {
          const w = parseInt(getAttr(pgSzEl, 'w:w', 'w') || '0', 10);
          const h = parseInt(getAttr(pgSzEl, 'w:h', 'h') || '0', 10);
          const orient = getAttr(pgSzEl, 'w:orient', 'orient');
          if (orient === 'landscape') orientation = 'landscape';

          // A4 = 11906 x 16838 dxa; Letter = 12240 x 15840 dxa
          if (w >= 14000 || h >= 20000) paperSize = 'A3';
          else if (Math.abs(w - 12240) < 500 && Math.abs(h - 15840) < 500) paperSize = 'Letter';
          else if (Math.abs(w - 12240) < 500 && Math.abs(h - 20160) < 500) paperSize = 'Legal';
          else paperSize = 'A4';
        }

        const pgMarEl = getFirstElement(sectPrEl, 'pgMar');
        if (pgMarEl) {
          const topDxa = parseInt(getAttr(pgMarEl, 'w:top', 'top') || '1440', 10);
          const bottomDxa = parseInt(getAttr(pgMarEl, 'w:bottom', 'bottom') || '1440', 10);
          const leftDxa = parseInt(getAttr(pgMarEl, 'w:left', 'left') || '1440', 10);
          const rightDxa = parseInt(getAttr(pgMarEl, 'w:right', 'right') || '1440', 10);

          margins = {
            top: Math.round(topDxa / 40),
            bottom: Math.round(bottomDxa / 40),
            left: Math.round(leftDxa / 40),
            right: Math.round(rightDxa / 40),
          };
        }
      }

      layoutSettings = {
        paperSize,
        orientation,
        margins,
        columns: 1,
        headerText: headerText || undefined,
        footerText: footerText || undefined,
        showPageNumbers: true,
      };
    }

    const baseTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : '未命名文档';
    const proseMirrorJson = ProseMirrorAdapter.structuredNodesToProseMirror(nodes);

    const documentModel: DocumentModel = {
      title: baseTitle,
      updatedAt: Date.now(),
      nodes,
      proseMirrorJson,
      layoutSettings,
    };

    const pureDoc: PureDocument = {
      id: `doc-${Date.now()}`,
      title: baseTitle,
      updatedAt: Date.now(),
      model: documentModel,
      nodes,
      proseMirrorJson,
      layoutSettings,
    };

    return {
      title: baseTitle,
      nodes,
      proseMirrorJson,
      documentModel,
      pureDoc,
      layoutSettings,
    };
  }
}
