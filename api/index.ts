import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

/**
 * Função serverless da Vercel: atende todas as rotas /api/* com a mesma aplicação Express do servidor local.
 * A conexão com o banco é criada uma vez por instância e reaproveitada entre as requisições.
 * As migrações não rodam aqui: são aplicadas uma vez com `npm run db:migrate`.
 */
let app: Promise<Express> | undefined;

function getApp(): Promise<Express> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return Promise.reject(new Error('DATABASE_URL não configurada nas variáveis de ambiente da Vercel.'));
  return (app ??= openDatabase(url, { migrate: false })
    .then((db) => createApp(db).app)
    .catch((error) => {
      app = undefined;
      throw error;
    }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const express = await getApp();
    express(req as Parameters<Express>[0], res as Parameters<Express>[1]);
  } catch (error) {
    console.error('[SEICE] Falha ao iniciar a API:', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'database_unavailable', message: 'O servidor do SEICE não conseguiu acessar o banco de dados. Tente novamente em instantes.' } }));
  }
}
