// script.js - 인도양 교역망 AI 무역상 시뮬레이션 로직

// 1. 역사적 거점 및 상품 데이터 정의
// (특산품은 교과서 사료에 기초하며, 가격/비용은 학습용 가상 수치입니다)
const REGIONS_DATA = {
  east_africa: {
    id: "east_africa",
    name: "동아프리카",
    portName: "킬와 / 모가디슈",
    description: "스와힐리 해안의 무역 도시로, 내륙에서 산출되는 풍부한 금과 상아의 집산지입니다.",
    adjacent: ["arabia"], // 인접 지역
    distanceTo: { east_africa: 0, arabia: 1, india: 2, southeast_asia: 3, china: 4 },
    goods: [
      { id: "gold", name: "금 (사금)", basePrice: 40, desc: "동아프리카 내륙에서 채굴된 귀금속" },
      { id: "ivory", name: "상아", basePrice: 25, desc: "조각품과 장식재로 널리 쓰이는 고급 상품" }
    ]
  },
  arabia: {
    id: "arabia",
    name: "아라비아",
    portName: "호르무즈 / 아덴",
    description: "홍해와 페르시아만의 입구로, 향료와 명마를 수출하며 동서 교역의 가교 역할을 합니다.",
    adjacent: ["east_africa", "india"],
    distanceTo: { east_africa: 1, arabia: 0, india: 1, southeast_asia: 2, china: 3 },
    goods: [
      { id: "frankincense", name: "유향 (향료)", basePrice: 20, desc: "종교 의식과 치료용으로 인기 있는 아라비아 특산 수지" },
      { id: "horse", name: "아라비아 명마", basePrice: 35, desc: "인도 군주들이 군사용으로 대량 수입한 말" }
    ]
  },
  india: {
    id: "india",
    name: "인도",
    portName: "캘리컷 / 구자라트",
    description: "인도양 교역의 심장부로, 품질 좋은 면직물과 세계인이 찾는 후추의 최대 생산지입니다.",
    adjacent: ["arabia", "southeast_asia"],
    distanceTo: { east_africa: 2, arabia: 1, india: 0, southeast_asia: 1, china: 2 },
    goods: [
      { id: "pepper", name: "후추", basePrice: 25, desc: "음식 보존과 풍미를 위해 전 세계가 열광한 향신료" },
      { id: "cotton", name: "인도산 면직물", basePrice: 20, desc: "가볍고 시원하여 전 인도양권에서 교환 화폐처럼 쓰임" }
    ]
  },
  southeast_asia: {
    id: "southeast_asia",
    name: "동남아시아",
    portName: "믈라카 / 말루쿠 제도",
    description: "말루쿠 제도의 귀한 정향과 육두구 생산지이자, 믈라카 해협을 쥔 중계무역의 핵심지입니다.",
    adjacent: ["india", "china"],
    distanceTo: { east_africa: 3, arabia: 2, india: 1, southeast_asia: 0, china: 1 },
    goods: [
      { id: "clove", name: "정향 (향신료)", basePrice: 30, desc: "말루쿠 제도에서만 자라는 특수 향신료" },
      { id: "nutmeg", name: "육두구", basePrice: 25, desc: "약재이자 방부제로 금값에 거래되던 열매" }
    ]
  },
  china: {
    id: "china",
    name: "중국 (송·원·명)",
    portName: "취안저우 / 광저우",
    description: "시박사가 설치된 해상 무역의 동쪽 종점으로, 최상급 비단과 정교한 도자기의 발원지입니다.",
    adjacent: ["southeast_asia"],
    distanceTo: { east_africa: 4, arabia: 3, india: 2, southeast_asia: 1, china: 0 },
    goods: [
      { id: "silk", name: "비단 (견직물)", basePrice: 35, desc: "귀족들이 탐내던 부와 신분의 상징" },
      { id: "porcelain", name: "청자 및 백자", basePrice: 30, desc: "견고하고 아름다워 유럽과 이슬람권에 수출된 도자기" }
    ]
  }
};

