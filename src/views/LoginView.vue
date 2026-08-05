<template>
  <div class="login-page" @pointerdown="unlockOnce">
    <canvas ref="canvasRef" class="photon-canvas"></canvas>
    <div class="aurora a1"></div>
    <div class="aurora a2"></div>
    <div class="scanlines"></div>
    <div class="vignette"></div>

    <div class="audio-dock" @pointerdown.stop>
      <button
        class="mute-btn"
        type="button"
        :title="bgMuted ? '开启背景音' : '关闭背景音'"
        @click.stop="onToggleMute"
      >
        {{ bgMuted ? '静音' : '音量' }}
      </button>
      <label class="volume-control">
        <span>背景音乐</span>
        <input
          v-model.number="bgVolume"
          class="volume-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          :disabled="bgMuted"
          @input="onVolumeInput"
        />
        <em>{{ bgMuted ? 0 : bgVolume }}%</em>
      </label>
    </div>

    <div class="login-panel" :class="{ shaking: shake }">
      <div class="panel-glow"></div>
      <div class="brand">
        <span class="brand-mark"></span>
        <div>
          <h1>api-test</h1>
          <p class="brand-tag">ENTERPRISE ACCESS GATE</p>
        </div>
      </div>
      <p class="subtitle">光子鉴权通道已就绪 · 请完成身份校验</p>

      <form class="login-form" @submit.prevent="onSubmitClick">
        <label>
          <span>用户名</span>
          <input
            v-model.trim="form.username"
            type="text"
            placeholder="请输入用户名"
            autocomplete="username"
            @focus="playFocus"
          />
        </label>
        <label>
          <span>密码</span>
          <input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            @focus="playFocus"
          />
        </label>
        <label>
          <span>验证码</span>
          <div class="captcha-row">
            <input
              v-model.trim="form.captchaCode"
              type="text"
              maxlength="6"
              placeholder="请输入验证码"
              autocomplete="off"
              @focus="playFocus"
            />
            <button
              class="captcha-btn"
              type="button"
              :disabled="captchaLoading"
              title="点击刷新"
              @click="onRefreshCaptcha"
            >
              <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
              <span v-else>{{ captchaLoading ? '加载中' : '获取验证码' }}</span>
            </button>
          </div>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="submit-btn" type="submit" :disabled="loading">
          <span class="btn-shine"></span>
          <span class="btn-text">{{ loading ? '鉴权中...' : '安全登录' }}</span>
        </button>
      </form>

      <p class="hint">演示账号：admin / 123456 · 连续失败 5 次将锁定 15 分钟</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCaptcha, loginApi } from '../api/http'
import {
  getBgVolume,
  isBgMuted,
  playClick,
  playError,
  playFocus,
  playRefresh,
  playSuccess,
  setBgVolume,
  startBgMusic,
  stopBgMusic,
  toggleBgMute,
  unlockAudio
} from '../utils/sound'

const router = useRouter()
const route = useRoute()
const canvasRef = ref(null)
const loading = ref(false)
const captchaLoading = ref(false)
const error = ref('')
const captchaImage = ref('')
const captchaId = ref('')
const shake = ref(false)
const bgMuted = ref(isBgMuted())
const bgVolume = ref(Math.round(getBgVolume() * 100))
const form = reactive({
  username: 'admin',
  password: '123456',
  captchaCode: ''
})

let rafId = 0
let cleanupPhoton = null
let audioUnlocked = false

function unlockOnce() {
  if (!audioUnlocked) {
    unlockAudio()
    startBgMusic()
    audioUnlocked = true
  }
}

function onToggleMute() {
  unlockOnce()
  playClick()
  bgMuted.value = toggleBgMute()
}

