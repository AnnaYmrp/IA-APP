/**
 * Cronómetro Vital: Guía de Código Azul (ResusTime)
 * Motor Clínico de Tiempos, Fármacos y Bitácora ACLS
 */

// ==========================================
// 1. SISTEMA DE AUDIO (Web Audio API Sintetizado)
// ==========================================
// Cero dependencias de archivos externos (.mp3) que puedan fallar o bloquearse.
class ClinicalAudioSystem {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.hasUnlocked = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.hasUnlocked = true;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
  }

  // Tono suave de confirmación / clic táctil
  playClick() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio click error:', e);
    }
  }

  // Chime hospitalario armónico para aviso de 2 minutos (Evaluación de Ritmo y Cambio de Operador)
  play2MinChime() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [
        { freq: 523.25, time: now, dur: 0.35 },       // C5
        { freq: 659.25, time: now + 0.25, dur: 0.5 },  // E5
        { freq: 783.99, time: now + 0.5, dur: 0.7 }   // G5
      ].forEach(tone => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(tone.freq, tone.time);
        gain.gain.setValueAtTime(0.18, tone.time);
        gain.gain.exponentialRampToValueAtTime(0.001, tone.time + tone.dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(tone.time);
        osc.stop(tone.time + tone.dur);
      });
    } catch (e) {
      console.warn('Audio 2min chime error:', e);
    }
  }

  // Alarma pulsante de 3 minutos para Adrenalina (Siguiente Dosis)
  playEpi3MinAlert() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 3 pulsos cortos de alerta médica
      for (let i = 0; i < 3; i++) {
        const t = now + (i * 0.22);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t); // A5
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      }
    } catch (e) {
      console.warn('Audio Epi alert error:', e);
    }
  }

  // Tono de carga y descarga de desfibrilador
  playShockBeep() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.4);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio Shock error:', e);
    }
  }
}

const audio = new ClinicalAudioSystem();

// ==========================================
// 2. ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
const STORAGE_KEY = 'cronometro_vital_state_v2';

const defaultState = {
  isActive: false,
  isPaused: false,
  startTime: null,          // Timestamp ms
  startWallClock: null,     // Formato "HH:MM:SS"
  elapsedSeconds: 0,
  
  // Ciclos RCP (2 minutos)
  cycleElapsedSeconds: 0,
  cycleTargetSeconds: 120,  // 2 min exactos
  cyclesCount: 0,
  hasAlertedCycle2Min: false,

  // Desfibrilaciones
  shocksCount: 0,
  totalJoules: 0,
  lastShockJoules: null,

  // Fármacos
  epiCount: 0,
  lastEpiElapsedSeconds: null,
  hasAlertedEpi3Min: false,
  
  // Contadores de otros fármacos
  drugStats: {
    amiodaronaDoses: 0,
    amiodaronaMg: 0,
    lidocainaDoses: 0,
    lidocainaMg: 0,
    magnesioDoses: 0,
    magnesioG: 0,
    bicarbonatoDoses: 0,
    bicarbonatoMeq: 0,
    calcioDoses: 0,
    calcioG: 0
  },

  // Estado del paciente y ritmo
  lastRhythm: 'No clasificado',
  airwayStatus: 'No asegurada',
  vascularAccess: 'Sin vía confirmada',
  outcome: 'En reanimación activa', // 'ROSC', 'Cese', etc.
  outcomeTime: null,

  // Historial de Bitácora
  events: [],

  // Preferencias
  soundEnabled: true,
  currentTab: 'consola-principal'
};

let appState = loadState();
let timerInterval = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
  return { ...defaultState };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Error guardando estado:', e);
  }
}

// ==========================================
// 3. UTILIDADES DE TIEMPO
// ==========================================
function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getWallClockTimeString() {
  const d = new Date();
  return d.toTimeString().split(' ')[0]; // "HH:MM:SS"
}

function getFormattedDate() {
  const d = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('es-ES', options);
}

// ==========================================
// 4. GESTIÓN DE EVENTOS DE BITÁCORA
// ==========================================
function logEvent(category, title, details = '', badgeColor = 'text-primary') {
  const event = {
    id: 'evt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    realTime: getWallClockTimeString(),
    codeTimeFormatted: formatMMSS(appState.elapsedSeconds),
    codeTimeSeconds: appState.elapsedSeconds,
    category: category, // 'FÁRMACO', 'DESFIBRILACIÓN', 'CICLO/RITMO', 'VÍA AÉREA', 'ACCESO', 'NOTA'
    title: title,
    details: details,
    badgeColor: badgeColor
  };

  appState.events.unshift(event); // Más reciente primero
  saveState();
  renderTimeline();
  renderLiveMiniFeed();
  renderLeaderHUD();
  renderSBARSummary();
  return event;
}