// 2. 게임 상태(State) 관리 객체
const gameState = {
  currentRound: 1, // 1, 2, 3
  homeRegionId: null, // 시작 거점
  currentRegionId: null, // 현재 위치
  silver: 100, // 시작 은화
  initialSilver: 100,
  maxTurnsPerRound: 3,
  remainingTurns: 3,
  inventory: {}, // { goodId: { name: "", count: 0, originRegion: "" } }
  tradeLogs: [],
  totalSpentSilver: 0,
  totalEarnedSilver: 0,
  goodsAcquiredCount: 0,
  completed: false
};

// 3. 지역별 상품 가격 계산 규칙 함수
// (생산지와 멀어질수록 거리마다 +50%~100% 프리미엄 발생, 생산지에서는 원가)
function calculateSellPrice(goodId, originRegionId, sellRegionId) {
  const originRegion = REGIONS_DATA[originRegionId];
  const good = originRegion.goods.find(g => g.id === goodId);
  if (!good) return 10;

  const distance = REGIONS_DATA[originRegionId].distanceTo[sellRegionId];
  if (distance === 0) {
    // 본산지에서 그대로 되파는 경우 (차익 거의 없음, 10% 감가)
    return Math.floor(good.basePrice * 0.9);
  } else {
    // 거리에 비례하여 희소성 프리미엄 가산 (거리당 40% 추가 수익)
    return Math.floor(good.basePrice * (1 + distance * 0.45));
  }
}

// 4. DOM 요소 캐싱
const displayRound = document.getElementById("display-round");
const displayHomeRegion = document.getElementById("display-home-region");
const displayCurrentRegion = document.getElementById("display-current-region");
const displaySilver = document.getElementById("display-silver");
const displayTurns = document.getElementById("display-turns");

const roundTitle = document.getElementById("round-title");
const roundProgress = document.getElementById("round-progress");
const roundDescription = document.getElementById("round-description");
const roundRuleNote = document.getElementById("round-rule-note");

const regionsContainer = document.getElementById("regions-container");
const storageTotal = document.getElementById("storage-total");
const inventoryList = document.getElementById("inventory-list");

const initialSetupUI = document.getElementById("initial-setup-ui");
const activeTradeUI = document.getElementById("active-trade-ui");
const btnNextRound = document.getElementById("btn-next-round");
const nextRoundHint = document.getElementById("next-round-hint");
const btnRestart = document.getElementById("btn-restart");

const tradeLogContainer = document.getElementById("trade-log-container");
const reflectionSection = document.getElementById("reflection-section");
const finalSummaryBox = document.getElementById("final-summary-box");

// 탭 버튼 및 패널
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const buyItemList = document.getElementById("buy-item-list");
const sellItemList = document.getElementById("sell-item-list");
const travelRouteList = document.getElementById("travel-route-list");
const agentRouteList = document.getElementById("agent-route-list");
const buyCurrentLoc = document.getElementById("buy-current-location");
const sellCurrentLoc = document.getElementById("sell-current-location");

// 5. 초기화 및 렌더링 함수
function initGame() {
  gameState.currentRound = 1;
  gameState.homeRegionId = null;
  gameState.currentRegionId = null;
  gameState.silver = 100;
  gameState.remainingTurns = 3;
  gameState.inventory = {};
  gameState.tradeLogs = [];
  gameState.totalSpentSilver = 0;
  gameState.totalEarnedSilver = 0;
  gameState.goodsAcquiredCount = 0;
  gameState.completed = false;

  reflectionSection.classList.add("hidden");
  document.getElementById("q1").value = "";
  document.getElementById("q2").value = "";
  document.getElementById("q3").value = "";
  document.getElementById("reflection-alert").classList.add("hidden");

  logMessage("게임이 초기화되었습니다. 무역 상단을 발족할 시작 지역을 선택해 주세요.", "system");
  updateUI();
}

