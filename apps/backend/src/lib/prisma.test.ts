import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveDatabaseUrl } from './prisma';

const SRC = path.resolve(__dirname, '..');

function arquivosTs(dir: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) arquivosTs(completo, encontrados);
    else if (entrada.name.endsWith('.ts')) encontrados.push(completo);
  }
  return encontrados;
}

/**
 * Um pool por processo, e o dono dele é `lib/prisma.ts`.
 *
 * Havia nove `new PrismaClient()` espalhados, cada um com o próprio pool de 5
 * conexões. O `P2024` em produção não era banco cheio: era o pool de uma rota
 * estourando enquanto os outros oito estavam parados segurando as conexões
 * deles. Um cliente novo é barato de escrever e o efeito só aparece sob carga,
 * então a regra precisa de guarda automática.
 */
{
  const infratores: string[] = [];
  for (const arquivo of arquivosTs(SRC)) {
    const relativo = path.relative(SRC, arquivo).split(path.sep).join('/');
    if (relativo === 'lib/prisma.ts' || relativo === 'lib/prisma.test.ts') continue;

    const conteudo = readFileSync(arquivo, 'utf8');
    conteudo.split('\n').forEach((linha, indice) => {
      // Ignora comentário: os arquivos explicam o histórico citando a chamada.
      const semComentario = linha.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
      if (/new PrismaClient\s*\(/.test(semComentario)) {
        infratores.push(`${relativo}:${indice + 1}`);
      }
    });
  }

  assert.deepEqual(
    infratores,
    [],
    `só lib/prisma.ts pode instanciar o PrismaClient; importe { prisma } de lib/prisma. Infratores: ${infratores.join(', ')}`,
  );
}

// O limite explícito existe porque, sem ele, o Prisma deriva `núcleos × 2 + 1`
// — no contêiner de produção isso dava 5, número que descreve a CPU e não o
// banco. Atrás do pooler do Supabase (pgbouncer, porta 6543) a conexão do app é
// barata e o app se limitava sozinho.
{
  const resolvida = resolveDatabaseUrl('postgresql://u:p@host:6543/db?pgbouncer=true');
  assert.ok(resolvida);
  const url = new URL(resolvida);
  assert.equal(url.searchParams.get('connection_limit'), '20');
  assert.equal(url.searchParams.get('pgbouncer'), 'true', 'os parâmetros existentes precisam sobreviver');
}

// Quem configurou o ambiente sabe mais que o padrão do código.
{
  const original = 'postgresql://u:p@host:6543/db?connection_limit=3';
  assert.equal(resolveDatabaseUrl(original), original);
}

{
  assert.equal(resolveDatabaseUrl(undefined), undefined);
  // URL malformada volta como veio, para o Prisma falhar com a mensagem dele.
  assert.equal(resolveDatabaseUrl('nao-e-url'), 'nao-e-url');
}

console.log('lib/prisma tests passed');
