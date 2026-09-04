import type { Schema } from '@tiptap/pm/model';
import { getLuminaDocSchema } from './TiptapExtensions';

export interface ProseMirrorValidationReport {
  rootType: string;
  childCount: number;
  nodeTypes: string[];
  markTypes: string[];
  invalidNodes: string[];
  invalidAttrs: string[];
  invalidMarks: string[];
  isValid: boolean;
  errorMessage?: string;
}

export class ProseMirrorValidator {
  /**
   * Deep sanitize a ProseMirror JSON AST to guarantee schema compliance:
   * 1. Strips out invalid empty text nodes ({ type: 'text', text: '' }) which violate ProseMirror constraints.
   * 2. Ensures block containers (tableCell, tableHeader, listItem, blockquote) contain at least one valid child block.
   * 3. Cleans up empty marks and invalid attributes.
   */
  public static sanitizeProseMirrorJson(node: any): any {
    if (!node || typeof node !== 'object') {
      return null;
    }

    if (node.type === 'text') {
      if (typeof node.text !== 'string' || node.text.length === 0) {
        return null; // Eliminate zero-length text nodes
      }
      const cleanNode: any = { type: 'text', text: node.text };
      if (Array.isArray(node.marks) && node.marks.length > 0) {
        const validMarks = node.marks.filter((m: any) => m && typeof m.type === 'string');
        if (validMarks.length > 0) {
          cleanNode.marks = validMarks;
        }
      }
      return cleanNode;
    }

    const cleanNode: any = { type: node.type };
    if (node.attrs && typeof node.attrs === 'object') {
      const filteredAttrs: Record<string, any> = {};
      for (const [k, v] of Object.entries(node.attrs)) {
        if (v !== undefined && v !== null) {
          filteredAttrs[k] = v;
        }
      }
      if (Object.keys(filteredAttrs).length > 0) {
        cleanNode.attrs = filteredAttrs;
      }
    }

    if (Array.isArray(node.content)) {
      const sanitizedChildren: any[] = [];
      for (const child of node.content) {
        const cleanChild = this.sanitizeProseMirrorJson(child);
        if (cleanChild) {
          sanitizedChildren.push(cleanChild);
        }
      }

      // Enforce block content constraints for structural containers
      if (node.type === 'tableCell' || node.type === 'tableHeader' || node.type === 'listItem' || node.type === 'blockquote') {
        if (sanitizedChildren.length === 0) {
          sanitizedChildren.push({ type: 'paragraph' });
        }
      }

      if (sanitizedChildren.length > 0) {
        cleanNode.content = sanitizedChildren;
      } else if (node.type === 'paragraph' || node.type === 'heading') {
        // Empty paragraph or heading is represented as node without content
        delete cleanNode.content;
      }
    } else {
      if (node.type === 'tableCell' || node.type === 'tableHeader' || node.type === 'listItem' || node.type === 'blockquote') {
        cleanNode.content = [{ type: 'paragraph' }];
      }
    }

    return cleanNode;
  }