// 로그 기록 함수
function logMessage(msg, type = "system") {
  const time = new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  gameState.tradeLogs.push({ time, msg, type });

  const entry = document.createElement("p");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  tradeLogContainer.appendChild(entry);
  tradeLogContainer.scrollTop = tradeLogContainer.scrollHeight;
}

// UI 전체 갱신
function updateUI() {
  // 1. 대시보드 갱신
  const roundNames = {
    1: "1라운드: 지역 내 거래 (국지적)",
    2: "2라운드: 인접 지역 직접 거래",
    3: "3라운드: 중개인을 이용한 장거리 거래"
  };
  displayRound.textContent = roundNames[gameState.currentRound];
  displayHomeRegion.textContent = gameState.homeRegionId ? REGIONS_DATA[gameState.homeRegionId].name : "선택 대기 중";
  displayCurrentRegion.textContent = gameState.currentRegionId ? REGIONS_DATA[gameState.currentRegionId].name : "선택 대기 중";
  displaySilver.textContent = `${gameState.silver} 은화`;
  displayTurns.textContent = `${gameState.remainingTurns} / ${gameState.maxTurnsPerRound}`;

  // 2. 라운드 안내 배너 갱신
  roundProgress.textContent = `${gameState.currentRound} / 3 라운드`;
  if (gameState.currentRound === 1) {
    roundTitle.textContent = "📌 1라운드: 지역 내 거래 (국지적 교역)";
    roundDescription.textContent = "자신의 시작 거점 내부에서 물품을 구매하고 판매해보세요. 같은 지역 안에서는 시세 차이가 적어 이윤이 제한적임을 관찰할 수 있습니다.";
    roundRuleNote.textContent = "규칙: 지역 이동 불가 · 중개 상인 고용 불가 · 현재 지역 내 상품만 거래 가능";
    document.getElementById("tab-travel").disabled = true;
    document.getElementById("tab-agent").disabled = true;
  } else if (gameState.currentRound === 2) {
    roundTitle.textContent = "📌 2라운드: 인접 지역 간 직접 거래 (계절풍 항해)";
    roundDescription.textContent = "계절풍을 타고 인접한 교역 거점으로 직접 이동해 보세요. 이동할 때마다 운송 비용(10 은화)과 턴이 소모되지만, 타지역 특산품을 가져가 비싼 값에 판매할 수 있습니다.";
    roundRuleNote.textContent = "규칙: 인접 지역으로 직접 이동 가능(비용 10 은화, 1턴 소모) · 중개 상인 이용 불가";
    document.getElementById("tab-travel").disabled = false;
    document.getElementById("tab-agent").disabled = true;
  } else if (gameState.currentRound === 3) {
    roundTitle.textContent = "📌 3라운드: 중개인을 이용한 장거리 거래 (세계적 교역망)";
    roundDescription.textContent = "직접 가기 힘든 먼 지역의 상품을 현지 중개 상인(AI 무역상)에게 의뢰하여 조달해 보세요. 중개 수수료(15 은화)가 발생하지만, 직접 위험을 뚫고 긴 항해를 하지 않아도 먼 문명의 물품을 확보할 수 있습니다.";
    roundRuleNote.textContent = "규칙: 직접 이동 가능 + 먼 지역 상품 중개 상인 위탁 구매/판매 가능 (수수료 15 은화)";
    document.getElementById("tab-travel").disabled = false;
    document.getElementById("tab-agent").disabled = false;
  }

  // 3. 지역 카드 렌더링
  renderRegions();

  // 4. 내 창고 렌더링
  renderInventory();

  // 5. 거래 조작부 렌더링
  if (!gameState.homeRegionId) {
    initialSetupUI.classList.remove("hidden");
    activeTradeUI.classList.add("hidden");
    btnNextRound.disabled = true;
    nextRoundHint.textContent = "먼저 좌측에서 시작 지역을 선택해야 합니다.";
  } else {
    initialSetupUI.classList.add("hidden");
    activeTradeUI.classList.remove("hidden");
    buyCurrentLoc.textContent = REGIONS_DATA[gameState.currentRegionId].name;
    sellCurrentLoc.textContent = REGIONS_DATA[gameState.currentRegionId].name;
    renderTradeTabsContent();

    // 다음 라운드 버튼 활성화 조건
    if (gameState.remainingTurns === 0 || gameState.tradeLogs.length > 2) {
      btnNextRound.disabled = false;
      if (gameState.currentRound < 3) {
        nextRoundHint.textContent = "준비가 되었다면 다음 라운드로 진행할 수 있습니다.";
      } else {
        btnNextRound.textContent = "최종 결과 확인 및 성찰 ➔";
        nextRoundHint.textContent = "모든 라운드가 끝났습니다. 최종 결과를 확인하세요.";
      }
    } else {
      btnNextRound.disabled = true;
      nextRoundHint.textContent = `최소 1회 이상 거래하거나 남은 턴(${gameState.remainingTurns}회)을 소모해야 진행할 수 있습니다.`;
    }
  }
}

