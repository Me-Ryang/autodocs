/**
 * AI 스마트 견적서 - 로컬 서버 및 OpenRouter 프록시
 * Node.js 내장 모듈(http, fs, path, fetch)만 사용하여 별도의 npm install 없이 즉시 실행됩니다.
 *
 * 환경변수(.env):
 *   OPENROUTER_API_KEY=sk-or-v1-xxxx
 *   PORT=3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 1. .env 파일 파싱 (외부 의존성 없이 직접 로드) ──────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('.env 파일 로드 중 경고:', e.message);
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── 2. MIME 타입 매핑 ────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ─── 3. CORS 헤더 설정 ────────────────────────────────────────────────────────
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Title');
}

// ─── 4. HTTP 서버 생성 ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Pre-flight 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let pathname = '/';
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch (e) {
    pathname = req.url.split('?')[0];
  }

  // 4-1. Health Check API
  if (pathname === '/api/health' && req.method === 'GET') {
    const hasKey = Boolean(
      process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_API_KEY.trim() &&
      !process.env.OPENROUTER_API_KEY.includes('여기에_실제_키를_입력하세요')
    );
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        hasKey,
        port: PORT,
      })
    );
    return;
  }

  // 4-2. OpenRouter 프록시 API
  if (pathname === '/api/chat' && req.method === 'POST') {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey || !apiKey.trim() || apiKey.includes('여기에_실제_키를_입력하세요')) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          error: {
            message:
              '.env 파일에 유효한 OPENROUTER_API_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요.',
            code: 'MISSING_API_KEY',
          },
        })
      );
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { model, messages, temperature } = payload;

        if (!model || !messages) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: {
                message: '요청에 model과 messages 필드가 필요합니다.',
                code: 'BAD_REQUEST',
              },
            })
          );
          return;
        }

        const openRouterRes = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
            'HTTP-Referer':
              req.headers.origin || req.headers.referer || `http://localhost:${PORT}`,
            'X-Title': 'AI Smart Quotation Generator',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: temperature ?? 0.1,
          }),
        });

        const data = await openRouterRes.json();
        res.writeHead(openRouterRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (err) {
        console.error('[/api/chat] 프록시 오류:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: { message: `서버 프록시 내부 오류: ${err.message}`, code: 'PROXY_ERROR' },
          })
        );
      }
    });
    return;
  }

  // 4-3. 정적 파일 서빙
  if (req.method === 'GET' || req.method === 'HEAD') {
    const relativePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(path.join(__dirname, relativePath));

    // 상위 디렉터리 접근 방지
    if (!safePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(safePath).pipe(res);
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  const hasKey = Boolean(
    process.env.OPENROUTER_API_KEY &&
    process.env.OPENROUTER_API_KEY.trim() &&
    !process.env.OPENROUTER_API_KEY.includes('여기에_실제_키를_입력하세요')
  );
  console.log('=================================================');
  console.log(`🚀 AI 스마트 견적서 서버 실행 완료!`);
  console.log(`🌐 접속 주소: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${hasKey ? '✅ .env 로드 성공' : '❌ .env 키 없음'}`);
  console.log('=================================================');
});
