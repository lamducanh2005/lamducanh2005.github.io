// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const state = {
  mode:      'idle',   // 'idle' | 'thinking' | 'talking'
  displayed: '',       // text currently shown in bubble
  question:  '',       // last question asked
  isTyping:  false,
  everAsked: false,
};

// ─────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────
const botBob        = document.getElementById('botBob');
const botHead       = document.getElementById('botHead');
const bulb          = document.getElementById('bulb');
const bubble        = document.getElementById('bubble');
const thinkingDots  = document.getElementById('thinkingDots');
const answerText    = document.getElementById('answerText');
const answerContent = document.getElementById('answerContent');
const caret         = document.getElementById('caret');
const mouthSmile    = document.getElementById('mouthSmile');
const mouthThink    = document.getElementById('mouthThink');
const mouthTalk     = document.getElementById('mouthTalk');
const userQuestion  = document.getElementById('userQuestion');
const userQText     = document.getElementById('userQuestionText');
const inputField    = document.getElementById('inputField');
const suggestions   = document.getElementById('suggestions');
const armL          = document.getElementById('armL');
const armR          = document.getElementById('armR');
const pupilL        = document.getElementById('pupilL');
const pupilR        = document.getElementById('pupilR');
const botHover      = document.getElementById('botHover');

// ─────────────────────────────────────────────
//  BOT STAGE SHIFT — dịch bot xuống khi bubble bị cắt trên màn hình
// ─────────────────────────────────────────────
const botStage = document.querySelector('.bot-stage');

function adjustBotStage() {
  requestAnimationFrame(() => {
    if (bubble.style.display === 'none') {
      botStage.style.transform = '';
      return;
    }
    const bubbleRect  = bubble.getBoundingClientRect();
    const headerEl    = document.querySelector('header');
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 70;
    const desiredTop  = headerBottom + 16;

    if (bubbleRect.top >= desiredTop) {
      botStage.style.transform = '';
      return;
    }

    const needed   = desiredTop - bubbleRect.top;
    const maxShift = window.innerHeight * 0.32;
    botStage.style.transform = `translateY(${Math.min(needed, maxShift)}px)`;
  });
}

// ─────────────────────────────────────────────
//  RENDER — sync DOM to state
// ─────────────────────────────────────────────
function render() {
  const { mode, displayed, question, isTyping, everAsked } = state;
  const showBubble = mode === 'thinking' || displayed.length > 0;
  const showAnswer = mode !== 'thinking' && displayed.length > 0;

  // Bubble
  bubble.style.display = showBubble ? 'block' : 'none';

  // Thinking dots vs answer text
  thinkingDots.style.display = mode === 'thinking' ? 'flex'  : 'none';
  answerText.style.display   = showAnswer           ? 'block' : 'none';
  if (showAnswer) {
    answerContent.textContent = displayed;
    caret.style.display = mode === 'talking' ? 'inline-block' : 'none';
  }

  // Mouth
  mouthSmile.style.display = mode === 'idle'     ? 'block' : 'none';
  mouthThink.style.display = mode === 'thinking' ? 'block' : 'none';
  mouthTalk.style.display  = mode === 'talking'  ? 'block' : 'none';

  // Bob body animation
  if (!_poking) {
    botBob.style.animation =
      mode === 'talking'  ? 'mb-nod .5s ease-in-out infinite' :
      mode === 'thinking' ? 'mb-sway 2.2s ease-in-out infinite' :
                            'mb-float 5s ease-in-out infinite';
  }

  // Bulb glow
  bulb.style.animation = isTyping
    ? 'mb-glowfast .7s ease-in-out infinite'
    : 'mb-glow 3.4s ease-in-out infinite';

  // User question display
  if (question) {
    userQText.textContent = question;
    userQuestion.style.display = 'flex';
  } else {
    userQuestion.style.display = 'none';
  }

  // Ẩn suggestion chips sau lần hỏi đầu tiên
  suggestions.style.display = everAsked ? 'none' : 'flex';

  adjustBotStage();
}

// ─────────────────────────────────────────────
//  TALKING — typewriter animation
// ─────────────────────────────────────────────
let talkInterval = null;