// 5개 지역 카드 렌더링
function renderRegions() {
  regionsContainer.innerHTML = "";

  Object.values(REGIONS_DATA).forEach(region => {
    const card = document.createElement("div");
    card.className = "region-card";

    const isCurrent = region.id === gameState.currentRegionId;
    const isAdjacent = gameState.currentRegionId && REGIONS_DATA[gameState.currentRegionId].adjacent.includes(region.id);

    if (isCurrent) card.classList.add("is-current");
    if (isAdjacent && gameState.currentRound >= 2) card.classList.add("is-adjacent");

    let badgeText = "원거리 지역";
    let badgeClass = "badge-distant";
    if (isCurrent) {
      badgeText = "🚩 현재 위치";
      badgeClass = "badge-current";
    } else if (isAdjacent) {
      badgeText = "⚓ 인접 항로 (직접 이동 가능)";
      badgeClass = "badge-adjacent";
    }

    // 특산품 칩
    const goodsChips = region.goods.map(g => 
      `<span class="market-item-chip">
        <span>${g.name}</span>
        <span class="price">${g.basePrice}은화</span>
      </span>`
    ).join("");

    // 시작 지역 선택 버튼 또는 상태 표시
    let actionBtnHtml = "";
    if (!gameState.homeRegionId) {
      actionBtnHtml = `<button class="btn-primary" onclick="selectHomeRegion('${region.id}')">이곳에서 상단 시작</button>`;
    }

    card.innerHTML = `
      <div class="region-card-header">
        <span class="region-title">${region.name} <small style="font-size:0.8rem; color:var(--text-muted);">(${region.portName})</small></span>
        <span class="region-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <p class="region-desc">${region.description}</p>
      <div style="font-size:0.8rem; font-weight:600; color:#475569; margin-top:6px;">산출 특산품 (기준가):</div>
      <div class="goods-market-list">${goodsChips}</div>
      ${actionBtnHtml ? `<div class="region-actions">${actionBtnHtml}</div>` : ""}
    `;

    regionsContainer.appendChild(card);
  });
}

// 시작 지역 선택
window.selectHomeRegion = function(regionId) {
  gameState.homeRegionId = regionId;
  gameState.currentRegionId = regionId;
  const region = REGIONS_DATA[regionId];
  logMessage(`[상단 발족] ${region.name} (${region.portName})에서 무역을 시작합니다. 기본 자본금 ${gameState.silver} 은화가 지급되었습니다.`, "system");
  updateUI();
};

