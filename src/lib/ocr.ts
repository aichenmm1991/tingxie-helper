// 拍照识字：浏览器端 OCR（Tesseract.js + chi_sim 中文印刷体模型）
// 识别完全在本地设备上进行，照片不会上传到任何服务器

import { createWorker } from 'tesseract.js'

export interface OcrProgress {
  stage: string
  percent: number // 0-100
}

/** 把照片缩小到合适尺寸，加快识别速度、提高准确率 */
async function downscaleImage(file: File, maxSide = 1800): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  // 白底，避免透明背景影响识别
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片处理失败'))),
      'image/jpeg',
      0.92
    )
  )
}

/**
 * 识别图片中的中文词语。
 * onProgress 报告识别进度。
 */
export async function recognizeWords(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {  onProgress?.({ stage: '正在处理照片…', percent: 2 })
  const image = await downscaleImage(file)

  onProgress?.({ stage: '首次使用正在加载识别引擎…', percent: 5 })
  const worker = await createWorker('chi_sim', 1, {
    workerPath: 'tesseract/worker.min.js',
    corePath: 'tesseract/',
    langPath: 'tesseract/',
    gzip: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          stage: '正在识别文字…',
          percent: 10 + Math.round(m.progress * 90),
        })
      }
    },
  })

  try {
    const { data } = await worker.recognize(image)
    onProgress?.({ stage: '识别完成', percent: 100 })
    return data.text
  } finally {
    await worker.terminate()
  }
}

/**
 * 清洗 OCR 识别结果：
 * - 去掉每行开头的序号（1. / 2、/ (3) 等）
 * - 只保留 2~6 个纯汉字的词（过滤掉标题、标点、杂讯）
 */
export function parseOcrText(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/^\s*(?:\(?\d{1,2}[.、．\)]?)\s*/, '')
    for (const tok of line.split(/[\s,，、;；]+/)) {
      const t = tok.trim()
      if (/^[一-龥]{2,6}$/.test(t) && !seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  return out
}