// ==========================================
// 5. MOTOR DE CRONÓMETROS (1 SEGUNDO TICK)
// ==========================================
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  if (!appState.isActive || appState.isPaused) return;

  appState.elapsedSeconds++;
  appState.cycleElapsedSeconds++;

  // --- REVISIÓN ALARMA 2 MINUTOS (CICLO RCP) ---
  if (appState.cycleElapsedSeconds >= appState.cycleTargetSeconds) {
    if (!appState.hasAlertedCycle2Min) {
      appState.hasAlertedCycle2Min = true;
      audio.play2MinChime();
    }
  }

  // --- REVISIÓN ALARMA 3 MINUTOS (ADRENALINA) ---
  if (appState.lastEpiElapsedSeconds !== null) {
    const timeSinceEpi = appState.elapsedSeconds - appState.lastEpiElapsedSeconds;
    if (timeSinceEpi >= 180) { // 3 minutos
      if (!appState.hasAlertedEpi3Min) {
        appState.hasAlertedEpi3Min = true;
        audio.playEpi3MinAlert();
      }
    }
  }

  updateTimersUI();
  
  // Guardar periódicamente cada 5 seg
  if (appState.elapsedSeconds % 5 === 0) {
    saveState();
  }
}

function updateTimersUI() {
  // Reloj Maestro
  const masterTimerEl = document.getElementById('master-timer');
  const headerTimerEl = document.getElementById('header-master-timer');
  const timeFormatted = formatMMSS(appState.elapsedSeconds);
  if (masterTimerEl) masterTimerEl.textContent = timeFormatted;
  if (headerTimerEl) headerTimerEl.textContent = timeFormatted;

  // Reloj de Ciclo RCP (Cuenta regresiva o transcurrido)
  const cycleTimerEl = document.getElementById('cycle-timer');
  const cycleSvgRing = document.getElementById('cycle-svg-ring');
  const cyclePercentEl = document.getElementById('cycle-percent-label');
  const cycleAlertBanner = document.getElementById('cycle-alert-banner');

  const cycleSec = appState.cycleElapsedSeconds;
  const targetSec = appState.cycleTargetSeconds; // 120s

  if (cycleTimerEl) {
    cycleTimerEl.textContent = formatMMSS(cycleSec);
  }

  const percent = Math.min(100, Math.round((cycleSec / targetSec) * 100));
  if (cyclePercentEl) {
    cyclePercentEl.textContent = `${percent}%`;
  }

  if (cycleSvgRing) {
    cycleSvgRing.setAttribute('stroke-dasharray', `${percent}, 100`);
  }

  // Banner y Estado de Alerta de 2 Minutos
  if (cycleSec >= targetSec) {
    // Alarma MORADA cumplida (Requerimiento del usuario)
    if (cycleAlertBanner) {
      cycleAlertBanner.classList.remove('hidden', 'bg-secondary-container/90');
      cycleAlertBanner.classList.add('flex', 'alert-purple-cycle', 'border-2', 'border-purple-400');
      
      const bannerTitle = document.getElementById('cycle-banner-title');
      const bannerSub = document.getElementById('cycle-banner-sub');
      if (bannerTitle) bannerTitle.textContent = '¡2 MINUTOS CUMPLIDOS! EVALUAR RITMO';
      if (bannerSub) bannerSub.textContent = 'Pausar compresiones <10s • Evaluar ritmo/pulso • CAMBIO OBLIGATORIO DE OPERADOR EN MASAJE CARDÍACO';
    }
    if (cycleTimerEl) {
      cycleTimerEl.classList.remove('text-secondary');
      cycleTimerEl.classList.add('text-purple-400', 'animate-pulse');
    }
  } else if (targetSec - cycleSec <= 15) {
    // Advertencia preventiva (últimos 15 segundos)
    if (cycleAlertBanner) {
      cycleAlertBanner.classList.remove('hidden', 'alert-purple-cycle', 'border-purple-400');
      cycleAlertBanner.classList.add('flex', 'bg-secondary-container/90');
      
      const bannerTitle = document.getElementById('cycle-banner-title');
      const bannerSub = document.getElementById('cycle-banner-sub');
      if (bannerTitle) bannerTitle.textContent = `FALTAN ${targetSec - cycleSec}s PARA EVALUAR RITMO`;
      if (bannerSub) bannerSub.textContent = 'Preparar relevo de masajista y preparación de palas/parches';
    }
  } else {
    // En progreso normal
    if (cycleAlertBanner) {
      cycleAlertBanner.classList.add('hidden');
      cycleAlertBanner.classList.remove('flex', 'alert-purple-cycle', 'border-2', 'border-purple-400');
    }
    if (cycleTimerEl) {
      cycleTimerEl.classList.remove('text-purple-400', 'animate-pulse');
      cycleTimerEl.classList.add('text-secondary');
    }
  }

  // --- MÓDULO ADRENALINA (Estado y Colores Verde / Amarillo / Rojo a los 3 min) ---
  updateAdrenalineUI();

  // Contadores
  const cyclesCountEl = document.getElementById('cycles-count');
  const shocksCountEl = document.getElementById('shocks-count');
  const epiCountEl = document.getElementById('epi-count');
  const cardEpiCountEl = document.getElementById('card-epi-count');

  if (cyclesCountEl) cyclesCountEl.textContent = appState.cyclesCount;
  if (shocksCountEl) shocksCountEl.textContent = appState.shocksCount;
  if (epiCountEl) epiCountEl.textContent = appState.epiCount;
  if (cardEpiCountEl) cardEpiCountEl.textContent = appState.epiCount;
}