// 창고 인벤토리 렌더링
function renderInventory() {
  inventoryList.innerHTML = "";
  const items = Object.values(gameState.inventory).filter(item => item.count > 0);
  const totalCount = items.reduce((acc, cur) => acc + cur.count, 0);
  storageTotal.textContent = `보유 상품: 총 ${totalCount}개`;

  if (items.length === 0) {
    inventoryList.innerHTML = `<p class="empty-text">현재 보관 중인 교역 상품이 없습니다.<br>시장에서 물품을 구매해 보세요.</p>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "inventory-item";
    const origin = REGIONS_DATA[item.originRegion].name;
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <span style="font-size:0.75rem; color:#64748b; margin-left:6px;">(생산지: ${origin})</span>
      </div>
      <span class="qty">${item.count}개</span>
    `;
    inventoryList.appendChild(row);
  });
}

// 거래 작업대 탭 내용 렌더링
function renderTradeTabsContent() {
  const currentRegion = REGIONS_DATA[gameState.currentRegionId];

  // 1. 구매 패널 (현재 지역의 특산품)
  buyItemList.innerHTML = "";
  currentRegion.goods.forEach(good => {
    const canAfford = gameState.silver >= good.basePrice && gameState.remainingTurns > 0;
    const row = document.createElement("div");
    row.className = "trade-row";
    row.innerHTML = `
      <div class="trade-row-info">
        <span class="trade-row-title">${good.name}</span>
        <span class="trade-row-sub">${good.desc} | 가격: <strong style="color:var(--accent);">${good.basePrice} 은화</strong></span>
      </div>
      <button class="btn-action" ${!canAfford ? "disabled" : ""} onclick="buyGood('${good.id}', '${currentRegion.id}')">
        구매하기 (1턴 소모)
      </button>
    `;
    buyItemList.appendChild(row);
  });

  // 2. 판매 패널 (내가 가진 물품들을 현재 지역 시장에 판매)
  sellItemList.innerHTML = "";
  const items = Object.values(gameState.inventory).filter(item => item.count > 0);
  if (items.length === 0) {
    sellItemList.innerHTML = `<p class="empty-text">판매할 수 있는 물품이 창고에 없습니다.</p>`;
  } else {
    items.forEach(item => {
      const sellPrice = calculateSellPrice(item.goodId, item.originRegion, gameState.currentRegionId);
      const isProfitable = sellPrice > item.purchasePrice;
      const profitText = isProfitable 
        ? `<span style="color:#059669; font-weight:600;">(이윤: +${sellPrice - item.purchasePrice} 은화)</span>`
        : `<span style="color:#64748b;">(원가 대비 동일/감가)</span>`;

      const canSell = gameState.remainingTurns > 0;
      const row = document.createElement("div");
      row.className = "trade-row";
      row.innerHTML = `
        <div class="trade-row-info">
          <span class="trade-row-title">${item.name} (${item.count}개 보유)</span>
          <span class="trade-row-sub">
            원산지: ${REGIONS_DATA[item.originRegion].name} | 판매가: <strong>${sellPrice} 은화</strong> ${profitText}
          </span>
        </div>
        <button class="btn-action" ${!canSell ? "disabled" : ""} onclick="sellGood('${item.goodId}')">
          1개 판매하기 (1턴 소모)
        </button>
      `;
      sellItemList.appendChild(row);
    });
  }

  // 3. 이동 패널 (2라운드 이상: 인접 지역으로 직접 이동)
  travelRouteList.innerHTML = "";
  if (gameState.currentRound < 2) {
    travelRouteList.innerHTML = `<p class="empty-text">2라운드부터 계절풍 항로를 통한 인접 지역 직접 이동이 해금됩니다.</p>`;
  } else {
    currentRegion.adjacent.forEach(adjId => {
      const targetRegion = REGIONS_DATA[adjId];
      const travelCost = 10; // 학습용 가상 이동 운송비
      const canTravel = gameState.silver >= travelCost && gameState.remainingTurns > 0;

      const row = document.createElement("div");
      row.className = "trade-row";
      row.innerHTML = `
        <div class="trade-row-info">
          <span class="trade-row-title">${targetRegion.name} (${targetRegion.portName})</span>
          <span class="trade-row-sub">항해 운송비: <strong>${travelCost} 은화</strong> | 계절풍을 타고 직접 항해</span>
        </div>
        <button class="btn-action" ${!canTravel ? "disabled" : ""} onclick="travelToRegion('${targetRegion.id}', ${travelCost})">
          항해하기 (1턴 소모)
        </button>
      `;
      travelRouteList.appendChild(row);
    });
  }

  // 4. 중개 거래 패널 (3라운드: 원거리 지역 상품을 중개 상인에게 위탁)
  agentRouteList.innerHTML = "";
  if (gameState.currentRound < 3) {
    agentRouteList.innerHTML = `<p class="empty-text">3라운드부터 아랍·인도계 중개 상인을 통한 원거리 위탁 거래가 해금됩니다.</p>`;
  } else {
    // 거리가 2 이상인 원거리 지역들의 상품 리스트
    let distantItemsCount = 0;
    Object.values(REGIONS_DATA).forEach(targetRegion => {
      const distance = currentRegion.distanceTo[targetRegion.id];
      if (distance >= 2) {
        targetRegion.goods.forEach(good => {
          distantItemsCount++;
          const agentFee = 15; // 중개 수수료
          const totalCost = good.basePrice + agentFee;
          const canBuyAgent = gameState.silver >= totalCost && gameState.remainingTurns > 0;

          const row = document.createElement("div");
          row.className = "trade-row";
          row.innerHTML = `
            <div class="trade-row-info">
              <span class="trade-row-title">${good.name} (원산지: ${targetRegion.name})</span>
              <span class="trade-row-sub">
                상품가 ${good.basePrice}은화 + 중개수수료 ${agentFee}은화 = 합계 <strong>${totalCost} 은화</strong>
              </span>
            </div>
            <button class="btn-action" ${!canBuyAgent ? "disabled" : ""} onclick="buyViaAgent('${good.id}', '${targetRegion.id}', ${good.basePrice}, ${agentFee})">
              중개상 위탁 구매 (1턴 소모)
            </button>
          `;
          agentRouteList.appendChild(row);
        });
      }
    });

    if (distantItemsCount === 0) {
      agentRouteList.innerHTML = `<p class="empty-text">현재 위치는 다른 모든 거점과 직접 인접해 있습니다.</p>`;
    }
  }
}

