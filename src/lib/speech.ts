// 浏览器语音朗读封装（Web Speech API + 云端词典发音兜底）
// 发音标准：只使用「中国大陆标准普通话」——本机只信微软/谷歌/苹果引擎，
// 其余情况（微信/UC/部分安卓浏览器）走云端词典级标准音。

let token = 0

// ---------- 云端兜底音源 ----------
// 有道词典发音接口：词典级标准普通话，任意中文文本返回 mp3，<audio> 播放不受跨域限制。
// 实测排除项（2026-10）：百度 gettts 带 attachment 头浏览器禁播；Edge TTS 校验 Origin 网页端不可用。
const youdaoUrl = (text: string) =>
  `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`

// ---------- 云端音频池：每词一个 <audio>，开始听写时整组预加载并在手势里静音解锁 ----------
// 之后朗读 / 重读 / 自动念下一个全部瞬时播放，不再等网络
const audioPool = new Map<string, HTMLAudioElement>()
const unlockedEls = new WeakSet<HTMLAudioElement>()
let currentCloudEl: HTMLAudioElement | null = null

function getPooledAudio(word: string): HTMLAudioElement {
  let el = audioPool.get(word)
  if (!el) {
    if (audioPool.size > 200) {
      const oldest = audioPool.keys().next().value
      if (oldest !== undefined) audioPool.delete(oldest)
    }
    el = new Audio(youdaoUrl(word))
    el.preload = 'auto'
    audioPool.set(word, el)
  }
  return el
}

function unlockEl(el: HTMLAudioElement) {
  if (!el.paused || unlockedEls.has(el)) return
  el.muted = true
  const p = el.play()
  if (p)
    p.then(() => {
      unlockedEls.add(el) // 播放成功才算真正解锁（持久有效），失败则留给下次手势重试
      el.pause()
      el.muted = false
    }).catch(() => {
      el.muted = false
    })
}

/** 在用户手势（如「开始听写」点击）里调用：预创建并解锁整组词的云端音频。
 *  除了整词，还预建降级拆分片段（四字词的 2+2、更长词的单字），保证降级播放同样瞬时。 */
export function unlockAudio(words: string[] = []) {
  if (typeof window === 'undefined' || nativeUsable()) return
  const all = new Set<string>()
  for (const w of words) {
    all.add(w)
    if (w.length === 4) {
      all.add(w.slice(0, 2))
      all.add(w.slice(2))
    }
    if (w.length > 2) for (const ch of w) all.add(ch)
  }
  all.forEach((t) => unlockEl(getPooledAudio(t)))
}

// 之后每次点击/触摸，顺手解锁新入池的元素（覆盖会话中后加的词）
if (typeof window !== 'undefined') {
  const sweep = () => audioPool.forEach(unlockEl)
  ;['pointerdown', 'touchstart', 'click'].forEach((ev) =>
    window.addEventListener(ev, sweep, { capture: true, passive: true })
  )
}

/** 把读不了的片段继续拆小：四字词 2+2，更长的一分为二，二字及以下不可再拆 */
function splitUnit(text: string): string[] | null {
  const len = text.length
  if (len <= 2) return null
  if (len === 4) return [text.slice(0, 2), text.slice(2)]
  const mid = Math.ceil(len / 2)
  return [text.slice(0, mid), text.slice(mid)]
}

/** 云端朗读一个词，接口与 speakWord 相同。
 *  整词没有读音时（成语等），自动按 2+2 / 逐字拆分朗读，读音均为词典标准音。 */
function speakWordCloud(word: string, opts: SpeakOpts, onDone?: () => void): () => void {
  const myToken = ++token
  let round = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0

  // 依次播放片段；某片段读不了就拆小重试，单字也读不了则跳过
  const playUnits = (units: string[], done: () => void) => {
    let i = 0
    const next = () => {
      if (myToken !== token) return
      if (i >= units.length) {
        done()
        return
      }
      const text = units[i]
      const el = getPooledAudio(text)
      currentCloudEl = el
      const my = ++attempt
      const fail = () => {
        if (myToken !== token || my !== attempt) return
        const parts = splitUnit(text)
        if (parts) units.splice(i, 1, ...parts)
        else i++
        next()
      }
      el.onerror = () => fail()
      el.onended = () => {
        if (myToken !== token || my !== attempt) return
        i++
        timer = setTimeout(next, 250) // 片段间小停顿，模拟词语节奏
      }
      try {
        el.pause()
        if (el.readyState >= 1) el.currentTime = 0
        el.playbackRate = opts.rate
        const p = el.play()
        if (p) p.catch(fail)
      } catch {
        fail()
      }
    }
    next()
  }

  const once = () => {
    if (myToken !== token) return
    playUnits([word], () => {
      if (myToken !== token) return
      round++
      if (round < opts.times) {
        timer = setTimeout(once, opts.gapMs)
      } else {
        onDone?.()
      }
    })
  }

  once()

  return () => {
    if (myToken === token) token++
    if (timer) clearTimeout(timer)
    try {
      currentCloudEl?.pause()
    } catch {
      /* ignore */
    }
  }
}

