import { useCallback, useEffect, useRef, useState } from 'react'
import { type Settings } from '../lib/store'
import { speakWord, stopSpeaking, ttsSupported } from '../lib/speech'

interface Props {
  title: string
  words: string[]
  settings: Settings
  onFinish: (peeked: string[]) => void
  onQuit: () => void
}

export default function DictationPhase({ title, words, settings, onFinish, onQuit }: Props) {
  const [idx, setIdx] = useState(0)
  const [peeking, setPeeking] = useState(false)
  const [peeked, setPeeked] = useState<string[]>([])
  const [countdown, setCountdown] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(true)
  const cancelRef = useRef<(() => void) | null>(null)

  const word = words[idx]
  const isLast = idx === words.length - 1

  const play = useCallback(() => {
    setCountdown(null)
    setSpeaking(true)
    cancelRef.current?.()
    cancelRef.current = speakWord(
      word,
      { rate: settings.rate, times: settings.times, gapMs: settings.gapMs, voiceURI: settings.voiceURI || undefined },
      () => {
        setSpeaking(false)
        if (settings.autoNext) setCountdown(settings.autoNextSec)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, settings])

  // 切词时自动朗读
  useEffect(() => {
    play()
    return () => {
      cancelRef.current?.()
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // 自动下一个的倒计时
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      goNext()
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    cancelRef.current?.()
    stopSpeaking()
    setCountdown(null)
    setPeeking(false)
    if (isLast) {
      onFinish(peeked)
    } else {
      setIdx((i) => i + 1)
    }
  }, [isLast, onFinish, peeked])

  const handlePeek = () => {
    setCountdown(null) // 偷看时暂停自动倒计时
    setPeeking(true)
    if (!peeked.includes(word)) setPeeked((p) => [...p, word])
  }

  const progress = ((idx + 1) / words.length) * 100

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col px-4 pb-10">
      {/* 顶部信息 */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => {
            stopSpeaking()
            onQuit()
          }}
          className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-stone-500 ring-1 ring-stone-200 transition hover:bg-white"
        >
          ← 退出
        </button>
        <div className="truncate px-3 text-sm font-medium text-stone-500">{title}</div>
        <div className="shrink-0 rounded-full bg-orange-500 px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-orange-200">
          {idx + 1} / {words.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70 ring-1 ring-orange-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 主显示区：默认不显示词语 */}
      <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-3xl bg-white/80 p-8 shadow-lg shadow-orange-100 ring-1 ring-orange-100">
        {peeking ? (
          <>
            <div className="text-sm font-medium text-rose-400">👀 偷看时间 · 这个词已记入错词本</div>
            <div className="mt-4 text-6xl font-black tracking-widest text-stone-800 sm:text-7xl">
              {word}
            </div>
            <button
              onClick={() => setPeeking(false)}
              className="mt-8 rounded-2xl bg-stone-700 px-8 py-3 text-lg font-bold text-white transition hover:bg-stone-800 active:scale-[0.98]"
            >
              记住了，藏起来
            </button>
          </>
        ) : (
          <>
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-400 text-5xl shadow-lg shadow-orange-200">
              {speaking ? '🔊' : '✏️'}
            </div>
            <div className="mt-6 text-2xl font-bold text-stone-700">
              {speaking ? '仔细听…' : '该你写啦！'}
            </div>
            <div className="mt-2 text-sm text-stone-400">
              {speaking ? '正在朗读第 ' + (idx + 1) + ' 个词语' : '写完以后点下面的绿色按钮'}
            </div>
            {countdown !== null && (
              <div className="mt-4 rounded-full bg-amber-100 px-5 py-1.5 text-sm font-bold text-amber-700">
                {countdown} 秒后自动念下一个
              </div>
            )}
          </>
        )}
      </div>

      {!ttsSupported && (
        <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-center text-sm text-sky-600">
          当前浏览器将使用在线语音朗读，请保持网络畅通 ☁️
        </div>
      )}

      {/* 操作按钮区 */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={play}
          className="rounded-2xl bg-sky-500 px-4 py-4 text-lg font-bold text-white shadow-md shadow-sky-200 transition hover:bg-sky-600 active:scale-[0.98]"
        >
          🔁 再念一遍
        </button>
        <button
          onClick={handlePeek}
          disabled={peeking}
          className="rounded-2xl bg-rose-400 px-4 py-4 text-lg font-bold text-white shadow-md shadow-rose-200 transition hover:bg-rose-500 active:scale-[0.98] disabled:opacity-50"
        >
          👀 不会写，看一眼
        </button>
      </div>
      <button
        onClick={goNext}
        className="mt-3 w-full rounded-2xl bg-emerald-500 px-4 py-5 text-2xl font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 active:scale-[0.98]"
      >
        {isLast ? '🏁 写完了，完成听写' : '✅ 写完了，念下一个'}
      </button>
      {peeked.length > 0 && (
        <div className="mt-3 text-center text-sm text-stone-400">
          本轮已偷看 {peeked.length} 个词
        </div>
      )}
    </div>
  )
}
