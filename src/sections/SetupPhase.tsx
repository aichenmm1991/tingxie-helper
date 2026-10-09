import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type WordList,
  type Settings,
  parseWords,
  loadLists,
  saveLists,
  loadWrongBook,
  removeFromWrongBook,
} from '../lib/store'
import { getMainlandVoices, speakWord, ttsSupported, unlockAudio } from '../lib/speech'
import { recognizeWords, parseOcrText, type OcrProgress } from '../lib/ocr'

interface Props {
  settings: Settings
  onSettingsChange: (s: Settings) => void
  onStart: (words: string[], title: string) => void
}

export default function SetupPhase({ settings, onSettingsChange, onStart }: Props) {
  const [lists, setLists] = useState<WordList[]>(() => loadLists())
  const [wrongBook, setWrongBook] = useState<string[]>(() => loadWrongBook())
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [ocr, setOcr] = useState<OcrProgress | null>(null)
  const [ocrMsg, setOcrMsg] = useState('')

  // 拍照/上传词语单照片，本地识别成文字
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一张照片
    if (!f) return
    setOcrMsg('')
    setOcr({ stage: '准备中…', percent: 0 })
    try {
      const text = await recognizeWords(f, setOcr)
      const words = parseOcrText(text)
      if (words.length === 0) {
        setOcrMsg('没认出词语 😅 请在光线充足的地方把纸面放平、拍清楚再试')
      } else {
        setText((prev) =>
          prev.trim() ? prev.trimEnd() + '\n' + words.join('\n') : words.join('\n')
        )
        setOcrMsg(`✅ 识别出 ${words.length} 个词语，已填入上方文本框，请检查一下有没有认错字`)
      }
    } catch {
      setOcrMsg('识别失败，请重试，或改用打字/粘贴输入')
    } finally {
      setOcr(null)
    }
  }

  // 加载本机可用的标准普通话声音（浏览器异步加载，需监听变化）
  useEffect(() => {
    if (!ttsSupported) return
    const load = () => setVoices(getMainlandVoices())
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    const t = setInterval(load, 1000) // 部分浏览器不触发事件，轮询兜底
    const stop = setTimeout(() => clearInterval(t), 6000)
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load)
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [])

  const previewVoice = () => {
    speakWord('飘扬', {
      rate: settings.rate,
      times: 1,
      gapMs: 0,
      voiceURI: settings.voiceURI || undefined,
    })
  }

  const parsed = useMemo(() => parseWords(text), [text])

  const saveList = () => {
    if (parsed.length === 0) return
    const listName =
      name.trim() ||
      `词表 ${new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`
    const next: WordList = {
      id: `${Date.now()}`,
      name: listName,
      words: parsed,
      updatedAt: Date.now(),
    }
    const all = [next, ...lists]
    setLists(all)
    saveLists(all)
    setName('')
    setText('')
  }

  const deleteList = (id: string) => {
    const all = lists.filter((l) => l.id !== id)
    setLists(all)
    saveLists(all)
  }

  const startDirect = () => {
    if (parsed.length === 0) return
    unlockAudio(parsed)
    onStart(parsed, name.trim() || '临时听写')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      {/* 录入区 */}
      <section className="rounded-3xl bg-white/80 p-6 shadow-lg shadow-orange-100 ring-1 ring-orange-100">
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-800">
          <span>📝</span> 第一步：把老师布置的词语放进来
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          拍张词语单照片自动识别，或者手动打字/粘贴（一行一个词，逗号、空格隔开也行）
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={ocr !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/60 px-4 py-4 font-bold text-orange-600 transition hover:bg-orange-100 active:scale-[0.99] disabled:opacity-60"
        >
          📷 拍词语单照片，自动识别成词表
        </button>
        {ocr !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-stone-500">
              <span>{ocr.stage}</span>
              <span>{ocr.percent}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-all duration-300"
                style={{ width: `${ocr.percent}%` }}
              />
            </div>
          </div>
        )}
        {ocrMsg && (
          <div className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-stone-600 ring-1 ring-amber-200">
            {ocrMsg}
          </div>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给这份词表起个名字（可选），如：9月18日语文"
          className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'例如：\n飘扬\n打扮\n鲜艳\n服装\n安静\n热闹'}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base leading-7 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-stone-500">
            已识别 <b className="text-orange-600">{parsed.length}</b> 个词语
          </span>
          {parsed.length > 0 && (
            <span className="max-w-[60%] truncate text-stone-400">
              {parsed.slice(0, 8).join('、')}
              {parsed.length > 8 ? '…' : ''}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={startDirect}
            disabled={parsed.length === 0}
            className="flex-1 rounded-2xl bg-orange-500 px-6 py-3.5 text-lg font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
          >
            🔊 直接开始听写
          </button>
          <button
            onClick={saveList}
            disabled={parsed.length === 0}
            className="rounded-2xl bg-white px-5 py-3.5 font-bold text-orange-600 ring-2 ring-orange-300 transition hover:bg-orange-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:text-stone-400 disabled:ring-stone-200"
          >
            💾 存为词表
          </button>
        </div>
      </section>

      {/* 朗读设置 */}
      <section className="mt-6 rounded-3xl bg-white/80 p-6 shadow-lg shadow-orange-100 ring-1 ring-orange-100">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center justify-between text-lg font-bold text-stone-800"
        >
          <span className="flex items-center gap-2">
            <span>⚙️</span> 朗读设置
          </span>
          <span className="text-stone-400">{showSettings ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {showSettings && (
          <div className="mt-5 space-y-5">
            {/* 朗读声音选择 */}
            <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
              <div className="mb-2 text-sm font-medium text-stone-700">
                朗读声音
                <span className="ml-1 text-xs text-stone-400">
                  全部为标准普通话（已排除台湾腔、粤语）
                </span>
              </div>
              {voices.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={settings.voiceURI}
                    onChange={(e) => onSettingsChange({ ...settings, voiceURI: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  >
                    <option value="">自动选择（最标准的）</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={previewVoice}
                    className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-95"
                  >
                    🔊 试听
                  </button>
                </div>
              ) : (
                <p className="text-xs text-stone-500">
                  正在加载声音列表…如果一直没有，建议用 <b>Microsoft Edge</b> 浏览器打开，自带播音级标准普通话（晓晓等）。
                </p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium text-stone-700">语速</span>
                <span className="text-stone-500">
                  {settings.rate < 0.75 ? '慢' : settings.rate < 1 ? '稍慢' : '正常'}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.2}
                step={0.05}
                value={settings.rate}
                onChange={(e) => onSettingsChange({ ...settings, rate: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium text-stone-700">每个词读几遍</div>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => onSettingsChange({ ...settings, times: n })}
                    className={`flex-1 rounded-xl py-2.5 font-bold transition ${
                      settings.times === n
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {n} 遍
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
              <span className="text-sm font-medium text-stone-700">
                打乱词语顺序
                <span className="ml-1 text-xs text-stone-400">防止孩子背顺序</span>
              </span>
              <input
                type="checkbox"
                checked={settings.shuffle}
                onChange={(e) => onSettingsChange({ ...settings, shuffle: e.target.checked })}
                className="h-5 w-5 accent-orange-500"
              />
            </label>
            <div className="rounded-xl bg-stone-50 px-4 py-3">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  自动念下一个
                  <span className="ml-1 text-xs text-stone-400">不用孩子自己点</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoNext}
                  onChange={(e) => onSettingsChange({ ...settings, autoNext: e.target.checked })}
                  className="h-5 w-5 accent-orange-500"
                />
              </label>
              {settings.autoNext && (
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-stone-600">写完等待时间</span>
                    <span className="font-bold text-orange-600">{settings.autoNextSec} 秒</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={settings.autoNextSec}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, autoNextSec: Number(e.target.value) })
                    }
                    className="w-full accent-orange-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 已保存词表 */}
      {lists.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-bold text-stone-800">
            <span>📚</span> 已保存的词表
          </h2>
          <div className="space-y-3">
            {lists.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 shadow-md shadow-orange-100/60 ring-1 ring-orange-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-stone-800">{l.name}</div>
                  <div className="mt-0.5 truncate text-xs text-stone-400">
                    {l.words.length} 个词 · {l.words.slice(0, 6).join('、')}
                    {l.words.length > 6 ? '…' : ''}
                  </div>
                </div>
                <button
                  onClick={() => {
                    unlockAudio(l.words)
                    onStart(l.words, l.name)
                  }}
                  className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-95"
                >
                  开始
                </button>
                <button
                  onClick={() => deleteList(l.id)}
                  className="shrink-0 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500 transition hover:bg-red-50 hover:text-red-500"
                  title="删除这个词表"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 错词本 */}
      <section className="mt-6 rounded-3xl bg-gradient-to-br from-rose-50 to-orange-50 p-6 shadow-lg shadow-rose-100 ring-1 ring-rose-100">
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-800">
          <span>📕</span> 错词本
          <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold text-white">
            {wrongBook.length}
          </span>
        </h2>
        {wrongBook.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            还没有错词。听写时孩子「偷看」过的词、以及家长批改标记的错词，都会自动收进这里。
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {wrongBook.map((w) => (
                <span
                  key={w}
                  className="group inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-rose-200"
                >
                  {w}
                  <button
                    onClick={() => setWrongBook(removeFromWrongBook(w))}
                    className="text-stone-300 transition hover:text-red-500"
                    title="移出错词本"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                unlockAudio(wrongBook)
                onStart(wrongBook, '错词本复习')
              }}
              className="mt-4 w-full rounded-2xl bg-rose-500 px-6 py-3.5 text-lg font-bold text-white shadow-md shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.98]"
            >
              🔁 听写错词（{wrongBook.length} 个）
            </button>
          </>
        )}
      </section>
    </div>
  )
}
