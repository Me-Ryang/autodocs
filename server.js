/**
 * AI 스마트 견적서 - 백엔드 프록시 서버
 * OpenRouter API Key를 환경변수로 관리하여 클라이언트에 노출하지 않음.
 *
 * 환경변수 설정 방법:
 *   - .env 파일 생성 후: OPENROUTER_API_KEY=sk-or-v1-xxxxx
 *   - 또는 배포 플랫폼(Vercel, Railway, Render 등)의 환경변수 설정 UI 사용
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (index.html, style.css, app.js)
app.use(express.static(path.join(__dirname)));

// ─── OpenRouter 프록시 API ────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: '서버에 OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다. 서버 관리자에게 문의해 주세요.',
        code: 'MISSING_API_KEY',
      },
    });
  }

  const { model, messages, temperature } = req.body;

  if (!model || !messages) {
    return res.status(400).json({
      error: { message: '요청에 model과 messages 필드가 필요합니다.', code: 'BAD_REQUEST' },
    });
  }

  try {
    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'http://localhost:3000',
        'X-Title': 'AI Smart Quotation Generator',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.1,
      }),
    });

    const data = await openRouterRes.json();

    if (!openRouterRes.ok) {
      return res.status(openRouterRes.status).json({ error: data.error || data });
    }

    return res.json(data);
  } catch (err) {
    console.error('[/api/chat] 프록시 오류:', err);
    return res.status(500).json({
      error: { message: `서버 내부 오류: ${err.message}`, code: 'PROXY_ERROR' },
    });
  }
});

// ─── 서버 시작 ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const keyStatus = process.env.OPENROUTER_API_KEY
    ? '✅ OPENROUTER_API_KEY 환경변수 확인됨'
    : '❌ OPENROUTER_API_KEY 환경변수 없음 - .env 파일 또는 배포 환경변수를 확인하세요';

  console.log(`🚀 AI 스마트 견적서 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   ${keyStatus}`);
});
