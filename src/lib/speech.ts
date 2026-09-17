// 浏览器语音朗读封装（Web Speech API）
// 严格使用「中国大陆标准普通话」声音，排除台湾腔、粤语等非国标读音

let token = 0

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

export function stopSpeaking() {
  token++
  if (ttsSupported) window.speechSynthesis.cancel()
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
  if (!ttsSupported) {
    onDone?.()
    return () => {}
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
