// 词表、错词本、设置的本地存储

export interface WordList {
  id: string
  name: string
  words: string[]
  updatedAt: number
}

export interface Settings {
  rate: number // 语速 0.5 - 1.2
  times: number // 每个词读几遍 1-3
  gapMs: number // 重复朗读之间的停顿
  autoNext: boolean // 读完是否自动进入下一个
  autoNextSec: number // 自动进入下一个的倒计时秒数
  shuffle: boolean // 是否打乱顺序
  voiceURI: string // 指定的朗读者声音，空字符串 = 自动选标准普通话
}

export const DEFAULT_SETTINGS: Settings = {
  rate: 0.85,
  times: 2,
  gapMs: 1200,
  autoNext: false,
  autoNextSec: 8,
  shuffle: false,
  voiceURI: '',
}

const LISTS_KEY = 'tingxie.lists.v1'
const WRONG_KEY = 'tingxie.wrongbook.v1'
const SETTINGS_KEY = 'tingxie.settings.v1'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadLists(): WordList[] {
  return safeParse<WordList[]>(localStorage.getItem(LISTS_KEY), [])
}

export function saveLists(lists: WordList[]) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists))
}

export function loadWrongBook(): string[] {
  return safeParse<string[]>(localStorage.getItem(WRONG_KEY), [])
}

export function saveWrongBook(words: string[]) {
  localStorage.setItem(WRONG_KEY, JSON.stringify(words))
}

export function addToWrongBook(words: string[]): string[] {
  const book = loadWrongBook()
  const merged = [...book]
  for (const w of words) {
    if (!merged.includes(w)) merged.push(w)
  }
  saveWrongBook(merged)
  return merged
}

export function removeFromWrongBook(word: string): string[] {
  const book = loadWrongBook().filter((w) => w !== word)
  saveWrongBook(book)
  return book
}

export function loadSettings(): Settings {
  const s = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {})
  return { ...DEFAULT_SETTINGS, ...s }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

/** 把家长粘贴的文本解析成词语数组：按换行/逗号/顿号/分号/空格切分，去重且保持顺序 */
export function parseWords(text: string): string[] {
  const parts = text
    .split(/\n+/)
    .flatMap((line) =>
      line
        // 去掉行首列表编号："1." "2、" "(3)" "④" "一、" "5 苹果" 等
        .replace(
          /^\s*(?:[\(（【\[]?\d+[\)）】\]]?|[①-⑳]|[零一二三四五六七八九十]+)\s*(?:[、.．:：\-]|\s)\s*/,
          ''
        )
        .split(/[,，、;；\s]+/)
    )
    .map((s) => s.replace(/^[.。．,，、;；!！?？]+|[.。．,，、;；!！?？]+$/g, '').trim())
    .filter((s) => s.length > 0 && !/^\d+$/.test(s))
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }
  return out
}

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