// 거래 액션: 물품 구매
window.buyGood = function(goodId, regionId) {
  if (gameState.remainingTurns <= 0) return;
  const region = REGIONS_DATA[regionId];
  const good = region.goods.find(g => g.id === goodId);
  if (!good || gameState.silver < good.basePrice) return;

  gameState.silver -= good.basePrice;
  gameState.totalSpentSilver += good.basePrice;
  gameState.remainingTurns -= 1;
  gameState.goodsAcquiredCount += 1;

  if (!gameState.inventory[goodId]) {
    gameState.inventory[goodId] = {
      goodId: good.id,
      name: good.name,
      originRegion: regionId,
      purchasePrice: good.basePrice,
      count: 0
    };
  }
  gameState.inventory[goodId].count += 1;

  logMessage(`[구매] ${region.name}에서 '${good.name}' 1개를 ${good.basePrice} 은화에 매입했습니다. (잔액: ${gameState.silver} 은화, 남은 턴: ${gameState.remainingTurns})`, "buy");
  updateUI();
};

// 거래 액션: 물품 판매
window.sellGood = function(goodId) {
  if (gameState.remainingTurns <= 0) return;
  const item = gameState.inventory[goodId];
  if (!item || item.count <= 0) return;

  const sellPrice = calculateSellPrice(item.goodId, item.originRegion, gameState.currentRegionId);
  gameState.silver += sellPrice;
  gameState.totalEarnedSilver += sellPrice;
  gameState.remainingTurns -= 1;
  item.count -= 1;

  const currentLocName = REGIONS_DATA[gameState.currentRegionId].name;
  const originName = REGIONS_DATA[item.originRegion].name;
  logMessage(`[판매] ${currentLocName} 시장에 '${item.name}'(원산지: ${originName}) 1개를 ${sellPrice} 은화에 매각했습니다. (잔액: ${gameState.silver} 은화, 남은 턴: ${gameState.remainingTurns})`, "sell");
  updateUI();
};

