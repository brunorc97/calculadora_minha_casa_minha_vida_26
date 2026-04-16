const BANDS = [
  { name: "Faixa 1", min: 0, max: 3200, propertyCap: 275000 },
  { name: "Faixa 2", min: 3200.01, max: 5000, propertyCap: 275000 },
  { name: "Faixa 3", min: 5000.01, max: 9600, propertyCap: 400000 },
  { name: "Faixa 4 / Classe Média", min: 9600.01, max: 13000, propertyCap: 600000 },
];

const MAX_TERM_YEARS = 35;
const SAFE_COMMITMENT = 30;
const MIN_DOWN_PAYMENT_PERCENT = 20;
const DFI_MONTHLY_RATE = 0.00018;

const RATE_RULES = [
  {
    min: 0,
    max: 2160,
    rates: {
      N_NE: { cotista: 4.0, nonCotista: 4.5 },
      OTHER: { cotista: 4.25, nonCotista: 4.75 },
    },
  },
  {
    min: 2160.01,
    max: 2850,
    rates: {
      N_NE: { cotista: 4.25, nonCotista: 4.75 },
      OTHER: { cotista: 4.5, nonCotista: 5.0 },
    },
  },
  {
    min: 2850.01,
    max: 3200,
    rates: {
      N_NE: { cotista: 4.5, nonCotista: 5.0 },
      OTHER: { cotista: 4.75, nonCotista: 5.25 },
    },
  },
  {
    min: 3200.01,
    max: 3500,
    rates: {
      N_NE: { cotista: 4.75, nonCotista: 5.25 },
      OTHER: { cotista: 5.0, nonCotista: 5.5 },
    },
  },
  {
    min: 3500.01,
    max: 4000,
    rates: {
      N_NE: { cotista: 5.5, nonCotista: 5.5 },
      OTHER: { cotista: 6.0, nonCotista: 6.0 },
    },
  },
  {
    min: 4000.01,
    max: 5000,
    rates: {
      N_NE: { cotista: 6.5, nonCotista: 6.5 },
      OTHER: { cotista: 7.0, nonCotista: 7.0 },
    },
  },
  {
    min: 5000.01,
    max: 9600,
    rates: {
      N_NE: { cotista: 7.66, nonCotista: 7.66 },
      OTHER: { cotista: 8.16, nonCotista: 8.16 },
    },
  },
  {
    min: 9600.01,
    max: 13000,
    rates: {
      N_NE: { cotista: 8.66, nonCotista: 10.0 },
      OTHER: { cotista: 8.66, nonCotista: 10.0 },
    },
    rateLabel: "Classe Média",
  },
];

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

function getRateRule(income) {
  return RATE_RULES.find((rule) => income >= rule.min && income <= rule.max) || null;
}