function updateAdrenalineUI() {
  const epiTimeLabel = document.getElementById('epi-last-time-label');
  const epiStatusBadge = document.getElementById('epi-status-badge');
  const epiBannerAlert = document.getElementById('epi-banner-alert');
  const epiCard = document.getElementById('card-adrenalina-btn');

  if (appState.lastEpiElapsedSeconds === null) {
    if (epiTimeLabel) epiTimeLabel.innerHTML = 'Sin dosis administrada aún';
    if (epiStatusBadge) {
      epiStatusBadge.textContent = 'Pendiente según protocolo';
      epiStatusBadge.className = 'px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase font-bold';
    }
    if (epiBannerAlert) epiBannerAlert.classList.add('hidden');
    if (epiCard) epiCard.classList.remove('alert-red-epi', 'border-red-500');
    return;
  }

  const elapsedSinceEpi = appState.elapsedSeconds - appState.lastEpiElapsedSeconds;
  const formattedSince = formatMMSS(elapsedSinceEpi);

  if (elapsedSinceEpi < 120) {
    // MENOS DE 2 MINUTOS: VERDE AL APLICAR (Requerimiento)
    if (epiTimeLabel) epiTimeLabel.innerHTML = `Última dosis: <strong class="text-emerald-400">Hace ${formattedSince} min</strong>`;
    if (epiStatusBadge) {
      epiStatusBadge.textContent = 'Dosis Reciente (Efecto Activo)';
      epiStatusBadge.className = 'px-space-xs py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-600 font-label-sm text-label-sm uppercase font-bold';
    }
    if (epiBannerAlert) epiBannerAlert.classList.add('hidden');
    if (epiCard) {
      epiCard.classList.remove('alert-red-epi', 'border-red-500');
      epiCard.style.borderColor = '#10B981'; // Verde
    }
  } else if (elapsedSinceEpi < 180) {
    // ENTRE 2 Y 3 MINUTOS: ÁMBAR / PREPARACIÓN
    if (epiTimeLabel) epiTimeLabel.innerHTML = `Última dosis: <strong class="text-amber-400">Hace ${formattedSince} min</strong>`;
    if (epiStatusBadge) {
      epiStatusBadge.textContent = 'Preparar ampolla 1 mg';
      epiStatusBadge.className = 'px-space-xs py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-label-sm text-label-sm uppercase font-bold';
    }
    if (epiBannerAlert) epiBannerAlert.classList.add('hidden');
    if (epiCard) {
      epiCard.classList.remove('alert-red-epi', 'border-red-500');
      epiCard.style.borderColor = '#F59E0B'; // Ámbar
    }
  } else {
    // A LOS 3 MINUTOS EXACTOS: ROJO ALARMA VISUAL (Requerimiento)
    if (epiTimeLabel) epiTimeLabel.innerHTML = `Última dosis: <strong class="text-red-400 font-bold">Hace ${formattedSince} min (¡VENTANA CUMPLIDA!)</strong>`;
    if (epiStatusBadge) {
      epiStatusBadge.textContent = '¡APLICAR SIGUIENTE DOSIS AHORA!';
      epiStatusBadge.className = 'px-space-xs py-0.5 rounded bg-red-900 text-red-100 font-label-sm text-label-sm uppercase font-bold animate-pulse border border-red-400';
    }
    if (epiBannerAlert) {
      epiBannerAlert.classList.remove('hidden');
      epiBannerAlert.classList.add('flex', 'alert-red-epi');
    }
    if (epiCard) {
      epiCard.classList.add('alert-red-epi', 'border-2', 'border-red-500');
    }
  }
}

// ==========================================
// 6. ACCIONES CLÍNICAS PRINCIPALES
// ==========================================

// Iniciar Código Azul tras confirmación en pantalla previa
function confirmAndStartCode() {
  audio.init();
  audio.playClick();

  const c1 = document.getElementById('pre-check-1').checked;
  const c2 = document.getElementById('pre-check-2').checked;
  const c3 = document.getElementById('pre-check-3').checked;

  if (!c1 || !c2 || !c3) {
    alert('Por seguridad clínica, verifique y marque las 3 condiciones críticas antes de activar el Código Azul.');
    return;
  }

  appState.isActive = true;
  appState.isPaused = false;
  appState.startTime = Date.now();
  appState.startWallClock = getWallClockTimeString();
  appState.elapsedSeconds = 0;
  appState.cycleElapsedSeconds = 0;
  appState.cyclesCount = 1;
  appState.events = [];

  logEvent(
    'CÓDIGO AZUL',
    'INICIO FORMAL DE CÓDIGO AZUL',
    'PCR Confirmado: Paciente sin respuesta, sin pulso carotídeo y con apnea/gasping. Se inician maniobras de RCP 30:2 / continuas.',
    'text-primary'
  );

  document.getElementById('pre-code-modal').classList.add('hidden');
  document.getElementById('code-active-badge').classList.remove('hidden');
  document.getElementById('code-standby-badge').classList.add('hidden');
  
  const startTimeEl = document.getElementById('start-time-display');
  if (startTimeEl) startTimeEl.textContent = `Hora Inicio: ${appState.startWallClock}`;

  startTimerLoop();
  updateTimersUI();
  saveState();
}

