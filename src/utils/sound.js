/**
 * 音效工具：
 * - UI 点击音：短促合成音
 * - 背景音乐：轻缓「读书」氛围曲（柔和钢琴琶音 + 氛围垫底，循环）
 * - 支持音量滑动调节（0~1），持久化到 localStorage
 *
 * 浏览器要求用户交互后才能播放，首次点击会自动解锁。
 */
const BG_VOLUME_KEY = 'bg_volume'
const DEFAULT_BG_VOLUME = 0.38

let audioCtx = null
let bgGainNode = null
let bgPadNodes = []
let bgPlaying = false
let bgMuted = localStorage.getItem('bg_muted') === '1'
let bgVolume = readStoredVolume()
let melodyTimer = null
let stepIndex = 0

function readStoredVolume() {
  const raw = localStorage.getItem(BG_VOLUME_KEY)
  const n = raw == null ? DEFAULT_BG_VOLUME : Number(raw)
  if (Number.isNaN(n)) return DEFAULT_BG_VOLUME
  return Math.min(1, Math.max(0, n))
}

function effectiveBgGain() {
  return bgMuted ? 0 : bgVolume
}

function applyBgGain() {
  if (!bgGainNode) return
  const ctx = getCtx()
  if (!ctx) {
    bgGainNode.gain.value = effectiveBgGain()
    return
  }
  bgGainNode.gain.setTargetAtTime(effectiveBgGain(), ctx.currentTime, 0.05)
}

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function tone({ frequency, duration, type = 'sine', volume = 0.08, slideTo }) {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(frequency, now)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration)
  }

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

/** 短促点击音 */
export function playClick() {
  tone({ frequency: 880, duration: 0.07, type: 'triangle', volume: 0.06, slideTo: 520 })
}

/** 输入框聚焦轻音 */
export function playFocus() {
  tone({ frequency: 640, duration: 0.05, type: 'sine', volume: 0.035 })
}

/** 刷新验证码 */
export function playRefresh() {
  tone({ frequency: 520, duration: 0.08, type: 'square', volume: 0.04, slideTo: 780 })
  setTimeout(() => {
    tone({ frequency: 780, duration: 0.06, type: 'square', volume: 0.03 })
  }, 60)
}

/** 登录成功 */
export function playSuccess() {
  tone({ frequency: 523, duration: 0.1, type: 'sine', volume: 0.07 })
  setTimeout(() => tone({ frequency: 659, duration: 0.1, type: 'sine', volume: 0.07 }), 80)
  setTimeout(() => tone({ frequency: 784, duration: 0.16, type: 'sine', volume: 0.08 }), 160)
}

/** 登录失败 */
export function playError() {
  tone({ frequency: 220, duration: 0.16, type: 'sawtooth', volume: 0.05, slideTo: 120 })
}

/** 首次交互时解锁音频上下文 */
export function unlockAudio() {
  getCtx()
}

export function isBgMuted() {
  return bgMuted
}

export function getBgVolume() {
  return bgVolume
}

/** 设置背景音乐音量（0~1），并立即生效 */
export function setBgVolume(value) {
  const n = Number(value)
  bgVolume = Number.isNaN(n) ? DEFAULT_BG_VOLUME : Math.min(1, Math.max(0, n))
  localStorage.setItem(BG_VOLUME_KEY, String(bgVolume))
  // 拖到接近 0 时视为静音态展示，但不强制改 muted 标记
  applyBgGain()
  return bgVolume
}

/** 柔和钢琴音色：三角波 + 较长衰减，类似读书轻音乐 */
function playSoftPiano(freq, when, duration = 1.8, velocity = 0.22) {
  const ctx = getCtx()
  if (!ctx || !bgGainNode) return

  const osc = ctx.createOscillator()
  const partial = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  osc.type = 'triangle'
  partial.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  partial.frequency.setValueAtTime(freq * 2, when)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, when)
  filter.Q.value = 0.7

  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(velocity, when + 0.03)
  gain.gain.exponentialRampToValueAtTime(velocity * 0.35, when + 0.45)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)

  osc.connect(filter)
  partial.connect(filter)
  filter.connect(gain)
  gain.connect(bgGainNode)

  osc.start(when)
  partial.start(when)
  osc.stop(when + duration + 0.05)
  partial.stop(when + duration + 0.05)
}

/**
 * C 大调轻缓进行：C - Am - F - G
 * 每小节一组下行/环绕琶音，节奏偏慢，适合阅读。
 */
const CHORD_ARP = [
  [261.63, 329.63, 392.0, 523.25], // C
  [220.0, 261.63, 329.63, 440.0], // Am
  [174.61, 220.0, 261.63, 349.23], // F
  [196.0, 246.94, 293.66, 392.0] // G
]

function scheduleMelodyLoop() {
  if (!bgPlaying) return
  const ctx = getCtx()
  if (!ctx || !bgGainNode) return

  const chord = CHORD_ARP[stepIndex % CHORD_ARP.length]
  const now = ctx.currentTime
  const gap = 0.42

  chord.forEach((freq, i) => {
    playSoftPiano(freq, now + i * gap, 2.1, 0.18 + i * 0.02)
  })
  playSoftPiano(chord[0] / 2, now, 3.2, 0.12)

  stepIndex += 1
  melodyTimer = setTimeout(scheduleMelodyLoop, 2200)
}

function startSoftPad() {
  const ctx = getCtx()
  if (!ctx || !bgGainNode) return

  const freqs = [130.81, 196.0]
  bgPadNodes = freqs.map((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'sine'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.value = 600
    gain.gain.value = idx === 0 ? 0.22 : 0.14
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(bgGainNode)
    osc.start()
    return { osc, gain }
  })
}

/**
 * 启动轻缓读书氛围背景音乐（循环）。
 */
export function startBgMusic() {
  const ctx = getCtx()
  if (!ctx || bgPlaying) return

  bgGainNode = ctx.createGain()
  bgGainNode.gain.value = effectiveBgGain()
  bgGainNode.connect(ctx.destination)

  startSoftPad()
  bgPlaying = true
  stepIndex = 0
  scheduleMelodyLoop()
}

export function stopBgMusic() {
  if (melodyTimer) {
    clearTimeout(melodyTimer)
    melodyTimer = null
  }
  bgPadNodes.forEach((n) => {
    try {
      n.osc.stop()
    } catch (e) {
      // ignore
    }
  })
  bgPadNodes = []
  bgPlaying = false
  bgGainNode = null
  stepIndex = 0
}

/** 开关背景音；返回当前是否静音 */
export function toggleBgMute() {
  bgMuted = !bgMuted
  localStorage.setItem('bg_muted', bgMuted ? '1' : '0')
  applyBgGain()
  if (!bgMuted && !bgPlaying) {
    startBgMusic()
  }
  return bgMuted
}

export function setBgMuted(muted) {
  bgMuted = Boolean(muted)
  localStorage.setItem('bg_muted', bgMuted ? '1' : '0')
  applyBgGain()
}
