import { createHash } from 'node:crypto';

export const ROUTINE_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const ROUTINE_SOURCE_MAX_CHARACTERS = 100_000;

export type RoutineSourceMime =
  | 'text/plain'
  | 'text/markdown'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type BinaryParser = (buffer: Buffer) => Promise<string>;

export type RoutineSourceExtractorInput = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string | null;
};

export type RoutineSourceExtraction = {
  text: string;
  mimeType: RoutineSourceMime;
  fileName: string | null;
  sha256: string;
  bytes: number;
  originalCharacters: number;
  truncated: boolean;
};

export type RoutineSourceErrorCode =
  | 'unsupported_type'
  | 'file_too_large'
  | 'empty_source'
  | 'extraction_failed';

export class RoutineSourceError extends Error {
  constructor(
    public readonly code: RoutineSourceErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RoutineSourceError';
  }
}

const SUPPORTED_MIMES = new Set<RoutineSourceMime>([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseXlsx(buffer: Buffer): Promise<string> {
  const { default: readExcelFile } = await import('read-excel-file/node');
  const sheets = await readExcelFile(buffer);

  const renderCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
  };

  return sheets
    .map((sheet) => [
      `Planilha: ${sheet.sheet}`,
      ...sheet.data.map((row) => row.map(renderCell).join('\t')),
    ].join('\n'))
    .join('\n\n');
}

const DEFAULT_PARSERS: Partial<Record<RoutineSourceMime, BinaryParser>> = {
  'application/pdf': parsePdf,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDocx,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': parseXlsx,
};

export class RoutineSourceExtractorService {
  private readonly parsers: Partial<Record<RoutineSourceMime, BinaryParser>>;

  constructor(options?: { parsers?: Partial<Record<RoutineSourceMime, BinaryParser>> }) {
    this.parsers = { ...DEFAULT_PARSERS, ...options?.parsers };
  }

  async extract(input: RoutineSourceExtractorInput): Promise<RoutineSourceExtraction> {
    if (input.buffer.byteLength > ROUTINE_SOURCE_MAX_BYTES) {
      throw new RoutineSourceError('file_too_large', 'O arquivo ultrapassa o limite de 10 MB.');
    }

    if (!SUPPORTED_MIMES.has(input.mimeType as RoutineSourceMime)) {
      throw new RoutineSourceError('unsupported_type', 'Use TXT, Markdown, PDF, DOCX ou XLSX.');
    }

    const mimeType = input.mimeType as RoutineSourceMime;
    let rawText: string;
    try {
      if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        rawText = input.buffer.toString('utf8');
      } else {
        const parser = this.parsers[mimeType];
        if (!parser) throw new Error(`Parser indisponível para ${mimeType}`);
        rawText = await parser(input.buffer);
      }
    } catch (error) {
      if (error instanceof RoutineSourceError) throw error;
      throw new RoutineSourceError('extraction_failed', 'Não foi possível ler este arquivo.', error);
    }

    const normalized = normalizeText(rawText);
    if (!normalized) {
      throw new RoutineSourceError('empty_source', 'O arquivo não contém texto utilizável.');
    }

    const originalCharacters = normalized.length;
    const truncated = originalCharacters > ROUTINE_SOURCE_MAX_CHARACTERS;

    return {
      text: truncated ? normalized.slice(0, ROUTINE_SOURCE_MAX_CHARACTERS) : normalized,
      mimeType,
      fileName: input.fileName?.trim() || null,
      sha256: createHash('sha256').update(input.buffer).digest('hex'),
      bytes: input.buffer.byteLength,
      originalCharacters,
      truncated,
    };
  }
}
