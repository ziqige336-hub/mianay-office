import type { OfficeFile, DocOutlineItem, DocumentModel } from '../types';
import { writerBridge, WriterDocumentStats } from '../core/office/WriterBridge';
import { officeEngine } from '../core/office/OfficeEngine';

export interface DocumentFormattingOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number; // in pt or px
  fontFamily?: string;
  color?: string;
  highlight?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
}

/**
 * DocumentService
 * 
 * High-level Lumina Feature Layer Service for Word Processor (Writer).
 * Provides programmatic text manipulation, selection querying, content replacement,
 * formatting, AI assistant hooks, and document persistence via WriterBridge & LibreOffice Engine.
 */
export class DocumentService {
  private static instance: DocumentService;
  private editorInstance: any = null;
  private currentDocFile: OfficeFile | null = null;

  private constructor() {}

  public static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  /**
   * Bind the active editor instance (e.g. Tiptap) for direct DOM/AST manipulation
   */
  public registerEditor(editor: any, file?: OfficeFile | null): void {
    this.editorInstance = editor;
    if (file) {
      this.currentDocFile = file;
    }
  }

  /**
   * Set active file metadata
   */
  public setCurrentFile(file: OfficeFile | null): void {
    this.currentDocFile = file;
  }

  /**
   * 1. getSelectedText()
   * Retrieves the currently selected text in the document editor.
   * If nothing is selected, returns an empty string or the word at cursor.
   */
  public getSelectedText(): string {
    if (this.editorInstance) {
      const { from, to } = this.editorInstance.state.selection;
      if (from !== to) {
        return this.editorInstance.state.doc.textBetween(from, to, ' ');
      }
    }
    // Fallback to window selection
    if (typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        return sel.toString();
      }
    }
    return '';
  }

  /**
   * 2. getDocumentText()
   * Retrieves the full plain text or structured content of the current document.
   */
  public getDocumentText(format: 'plain' | 'html' | 'markdown' = 'plain'): string {
    if (this.editorInstance) {
      if (format === 'html') {
        return this.editorInstance.getHTML();
      }
      return this.editorInstance.getText();
    }
    if (this.currentDocFile) {
      const content = this.currentDocFile.content;
      if (typeof content === 'string') {
        if (format === 'plain') {
          return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return content;
      }
    }
    return '';
  }

  /**
   * 3. replaceText()
   * Replaces either the currently selected text range or target search text with new content.
   * Typically invoked by AI Polish / Translate / Summarize / Rephrase features.
   */
  public replaceText(newText: string, targetText?: string): boolean {
    if (!this.editorInstance) {
      console.warn('DocumentService: No active editor bound for replaceText');
      return false;
    }

    try {
      if (targetText && targetText.trim()) {
        // Search & Replace occurrence
        const currentHtml = this.editorInstance.getHTML();
        if (currentHtml.includes(targetText)) {
          const updatedHtml = currentHtml.replace(targetText, newText);
          this.editorInstance.commands.setContent(updatedHtml, true);
          return true;
        }
      }

      // Default: Replace current selection
      const { from, to } = this.editorInstance.state.selection;
      if (from !== to) {
        this.editorInstance
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent(newText)
          .run();
        return true;
      }

      // If no selection, insert at current cursor
      this.editorInstance.chain().focus().insertContent(newText).run();
      return true;
    } catch (err) {
      console.error('DocumentService.replaceText failed:', err);
      return false;
    }
  }

  /**
   * 4. insertText()
   * Inserts text, paragraphs, tables, or markdown at the current cursor position.
   */
  public insertText(text: string, position?: 'cursor' | 'start' | 'end'): boolean {
    if (!this.editorInstance) {
      console.warn('DocumentService: No active editor bound for insertText');
      return false;
    }

    try {
      if (position === 'start') {
        this.editorInstance.chain().focus('start').insertContent(text).run();
      } else if (position === 'end') {
        this.editorInstance.chain().focus('end').insertContent(text).run();
      } else {
        this.editorInstance.chain().focus().insertContent(text).run();
      }
      return true;
    } catch (err) {
      console.error('DocumentService.insertText failed:', err);
      return false;
    }
  }

  /**
   * 5. formatSelection()
   * Applies rich styling and typographic formatting to the active selection.
   */
  public formatSelection(options: DocumentFormattingOptions): boolean {
    if (!this.editorInstance) {
      console.warn('DocumentService: No active editor bound for formatSelection');
      return false;
    }

    try {
      let chain = this.editorInstance.chain().focus();

      if (options.bold !== undefined) {
        chain = options.bold ? chain.setBold() : chain.unsetBold();
      }
      if (options.italic !== undefined) {
        chain = options.italic ? chain.setItalic() : chain.unsetItalic();
      }
      if (options.underline !== undefined) {
        chain = options.underline ? chain.setUnderline() : chain.unsetUnderline();
      }
      if (options.strikethrough !== undefined) {
        chain = options.strikethrough ? chain.setStrike() : chain.unsetStrike();
      }
      if (options.color) {
        chain = chain.setColor(options.color);
      }
      if (options.highlight) {
        chain = chain.setHighlight({ color: options.highlight });
      }
      if (options.fontFamily) {
        chain = chain.setFontFamily(options.fontFamily);
      }
      if (options.fontSize) {
        chain = chain.setFontSize(`${options.fontSize}pt`);
      }
      if (options.align) {
        chain = chain.setTextAlign(options.align);
      }

      chain.run();
      return true;
    } catch (err) {
      console.error('DocumentService.formatSelection failed:', err);
      return false;
    }
  }

  /**
   * Get document outline / Table of Contents
   */
  public getOutline(): DocOutlineItem[] {
    const html = this.getDocumentText('html');
    return writerBridge.extractOutline(html);
  }

  /**
   * Get document statistics (characters, words, paragraphs, tables)
   */
  public getStats(): WriterDocumentStats {
    const html = this.getDocumentText('html');
    return writerBridge.calculateStats(html);
  }

  /**
   * Perform AI Polishing workflow:
   * 1. Get selected text (or whole doc)
   * 2. Callback to AI / LLM
   * 3. Replace with polished output
   */
  public async executeAiPolish(
    aiWorker: (original: string) => Promise<string>,
    scope: 'selection' | 'document' = 'selection'
  ): Promise<{ original: string; polished: string; success: boolean }> {
    const textToPolish = scope === 'selection' ? this.getSelectedText() : this.getDocumentText('plain');
    if (!textToPolish.trim()) {
      throw new Error('未检测到要润色的文本内容，请先选中文本或输入内容');
    }

    const polishedResult = await aiWorker(textToPolish);
    if (polishedResult) {
      this.replaceText(polishedResult, scope === 'selection' ? undefined : textToPolish);
      return { original: textToPolish, polished: polishedResult, success: true };
    }
    return { original: textToPolish, polished: '', success: false };
  }

  /**
   * Save document to local disk or cache via LibreOffice Writer
   */
  public async saveDocument(): Promise<{ success: boolean; filename: string; size: number }> {
    if (!this.currentDocFile) {
      throw new Error('未载入可保存的文档');
    }
    const html = this.getDocumentText('html');
    const title = this.currentDocFile.name || '文档.docx';
    const result = await writerBridge.generateDocx(this.currentDocFile.id, html, title);
    return {
      success: true,
      filename: result.filename,
      size: result.size,
    };
  }

  /**
   * Export document to PDF via LibreOffice Writer Engine
   */
  public async exportPdf(options?: { title?: string; pdfa?: boolean }): Promise<Blob> {
    if (!this.currentDocFile) {
      throw new Error('未载入文档');
    }
    const html = this.getDocumentText('html');
    return await writerBridge.exportPdf(this.currentDocFile.id, html, options);
  }
}

export const documentService = DocumentService.getInstance();