// 거래 액션: 지역 직접 이동 (2라운드)
window.travelToRegion = function(targetRegionId, cost) {
  if (gameState.remainingTurns <= 0 || gameState.silver < cost) return;

  gameState.silver -= cost;
  gameState.totalSpentSilver += cost;
  gameState.remainingTurns -= 1;
  const fromName = REGIONS_DATA[gameState.currentRegionId].name;
  gameState.currentRegionId = targetRegionId;
  const toName = REGIONS_DATA[targetRegionId].name;

  logMessage(`[항해] ${fromName}에서 계절풍을 타고 ${toName}(으)로 직접 항해했습니다. (운송비: ${cost} 은화 지출, 잔액: ${gameState.silver} 은화)`, "travel");
  updateUI();
};

// 거래 액션: 중개상인을 통한 원거리 구매 (3라운드)
window.buyViaAgent = function(goodId, originRegionId, basePrice, agentFee) {
  const totalCost = basePrice + agentFee;
  if (gameState.remainingTurns <= 0 || gameState.silver < totalCost) return;

  const targetRegion = REGIONS_DATA[originRegionId];
  const good = targetRegion.goods.find(g => g.id === goodId);
  if (!good) return;

  gameState.silver -= totalCost;
  gameState.totalSpentSilver += totalCost;
  gameState.remainingTurns -= 1;
  gameState.goodsAcquiredCount += 1;

  if (!gameState.inventory[goodId]) {
    gameState.inventory[goodId] = {
      goodId: good.id,
      name: good.name,
      originRegion: originRegionId,
      purchasePrice: totalCost,
      count: 0
    };
  }
  gameState.inventory[goodId].count += 1;

  logMessage(`[중개 거래] 아랍·인도 중개상인에게 의뢰하여 ${targetRegion.name}의 '${good.name}'을(를) 조달했습니다. (상품대금: ${basePrice} + 수수료: ${agentFee} = 총 ${totalCost} 은화 지출)`, "agent");
  updateUI();
};

// 다음 라운드 진행 핸들러
btnNextRound.addEventListener("click", () => {
  if (gameState.currentRound === 1) {
    gameState.currentRound = 2;
    gameState.remainingTurns = gameState.maxTurnsPerRound;
    logMessage(`========== [2라운드 시작] 인접 지역 간 직접 교역이 개방되었습니다! ==========`, "system");
    // 기본 탭을 이동 탭으로 전환
    switchTab("travel");
  } else if (gameState.currentRound === 2) {
    gameState.currentRound = 3;
    gameState.remainingTurns = gameState.maxTurnsPerRound;
    logMessage(`========== [3라운드 시작] 중개인을 통한 원거리 장거리 교역망이 연결되었습니다! ==========`, "system");
    switchTab("agent");
  } else if (gameState.currentRound === 3) {
    finishSimulation();
    return;
  }
  updateUI();
});

