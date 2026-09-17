import { useCallback, useState } from 'react'
import '../App.css'
import SetupPhase from '../sections/SetupPhase'
import DictationPhase from '../sections/DictationPhase'
import ResultPhase from '../sections/ResultPhase'
import {
  type Settings,
  loadSettings,
  saveSettings,
  shuffled,
} from '../lib/store'
import { stopSpeaking } from '../lib/speech'

type Phase =
  | { kind: 'setup' }
  | { kind: 'dictation'; title: string; words: string[]; round: number }
  | { kind: 'result'; title: string; words: string[]; peeked: string[] }

export default function Home() {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const updateSettings = (s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }

  const startDictation = useCallback(
    (words: string[], title: string) => {
      const ordered = settings.shuffle ? shuffled(words) : words
      setPhase({ kind: 'dictation', title, words: ordered, round: Date.now() })
    },
    [settings.shuffle]
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50">
      {/* 顶部标题栏 */}
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-400 text-2xl shadow-md shadow-orange-200">
          ✏️
        </div>
        <div>
          <h1 className="text-xl font-black text-stone-800">听写小助手</h1>
          <p className="text-xs text-stone-400">机器念词 · 孩子听写 · 错词自动收集</p>
        </div>
      </header>

      {phase.kind === 'setup' && (
        <SetupPhase
          settings={settings}
          onSettingsChange={updateSettings}
          onStart={startDictation}
        />
      )}

      {phase.kind === 'dictation' && (
        <DictationPhase
          key={phase.round}
          title={phase.title}
          words={phase.words}
          settings={settings}
          onFinish={(peeked) => {
            stopSpeaking()
            setPhase({ kind: 'result', title: phase.title, words: phase.words, peeked })
          }}
          onQuit={() => setPhase({ kind: 'setup' })}
        />
      )}

      {phase.kind === 'result' && (
        <ResultPhase
          title={phase.title}
          words={phase.words}
          peeked={phase.peeked}
          onRestartWrong={(wrongWords) => startDictation(wrongWords, `${phase.title} · 错词重练`)}
          onRestartAll={() => startDictation(phase.words, phase.title)}
          onHome={() => setPhase({ kind: 'setup' })}
        />
      )}
    </div>
  )
}
