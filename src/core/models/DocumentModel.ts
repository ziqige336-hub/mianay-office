import type {
  FormattedRun,
  DocTableData,
  StructuredDocNode,
  DocPageLayoutSettings,
  DocBlock,
} from '../../types';

export interface DocumentMetadata {
  id?: string;
  title?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface DocumentModel {
  id?: string;
  metadata?: DocumentMetadata;
  title: string;
  pages?: number;
  blocks?: StructuredDocNode[];
  nodes: StructuredDocNode[]; // Unified AST nodes
  styles?: Record<string, any>;
  layout?: DocPageLayoutSettings;
  layoutSettings?: DocPageLayoutSettings;
  updatedAt: number;
}

/**
 * Real-time Data Flow Tracer for Lumina SSOT Architecture
 */
export class DocumentModelTracer {
  public static traceInputToModel(
    inputRaw: string | object,
    source: string,
    model: DocumentModel
  ): void {
    const blockCount = model.blocks?.length ?? model.nodes?.length ?? 0;
    console.log('====================================================');
    console.log('🔄 [Lumina SSOT Data Tracking]');
    console.log(`Editor Input:     [${source}] ${typeof inputRaw === 'string' ? inputRaw.substring(0, 100) : JSON.stringify(inputRaw).substring(0, 100)}`);
    console.log('↓');
    console.log(`Adapter:          ProseMirrorAdapter / StructuredDocAdapter`);
    console.log('↓');
    console.log(`DocumentModel:    ID: ${model.id || 'doc-active'}, Title: "${model.title}", Blocks Count: ${blockCount}, Updated: ${new Date(model.updatedAt).toISOString()}`);
    console.log('↓');
    console.log(`Export Source:    DocumentModel (Zero HTML intermediate / Zero DOM parsing)`);
    console.log('====================================================');
  }
}
