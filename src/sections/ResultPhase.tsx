import { useMemo, useState } from 'react'
import { addToWrongBook } from '../lib/store'

interface Props {
  title: string
  words: string[]
  peeked: string[] // 听写过程中偷看过的词
  onRestartWrong: (wrongWords: string[]) => void
  onRestartAll: () => void
  onHome: () => void
}

export default function ResultPhase({
  title,
  words,
  peeked,
  onRestartWrong,
  onRestartAll,
  onHome,
}: Props) {
  // wrongSet: 初始包含所有偷看过的词，家长对照作业本点击切换对错
  const [wrongSet, setWrongSet] = useState<Set<string>>(() => new Set(peeked))
  const [saved, setSaved] = useState(false)

  const toggle = (w: string) => {
    setSaved(false)
    setWrongSet((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  const wrongWords = useMemo(
    () => words.filter((w) => wrongSet.has(w)),
    [words, wrongSet]
  )
  const correctCount = words.length - wrongWords.length

  const saveWrong = () => {
    if (wrongWords.length > 0) addToWrongBook(wrongWords)
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      {/* 成绩单 */}
      <section className="rounded-3xl bg-white/80 p-6 text-center shadow-lg shadow-orange-100 ring-1 ring-orange-100">
        <div className="text-5xl">{wrongWords.length === 0 ? '🎉' : '💪'}</div>
        <h2 className="mt-2 text-2xl font-black text-stone-800">
          {wrongWords.length === 0 ? '太棒了，全部完成！' : '听写完成，来批改一下吧'}
        </h2>
        <p className="mt-2 text-stone-500">
          {title} · 共 {words.length} 个词
          {peeked.length > 0 && ` · 偷看过 ${peeked.length} 个`}
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <div className="rounded-2xl bg-emerald-50 px-6 py-3 ring-1 ring-emerald-200">
            <div className="text-3xl font-black text-emerald-600">{correctCount}</div>
            <div className="text-xs font-medium text-emerald-600">写对了</div>
          </div>
          <div className="rounded-2xl bg-rose-50 px-6 py-3 ring-1 ring-rose-200">
            <div className="text-3xl font-black text-rose-500">{wrongWords.length}</div>
            <div className="text-xs font-medium text-rose-500">还要加油</div>
          </div>
        </div>
      </section>

      {/* 批改区 */}
      <section className="mt-6 rounded-3xl bg-white/80 p-6 shadow-lg shadow-orange-100 ring-1 ring-orange-100">
        <h3 className="font-bold text-stone-800">
          ✏️ 家长对照作业本点一点：<span className="text-rose-500">点红 = 写错/不会</span>，
          <span className="text-emerald-600">点绿 = 写对了</span>
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {words.map((w, i) => {
            const wrong = wrongSet.has(w)
            const wasPeeked = peeked.includes(w)
            return (
              <button
                key={w}
                onClick={() => toggle(w)}
                className={`relative rounded-xl px-2 py-3 text-lg font-bold transition active:scale-95 ${
                  wrong
                    ? 'bg-rose-100 text-rose-600 ring-2 ring-rose-400'
                    : 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300'
                }`}
              >
                <span className="mr-1 text-xs font-normal text-stone-400">{i + 1}.</span>
                {w}
                {wasPeeked && (
                  <span
                    className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
                    title="听写时偷看过"
                  >
                    👀
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* 操作区 */}
      <div className="mt-6 space-y-3">
        {wrongWords.length > 0 && (
          <>
            <button
              onClick={saveWrong}
              disabled={saved}
              className="w-full rounded-2xl bg-rose-500 px-6 py-4 text-lg font-bold text-white shadow-md shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60"
            >
              {saved ? '✅ 已收进错词本' : `📕 把 ${wrongWords.length} 个错词收进错词本`}
            </button>
            <button
              onClick={() => {
                addToWrongBook(wrongWords)
                onRestartWrong(wrongWords)
              }}
              className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.98]"
            >
              🔁 马上把错词再听写一遍
            </button>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onRestartAll}
            className="rounded-2xl bg-white px-4 py-3.5 font-bold text-stone-600 ring-2 ring-stone-200 transition hover:bg-stone-50 active:scale-[0.98]"
          >
            🔄 全部重来
          </button>
          <button
            onClick={onHome}
            className="rounded-2xl bg-white px-4 py-3.5 font-bold text-stone-600 ring-2 ring-stone-200 transition hover:bg-stone-50 active:scale-[0.98]"
          >
            🏠 返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