// Reiniciar Ciclo de RCP (2 Minutos)
function resetCPRCycle(evaluatedRhythm = null) {
  audio.playClick();
  appState.cyclesCount++;
  appState.cycleElapsedSeconds = 0;
  appState.hasAlertedCycle2Min = false;

  const rhythmText = evaluatedRhythm || appState.lastRhythm || 'No especificado';
  logEvent(
    'CICLO/RITMO',
    `FIN CICLO ${appState.cyclesCount - 1} • RELEVO DE MASAJISTA`,
    `Ritmo evaluado: ${rhythmText}. Se reanudan compresiones torácicas inmediatamente con relevo de operador.`,
    'text-secondary'
  );

  updateTimersUI();
  saveState();
}

// Módulo de Adrenalina: Aplicación de 1 mg IV/IO
function administerAdrenaline() {
  audio.playClick();
  appState.epiCount++;
  appState.lastEpiElapsedSeconds = appState.elapsedSeconds;
  appState.hasAlertedEpi3Min = false;

  logEvent(
    'FÁRMACO',
    `ADRENALINA 1 mg IV/IO (#${appState.epiCount})`,
    `Dosis #${appState.epiCount} administrada en bolo rápido IV/IO + flush de 20 mL solución salina. Próxima dosis recomendada en 3 a 5 minutos.`,
    'text-tertiary'
  );

  updateTimersUI();
  saveState();
}