  /**
   * Validate ProseMirror JSON AST against the active Tiptap / ProseMirror Schema.
   * Produces a comprehensive validation summary report.
   */
  public static validate(
    jsonDoc: any,
    customSchema?: Schema
  ): { report: ProseMirrorValidationReport; sanitizedDoc: any } {
    const schema = customSchema || getLuminaDocSchema();

    if (!jsonDoc || typeof jsonDoc !== 'object' || jsonDoc.type !== 'doc') {
      const report: ProseMirrorValidationReport = {
        rootType: jsonDoc?.type || typeof jsonDoc,
        childCount: 0,
        nodeTypes: [],
        markTypes: [],
        invalidNodes: ['Root node is not of type "doc"'],
        invalidAttrs: [],
        invalidMarks: [],
        isValid: false,
        errorMessage: 'Invalid document: Root must be an object with type "doc"',
      };
      return { report, sanitizedDoc: jsonDoc };
    }

    const sanitizedDoc = this.sanitizeProseMirrorJson(jsonDoc) || { type: 'doc', content: [{ type: 'paragraph' }] };

    const detectedNodeTypes = new Set<string>();
    const detectedMarkTypes = new Set<string>();
    const invalidNodes: string[] = [];
    const invalidAttrs: string[] = [];
    const invalidMarks: string[] = [];

    const traverse = (node: any, path: string) => {
      if (!node || typeof node !== 'object') return;

      const nodeType = node.type;
      if (typeof nodeType === 'string') {
        detectedNodeTypes.add(nodeType);
        const schemaNodeType = schema.nodes[nodeType];
        if (!schemaNodeType) {
          invalidNodes.push(`${path}: Unknown node type "${nodeType}"`);
        } else {
          // Check node attrs
          if (node.attrs && typeof node.attrs === 'object') {
            const allowedAttrs = schemaNodeType.spec.attrs || {};
            for (const attrKey of Object.keys(node.attrs)) {
              if (!(attrKey in allowedAttrs)) {
                invalidAttrs.push(`${path} (${nodeType}): Unrecognized attribute "${attrKey}"`);
              }
            }
          }
        }
      } else {
        invalidNodes.push(`${path}: Missing or invalid "type" property`);
      }

      if (Array.isArray(node.marks)) {
        for (let m = 0; m < node.marks.length; m++) {
          const mark = node.marks[m];
          if (mark && typeof mark.type === 'string') {
            detectedMarkTypes.add(mark.type);
            const schemaMarkType = schema.marks[mark.type];
            if (!schemaMarkType) {
              invalidMarks.push(`${path}[mark ${m}]: Unknown mark type "${mark.type}"`);
            } else if (mark.attrs && typeof mark.attrs === 'object') {
              const allowedAttrs = schemaMarkType.spec.attrs || {};
              for (const attrKey of Object.keys(mark.attrs)) {
                if (!(attrKey in allowedAttrs)) {
                  invalidAttrs.push(`${path}[mark ${mark.type}]: Unrecognized mark attribute "${attrKey}"`);
                }
              }
            }
          } else {
            invalidMarks.push(`${path}[mark ${m}]: Invalid mark format`);
          }
        }
      }

      if (Array.isArray(node.content)) {
        node.content.forEach((child: any, idx: number) => {
          traverse(child, `${path} > ${child.type || 'unknown'}[${idx}]`);
        });
      }
    };

    traverse(sanitizedDoc, 'doc');

    let isValid = invalidNodes.length === 0 && invalidMarks.length === 0;
    let errorMessage: string | undefined;

    // Run ProseMirror native Schema Node validator
    try {
      const pmNode = schema.nodeFromJSON(sanitizedDoc);
      pmNode.check(); // Deep consistency check
    } catch (err: any) {
      isValid = false;
      errorMessage = err.message || 'ProseMirror schema validation failed';
      invalidNodes.push(`PM_SCHEMA_ERROR: ${errorMessage}`);
    }

    const childCount = Array.isArray(sanitizedDoc.content) ? sanitizedDoc.content.length : 0;

    const report: ProseMirrorValidationReport = {
      rootType: sanitizedDoc.type,
      childCount,
      nodeTypes: Array.from(detectedNodeTypes),
      markTypes: Array.from(detectedMarkTypes),
      invalidNodes,
      invalidAttrs,
      invalidMarks,
      isValid,
      errorMessage,
    };

    // Print real validation report log matching user specifications
    console.log('🔍 [Lumina DOCX ProseMirror Validation Report]:', {
      rootType: report.rootType,
      childCount: report.childCount,
      nodeTypes: report.nodeTypes,
      markTypes: report.markTypes,
      invalidNodes: report.invalidNodes,
      invalidAttrs: report.invalidAttrs,
      invalidMarks: report.invalidMarks,
      isValid: report.isValid,
    });

    return { report, sanitizedDoc };
  }
}
