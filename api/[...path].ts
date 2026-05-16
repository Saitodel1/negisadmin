import app from '../server/index';

export default function handler(req: any, res: any) {
  const path = req.query?.path;
  const suffix = Array.isArray(path) ? path.join('/') : String(path || '');
  const queryIndex = req.url.indexOf('?');
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';

  req.url = suffix ? `/api/${suffix}${query}` : `/api${query}`;
  return app(req, res);
}
