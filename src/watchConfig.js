import { useSyncExternalStore } from 'react'

/* Варианты конструктора часов */

export const DIALS = [
  { id: 'auto', label: 'Под секцию', color: null },
  { id: 'midnight', label: 'Полночь', color: '#0e1b2e' },
  { id: 'graphite', label: 'Графит', color: '#2a2c31' },
  { id: 'emerald', label: 'Изумруд', color: '#0f3d2e' },
  { id: 'bordeaux', label: 'Бордо', color: '#4a0e1c' },
  { id: 'sky', label: 'Небо', color: '#8db6dc' },
  { id: 'ivory', label: 'Слоновая кость', color: '#efe8d8' },
]

export const CASES = [
  { id: 'steel', label: 'Сталь', color: '#dfe3e8', roughness: 0.08 },
  { id: 'gold', label: 'Золото', color: '#e9c46a', roughness: 0.1 },
  { id: 'rose', label: 'Розовое золото', color: '#e8a98c', roughness: 0.1 },
  { id: 'black', label: 'Чёрный PVD', color: '#2b2c30', roughness: 0.3 },
]

export const STRAPS = [
  { id: 'brown', label: 'Коричневая кожа', type: 'leather', color: '#3b2416' },
  { id: 'black', label: 'Чёрная кожа', type: 'leather', color: '#151515' },
  { id: 'tan', label: 'Рыжая кожа', type: 'leather', color: '#9a5b2e' },
  { id: 'navy', label: 'Синяя кожа', type: 'leather', color: '#1c2b4a' },
  { id: 'rubber', label: 'Каучук', type: 'rubber', color: '#1b1b1d' },
  { id: 'orange', label: 'Оранжевый каучук', type: 'rubber', color: '#e8590c' },
  { id: 'bracelet', label: 'Браслет', type: 'bracelet', color: null },
]

export const HANDS = [
  { id: 'gold', label: 'Золото', color: '#f0cd7a', metalness: 1, roughness: 0.08 },
  { id: 'steel', label: 'Сталь', color: '#e9edf1', metalness: 1, roughness: 0.06 },
  { id: 'blued', label: 'Синёная сталь', color: '#2340b8', metalness: 0.9, roughness: 0.15 },
  { id: 'black', label: 'Чёрные', color: '#1a1a1c', metalness: 0.6, roughness: 0.35 },
]

export const DEFAULTS = { dial: 'auto', case: 'steel', strap: 'brown', hands: 'gold', text: 'PULSE' }

const LISTS = { dial: DIALS, case: CASES, strap: STRAPS, hands: HANDS }

export const cleanText = (t) => (t || '').toUpperCase().replace(/[^A-ZА-ЯЁ0-9 .\-·&]/g, '').slice(0, 12)

/* Сборка хранится в адресе страницы — ссылкой можно поделиться */

function fromURL() {
  const q = new URLSearchParams(window.location.search)
  const cfg = { ...DEFAULTS }
  for (const [key, list] of Object.entries(LISTS)) {
    const v = q.get(key)
    if (v && list.some((o) => o.id === v)) cfg[key] = v
  }
  if (q.has('text')) cfg.text = cleanText(q.get('text'))
  return cfg
}

function toURL(cfg) {
  const q = new URLSearchParams(window.location.search)
  for (const key of Object.keys(DEFAULTS)) {
    if (cfg[key] === DEFAULTS[key]) q.delete(key)
    else q.set(key, cfg[key])
  }
  const qs = q.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
}

let config = fromURL()
const listeners = new Set()

export const watchStore = {
  get: () => config,
  set(patch) {
    config = { ...config, ...patch }
    toURL(config)
    listeners.forEach((l) => l())
  },
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  // Заполняется 3D-сценой: возвращает PNG текущего кадра.
  capture: null,
  // Поворот часов мышью в конструкторе (читается 3D-сценой каждый кадр).
  drag: { x: 0, y: 0, dragging: false },
}

export function dragWatch(dx, dy) {
  watchStore.drag.x += dx * 0.008
  watchStore.drag.y = Math.min(0.7, Math.max(-0.7, watchStore.drag.y + dy * 0.006))
}

export const findOption = (key, id) => LISTS[key].find((o) => o.id === id) || LISTS[key][0]

export function randomConfig() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)].id
  return { dial: pick(DIALS.slice(1)), case: pick(CASES), strap: pick(STRAPS), hands: pick(HANDS) }
}

export function useWatchConfig() {
  return useSyncExternalStore(watchStore.subscribe, watchStore.get)
}

export function hasCustomConfig() {
  return Object.keys(DEFAULTS).some((k) => config[k] !== DEFAULTS[k])
}