function onVolumeInput() {
  unlockOnce()
  setBgVolume(bgVolume.value / 100)
  if (bgVolume.value > 0 && bgMuted.value) {
    bgMuted.value = toggleBgMute()
  }
}

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    const data = await fetchCaptcha()
    captchaId.value = data.captchaId
    captchaImage.value = data.imageBase64
    form.captchaCode = ''
  } catch (e) {
    error.value = e.message || '验证码加载失败'
  } finally {
    captchaLoading.value = false
  }
}

function onRefreshCaptcha() {
  unlockOnce()
  playRefresh()
  loadCaptcha()
}

async function onSubmitClick() {
  unlockOnce()
  playClick()
  await handleLogin()
}

async function handleLogin() {
  error.value = ''
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    triggerShake()
    playError()
    return
  }
  if (!captchaId.value || !form.captchaCode) {
    error.value = '请输入验证码'
    triggerShake()
    playError()
    return
  }

  loading.value = true
  try {
    await loginApi({
      username: form.username,
      password: form.password,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode
    })
    playSuccess()
    stopBgMusic()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    setTimeout(() => {
      router.replace(redirect || '/admin')
    }, 280)
  } catch (e) {
    error.value = e.message || '登录失败'
    triggerShake()
    playError()
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}

function triggerShake() {
  shake.value = true
  setTimeout(() => {
    shake.value = false
  }, 450)
}

