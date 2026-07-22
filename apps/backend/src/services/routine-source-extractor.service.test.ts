import assert from 'node:assert/strict';

import {
  RoutineSourceError,
  RoutineSourceExtractorService,
} from './routine-source-extractor.service';

async function run() {
  const service = new RoutineSourceExtractorService();

  {
    const result = await service.extract({
      buffer: Buffer.from('  Meta: terminar o site.\r\n\r\nTarefa: revisar a home.  ', 'utf8'),
      mimeType: 'text/plain',
      fileName: 'rotina.txt',
    });
    assert.equal(result.text, 'Meta: terminar o site.\n\nTarefa: revisar a home.');
    assert.equal(result.truncated, false);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
  }

  {
    await assert.rejects(
      () => service.extract({
        buffer: Buffer.from('executável'),
        mimeType: 'application/x-msdownload',
        fileName: 'rotina.exe',
      }),
      (error: unknown) => error instanceof RoutineSourceError && error.code === 'unsupported_type',
    );
  }

  {
    await assert.rejects(
      () => service.extract({
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        mimeType: 'application/pdf',
        fileName: 'grande.pdf',
      }),
      (error: unknown) => error instanceof RoutineSourceError && error.code === 'file_too_large',
    );
  }

  {
    const result = await service.extract({
      buffer: Buffer.from('a'.repeat(100_010)),
      mimeType: 'text/markdown',
      fileName: 'grande.md',
    });
    assert.equal(result.text.length, 100_000);
    assert.equal(result.originalCharacters, 100_010);
    assert.equal(result.truncated, true);
  }

  {
    let receivedBytes = 0;
    const withPdfParser = new RoutineSourceExtractorService({
      parsers: {
        'application/pdf': async (buffer) => {
          receivedBytes = buffer.length;
          return 'Projeto mudança\nComprar tinta';
        },
      },
    });
    const result = await withPdfParser.extract({
      buffer: Buffer.from('%PDF-fake'),
      mimeType: 'application/pdf',
      fileName: 'mudanca.pdf',
    });
    assert.equal(receivedBytes, 9);
    assert.equal(result.text, 'Projeto mudança\nComprar tinta');
  }

  console.log('routine-source-extractor.service tests passed');
}

void run();
