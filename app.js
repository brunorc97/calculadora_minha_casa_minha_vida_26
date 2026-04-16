const BANDS = [
  { name: "Faixa 1", min: 0, max: 3200, rateMin: 4.0, rateMax: 4.5 },
  { name: "Faixa 2", min: 3200.01, max: 5000, rateMin: 4.75, rateMax: 5.5 },
  { name: "Faixa 3", min: 5000.01, max: 9600, rateMin: 6.5, rateMax: 7.66 },
  { name: "Faixa 4", min: 9600.01, max: 13000, rateMin: 10.0, rateMax: 10.0 },
];

const MAX_TERM_YEARS = 35;
const SAFE_COMMITMENT = 30;
const MIN_DOWN_PAYMENT_PERCENT = 20;

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function parseCurrency(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setInitialCurrencyInput(input) {
  input.value = formatBRL(parseCurrency(input.value));
}

function toEditableCurrency(value) {
  const numericValue = parseCurrency(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  const hasDecimals = Math.abs(numericValue % 1) > 0;
  return hasDecimals
    ? numericValue.toFixed(2).replace(".", ",")
    : String(Math.round(numericValue));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBand(income) {
  return BANDS.find((band) => income >= band.min && income <= band.max) || null;
}

function getAnnualRate(income, band) {
  if (!band) {
    return 0;
  }

  if (band.rateMin === band.rateMax) {
    return band.rateMin;
  }

  const progress = (income - band.min) / (band.max - band.min);
  return band.rateMin + (band.rateMax - band.rateMin) * clamp(progress, 0, 1);
}

function calculatePrice(financedValue, monthlyRate, months) {
  if (financedValue <= 0 || months <= 0) {
    return {
      firstInstallment: 0,
      lastInstallment: 0,
      averageInstallment: 0,
      totalPaid: 0,
    };
  }

  if (monthlyRate <= 0) {
    const installment = financedValue / months;
    return {
      firstInstallment: installment,
      lastInstallment: installment,
      averageInstallment: installment,
      totalPaid: installment * months,
    };
  }

  const factor = Math.pow(1 + monthlyRate, months);
  const installment = financedValue * ((monthlyRate * factor) / (factor - 1));

  return {
    firstInstallment: installment,
    lastInstallment: installment,
    averageInstallment: installment,
    totalPaid: installment * months,
  };
}

function calculateSac(financedValue, monthlyRate, months) {
  if (financedValue <= 0 || months <= 0) {
    return {
      firstInstallment: 0,
      lastInstallment: 0,
      averageInstallment: 0,
      totalPaid: 0,
    };
  }

  const amortization = financedValue / months;
  const firstInstallment = amortization + financedValue * monthlyRate;
  const lastBalance = amortization;
  const lastInstallment = amortization + lastBalance * monthlyRate;
  const totalInterest = monthlyRate > 0 ? monthlyRate * financedValue * (months + 1) / 2 : 0;
  const totalPaid = financedValue + totalInterest;

  return {
    firstInstallment,
    lastInstallment,
    averageInstallment: totalPaid / months,
    totalPaid,
  };
}

function getEffectiveAnnualRateFromNominal(annualRate) {
  const monthlyRate = annualRate / 100 / 12;
  return (Math.pow(1 + monthlyRate, 12) - 1) * 100;
}

function buildBandLegend() {
  const container = document.getElementById("bandLegend");
  container.innerHTML = `
    <h3>Faixas vigentes</h3>
    ${BANDS.map((band) => `
      <div class="legend-item">
        <div>
          <strong>${band.name}</strong>
          <div class="muted">${formatBRL(band.min)} até ${formatBRL(band.max)}</div>
        </div>
        <div><strong>${formatPercent(band.rateMin)}${band.rateMin !== band.rateMax ? ` a ${formatPercent(band.rateMax)}` : ""} a.a.</strong></div>
      </div>
    `).join("")}
  `;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function setAlert(message, isWarning) {
  const alert = document.getElementById("mainAlert");
  alert.textContent = message;
  alert.className = isWarning ? "alert warn" : "alert";
}

function recalculate() {
  const income = parseCurrency(document.getElementById("income").value);
  const propertyValue = parseCurrency(document.getElementById("propertyValue").value);
  const downPaymentInput = document.getElementById("downPayment");
  const downPayment = parseCurrency(downPaymentInput.value);
  const termYears = clamp(Number(document.getElementById("termYears").value) || 0, 1, MAX_TERM_YEARS);
  const amortization = document.getElementById("amortization").value;

  document.getElementById("termYears").value = termYears;

  const minimumDownPayment = propertyValue * (MIN_DOWN_PAYMENT_PERCENT / 100);
  const effectiveDownPayment = Math.max(downPayment, minimumDownPayment);
  const months = termYears * 12;
  const financedValue = Math.max(propertyValue - effectiveDownPayment, 0);
  const band = getBand(income);
  const annualRate = getAnnualRate(income, band);
  const monthlyRate = annualRate / 100 / 12;
  const nominalMonthlyRate = annualRate / 12;
  const effectiveAnnualRate = getEffectiveAnnualRateFromNominal(annualRate);
  const effectiveMonthlyRate = monthlyRate * 100;

  const simulation = amortization === "SAC"
    ? calculateSac(financedValue, monthlyRate, months)
    : calculatePrice(financedValue, monthlyRate, months);

  const downPaymentPercent = propertyValue > 0 ? (effectiveDownPayment / propertyValue) * 100 : 0;
  const installmentReference = amortization === "SAC"
    ? simulation.firstInstallment
    : simulation.averageInstallment;
  const incomeCommitment = income > 0 ? (installmentReference / income) * 100 : 0;

  if (!band) {
    setAlert("A renda informada está fora das faixas atuais do Minha Casa Minha Vida consideradas nesta calculadora.", true);
  } else if (propertyValue > 0 && downPayment < minimumDownPayment) {
    setAlert(`A entrada mínima considerada nesta simulação é de 20% do imóvel (${formatBRL(minimumDownPayment)}).`, true);
  } else if (financedValue <= 0) {
    setAlert("A entrada cobre 100% do valor do imóvel. Não há saldo para financiar.", false);
  } else if (incomeCommitment > SAFE_COMMITMENT) {
    setAlert("A parcela estimada compromete mais de 30% da renda familiar. O banco pode exigir ajuste no valor, entrada ou prazo.", true);
  } else {
    setAlert("Simulação dentro de um cenário saudável de comprometimento de renda, considerando apenas esta estimativa.", false);
  }

  setText("bandName", band ? band.name : "Fora do programa");
  setText("annualRate", band ? `${formatPercent(annualRate)} a.a.` : "Não disponível");
  setText("nominalMonthlyRate", band ? `${formatPercent(nominalMonthlyRate)} a.m.` : "Não disponível");
  setText("effectiveAnnualRate", band ? `${formatPercent(effectiveAnnualRate)} a.a.` : "Não disponível");
  setText("effectiveMonthlyRate", band ? `${formatPercent(effectiveMonthlyRate)} a.m.` : "Não disponível");
  setText("termLabel", `${months} meses (${termYears} anos)`);
  setText("financedValue", formatBRL(financedValue));
  setText("downPaymentPercent", formatPercent(downPaymentPercent));
  setText("incomeCommitment", formatPercent(incomeCommitment));
  setText("firstInstallment", formatBRL(simulation.firstInstallment));
  setText("lastInstallment", formatBRL(simulation.lastInstallment));
  setText("averageInstallment", formatBRL(simulation.averageInstallment));
  setText("totalPaid", formatBRL(simulation.totalPaid));
  setText("systemTag", `Sistema: ${amortization}`);
}

function setup() {
  buildBandLegend();

  const currencyInputs = [
    document.getElementById("income"),
    document.getElementById("propertyValue"),
    document.getElementById("downPayment"),
  ];

  currencyInputs.forEach((input) => {
    setInitialCurrencyInput(input);
    input.addEventListener("focus", () => {
      input.value = toEditableCurrency(input.value);
    });
    input.addEventListener("input", recalculate);
    input.addEventListener("blur", () => {
      let nextValue = parseCurrency(input.value);

      if (input.id === "downPayment") {
        const propertyValue = parseCurrency(document.getElementById("propertyValue").value);
        const minimumDownPayment = propertyValue * (MIN_DOWN_PAYMENT_PERCENT / 100);
        nextValue = Math.max(nextValue, minimumDownPayment);
      }

      input.value = formatBRL(nextValue);
      recalculate();
    });
  });

  document.getElementById("termYears").addEventListener("input", recalculate);
  document.getElementById("amortization").addEventListener("change", recalculate);

  recalculate();
}

setup();
