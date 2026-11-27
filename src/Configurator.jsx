import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CASES,
  DEFAULTS,
  DIALS,
  HANDS,
  STRAPS,
  cleanText,
  dragWatch,
  findOption,
  randomConfig,
  useWatchConfig,
  watchStore,
} from './watchConfig.js'

const EASE = [0.22, 1, 0.36, 1]

const GROUPS = [
  { key: 'dial', title: 'Циферблат', list: DIALS },
  { key: 'case', title: 'Корпус', list: CASES },
  { key: 'strap', title: 'Ремешок', list: STRAPS },
  { key: 'hands', title: 'Стрелки и индексы', list: HANDS },
]

function swatchStyle(key, o) {
  if (key === 'dial' && !o.color) return { background: 'conic-gradient(var(--a1), var(--a2), var(--a3), var(--a1))' }
  if (key === 'strap' && o.type === 'bracelet') {
    return { background: 'repeating-linear-gradient(90deg, #f1f3f5 0 6px, #a9b0b8 6px 8px, #dfe3e8 8px 14px)' }
  }
  if (key === 'strap' && o.type === 'rubber') {
    return { background: `repeating-linear-gradient(0deg, ${o.color} 0 5px, color-mix(in srgb, ${o.color} 75%, #000) 5px 7px)` }
  }
  if (key === 'case' || key === 'hands') {
    return { background: `radial-gradient(circle at 30% 30%, #fff8, transparent 45%), ${o.color}` }
  }
  return { background: o.color }
}

function Swatches({ group, value }) {
  return (
    <div className="cfg-group">
      <div className="cfg-group-head">
        <span>{group.title}</span>
        <AnimatePresence mode="wait">
          <motion.em
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {findOption(group.key, value).label}
          </motion.em>
        </AnimatePresence>
      </div>
      <div className="cfg-swatches" role="radiogroup" aria-label={group.title}>
        {group.list.map((o) => {
          const active = o.id === value
          return (
            <motion.button
              key={o.id}
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              title={o.label}
              className={`cfg-swatch ${active ? 'cfg-swatch--active' : ''}`}
              onClick={() => watchStore.set({ [group.key]: o.id })}
              whileHover={{ scale: 1.12, y: -2 }}
              whileTap={{ scale: 0.9 }}
            >
              {active && (
                <motion.span
                  layoutId={`ring-${group.key}`}
                  className="cfg-ring"
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                />
              )}
              <span className="cfg-dot" style={swatchStyle(group.key, o)} />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

async function downloadPng(cfg) {
  const shot = watchStore.capture?.()
  if (!shot) return false
  const img = new Image()
  img.src = shot
  await img.decode()
  const css = getComputedStyle(document.documentElement)
  const W = img.width
  const H = img.height
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const bg = g.createRadialGradient(W * 0.6, H * 0.45, 0, W * 0.6, H * 0.45, Math.max(W, H) * 0.7)
  bg.addColorStop(0, css.getPropertyValue('--bg-2').trim() || '#111')
  bg.addColorStop(1, css.getPropertyValue('--bg').trim() || '#000')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  g.drawImage(img, 0, 0)
  const ink = css.getPropertyValue('--text').trim() || '#fff'
  const muted = css.getPropertyValue('--muted').trim() || '#999'
  const pad = W * 0.04
  g.fillStyle = ink
  g.font = `800 ${Math.round(W * 0.03)}px Inter, system-ui, sans-serif`
  g.fillText(`Моя сборка ${cfg.text || 'PULSE'}`, pad, H - pad - W * 0.03)
  g.fillStyle = muted
  g.font = `500 ${Math.round(W * 0.014)}px Inter, system-ui, sans-serif`
  const line = GROUPS.map((gr) => findOption(gr.key, cfg[gr.key]).label).join(' · ')
  g.fillText(line, pad, H - pad)
  const a = document.createElement('a')
  a.download = `pulse-watch-${cfg.case}-${cfg.strap}.png`
  a.href = c.toDataURL('image/png')
  a.click()
  return true
}

export default function Configurator() {
  const cfg = useWatchConfig()
  const [toast, setToast] = useState('')
  const toastTimer = useRef()
  const last = useRef(null)

  const say = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const onPointerDown = (e) => {
    last.current = { x: e.clientX, y: e.clientY }
    watchStore.drag.dragging = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!last.current) return
    dragWatch(e.clientX - last.current.x, e.clientY - last.current.y)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    last.current = null
    watchStore.drag.dragging = false
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      say('Ссылка на сборку скопирована')
    } catch {
      say('Не удалось скопировать — возьмите ссылку из адресной строки')
    }
  }

  return (
    <section className="build-section" id="build" data-theme="build">
      <div
        className="build-drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden="true"
      >
        <span className="build-drag-hint">⟲ Потяните, чтобы повернуть</span>
      </div>
      <motion.div
        className="cfg-panel"
        initial={{ opacity: 0, x: -60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ amount: 0.3 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <span className="kicker">Конструктор</span>
        <h2>Соберите свои часы</h2>
        <p className="cfg-lead">Выберите детали — модель меняется вживую. Сборка сохраняется в ссылке.</p>

        {GROUPS.map((gr) => (
          <Swatches key={gr.key} group={gr} value={cfg[gr.key]} />
        ))}

        <label className="cfg-group cfg-text">
          <div className="cfg-group-head">
            <span>Надпись на циферблате</span>
            <em>{cfg.text.length}/12</em>
          </div>
          <input
            value={cfg.text}
            maxLength={12}
            placeholder="PULSE"
            onChange={(e) => watchStore.set({ text: cleanText(e.target.value) })}
          />
        </label>

        <div className="cfg-actions">
          <motion.button
            className="cfg-btn cfg-btn--primary"
            whileTap={{ scale: 0.94 }}
            onClick={async () => say((await downloadPng(cfg)) ? 'Картинка сохранена' : '3D ещё загружается')}
          >
            ⤓ Скачать PNG
          </motion.button>
          <motion.button className="cfg-btn" whileTap={{ scale: 0.94 }} onClick={copyLink}>
            🔗 Ссылка
          </motion.button>
          <motion.button
            className="cfg-btn"
            whileTap={{ scale: 0.94, rotate: -20 }}
            onClick={() => watchStore.set(randomConfig())}
          >
            🎲 Случайно
          </motion.button>
          <motion.button className="cfg-btn" whileTap={{ scale: 0.94 }} onClick={() => watchStore.set(DEFAULTS)}>
            ↺ Сброс
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="cfg-toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