// 시뮬레이션 완료 및 성찰 모달 표시
function finishSimulation() {
  gameState.completed = true;
  reflectionSection.classList.remove("hidden");
  reflectionSection.scrollIntoView({ behavior: "smooth" });

  const profit = gameState.silver - gameState.initialSilver;
  const profitRate = ((profit / gameState.initialSilver) * 100).toFixed(1);

  finalSummaryBox.innerHTML = `
    <div class="summary-item">
      <h4>시작 본거지</h4>
      <p>${REGIONS_DATA[gameState.homeRegionId].name}</p>
    </div>
    <div class="summary-item">
      <h4>최종 자본금</h4>
      <p>${gameState.silver} 은화</p>
    </div>
    <div class="summary-item">
      <h4>순수익 (수익률)</h4>
      <p style="color:${profit >= 0 ? '#047857' : '#b91c1c'};">${profit >= 0 ? '+' : ''}${profit} 은화 (${profitRate}%)</p>
    </div>
    <div class="summary-item">
      <h4>총 확보한 상품 수</h4>
      <p>${gameState.goodsAcquiredCount}건</p>
    </div>
  `;

  logMessage(`🏆 모든 교역 활동이 완료되었습니다. 최종 은화: ${gameState.silver} 은화, 순수익: ${profit} 은화. 아래의 성찰 질문을 작성하세요.`, "system");
}

// 탭 전환 유틸
function switchTab(tabId) {
  tabButtons.forEach(btn => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  tabPanels.forEach(panel => {
    if (panel.id === `panel-${tabId}`) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const tabId = btn.getAttribute("data-tab");
    switchTab(tabId);
  });
});

// 다시 시작 버튼
btnRestart.addEventListener("click", () => {
  if (confirm("정말로 게임을 처음 상태로 다시 시작하시겠습니까? 현재 진행 상황이 초기화됩니다.")) {
    initGame();
  }
});

// 성찰 답변 저장 및 복사 기능
const btnSaveReflection = document.getElementById("btn-save-reflection");
const btnCopyReflection = document.getElementById("btn-copy-reflection");
const reflectionAlert = document.getElementById("reflection-alert");

btnSaveReflection.addEventListener("click", () => {
  const q1 = document.getElementById("q1").value.trim();
  const q2 = document.getElementById("q2").value.trim();
  const q3 = document.getElementById("q3").value.trim();

  if (!q1 || !q2 || !q3) {
    showAlert("모든 질문에 대한 답변을 작성해 주세요.", "warning");
    return;
  }
  showAlert("✅ 성찰 내용이 성공적으로 저장되었습니다! '답변 복사하기'를 눌러 과제 제출용으로 활용할 수 있습니다.", "success");
});

btnCopyReflection.addEventListener("click", () => {
  const q1 = document.getElementById("q1").value.trim();
  const q2 = document.getElementById("q2").value.trim();
  const q3 = document.getElementById("q3").value.trim();

  const reportText = `[세계적 상품 교역: AI 무역상 시뮬레이션 성찰 리포트]
- 시작 거점: ${REGIONS_DATA[gameState.homeRegionId]?.name || '미정'}
- 최종 자본금: ${gameState.silver} 은화 (시작: 100 은화)
- 총 확보 상품 수: ${gameState.goodsAcquiredCount}건

Q1. 먼 지역의 상품을 얻기 위해 중개인을 이용한 이유는 무엇인가?
답변: ${q1 || '(미작성)'}

Q2. 교역망이 연결되면 각 지역에는 어떤 변화가 생길 수 있는가?
답변: ${q2 || '(미작성)'}

Q3. 게임에서 경험한 교역과 실제 역사의 차이는 무엇인가?
답변: ${q3 || '(미작성)'}`;

  navigator.clipboard.writeText(reportText).then(() => {
    showAlert("📋 성찰 보고서 전문이 클립보드에 복사되었습니다! (원하는 곳에 붙여넣기(Ctrl+V) 하세요)", "success");
  }).catch(() => {
    showAlert("클립보드 복사에 실패했습니다. 내용을 직접 드래그하여 복사해 주세요.", "warning");
  });
});

function showAlert(msg, type) {
  reflectionAlert.textContent = msg;
  reflectionAlert.className = `reflection-alert ${type}`;
  reflectionAlert.classList.remove("hidden");
}

// 게임 시작
window.addEventListener("DOMContentLoaded", () => {
  initGame();
});