function startPhoton(canvas) {
  const ctx = canvas.getContext('2d')
  const particles = []
  const meteors = []
  const ripples = []
  const mouse = { x: null, y: null }
  const COUNT = 110
  const LINK_DIST = 160
  let tick = 0

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  function createParticle() {
    const warm = Math.random() > 0.72
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      r: Math.random() * 2.2 + 0.5,
      pulse: Math.random() * Math.PI * 2,
      warm
    }
  }

  function spawnMeteor() {
    meteors.push({
      x: Math.random() * canvas.width,
      y: -20,
      len: 60 + Math.random() * 90,
      speed: 4 + Math.random() * 5,
      angle: Math.PI / 3 + Math.random() * 0.35,
      life: 1
    })
  }

  function init() {
    particles.length = 0
    for (let i = 0; i < COUNT; i++) {
      particles.push(createParticle())
    }
  }

  function addRipple(x, y) {
    ripples.push({ x, y, r: 0, max: 90 + Math.random() * 50, alpha: 0.7 })
  }

  function draw() {
    tick += 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 动态光晕核心
    const cx = canvas.width * 0.5 + Math.sin(tick * 0.008) * 40
    const cy = canvas.height * 0.38 + Math.cos(tick * 0.01) * 30
    const core = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(canvas.width, canvas.height) * 0.55)
    core.addColorStop(0, 'rgba(40, 180, 255, 0.22)')
    core.addColorStop(0.35, 'rgba(20, 90, 160, 0.12)')
    core.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 偶尔生成流星
    if (tick % 90 === 0) spawnMeteor()

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]
      m.x += Math.cos(m.angle) * m.speed
      m.y += Math.sin(m.angle) * m.speed
      m.life -= 0.012
      const tx = m.x - Math.cos(m.angle) * m.len
      const ty = m.y - Math.sin(m.angle) * m.len
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty)
      grad.addColorStop(0, `rgba(180, 240, 255, ${m.life})`)
      grad.addColorStop(1, 'rgba(180, 240, 255, 0)')
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.stroke()
      if (m.life <= 0 || m.y > canvas.height + 40) meteors.splice(i, 1)
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.pulse += 0.03

      // 鼠标引力
      if (mouse.x != null) {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy) || 1
        if (dist < 220) {
          p.vx += (dx / dist) * 0.02
          p.vy += (dy / dist) * 0.02
        }
      }

      // 速度阻尼，避免飞太快
      p.vx *= 0.995
      p.vy *= 0.995

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1

      const glow = 0.4 + Math.sin(p.pulse) * 0.35
      const color = p.warm
        ? `rgba(255, 190, 120, ${glow})`
        : `rgba(120, 230, 255, ${glow})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.shadowBlur = 16
      ctx.shadowColor = p.warm ? 'rgba(255, 170, 80, 0.95)' : 'rgba(80, 210, 255, 0.95)'
      ctx.fill()
      ctx.shadowBlur = 0

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j]
        const dx = p.x - q.x
        const dy = p.y - q.y
        const dist = Math.hypot(dx, dy)
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.42
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.strokeStyle = `rgba(110, 220, 255, ${alpha})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      if (mouse.x != null) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < 200) {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.strokeStyle = `rgba(190, 245, 255, ${(1 - dist / 200) * 0.55})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }
    }

    // 点击涟漪
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      r.r += 3.2
      r.alpha *= 0.94
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(140, 230, 255, ${r.alpha})`
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r * 0.55, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 200, 140, ${r.alpha * 0.7})`
      ctx.lineWidth = 1
      ctx.stroke()
      if (r.r > r.max || r.alpha < 0.03) ripples.splice(i, 1)
    }

    rafId = requestAnimationFrame(draw)
  }

  function onMove(e) {
    mouse.x = e.clientX
    mouse.y = e.clientY
  }

  function onLeave() {
    mouse.x = null
    mouse.y = null
  }

  function onClick(e) {
    addRipple(e.clientX, e.clientY)
  }

  resize()
  init()
  draw()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseleave', onLeave)
  window.addEventListener('pointerdown', onClick)

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseleave', onLeave)
    window.removeEventListener('pointerdown', onClick)
  }
}

onMounted(() => {
  cleanupPhoton = startPhoton(canvasRef.value)
  loadCaptcha()
})

onUnmounted(() => {
  if (cleanupPhoton) cleanupPhoton()
  stopBgMusic()
})
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 15% 10%, rgba(20, 80, 120, 0.45) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 90%, rgba(40, 30, 80, 0.35) 0%, transparent 45%),
    linear-gradient(160deg, #03050a 0%, #07131f 45%, #050910 100%);
  display: grid;
  place-items: center;
  padding: 24px;
}

.photon-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.aurora {
  position: absolute;
  width: 55vw;
  height: 55vw;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.35;
  z-index: 0;
  pointer-events: none;
  animation: drift 12s ease-in-out infinite alternate;
}

.a1 {
  top: -10%;
  left: -8%;
  background: radial-gradient(circle, rgba(40, 180, 255, 0.55), transparent 70%);
}

.a2 {
  right: -12%;
  bottom: -15%;
  background: radial-gradient(circle, rgba(255, 140, 80, 0.35), transparent 70%);
  animation-delay: -4s;
}

@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(40px, -30px) scale(1.12); }
}

.scanlines {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 2px,
    rgba(0, 0, 0, 0.08) 3px
  );
  opacity: 0.35;
  mix-blend-mode: soft-light;
}

.vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
}

.audio-dock {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 8px;
  border-radius: 999px;
  border: 1px solid rgba(120, 200, 255, 0.35);
  background: rgba(6, 14, 26, 0.78);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.mute-btn {
  border: 1px solid rgba(120, 200, 255, 0.35);
  background: rgba(4, 12, 22, 0.85);
  color: rgba(210, 235, 255, 0.95);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s;
}

.mute-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(140, 220, 255, 0.7);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(200, 230, 255, 0.85);
  font-size: 12px;
}

.volume-control em {
  font-style: normal;
  min-width: 36px;
  text-align: right;
  color: rgba(180, 220, 255, 0.75);
}

.volume-slider {
  width: 110px;
  accent-color: #6fd3ff;
  cursor: pointer;
}

@media (max-width: 640px) {
  .audio-dock {
    top: 12px;
    right: 12px;
    left: 12px;
    justify-content: space-between;
  }

  .volume-slider {
    width: 90px;
  }
}

.login-panel {
  position: relative;
  z-index: 2;
  width: min(420px, 92vw);
  padding: 38px 34px 28px;
  border-radius: 20px;
  background: rgba(6, 14, 26, 0.78);
  border: 1px solid rgba(120, 210, 255, 0.28);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 30px 80px rgba(0, 0, 0, 0.55),
    0 0 60px rgba(40, 170, 255, 0.18);
  backdrop-filter: blur(18px);
  color: #e8f4ff;
  animation: panel-in 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
  overflow: hidden;
}

.login-panel.shaking {
  animation: shake 0.45s ease;
}

.panel-glow {
  position: absolute;
  inset: -40% auto auto -20%;
  width: 140%;
  height: 55%;
  background: linear-gradient(120deg, transparent, rgba(90, 200, 255, 0.12), transparent);
  transform: rotate(-8deg);
  pointer-events: none;
  animation: sweep 5.5s ease-in-out infinite;
}

@keyframes sweep {
  0%, 100% { transform: translateX(-20%) rotate(-8deg); opacity: 0.3; }
  50% { transform: translateX(10%) rotate(-8deg); opacity: 0.75; }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.96);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.brand-mark {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #7cd8ff;
  box-shadow:
    0 0 16px #7cd8ff,
    0 0 36px rgba(124, 216, 255, 0.7),
    0 0 60px rgba(255, 160, 80, 0.25);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.65; }
}

.brand h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: linear-gradient(90deg, #eaf8ff, #7cd8ff 45%, #ffc08a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-tag {
  margin: 4px 0 0;
  font-size: 10px;
  letter-spacing: 0.22em;
  color: rgba(160, 210, 255, 0.55);
}

.subtitle {
  margin: 0 0 26px;
  color: rgba(200, 230, 255, 0.7);
  font-size: 13px;
}

.login-form {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: rgba(210, 235, 255, 0.82);
}

input {
  width: 100%;
  border: 1px solid rgba(120, 200, 255, 0.28);
  background: rgba(3, 10, 20, 0.8);
  color: #f2f8ff;
  border-radius: 11px;
  padding: 12px 14px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

input:focus {
  border-color: rgba(124, 216, 255, 0.85);
  box-shadow:
    0 0 0 3px rgba(80, 180, 255, 0.18),
    0 0 24px rgba(80, 180, 255, 0.2);
  transform: translateY(-1px);
}

.captcha-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 10px;
  align-items: stretch;
}

.captcha-btn {
  margin-top: 0;
  padding: 0;
  border-radius: 11px;
  border: 1px solid rgba(120, 200, 255, 0.35);
  background: rgba(4, 12, 22, 0.9);
  overflow: hidden;
  min-height: 44px;
  display: grid;
  place-items: center;
  color: rgba(200, 230, 255, 0.8);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
}

.captcha-btn:hover:not(:disabled) {
  box-shadow: 0 0 18px rgba(90, 200, 255, 0.35);
  transform: translateY(-1px);
}

.captcha-btn img {
  width: 100%;
  height: 44px;
  object-fit: cover;
  display: block;
}

.submit-btn {
  position: relative;
  margin-top: 10px;
  border: none;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  color: #041018;
  background: linear-gradient(135deg, #b8f0ff 0%, #4fc3f7 50%, #29b6f6 100%);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s;
  box-shadow: 0 8px 28px rgba(40, 170, 255, 0.35);
}

.btn-shine {
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  transform: skewX(-20deg);
  animation: shine 2.8s ease-in-out infinite;
}

@keyframes shine {
  0%, 35% { left: -40%; }
  65%, 100% { left: 140%; }
}

.btn-text {
  position: relative;
  z-index: 1;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.01);
  filter: brightness(1.08);
  box-shadow: 0 12px 36px rgba(40, 170, 255, 0.5);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error {
  margin: 0;
  color: #ff9a9a;
  font-size: 13px;
  text-shadow: 0 0 10px rgba(255, 80, 80, 0.35);
}

.hint {
  margin: 18px 0 0;
  text-align: center;
  font-size: 12px;
  color: rgba(180, 210, 230, 0.55);
}
</style>
