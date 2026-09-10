/**
 * AI Smart Quotation Generator - Core Application Logic
 * 백엔드 프록시(/api/chat)를 통해 OpenRouter를 호출합니다.
 * API Key는 서버 환경변수(OPENROUTER_API_KEY)로 관리하며 클라이언트에 노출되지 않습니다.
 */

(function () {
  'use strict';

  // ==========================================
  // 1. Constants & State Management
  // ==========================================
  const STORAGE_KEYS = {
    SUPPLIER: 'ai_quote_supplier_profile',
    MODEL: 'ai_quote_selected_model',
  };

  // 사용할 AI 모델 (서버에서 환경변수로 관리하지만 클라이언트에서도 변경 가능)
  const DEFAULT_MODELS = {
    PRIMARY: 'deepseek/deepseek-chat',
    FALLBACKS: [
      'google/gemini-flash-1.5',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  };

  // 백엔드 프록시 엔드포인트
  const API_ENDPOINT = '/api/chat';

  const state = {
    selectedModel: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODELS.PRIMARY,
    isVatIncluded: false, // false: 부가세 별도, true: 부가세 포함
    isRecording: false,
    recognition: null,
    supplier: {
      name: '',
      ceo: '',
      bizNum: '',
      phone: '',
      address: '',
      email: '',
    },
    items: [
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
    ],
  };

  // Sample Scenarios for Fast Testing
  const SAMPLES = {
    website: `안녕하세요, (주)넥스트커머스 박민수 팀장입니다.
이번에 자사 반응형 공식 브랜드몰 및 모바일 웹 구축 프로젝트 견적 요청드립니다.
항목은 다음과 같이 구분해 주세요:
1. UI/UX 반응형 웹 디자인 (메인 및 서브 15P) - 1식 2,800,000원
2. 프론트엔드 퍼블리싱 및 인터랙션 구현 - 1식 2,200,000원
3. 쇼핑몰 PG 결제 및 백엔드 API 연동 - 1식 3,000,000원
4. 클라우드 서버 구축 및 도메인/SSL 세팅 - 1식 500,000원
견적일자는 오늘로 해주시고, 부가세는 별도로 계산해 주세요.
유효기간은 견적일로부터 30일이며, 납기는 계약일로부터 6주 이내입니다.
대금 결제조건은 계약금 50%, 완료 후 검수 시 잔금 50% 입금 조건입니다.`,

    interior: `강남구 역삼동 스타트업 공유오피스 인테리어 원복 및 부분 리모델링 건 견적서 작성 요청.
수신: (주)퓨처벤처스 최진호 대표님
견적명: 역삼 사옥 5층 인테리어 공사
품목 내역:
- 기존 가벽 철거 및 폐기물 처리: 1식 1,800,000원
- 흡음 방음벽 및 유리 파티션 시공: 수량 4개, 단가 650,000원 (2,600,000원)
- 바닥 친환경 데코타일 시공 (35평): 수량 35, 단가 45,000원 (1,575,000원)
- LED 라인 조명 및 전기 배선 증설 공사: 1식 1,200,000원
- 전체 친환경 수성 페인트 도장 공사: 1식 1,500,000원
부가세 10% 별도이며, 공사 기간은 착공 후 10일 소요 예정. 참조사항에 공사 하자보수 보증기간 1년 명시해 주세요.`,

    coffee: `카페 '블루웨이브' 성수점 대표님 앞 정기 원두 납품 견적서입니다.
품목:
- 시그니처 블렌드 원두 (에티오피아+콜롬비아 1kg): 수량 30봉, 단가 28,000원
- 싱글 오리진 디카페인 원두 (1kg): 수량 10봉, 단가 32,000원
- 100% 생분해 테이크아웃 친환경 컵 16oz (박스당 1,000개): 수량 5박스, 단가 65,000원
- 유기농 바닐라 시럽 1L: 수량 12병, 단가 14,000원
부가세 포함 금액으로 처리해 주시고, 매주 화요일 정기 직배송 조건입니다. 결제는 매월 말일 마감 익월 10일 결제입니다.`,

    marketing: `(주)트렌디패션 마케팅실 귀하.
2026 F/W 시즌 바이럴 마케팅 및 숏폼 영상 제작 대행 견적입니다.
1. 인스타그램 릴스 & 틱톡 숏폼 영상 기획/촬영/편집: 수량 8편, 단가 400,000원
2. 패션 전문 인플루언서(팔로워 5만 이상) 시딩 협찬 집행: 수량 15명, 단가 200,000원
3. 메타(Meta) 인스타그램 광고 퍼포먼스 세팅 및 리포트: 1식 1,500,000원
부가세 별도이며 견적 유효기간은 14일입니다. 참조사항: 원본 촬영 영상 소스 무상 제공 포함.`,
  };

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const dom = {
    sampleBtn: document.getElementById('sampleBtn'),
    sampleMenu: document.getElementById('sampleMenu'),
    clearBtn: document.getElementById('clearBtn'),
    printBtn: document.getElementById('printBtn'),

    micBtn: document.getElementById('micBtn'),
    sttBox: document.querySelector('.stt-box'),
    sttStatus: document.getElementById('sttStatus'),
    sttSubStatus: document.getElementById('sttSubStatus'),
    rawInput: document.getElementById('rawInput'),
    charCount: document.getElementById('charCount'),
    clearInputBtn: document.getElementById('clearInputBtn'),
    processBtn: document.getElementById('processBtn'),
    statusBanner: document.getElementById('statusBanner'),
    statusMessage: document.getElementById('statusMessage'),

    supplierToggle: document.getElementById('supplierToggle'),
    myCompany: document.getElementById('myCompany'),
    myCeo: document.getElementById('myCeo'),
    myBizNum: document.getElementById('myBizNum'),
    myPhone: document.getElementById('myPhone'),
    myAddress: document.getElementById('myAddress'),
    myEmail: document.getElementById('myEmail'),
    saveSupplierBtn: document.getElementById('saveSupplierBtn'),

    addRowBtn: document.getElementById('addRowBtn'),
    fillVatToggle: document.getElementById('fillVatToggle'),
    vatModeLabel: document.getElementById('vatModeLabel'),

    docRecipient: document.getElementById('docRecipient'),
    docQuoteTitle: document.getElementById('docQuoteTitle'),
    docQuoteDateYear: document.getElementById('docQuoteDateYear'),
    docQuoteDateMonth: document.getElementById('docQuoteDateMonth'),
    docQuoteDateDay: document.getElementById('docQuoteDateDay'),
    docValidUntil: document.getElementById('docValidUntil'),

    docSupplierName: document.getElementById('docSupplierName'),
    docSupplierCeo: document.getElementById('docSupplierCeo'),
    docSupplierBizNum: document.getElementById('docSupplierBizNum'),
    docSupplierPhone: document.getElementById('docSupplierPhone'),
    docSupplierAddress: document.getElementById('docSupplierAddress'),
    docSupplierEmail: document.getElementById('docSupplierEmail'),

    docKoreanAmount: document.getElementById('docKoreanAmount'),
    docNumberAmount: document.getElementById('docNumberAmount'),
    vatIncludedText: document.getElementById('vatIncludedText'),

    itemsTableBody: document.getElementById('itemsTableBody'),
    tableTotalQty: document.getElementById('tableTotalQty'),
    tableTotalAmount: document.getElementById('tableTotalAmount'),
    tableTotalVat: document.getElementById('tableTotalVat'),

    docRemarks: document.getElementById('docRemarks'),
    summarySupplyPrice: document.getElementById('summarySupplyPrice'),
    summaryVat: document.getElementById('summaryVat'),
    summaryGrandTotal: document.getElementById('summaryGrandTotal'),
  };

  // ==========================================
  // 3. Number & Currency Utilities
  // ==========================================
  function formatNumber(num) {
    if (isNaN(num) || num === null || num === undefined || num === '') return '0';
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  }

  function parseFormattedNumber(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = String(str).replace(/[^0-9.-]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }

  function numberToKoreanWon(number) {
    const num = Math.round(parseFormattedNumber(number));
    if (num <= 0) return '영';

    const units = ['', '만', '억', '조'];
    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const subUnits = ['', '십', '백', '천'];

    let result = '';
    let unitIndex = 0;
    let temp = num;

    while (temp > 0) {
      const chunk = temp % 10000;
      if (chunk > 0) {
        let chunkStr = '';
        const chunkDigits = String(chunk).padStart(4, '0');

        for (let i = 0; i < 4; i++) {
          const d = parseInt(chunkDigits[i], 10);
          if (d > 0) {
            const digitChar = (d === 1 && i < 3 && chunk >= 10) ? '' : digits[d];
            chunkStr += digitChar + subUnits[3 - i];
          }
        }
        result = chunkStr + units[unitIndex] + ' ' + result;
      }
      temp = Math.floor(temp / 10000);
      unitIndex++;
    }

    return result.trim();
  }

  function setTodayDate() {
    const today = new Date();
    dom.docQuoteDateYear.value = today.getFullYear();
    dom.docQuoteDateMonth.value = String(today.getMonth() + 1).padStart(2, '0');
    dom.docQuoteDateDay.value = String(today.getDate()).padStart(2, '0');
  }

  // ==========================================
  // 4. Quotation Table & Calculations
  // ==========================================
  function renderTableRows() {
    dom.itemsTableBody.innerHTML = '';

    while (state.items.length < 8) {
      state.items.push({ item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 });
    }

    state.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.dataset.index = index;

      tr.innerHTML = `
        <td><input type="text" class="item-input row-item" value="${escapeHtml(item.item || '')}" placeholder="품목명"></td>
        <td><input type="text" class="item-input row-desc" value="${escapeHtml(item.description || '')}" placeholder="규격/세부내용"></td>
        <td><input type="text" class="item-input text-center row-qty font-mono" value="${item.qty !== '' ? item.qty : ''}" placeholder="1"></td>
        <td><input type="text" class="item-input text-right row-price font-mono" value="${item.unitPrice ? formatNumber(item.unitPrice) : ''}" placeholder="0"></td>
        <td><input type="text" class="item-input text-right row-amount font-mono" value="${item.amount ? formatNumber(item.amount) : ''}" readonly tabindex="-1"></td>
        <td><input type="text" class="item-input text-right row-vat font-mono" value="${item.vat ? formatNumber(item.vat) : ''}" readonly tabindex="-1"></td>
        <td class="text-center no-print">
          <button type="button" class="row-delete-btn" title="이 행 삭제" data-index="${index}">&times;</button>
        </td>
      `;

      dom.itemsTableBody.appendChild(tr);
    });

    attachRowEvents();
    recalculateAll();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function attachRowEvents() {
    const rows = dom.itemsTableBody.querySelectorAll('tr');

    rows.forEach((tr) => {
      const index = parseInt(tr.dataset.index, 10);
      const itemInput = tr.querySelector('.row-item');
      const descInput = tr.querySelector('.row-desc');
      const qtyInput = tr.querySelector('.row-qty');
      const priceInput = tr.querySelector('.row-price');
      const deleteBtn = tr.querySelector('.row-delete-btn');

      itemInput.addEventListener('input', (e) => {
        state.items[index].item = e.target.value;
      });

      descInput.addEventListener('input', (e) => {
        state.items[index].description = e.target.value;
      });

      qtyInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9.]/g, '');
        state.items[index].qty = val;
        computeRow(index);
      });

      priceInput.addEventListener('input', (e) => {
        const raw = parseFormattedNumber(e.target.value);
        state.items[index].unitPrice = raw;
        computeRow(index);
      });

      priceInput.addEventListener('blur', (e) => {
        const raw = parseFormattedNumber(e.target.value);
        if (raw > 0) {
          e.target.value = formatNumber(raw);
        }
      });

      deleteBtn.addEventListener('click', () => {
        if (state.items.length > 1) {
          state.items.splice(index, 1);
          renderTableRows();
        } else {
          state.items[0] = { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 };
          renderTableRows();
        }
      });
    });
  }

  function computeRow(index) {
    const item = state.items[index];
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.unitPrice) || 0;

    let amount = 0;
    let vat = 0;

    if (qty > 0 && price > 0) {
      if (state.isVatIncluded) {
        const total = qty * price;
        amount = Math.round(total / 1.1);
        vat = total - amount;
      } else {
        amount = Math.round(qty * price);
        vat = Math.round(amount * 0.1);
      }
    }

    item.amount = amount;
    item.vat = vat;

    const tr = dom.itemsTableBody.querySelector(`tr[data-index="${index}"]`);
    if (tr) {
      const amountInput = tr.querySelector('.row-amount');
      const vatInput = tr.querySelector('.row-vat');
      if (amountInput) amountInput.value = amount ? formatNumber(amount) : '';
      if (vatInput) vatInput.value = vat ? formatNumber(vat) : '';
    }

    recalculateSummary();
  }

  function recalculateAll() {
    state.items.forEach((_, idx) => computeRow(idx));
  }

  function recalculateSummary() {
    let totalQty = 0;
    let totalSupply = 0;
    let totalVat = 0;
    let hasQty = false;

    state.items.forEach((item) => {
      const q = parseFloat(item.qty);
      if (!isNaN(q) && q > 0) {
        totalQty += q;
        hasQty = true;
      }
      totalSupply += (item.amount || 0);
      totalVat += (item.vat || 0);
    });

    const grandTotal = totalSupply + totalVat;

    dom.tableTotalQty.textContent = hasQty ? formatNumber(totalQty) : '-';
    dom.tableTotalAmount.textContent = formatNumber(totalSupply);
    dom.tableTotalVat.textContent = formatNumber(totalVat);

    dom.summarySupplyPrice.textContent = '₩ ' + formatNumber(totalSupply);
    dom.summaryVat.textContent = '₩ ' + formatNumber(totalVat);
    dom.summaryGrandTotal.textContent = '₩ ' + formatNumber(grandTotal);

    dom.docNumberAmount.textContent = '₩' + formatNumber(grandTotal);
    dom.docKoreanAmount.textContent = numberToKoreanWon(grandTotal);
  }

  function addEmptyRow() {
    state.items.push({ item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 });
    renderTableRows();
  }

  function toggleVatMode() {
    state.isVatIncluded = !state.isVatIncluded;
    dom.vatModeLabel.textContent = state.isVatIncluded ? '포함' : '별도';
    dom.vatIncludedText.textContent = state.isVatIncluded ? '※ 부가세포함' : '※ 부가세별도';
    recalculateAll();
  }

  // ==========================================
  // 5. Speech-To-Text (Web Speech API)
  // ==========================================
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      dom.sttStatus.textContent = '브라우저가 음성 인식을 지원하지 않습니다';
      dom.sttSubStatus.textContent = 'Chrome, Edge 브라우저를 권장합니다';
      dom.micBtn.disabled = true;
      dom.micBtn.style.opacity = '0.5';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      state.isRecording = true;
      dom.sttBox.classList.add('recording');
      dom.sttStatus.textContent = '음성을 듣고 있습니다... 말씀해 주세요';
      dom.sttSubStatus.textContent = '말씀을 마치면 마이크를 다시 눌러주세요';
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript) {
        dom.rawInput.value = (dom.rawInput.value + ' ' + finalTranscript).trim();
        updateCharCount();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      dom.sttStatus.textContent = '음성 인식 오류 (' + event.error + ')';
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };

    state.recognition = recognition;
  }

  function toggleRecording() {
    if (!state.recognition) return;

    if (state.isRecording) {
      state.recognition.stop();
      stopRecording();
    } else {
      try {
        state.recognition.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  }

  function stopRecording() {
    state.isRecording = false;
    dom.sttBox.classList.remove('recording');
    dom.sttStatus.textContent = '마이크를 눌러 음성으로 말해보세요';
    dom.sttSubStatus.textContent = '한국어 실시간 음성인식 지원';
  }

  // ==========================================
  // 6. 백엔드 프록시를 통한 AI 호출
  // ==========================================
  async function callProxyApi(modelName, rawText) {
    const systemPrompt = `당신은 대한민국 기업 및 프리랜서 실무를 위한 최고 수준의 견적서 작성 자동화 AI입니다.
사용자가 제공한 자연어(음성 받아쓰기, 이메일, 메신저 대화, 메모 등)를 정밀 분석하여 견적서 항목을 추출하고 반드시 유효한 JSON 형식으로만 응답하세요.

[규칙]
1. 반드시 유효한 JSON 객체 하나만 출력하세요. 마크다운 앞뒤 설명이나 부연 설명은 절대 금지합니다.
2. 금액, 수량은 순수 숫자(Number)로 변환하세요.
3. 수량 언급이 없으면 1로 지정합니다.
4. 부가세 언급이 없으면 기본적으로 "isVatIncluded": false (부가세 별도)입니다.
5. 유효기간 언급이 없으면 '견적일로부터 30일간'으로 설정합니다.

[반환할 JSON 구조 예시]
{
  "recipient": "수신소/고객사 (예: (주)알파상사 홍길동 팀장)",
  "quoteTitle": "견적명 (예: 브랜드 웹사이트 리뉴얼)",
  "quoteDate": "YYYY-MM-DD",
  "validUntil": "견적일로부터 30일간",
  "supplier": {
    "name": "공급자 상호명",
    "ceo": "대표자명",
    "bizNum": "사업자번호",
    "phone": "전화번호",
    "address": "사업장 주소",
    "email": "이메일"
  },
  "isVatIncluded": false,
  "items": [
    {
      "item": "품목명",
      "description": "규격 또는 상세내용",
      "quantity": 1,
      "unitPrice": 1500000
    }
  ],
  "remarks": "낙품기한, 결제조건, 계좌번호 등 비고/참조사항"
}`;

    const supplierContext = state.supplier.name
      ? `[참고: 저장된 기본 공급자 정보: 상호: ${state.supplier.name}, 대표: ${state.supplier.ceo}, 사업자번호: ${state.supplier.bizNum}, 연락소: ${state.supplier.phone}, 주소: ${state.supplier.address}, 이메일: ${state.supplier.email}]`
      : '';

    // 백엔드 프록시를 통해 호출 (서버가 API Key를 환경변수에서 읽어 주입)
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${supplierContext}\n\n[사용자 입력 내용]:\n${rawText}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${response.status} 에러`;
      throw new Error(msg);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI로부터 비어있는 응답을 받았습니다.');
    }

    // JSON만 안전하게 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답에서 JSON 형식을 추출할 수 없습니다.');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async function processWithAI() {
    const rawText = dom.rawInput.value.trim();

    if (!rawText) {
      alert('견적서에 넣을 내용을 입력하거나 마이크로 말씨해 주세요!');
      dom.rawInput.focus();
      return;
    }

    let model = state.selectedModel || DEFAULT_MODELS.PRIMARY;

    showBanner(`AI (${model.split('/')[1] || model}) 모델이 견적서를 생성하는 중입니다...`, 'loading');
    dom.processBtn.disabled = true;

    try {
      let parsed = null;
      try {
        parsed = await callProxyApi(model, rawText);
      } catch (firstErr) {
        console.warn(`Model ${model} failed:`, firstErr);

        // 자동 폴백: 다른 디폴트 모델로 재시도
        const fallbackModel = DEFAULT_MODELS.FALLBACKS.find((m) => m !== model) || DEFAULT_MODELS.PRIMARY;
        showBanner(`(${model.split('/')[1] || model}) 실패로 (${fallbackModel.split('/')[1] || fallbackModel}) 모델로 자동 재시도 중...`, 'loading');

        parsed = await callProxyApi(fallbackModel, rawText);
      }

      applyAiDataToQuotation(parsed);
      showBanner('✨ 견적서 생성이 완료되었습니다! 직접 수정하거나 PDF로 저장하세요.', 'success');
    } catch (err) {
      console.error('AI Processing Error:', err);
      showBanner(`❌ 오류 발생: ${err.message}`, 'error');
      alert(`AI 견적서 생성 중 오류가 발생했습니다:\n${err.message}`);
    } finally {
      dom.processBtn.disabled = false;
    }
  }

  function applyAiDataToQuotation(data) {
    if (!data) return;

    if (data.recipient !== undefined) dom.docRecipient.value = data.recipient;
    if (data.quoteTitle !== undefined) dom.docQuoteTitle.value = data.quoteTitle;

    if (data.quoteDate) {
      const parts = data.quoteDate.split('-');
      if (parts.length === 3) {
        dom.docQuoteDateYear.value = parts[0];
        dom.docQuoteDateMonth.value = parts[1];
        dom.docQuoteDateDay.value = parts[2];
      }
    } else {
      setTodayDate();
    }

    if (data.validUntil !== undefined) dom.docValidUntil.value = data.validUntil || '견적일로부터 30일간';

    const sup = data.supplier || {};
    dom.docSupplierName.value = sup.name || state.supplier.name || dom.docSupplierName.value;
    dom.docSupplierCeo.value = sup.ceo || state.supplier.ceo || dom.docSupplierCeo.value;
    dom.docSupplierBizNum.value = sup.bizNum || state.supplier.bizNum || dom.docSupplierBizNum.value;
    dom.docSupplierPhone.value = sup.phone || state.supplier.phone || dom.docSupplierPhone.value;
    dom.docSupplierAddress.value = sup.address || state.supplier.address || dom.docSupplierAddress.value;
    dom.docSupplierEmail.value = sup.email || state.supplier.email || dom.docSupplierEmail.value;

    state.isVatIncluded = Boolean(data.isVatIncluded);
    dom.vatModeLabel.textContent = state.isVatIncluded ? '포함' : '별도';
    dom.vatIncludedText.textContent = state.isVatIncluded ? '※ 부가세포함' : '※ 부가세별도';

    if (Array.isArray(data.items) && data.items.length > 0) {
      state.items = data.items.map((it) => ({
        item: it.item || '',
        description: it.description || '',
        qty: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        amount: 0,
        vat: 0,
      }));
    }

    if (data.remarks !== undefined) {
      dom.docRemarks.value = data.remarks;
    }

    renderTableRows();
  }

  function showBanner(msg, type = 'info') {
    dom.statusBanner.classList.remove('hidden');
    dom.statusMessage.textContent = msg;

    const spinner = dom.statusBanner.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = type === 'loading' ? 'block' : 'none';
    }
  }

  // ==========================================
  // 7. Profile & Settings Management
  // ==========================================
  function loadSavedSettings() {
    dom.apiKeyInput.value = state.apiKey;
    updateApiKeyBadge();

    // If previously saved model was the old unavailable gemini-2.0-flash-001, reset to deepseek-chat
    if (state.selectedModel === 'google/gemini-2.0-flash-001' || !state.selectedModel) {
      state.selectedModel = DEFAULT_MODELS.PRIMARY;
      localStorage.setItem(STORAGE_KEYS.MODEL, state.selectedModel);
    }

    if (state.selectedModel) {
      dom.modelSelect.value = state.selectedModel;
      if (dom.modelSelect.value !== state.selectedModel) {
        dom.modelSelect.value = 'custom';
        dom.customModelGroup.classList.remove('hidden');
        dom.customModelInput.value = state.selectedModel;
      }
    }

    const savedSupplier = localStorage.getItem(STORAGE_KEYS.SUPPLIER);
    if (savedSupplier) {
      try {
        state.supplier = JSON.parse(savedSupplier);
        dom.myCompany.value = state.supplier.name || '';
        dom.myCeo.value = state.supplier.ceo || '';
        dom.myBizNum.value = state.supplier.bizNum || '';
        dom.myPhone.value = state.supplier.phone || '';
        dom.myAddress.value = state.supplier.address || '';
        dom.myEmail.value = state.supplier.email || '';

        dom.docSupplierName.value = state.supplier.name || '';
        dom.docSupplierCeo.value = state.supplier.ceo || '';
        dom.docSupplierBizNum.value = state.supplier.bizNum || '';
        dom.docSupplierPhone.value = state.supplier.phone || '';
        dom.docSupplierAddress.value = state.supplier.address || '';
        dom.docSupplierEmail.value = state.supplier.email || '';
      } catch (e) {
        console.warn('Failed to parse saved supplier:', e);
      }
    }
  }


  function saveSupplierProfile() {
    state.supplier = {
      name: dom.myCompany.value.trim(),
      ceo: dom.myCeo.value.trim(),
      bizNum: dom.myBizNum.value.trim(),
      phone: dom.myPhone.value.trim(),
      address: dom.myAddress.value.trim(),
      email: dom.myEmail.value.trim(),
    };

    localStorage.setItem(STORAGE_KEYS.SUPPLIER, JSON.stringify(state.supplier));

    dom.docSupplierName.value = state.supplier.name;
    dom.docSupplierCeo.value = state.supplier.ceo;
    dom.docSupplierBizNum.value = state.supplier.bizNum;
    dom.docSupplierPhone.value = state.supplier.phone;
    dom.docSupplierAddress.value = state.supplier.address;
    dom.docSupplierEmail.value = state.supplier.email;

    alert('🏢 공급자 기본 정보가 안전하게 저장되었습니다.');
  }

  function resetAll() {
    if (!confirm('작성 중인 견적서 내용을 초기화하시겠습니까?')) return;

    dom.rawInput.value = '';
    updateCharCount();
    dom.docRecipient.value = '';
    dom.docQuoteTitle.value = '';
    setTodayDate();
    dom.docValidUntil.value = '견적일로부터 30일간';
    dom.docRemarks.value = '';

    dom.docSupplierName.value = state.supplier.name || '';
    dom.docSupplierCeo.value = state.supplier.ceo || '';
    dom.docSupplierBizNum.value = state.supplier.bizNum || '';
    dom.docSupplierPhone.value = state.supplier.phone || '';
    dom.docSupplierAddress.value = state.supplier.address || '';
    dom.docSupplierEmail.value = state.supplier.email || '';

    state.items = [
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
      { item: '', description: '', qty: '', unitPrice: '', amount: 0, vat: 0 },
    ];

    renderTableRows();
    dom.statusBanner.classList.add('hidden');
  }

  function updateCharCount() {
    dom.charCount.textContent = `${dom.rawInput.value.length}자`;
  }

  // ==========================================
  // 8. Event Listeners Setup
  // ==========================================
  function setupEventListeners() {
    dom.clearBtn.addEventListener('click', resetAll);
    dom.printBtn.addEventListener('click', () => window.print());

    dom.sampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.sampleMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      dom.sampleMenu.classList.add('hidden');
    });

    dom.sampleMenu.querySelectorAll('.dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.sample;
        if (SAMPLES[key]) {
          dom.rawInput.value = SAMPLES[key];
          updateCharCount();
        }
      });
    });

    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        dom.rawInput.value = chip.dataset.text;
        updateCharCount();
      });
    });

    dom.micBtn.addEventListener('click', toggleRecording);
    dom.rawInput.addEventListener('input', updateCharCount);
    dom.clearInputBtn.addEventListener('click', () => {
      dom.rawInput.value = '';
      updateCharCount();
    });

    dom.processBtn.addEventListener('click', processWithAI);

    dom.supplierToggle.addEventListener('click', () => {
      dom.supplierToggle.classList.toggle('open');
    });

    dom.saveSupplierBtn.addEventListener('click', saveSupplierProfile);
    dom.addRowBtn.addEventListener('click', addEmptyRow);
    dom.fillVatToggle.addEventListener('click', toggleVatMode);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dom.sampleMenu.classList.add('hidden');
      }
    });
  }

  // ==========================================
  // 9. App Initialization
  // ==========================================
  function init() {
    setTodayDate();
    loadSavedSettings();
    renderTableRows();
    initSpeechRecognition();
    setupEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
