import type { RequestHandler } from 'express';

export const pagesOrigin = 'https://tyhcch1234.github.io';

/** Public, read-only catalogue; never enables cross-site authentication cookies. */
export const catalogCors: RequestHandler = (req, res, next) => {
  const permitted = req.get('Origin') === pagesOrigin;
  res.vary('Origin');
  if (permitted) {
    res.set('Access-Control-Allow-Origin', pagesOrigin);
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Accept');
  }
  if (req.method === 'OPTIONS') {
    res.status(permitted ? 204 : 403).end();
    return;
  }
  next();
};