// Módulo de Desfibrilación: Selección de Joules
function openDefibModal() {
  audio.playClick();
  const modal = document.getElementById('defib-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeDefibModal() {
  const modal = document.getElementById('defib-modal');
  if (modal) modal.classList.add('hidden');
}

function confirmDefibrillation(joules) {
  let energy = joules;
  if (!energy) {
    const customInput = document.getElementById('custom-joules-input');
    energy = customInput && customInput.value ? customInput.value + ' J' : '200 J';
  }

  audio.playShockBeep();
  closeDefibModal();

  appState.shocksCount++;
  const numJoules = parseInt(energy, 10) || 0;
  appState.totalJoules += numJoules;
  appState.lastShockJoules = energy;

  logEvent(
    'DESFIBRILACIÓN',
    `DESCARGA #${appState.shocksCount}: ${energy}`,
    `Descarga no sincronizada de ${energy} aplicada por el líder. ¡Compresiones torácicas reanudadas de inmediato por 2 minutos sin pausar para evaluar ritmo!`,
    'text-primary'
  );

  // Reiniciar ciclo de 2 min tras choque según guías ACLS
  appState.cycleElapsedSeconds = 0;
  appState.hasAlertedCycle2Min = false;

  updateTimersUI();
  saveState();
}

// Módulo de Fármacos Adicionales con selección de dosis
function openDrugModal(defaultDrug = 'Amiodarona') {
  audio.playClick();
  const modal = document.getElementById('drug-modal');
  if (modal) {
    modal.classList.remove('hidden');
    selectDrugInModal(defaultDrug);
  }
}

function closeDrugModal() {
  const modal = document.getElementById('drug-modal');
  if (modal) modal.classList.add('hidden');
}

let selectedModalDrug = 'Amiodarona';

function selectDrugInModal(drugName) {
  selectedModalDrug = drugName;
  const titleEl = document.getElementById('modal-drug-title');
  const quickDosesContainer = document.getElementById('modal-quick-doses');
  const customDoseInput = document.getElementById('modal-custom-dose');
  const indicationsEl = document.getElementById('modal-drug-indication');

  if (titleEl) titleEl.textContent = drugName.toUpperCase();

  // Configuración de dosis típicas según ACLS
  const drugConfigs = {
    Amiodarona: {
      quickDoses: ['300 mg IV (1ra dosis)', '150 mg IV (2da dosis)', 'Dosis infusión'],
      defaultUnit: 'mg',
      indication: 'Indicado en FV / TV sin pulso refractaria a descargas después del 3er choque.'
    },
    Lidocaína: {
      quickDoses: ['100 mg (1-1.5 mg/kg)', '50 mg (0.5-0.75 mg/kg)', '75 mg IV'],
      defaultUnit: 'mg',
      indication: 'Alternativa antiarrítmica a la amiodarona en FV/TV sin pulso.'
    },
    'Sulfato de Magnesio': {
      quickDoses: ['2 g IV en bolo', '1 g IV', '4 g en infusión'],
      defaultUnit: 'g',
      indication: 'Tratamiento de elección para Torsades de Pointes (TV polimórfica con QT largo) o hipomagnesemia.'
    },
    'Bicarbonato de Sodio': {
      quickDoses: ['50 mEq (1 ampolla)', '1 mEq/kg', '100 mEq IV'],
      defaultUnit: 'mEq',
      indication: 'Hiperkalemia conocida, acidosis metabólica preexistente severa o intoxicación por antidepresivos tricíclicos.'
    },
    'Gluconato de Calcio': {
      quickDoses: ['1 g IV (10 mL al 10%)', '2 g IV', '3 g IV'],
      defaultUnit: 'g',
      indication: 'Hiperkalemia severa con cambios en el ECG, hipocalcemia o toxicidad por bloqueadores de canales de calcio.'
    },
    'Dextrosa 50%': {
      quickDoses: ['25 g (50 mL DAD 50%)', '50 g (100 mL)', '12.5 g IV'],
      defaultUnit: 'g',
      indication: 'Hipoglicemia documentada como causa reversible (5H).'
    }
  };

  const cfg = drugConfigs[drugName] || {
    quickDoses: ['1 dosis estándar', 'Dosis personalizada'],
    defaultUnit: '',
    indication: 'Administración bajo orden médica directa.'
  };

  if (indicationsEl) indicationsEl.textContent = cfg.indication;
  if (customDoseInput) {
    customDoseInput.value = '';
    customDoseInput.placeholder = `Escribe dosis según orden médica (ej. 150 ${cfg.defaultUnit})`;
  }

  if (quickDosesContainer) {
    quickDosesContainer.innerHTML = '';
    cfg.quickDoses.forEach(dose => {
      const btn = document.createElement('button');
      btn.className = 'py-space-sm px-space-md bg-surface-container-high hover:bg-tertiary-container hover:text-on-tertiary-container rounded font-label-md text-label-md uppercase font-semibold transition-colors text-left';
      btn.textContent = dose;
      btn.onclick = () => {
        if (customDoseInput) customDoseInput.value = dose;
      };
      quickDosesContainer.appendChild(btn);
    });
  }
}

function confirmDrugAdministration() {
  audio.playClick();
  const customInput = document.getElementById('modal-custom-dose');
  const dose = customInput && customInput.value.trim() ? customInput.value.trim() : 'Dosis estándar';

  // Actualizar estadísticas según el fármaco
  if (selectedModalDrug === 'Amiodarona') {
    appState.drugStats.amiodaronaDoses++;
    if (dose.includes('300')) appState.drugStats.amiodaronaMg += 300;
    else if (dose.includes('150')) appState.drugStats.amiodaronaMg += 150;
  } else if (selectedModalDrug === 'Lidocaína') {
    appState.drugStats.lidocainaDoses++;
  } else if (selectedModalDrug === 'Sulfato de Magnesio') {
    appState.drugStats.magnesioDoses++;
  } else if (selectedModalDrug === 'Bicarbonato de Sodio') {
    appState.drugStats.bicarbonatoDoses++;
  } else if (selectedModalDrug === 'Gluconato de Calcio') {
    appState.drugStats.calcioDoses++;
  }

  logEvent(
    'FÁRMACO',
    `${selectedModalDrug.toUpperCase()} • ${dose}`,
    `Administrado según orden médica por vía intravenosa/intraósea con bolo posterior de arrastre salino.`,
    'text-tertiary'
  );

  closeDrugModal();
  saveState();
}

// Modal de Evaluación de Ritmo
function openRhythmModal() {
  audio.playClick();
  const modal = document.getElementById('rhythm-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeRhythmModal() {
  const modal = document.getElementById('rhythm-modal');
  if (modal) modal.classList.add('hidden');
}

function setRhythm(rhythmName, isShockable) {
  audio.playClick();
  appState.lastRhythm = rhythmName;
  closeRhythmModal();

  logEvent(
    'CICLO/RITMO',
    `RITMO EVALUADO: ${rhythmName.toUpperCase()}`,
    isShockable
      ? 'Ritmo desfibrilable detectado. ¡Preparar desfibrilador, despejar área y administrar choque!'
      : 'Ritmo no desfibrilable. Reanudar compresiones inmediatamente, considerar adrenalina temprana y buscar 5H/5T.',
    isShockable ? 'text-primary' : 'text-outline'
  );

  // Reiniciar ciclo de 2 min
  resetCPRCycle(rhythmName);
}

// Manejo de Vía Aérea
function recordAirway(type) {
  audio.playClick();
  appState.airwayStatus = type;
  logEvent(
    'VÍA AÉREA',
    `VÍA AÉREA: ${type.toUpperCase()}`,
    'Dispositivo instalado con éxito. Se verifica capnografía cuantitativa y excursión torácica bilateral.',
    'text-outline'
  );
  saveState();
}

// Acceso Vascular
function recordVascular(type) {
  audio.playClick();
  appState.vascularAccess = type;
  logEvent(
    'ACCESO',
    `ACCESO LOGRADO: ${type.toUpperCase()}`,
    'Acceso permeable y comprobado para administración de volumen y vasopresores.',
    'text-outline'
  );
  saveState();
}

// Cierre de Código: ROSC (RCE) o Cese
function recordResolution(type) {
  audio.playClick();
  const isROSC = type === 'ROSC';
  appState.outcome = isROSC ? 'RCE (Retorno de Circulación Espontánea) Obtenido' : 'Cese de Maniobras Declarado';
  appState.outcomeTime = getWallClockTimeString();
  appState.isPaused = true;

  logEvent(
    'RESOLUCIÓN',
    isROSC ? '¡R.C.E. LOGRADO (RETORNO CIRCULACIÓN)!' : 'DECLARACIÓN FORMAL DE CESE DE MANIOBRAS',
    isROSC
      ? 'Presencia de pulso carotídeo central y elevación de ETCO2. Se inician cuidados post-paro cardíaco (hipotermia guiada, hemodinamia, traslado a UCI).'
      : 'Líder del equipo médico declara finalización de esfuerzos de reanimación por asistolia refractaria y tiempo prolongado.',
    isROSC ? 'text-emerald-400' : 'text-error'
  );

  // Cambiar a la pestaña de reporte SBAR automáticamente
  switchTab('resumen-entrega-turno');
  saveState();
}

// Ajuste retroactivo de tiempo (+1 min) si el código arrancó tarde
function adjustTime(minutes) {
  audio.playClick();
  appState.elapsedSeconds += (minutes * 60);
  logEvent('AJUSTE', `AJUSTE CRONOLÓGICO: +${minutes} MIN`, 'Corrección de tiempo estimado previo al inicio del registro formal.');
  updateTimersUI();
  saveState();
}

// ==========================================
// 7. RENDERIZADO DE VISTAS Y COMPONENTES
// ==========================================

// Renderizar Línea de Tiempo Completa
function renderTimeline(filterCategory = 'ALL') {
  const container = document.getElementById('full-timeline-container');
  if (!container) return;

  const events = appState.events.filter(e => {
    if (filterCategory === 'ALL') return true;
    return e.category === filterCategory;
  });

  if (events.length === 0) {
    container.innerHTML = `
      <div class="p-space-lg text-center text-outline bg-surface-container rounded-lg">
        <span class="material-symbols-outlined text-[36px] mb-2">event_busy</span>
        <p class="font-headline-sm text-headline-sm">No hay eventos registrados en esta categoría.</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Los eventos aparecerán aquí automáticamente al tocar los botones de acción.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(evt => `
    <div class="flex items-start gap-space-md p-space-sm bg-surface-container rounded-lg border-l-4 ${getBorderColorClass(evt.category)} shadow-sm hover:bg-surface-container-high transition-colors">
      <div class="flex flex-col items-center flex-shrink-0 w-20 text-center">
        <span class="font-label-lg text-label-lg font-bold text-on-surface tabular-nums">${evt.codeTimeFormatted}</span>
        <span class="font-label-sm text-label-sm text-outline tabular-nums">${evt.realTime}</span>
      </div>
      <div class="flex-1 flex flex-col">
        <div class="flex items-center justify-between gap-space-xs">
          <span class="font-label-sm text-label-sm font-bold uppercase tracking-wider ${evt.badgeColor}">${evt.category}</span>
          <span class="font-label-sm text-label-sm text-outline">ID: ${evt.id.slice(-4)}</span>
        </div>
        <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface uppercase mt-0.5">${evt.title}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1 leading-snug">${evt.details}</p>
      </div>
    </div>
  `).join('');
}

function getBorderColorClass(category) {
  switch (category) {
    case 'DESFIBRILACIÓN': return 'border-l-primary';
    case 'FÁRMACO': return 'border-l-tertiary';
    case 'CICLO/RITMO': return 'border-l-secondary';
    case 'RESOLUCIÓN': return 'border-l-emerald-400';
    default: return 'border-l-outline';
  }
}

// Mini Feed en Vivo (Consola Principal)
function renderLiveMiniFeed() {
  const container = document.getElementById('live-mini-feed');
  if (!container) return;

  const recent = appState.events.slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = `<p class="font-body-sm text-body-sm text-outline py-space-sm text-center">Sin eventos registrados aún.</p>`;
    return;
  }

  container.innerHTML = recent.map(evt => `
    <div class="flex items-start gap-space-xs py-space-xs border-b border-surface-variant/40 last:border-b-0">
      <span class="font-label-sm text-label-sm font-bold text-primary tabular-nums w-12 flex-shrink-0">${evt.codeTimeFormatted}</span>
      <div class="flex flex-col flex-1 leading-tight">
        <span class="font-label-sm text-label-sm font-bold text-on-surface uppercase truncate">${evt.title}</span>
        <span class="font-body-sm text-body-sm text-on-surface-variant/80 truncate">${evt.details}</span>
      </div>
    </div>
  `).join('');
}

// HUD de Respuesta Rápida al Líder (Pestaña Fármacos)
function renderLeaderHUD() {
  // Última Adrenalina
  const hudEpiTime = document.getElementById('hud-epi-time');
  const hudEpiDoses = document.getElementById('hud-epi-doses');
  if (hudEpiTime) {
    hudEpiTime.textContent = appState.lastEpiElapsedSeconds !== null 
      ? `Hace ${formatMMSS(appState.elapsedSeconds - appState.lastEpiElapsedSeconds)} min` 
      : 'No administrada';
  }
  if (hudEpiDoses) {
    hudEpiDoses.textContent = `${appState.epiCount} mg acumulados (${appState.epiCount} dosis)`;
  }

  // Amiodarona
  const hudAmioDoses = document.getElementById('hud-amio-doses');
  if (hudAmioDoses) {
    hudAmioDoses.textContent = `${appState.drugStats.amiodaronaMg} mg acumulados (${appState.drugStats.amiodaronaDoses} dosis)`;
  }

  // Choques
  const hudShocks = document.getElementById('hud-shocks-info');
  if (hudShocks) {
    hudShocks.textContent = `${appState.shocksCount} descargas (${appState.totalJoules} J acumulados)`;
  }
}

// Resumen Clínico SBAR y Acta de Entrega de Turno
function renderSBARSummary() {
  const sbarOutcome = document.getElementById('sbar-outcome-title');
  const sbarOutcomeDesc = document.getElementById('sbar-outcome-desc');
  const sbarTotalTime = document.getElementById('sbar-total-time');
  const sbarStartTime = document.getElementById('sbar-start-time');
  const sbarEndTime = document.getElementById('sbar-end-time');
  const sbarDate = document.getElementById('sbar-date');
  const sbarPayload = document.getElementById('ehrPayload');

  const totalTimeFormatted = formatMMSS(appState.elapsedSeconds);
  if (sbarTotalTime) sbarTotalTime.textContent = totalTimeFormatted;
  if (sbarStartTime) sbarStartTime.textContent = appState.startWallClock || '--:--:--';
  if (sbarEndTime) sbarEndTime.textContent = appState.outcomeTime || getWallClockTimeString();
  if (sbarDate) sbarDate.textContent = getFormattedDate();

  if (sbarOutcome) sbarOutcome.textContent = appState.outcome;
  if (sbarOutcomeDesc) {
    sbarOutcomeDesc.textContent = appState.outcome.includes('RCE')
      ? 'Paciente estabilizado hemodinámicamente tras reanimación cardiopulmonar avanzada. Se mantiene soporte ventilatorio y preparación para transferencia a UCI.'
      : 'Se cumplieron los ciclos de RCP avanzada multimodal con reevaluación continua sin respuesta favorable.';
  }

  // Actualizar métricas del Bento Grid en SBAR
  const sbarCycles = document.getElementById('sbar-cycles-val');
  const sbarShocks = document.getElementById('sbar-shocks-val');
  const sbarJoules = document.getElementById('sbar-joules-val');
  const sbarEpi = document.getElementById('sbar-epi-val');
  const sbarAmio = document.getElementById('sbar-amio-val');

  if (sbarCycles) sbarCycles.textContent = appState.cyclesCount;
  if (sbarShocks) sbarShocks.textContent = appState.shocksCount;
  if (sbarJoules) sbarJoules.textContent = `${appState.totalJoules} Joules acumulados`;
  if (sbarEpi) sbarEpi.textContent = appState.epiCount;
  if (sbarAmio) sbarAmio.textContent = appState.drugStats.amiodaronaMg;

  // Generar texto para copiar directo al EHR (Historia Clínica Electrónica)
  if (sbarPayload) {
    const textReport = `
==================================================
ACTA CLÍNICA DE CÓDIGO AZUL (SBAR) - RESUSTIME
==================================================
FECHA: ${getFormattedDate()}
HORA INICIO: ${appState.startWallClock || 'N/A'}
HORA TÉRMINO: ${appState.outcomeTime || getWallClockTimeString()}
DURACIÓN TOTAL DE PARO: ${totalTimeFormatted} (min:seg)
ESTADO FINAL: ${appState.outcome}

MÉTRICAS CLAVE ACLS:
- Ciclos de RCP (2 min) realizados: ${appState.cyclesCount}
- Descargas eléctricas aplicadas: ${appState.shocksCount} (Energía acumulada: ${appState.totalJoules} Joules)
- Adrenalina (Epinefrina 1 mg): ${appState.epiCount} dosis (${appState.epiCount} mg)
- Amiodarona: ${appState.drugStats.amiodaronaMg} mg (${appState.drugStats.amiodaronaDoses} dosis)
- Vía Aérea: ${appState.airwayStatus}
- Acceso Vascular: ${appState.vascularAccess}
- Último Ritmo Evaluado: ${appState.lastRhythm}

LÍNEA DE TIEMPO Y EVENTOS CRONOLÓGICOS DETALLADOS:
${appState.events.slice().reverse().map(e => `[${e.codeTimeFormatted} | ${e.realTime}] ${e.category}: ${e.title} -> ${e.details}`).join('\n')}

==================================================
Registrado electrónicamente por Cronómetro Vital App
==================================================
    `.trim();

    sbarPayload.textContent = textReport;
  }
}

// Copiar texto clínico al portapapeles
function copyClinicalText() {
  audio.playClick();
  const text = document.getElementById('ehrPayload').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyTopBtn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">check</span><span>¡COPIADO A EHR!</span>`;
      setTimeout(() => { btn.innerHTML = orig; }, 2500);
    }
  }).catch(err => {
    alert('Texto seleccionado, use Ctrl+C para copiar.');
  });
}