function getAnnualRate(income, region, isCotista) {
  const rule = getRateRule(income);
  if (!rule) {
    return 0;
  }

  const regionKey = region === "N_NE" ? "N_NE" : "OTHER";
  return isCotista ? rule.rates[regionKey].cotista : rule.rates[regionKey].nonCotista;
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
  const lastInstallment = amortization + amortization * monthlyRate;
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

function getMipMonthlyRate(age) {
  if (age <= 30) {
    return 0.00012;
  }
  if (age <= 40) {
    return 0.00017;
  }
  if (age <= 50) {
    return 0.00024;
  }
  if (age <= 60) {
    return 0.00038;
  }
  return 0.0006;
}

function calculateInsurance(financedValue, age, months) {
  if (financedValue <= 0) {
    return {
      firstMonthlyInsurance: 0,
      averageMonthlyInsurance: 0,
      lastMonthlyInsurance: 0,
      totalInsurance: 0,
    };
  }

  const mipMonthlyRate = getMipMonthlyRate(age);
  const averageBalance = financedValue / 2;
  const lastBalance = Math.max(financedValue * 0.02, 0);

  const firstMonthlyInsurance = financedValue * (mipMonthlyRate + DFI_MONTHLY_RATE);
  const averageMonthlyInsurance = averageBalance * (mipMonthlyRate + DFI_MONTHLY_RATE);
  const lastMonthlyInsurance = lastBalance * (mipMonthlyRate + DFI_MONTHLY_RATE);

  return {
    firstMonthlyInsurance,
    averageMonthlyInsurance,
    lastMonthlyInsurance,
    totalInsurance: averageMonthlyInsurance * months,
  };
}

function buildBandLegend() {
  const container = document.getElementById("bandLegend");
  container.innerHTML = `
    <h3>Faixas urbanas vigentes em 2026</h3>
    ${BANDS.map((band) => `
      <div class="legend-item">
        <div>
          <strong>${band.name}</strong>
          <div class="muted">${formatBRL(band.min)} até ${formatBRL(band.max)}</div>
        </div>
        <div>
          <strong>Imóvel até ${formatBRL(band.propertyCap)}</strong>
        </div>
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

function syncCombinedDownPayment() {
  const cashDownPayment = parseCurrency(document.getElementById("cashDownPayment").value);
  const hasFgts = document.getElementById("hasFgts").value === "yes";
  const fgtsBalance = hasFgts ? parseCurrency(document.getElementById("fgtsBalance").value) : 0;
  const downPaymentInput = document.getElementById("downPayment");
  downPaymentInput.value = formatBRL(cashDownPayment + fgtsBalance);
}

function toggleFgtsField() {
  const hasFgtsValue = document.getElementById("hasFgts").value;
  const hasFgts = hasFgtsValue === "yes";
  const fgtsBalanceField = document.getElementById("fgtsBalanceField");
  const fgtsBalanceInput = document.getElementById("fgtsBalance");
  const cotistaInput = document.getElementById("cotista");

  fgtsBalanceField.hidden = !hasFgts;
  cotistaInput.disabled = hasFgtsValue !== "yes";

  if (!hasFgts) {
    fgtsBalanceInput.value = formatBRL(0);
    cotistaInput.value = "no";
  }

  syncCombinedDownPayment();
}

function recalculate() {
  const income = parseCurrency(document.getElementById("income").value);
  const propertyValue = parseCurrency(document.getElementById("propertyValue").value);
  const borrowerAge = clamp(Number(document.getElementById("borrowerAge").value) || 0, 18, 80);
  const cashDownPayment = parseCurrency(document.getElementById("cashDownPayment").value);
  const hasFgts = document.getElementById("hasFgts").value === "yes";
  const fgtsBalance = hasFgts ? parseCurrency(document.getElementById("fgtsBalance").value) : 0;
  const downPaymentInput = document.getElementById("downPayment");
  const typedDownPayment = parseCurrency(downPaymentInput.value);
  const region = document.getElementById("region").value;
  const isCotista = document.getElementById("cotista").value === "yes";
  const termYears = clamp(Number(document.getElementById("termYears").value) || 0, 1, MAX_TERM_YEARS);
  const amortization = document.getElementById("amortization").value;

  document.getElementById("borrowerAge").value = borrowerAge;
  document.getElementById("termYears").value = termYears;

  const band = getBand(income);
  const rule = getRateRule(income);
  const annualRate = getAnnualRate(income, region, isCotista);
  const monthlyRate = annualRate / 100 / 12;
  const nominalMonthlyRate = annualRate / 12;
  const effectiveAnnualRate = getEffectiveAnnualRateFromNominal(annualRate);
  const effectiveMonthlyRate = monthlyRate * 100;
  const months = termYears * 12;
  const minimumDownPayment = propertyValue * (MIN_DOWN_PAYMENT_PERCENT / 100);
  const suggestedCombinedDownPayment = cashDownPayment + fgtsBalance;
  const effectiveDownPayment = Math.max(typedDownPayment, suggestedCombinedDownPayment, minimumDownPayment);
  const fgtsUsed = Math.min(fgtsBalance, effectiveDownPayment);
  const cashNeeded = Math.max(effectiveDownPayment - fgtsUsed, 0);
  const financedValue = Math.max(propertyValue - effectiveDownPayment, 0);

  const simulation = amortization === "SAC"
    ? calculateSac(financedValue, monthlyRate, months)
    : calculatePrice(financedValue, monthlyRate, months);
  const insurance = calculateInsurance(financedValue, borrowerAge, months);

  const downPaymentPercent = propertyValue > 0 ? (effectiveDownPayment / propertyValue) * 100 : 0;
  const installmentReference = amortization === "SAC"
    ? simulation.firstInstallment + insurance.firstMonthlyInsurance
    : simulation.averageInstallment + insurance.averageMonthlyInsurance;
  const incomeCommitment = income > 0 ? (installmentReference / income) * 100 : 0;

  if (!band) {
    setAlert("A renda informada está fora das faixas urbanas do MCMV consideradas nesta calculadora.", true);
  } else if (propertyValue > band.propertyCap) {
    setAlert(`Para ${band.name}, esta calculadora considera teto do imóvel de ${formatBRL(band.propertyCap)}.`, true);
  } else if (typedDownPayment < minimumDownPayment) {
    setAlert(`A entrada total considerada nesta simulação é de pelo menos 20% do imóvel (${formatBRL(minimumDownPayment)}). O FGTS pode compor esse valor.`, true);
  } else if (financedValue <= 0) {
    setAlert("A entrada cobre 100% do valor do imóvel. Não há saldo para financiar.", false);
  } else if (incomeCommitment > SAFE_COMMITMENT) {
    setAlert("A parcela estimada com seguros compromete mais de 30% da renda familiar. A CAIXA pode exigir menor valor, mais entrada ou prazo diferente.", true);
  } else if (income <= 3200) {
    setAlert("Cenário Faixa 1. O FGTS Futuro tende a se aplicar apenas à renda de até R$ 3.200, sujeito às regras operacionais do banco.", false);
  } else if (isCotista && income > 9600) {
    setAlert("Cenário Classe Média com elegibilidade ao Pró-Cotista: a simulação usa 8,66% a.a. em vez da taxa padrão de 10,00% a.a. Ter saldo de FGTS, por si só, não ativa essa redução.", false);
  } else if (income > 5000) {
    setAlert("Neste nível de renda, a simulação considera financiamento sem subsídio direto. O FGTS atua principalmente na entrada, amortização e redução de parcelas. Os seguros exibidos são estimados.", false);
  } else {
    setAlert("Simulação dentro de um cenário saudável de comprometimento de renda, considerando juros, amortização e uma estimativa simplificada de seguros.", false);
  }

  setText("bandName", band ? band.name : "Fora do programa");
  setText("propertyCap", band ? formatBRL(band.propertyCap) : "Não disponível");
  setText("annualRate", band ? `${formatPercent(annualRate)} a.a.` : "Não disponível");
  setText("nominalMonthlyRate", band ? `${formatPercent(nominalMonthlyRate)} a.m.` : "Não disponível");
  setText("effectiveAnnualRate", band ? `${formatPercent(effectiveAnnualRate)} a.a.` : "Não disponível");
  setText("effectiveMonthlyRate", band ? `${formatPercent(effectiveMonthlyRate)} a.m.` : "Não disponível");
  setText("termLabel", `${months} meses (${termYears} anos)`);
  setText("financedValue", formatBRL(financedValue));
  setText("downPaymentPercent", formatPercent(downPaymentPercent));
  setText("fgtsUsed", formatBRL(fgtsUsed));
  setText("cashNeeded", formatBRL(cashNeeded));
  setText("incomeCommitment", formatPercent(incomeCommitment));
  setText("estimatedInsurance", formatBRL(insurance.averageMonthlyInsurance));
  setText("firstInstallment", formatBRL(simulation.firstInstallment));
  setText("lastInstallment", formatBRL(simulation.lastInstallment));
  setText("averageInstallment", formatBRL(simulation.averageInstallment));
  setText("totalPaid", formatBRL(simulation.totalPaid));
  setText("firstInstallmentWithInsurance", formatBRL(simulation.firstInstallment + insurance.firstMonthlyInsurance));
  setText("averageInstallmentWithInsurance", formatBRL(simulation.averageInstallment + insurance.averageMonthlyInsurance));

  let tag = `Sistema: ${amortization}`;
  if (rule?.rateLabel) {
    tag += ` • ${rule.rateLabel}`;
  }
  if (isCotista) {
    tag += " • Pró-Cotista";
  }
  setText("systemTag", tag);
}

function setupCurrencyInputs() {
  const currencyInputs = [
    document.getElementById("income"),
    document.getElementById("propertyValue"),
    document.getElementById("cashDownPayment"),
    document.getElementById("fgtsBalance"),
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

      if (input.id === "cashDownPayment" || input.id === "fgtsBalance") {
        syncCombinedDownPayment();
      }

      recalculate();
    });
  });
}

function setup() {
  buildBandLegend();
  setupCurrencyInputs();
  toggleFgtsField();
  syncCombinedDownPayment();

  document.getElementById("termYears").addEventListener("input", recalculate);
  document.getElementById("borrowerAge").addEventListener("input", recalculate);
  document.getElementById("amortization").addEventListener("change", recalculate);
  document.getElementById("region").addEventListener("change", recalculate);
  document.getElementById("cotista").addEventListener("change", recalculate);
  document.getElementById("hasFgts").addEventListener("change", () => {
    toggleFgtsField();
    recalculate();
  });

  recalculate();
}

setup();
