import express, { type Express } from 'express';
import fs from 'fs';
import { type Server } from 'http';
import { nanoid } from 'nanoid';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import viteConfig from '../../vite.config';
import { injectCatalog } from '../catalog';

export async function setupVite(app: Express, server: Server) {
  const projectRoot = path.resolve(import.meta.dirname, '../..');
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      ...viteConfig.server,
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
      watch: {
        followSymlinks: false,
        ignored: (watchedPath: string) => {
          const absolutePath = path.resolve(watchedPath);
          return absolutePath !== projectRoot && !absolutePath.startsWith(projectRoot + path.sep);
        },
      },
    },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, '../..', 'client', 'index.html');
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace('src="/src/main.tsx"', `src="/src/main.tsx?v=${nanoid()}"`);
      const isHome = req.originalUrl.split('?')[0] === '/';
      if (isHome) template = await injectCatalog(template);
      else template = template.replace('</head>', '<meta name="robots" content="noindex" /></head>');
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(isHome ? 200 : 404).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = process.env.NODE_ENV === 'development'
    ? path.resolve(import.meta.dirname, '../..', 'dist', 'public')
    : path.resolve(import.meta.dirname, 'public');
  if (!fs.existsSync(distPath)) console.error(`Build directory missing: ${distPath}`);
  app.get('/', async (_req, res) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, 'index.html'), 'utf8');
      const html = await injectCatalog(template);
      res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=0' }).send(html);
    } catch {
      res.status(503).type('html').send('<!doctype html><html lang="zh-HK"><head><meta name="robots" content="noindex"><title>AI 精選指南｜暫時未能讀取</title></head><body><h1>暫時未能讀取工具資料</h1><p>請稍後重新整理頁面。</p></body></html>');
    }
  });
  app.use(express.static(distPath, { index: false }));
  app.use('*', async (_req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, 'index.html'), 'utf8');
      res.status(404).type('html').send(template.replace('</head>', '<meta name="robots" content="noindex" /></head>'));
    } catch (error) { next(error); }
  });
}