// ==========================================
// 8. NAVEGACIÓN Y PESTAÑAS (SPA)
// ==========================================
function switchTab(tabId) {
  audio.playClick();
  appState.currentTab = tabId;

  // Actualizar clases de botones en navbar
  document.querySelectorAll('[data-path]').forEach(link => {
    const target = link.getAttribute('data-path');
    if (target === tabId) {
      link.className = 'px-space-sm py-space-xs transition-all uppercase tracking-wider bg-primary-container text-on-primary-container font-semibold rounded';
      link.setAttribute('aria-current', 'page');
    } else {
      link.className = 'px-space-sm py-space-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-label-md text-label-md uppercase tracking-wider';
      link.removeAttribute('aria-current');
    }
  });

  // Mostrar la sección correspondiente
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  const activeTabEl = document.getElementById(`tab-${tabId}`);
  if (activeTabEl) {
    activeTabEl.classList.add('active');
  }

  // Refrescar vistas específicas
  if (tabId === 'linea-de-tiempo') renderTimeline();
  if (tabId === 'farmacos-busqueda') renderLeaderHUD();
  if (tabId === 'resumen-entrega-turno') renderSBARSummary();

  saveState();
}

// Búsqueda en tiempo real de fármacos
function setupDrugSearch() {
  const searchInput = document.getElementById('drugSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterDrugCards(query);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      filterDrugCards('');
    }
  });
}