function startTalking(answer) {
  clearInterval(talkInterval);
  answer = answer.trim();
  state.mode = 'talking';
  state.displayed = '';
  render();
  let i = 0;
  talkInterval = setInterval(() => {
    i++;
    state.displayed = answer.slice(0, i);
    render();
    answerText.scrollTop = answerText.scrollHeight;
    if (i >= answer.length) {
      clearInterval(talkInterval);
      state.mode = 'idle';
      render();
    }
  }, 26);
}

// ─────────────────────────────────────────────
//  LLM API
// ─────────────────────────────────────────────
const API_URL = 'https://unreached-squishy-resolute.ngrok-free.dev/chat';
const chatHistory = [];

async function sendToLLM(question) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
    },
    body: JSON.stringify({ prompt: question, history: chatHistory }),
  });

  if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);

  const data = await res.json();
  const reply = data.response;

  chatHistory.push({ role: 'user',      content: question });
  chatHistory.push({ role: 'assistant', content: reply    });

  return reply;
}

// ─────────────────────────────────────────────
//  ASK — gửi câu hỏi
// ─────────────────────────────────────────────
async function ask(text) {
  const q = (text != null ? String(text) : inputField.value).trim();
  if (!q) return;

  clearInterval(talkInterval);
  state.question   = q;
  state.mode       = 'thinking';
  state.displayed  = '';
  state.isTyping   = false;
  state.everAsked  = true;
  inputField.value = '';
  render();

  try {
    const answer = await sendToLLM(q);
    startTalking(answer);
  } catch (err) {
    startTalking('⚠️ ' + (err.message || 'Lỗi không xác định'));
  }
}

// ─────────────────────────────────────────────
//  INPUT EVENTS
// ─────────────────────────────────────────────
let typingTimer = null;

inputField.addEventListener('input', () => {
  state.isTyping = inputField.value.length > 0;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { state.isTyping = false; render(); }, 800);
  render();
});

inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); ask(); }
});

document.getElementById('sendBtn').addEventListener('click', () => ask());

// ─────────────────────────────────────────────
//  EYE TRACKING
// ─────────────────────────────────────────────
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2.4;
let eyeRaf = false;

function applyEye() {
  const r  = botHead.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top  + r.height * 0.34;
  let dx, dy;
  if (state.mode === 'thinking') {
    dx = 5; dy = -8;
  } else {
    const ang  = Math.atan2(mouseY - cy, mouseX - cx);
    const dist = Math.min(9, Math.hypot(mouseX - cx, mouseY - cy) / 26);
    dx = Math.cos(ang) * dist;
    dy = Math.sin(ang) * dist;
  }
  const t = `translate(${dx}px,${dy}px)`;
  pupilL.style.transform = t;
  pupilR.style.transform = t;
}

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (!eyeRaf) { eyeRaf = true; requestAnimationFrame(() => { eyeRaf = false; applyEye(); }); }
});

// ─────────────────────────────────────────────
//  BOT HOVER — arms wave
// ─────────────────────────────────────────────
botHover.addEventListener('mouseenter', () => {
  armL.style.animation = 'mb-wave .9s ease-in-out 0s infinite';
  armR.style.animation = 'mb-wave .9s ease-in-out .12s infinite';
});
botHover.addEventListener('mouseleave', () => {
  armL.style.animation = 'none'; armL.style.transform = 'rotate(6deg)';
  armR.style.animation = 'none'; armR.style.transform = 'rotate(-6deg)';
});

// ─────────────────────────────────────────────
//  POKE — click bot để nhảy
// ─────────────────────────────────────────────
let _poking   = false;
let _pokeTimer = null;

botHover.addEventListener('click', () => {
  _poking = true;
  clearTimeout(_pokeTimer);
  botBob.style.animation = 'none';
  void botBob.offsetWidth; // force reflow
  botBob.style.animation = 'mb-hop .55s cubic-bezier(.3,1.2,.4,1)';
  _pokeTimer = setTimeout(() => {
    _poking = false;
    render();
  }, 560);
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
const GREETING = 'Đây là chuyên gia sức khỏe tinh thần. Có câu hỏi thì nhập vào ô bên dưới hỏi mau, không thì mời đi chỗ khác.';
setTimeout(() => startTalking(GREETING), 650);

render();
applyEye();