// ---------- 本机语音（Web Speech API） ----------

/** 判断是否为大陆普通话声音（排除台湾、香港、粤语） */
export function isMainlandVoice(v: SpeechSynthesisVoice): boolean {
  const lang = v.lang.replace('_', '-')
  const name = v.name
  // 明确排除非大陆口音
  if (/zh[-](TW|HK|MO)/i.test(lang)) return false
  if (/yue|cantonese|粤语|taiwan|台湾|台灣|hong\s?kong|香港/i.test(name)) return false
  // 明确是大陆的
  if (/zh[-]CN|cmn|zh[-]Hans/i.test(lang)) return true
  // lang 只有 zh 的，按名字再判断一次（如 macOS 的 Ting-Ting）
  if (/^zh$/i.test(lang)) {
    return /ting|mei|hui|yao|kang|sinji|lilian|普通话|mandarin/i.test(name)
  }
  return false
}

/** 声音质量评分：微软神经网络声音（晓晓/云希等，播音级标准普通话）优先 */
function voiceScore(v: SpeechSynthesisVoice): number {
  const s = v.name
  if (/xiaoxiao|xiaoyi|yunjian|yunxi|yunyang|yunxia|yunfeng|yunhao|xiaochen|xiaohan|xiaomeng|xiaomo|xiaoqiu|xiaorui|xiaoshuang|xiaoxuan|xiaoyan|xiaoyou|xiaozhen|yunye|yunze/i.test(s))
    return 100 // 微软神经网络声音，最接近播音员标准
  if (/microsoft/i.test(s) && /online|natural/i.test(s)) return 90
  if (/google/i.test(s)) return 80
  if (/ting/i.test(s)) return 70 // macOS 婷婷
  if (/microsoft/i.test(s)) return 60
  return 50
}

export function getMainlandVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported) return []
  return window.speechSynthesis
    .getVoices()
    .filter(isMainlandVoice)
    .sort((a, b) => voiceScore(b) - voiceScore(a))
}

function pickVoice(voiceURI?: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  // 用户指定的声音优先
  if (voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === voiceURI)
    if (chosen) return chosen
  }
  const mainland = voices.filter(isMainlandVoice)
  if (mainland.length === 0) return voices.find((v) => /^zh/i.test(v.lang))
  return mainland.sort((a, b) => voiceScore(b) - voiceScore(a))[0]
}

// 提前触发声音列表加载（部分浏览器是异步加载的）
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}

export const ttsSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

/** 本机语音是否达到国标要求：API 存在、有中文声音、且是值得信赖的引擎（微软/谷歌/苹果）。
 *  手机厂商自带引擎口音/机械感重，不用它，改走云端。 */
function nativeUsable(voiceURI?: string): boolean {
  if (!ttsSupported) return false
  try {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return false
    if (voiceURI) return voices.some((v) => v.voiceURI === voiceURI)
    const v = pickVoice()
    if (!v) return false // 没有任何中文声音
    return voiceScore(v) >= 60
  } catch {
    return false
  }
}

export function stopSpeaking() {
  token++
  if (ttsSupported) window.speechSynthesis.cancel()
  try {
    currentCloudEl?.pause()
  } catch {
    /* ignore */
  }
}

export interface SpeakOpts {
  rate: number
  times: number
  gapMs: number
  voiceURI?: string
}

/**
 * 朗读一个词，可重复多遍。onDone 在最后一遍读完时触发。
 * 返回一个取消函数。
 */
export function speakWord(word: string, opts: SpeakOpts, onDone?: () => void): () => void {
  if (!nativeUsable(opts.voiceURI)) {
    return speakWordCloud(word, opts, onDone)
  }
  const myToken = ++token
  window.speechSynthesis.cancel()
  let round = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const once = () => {
    if (myToken !== token) return
    const u = new SpeechSynthesisUtterance(word)
    u.lang = 'zh-CN'
    u.rate = opts.rate
    u.pitch = 1
    const v = pickVoice(opts.voiceURI)
    if (v) u.voice = v
    u.onend = () => {
      if (myToken !== token) return
      round++
      if (round < opts.times) {
        timer = setTimeout(once, opts.gapMs)
      } else {
        onDone?.()
      }
    }
    u.onerror = () => {
      if (myToken !== token) return
      onDone?.()
    }
    window.speechSynthesis.speak(u)
  }

  // 稍作延迟，确保 cancel 生效
  setTimeout(once, 80)

  return () => {
    if (myToken === token) token++
    if (timer) clearTimeout(timer)
    window.speechSynthesis.cancel()
  }
}