function filterDrugCards(query) {
  const cards = document.querySelectorAll('.drug-card-item');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (!query || text.includes(query)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

// Modal de Nota Manual Personalizada
function openNoteModal() {
  audio.playClick();
  const modal = document.getElementById('note-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeNoteModal() {
  const modal = document.getElementById('note-modal');
  if (modal) modal.classList.add('hidden');
}

function saveCustomNote() {
  audio.playClick();
  const titleInput = document.getElementById('custom-note-title');
  const detailsInput = document.getElementById('custom-note-details');

  const title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : 'NOTA CLÍNICA';
  const details = detailsInput && detailsInput.value.trim() ? detailsInput.value.trim() : 'Evento clínico registrado';

  logEvent('NOTA', title, details, 'text-outline');
  closeNoteModal();
  if (titleInput) titleInput.value = '';
  if (detailsInput) detailsInput.value = '';
}

// Toggle Sonido Activado / Silencioso
function toggleSound() {
  appState.soundEnabled = !appState.soundEnabled;
  audio.setSoundEnabled(appState.soundEnabled);
  audio.playClick();

  const soundBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-toggle-icon');
  const soundLabel = document.getElementById('sound-toggle-label');

  if (soundIcon && soundLabel) {
    if (appState.soundEnabled) {
      soundIcon.textContent = 'volume_up';
      soundLabel.textContent = 'Sonido: Activado';
      if (soundBtn) {
        soundBtn.classList.remove('text-secondary', 'bg-surface-container-high');
        soundBtn.classList.add('text-emerald-400', 'bg-emerald-950/40', 'border', 'border-emerald-700/50');
      }
    } else {
      soundIcon.textContent = 'notifications_off';
      soundLabel.textContent = 'Modo Silencioso (Visual)';
      if (soundBtn) {
        soundBtn.classList.remove('text-emerald-400', 'bg-emerald-950/40', 'border', 'border-emerald-700/50');
        soundBtn.classList.add('text-secondary', 'bg-surface-container-high');
      }
    }
  }
  saveState();
}

// Reiniciar todo (Nuevo Código)
function resetEntireApp() {
  if (confirm('¿Está seguro de reiniciar completamente el sistema y comenzar un NUEVO Código Azul? Se borrarán los datos del código actual.')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// ==========================================
// 9. INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Configurar listeners de pestañas
  document.querySelectorAll('[data-path]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = link.getAttribute('data-path');
      switchTab(path);
    });
  });

  // Filtros de categoría de bitácora
  document.querySelectorAll('.timeline-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeline-filter-btn').forEach(b => {
        b.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-bold');
        b.classList.add('bg-surface-container', 'text-on-surface-variant');
      });
      btn.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold');
      btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
      renderTimeline(btn.getAttribute('data-category'));
    });
  });

  // Filtros rápidos de fármacos
  document.querySelectorAll('.drug-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.drug-filter-pill').forEach(b => {
        b.classList.remove('active', 'bg-tertiary', 'text-on-tertiary', 'font-bold');
        b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
      });
      btn.classList.add('active', 'bg-tertiary', 'text-on-tertiary', 'font-bold');
      btn.classList.remove('bg-surface-container-high', 'text-on-surface-variant');

      const filter = btn.getAttribute('data-filter');
      if (filter === 'all') {
        filterDrugCards('');
      } else {
        filterDrugCards(filter);
      }
    });
  });

  setupDrugSearch();

  // Restaurar estado si estaba activo
  if (appState.isActive) {
    document.getElementById('pre-code-modal').classList.add('hidden');
    document.getElementById('code-active-badge').classList.remove('hidden');
    document.getElementById('code-standby-badge').classList.add('hidden');
    const startTimeEl = document.getElementById('start-time-display');
    if (startTimeEl && appState.startWallClock) {
      startTimeEl.textContent = `Hora Inicio: ${appState.startWallClock}`;
    }
    startTimerLoop();
  }

  // Toggle de sonido
  audio.setSoundEnabled(appState.soundEnabled);
  const soundIcon = document.getElementById('sound-toggle-icon');
  const soundLabel = document.getElementById('sound-toggle-label');
  if (soundIcon && soundLabel) {
    if (appState.soundEnabled) {
      soundIcon.textContent = 'volume_up';
      soundLabel.textContent = 'Sonido: Activado';
    } else {
      soundIcon.textContent = 'notifications_off';
      soundLabel.textContent = 'Modo Silencioso (Visual)';
    }
  }

  // Activar pestaña inicial
  switchTab(appState.currentTab || 'consola-principal');
  updateTimersUI();
  renderTimeline();
  renderLiveMiniFeed();
});
