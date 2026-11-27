/* eslint-disable react/immutability, react/globals -- объекты three.js по задумке меняются в useFrame */
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
  Процедурная 3D-модель механических часов на three.js.
  Циферблат смотрит на +Z. Прокрутка секции #watch управляет «режиссурой»:
  стекло, стрелки и циферблат улетают, ротор и мосты поднимаются, камера подлетает
  к колёсной передаче, спуску и балансу, а в конце — полный разбор.
*/

const TAU = Math.PI * 2

/* ---------- Состояние прокрутки (без перерисовок React) ---------- */

const scroll = { t: 0, opacity: 0.3, px: 0, py: 0 }

function readScroll() {
  const el = document.getElementById('watch')
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  scroll.t = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height - vh), 0, 1)
  if (r.top > 0) scroll.opacity = THREE.MathUtils.lerp(0.3, 1, THREE.MathUtils.clamp(1 - r.top / vh, 0, 1))
  else if (r.bottom < vh) scroll.opacity = THREE.MathUtils.lerp(0.22, 1, THREE.MathUtils.clamp(r.bottom / vh, 0, 1))
  else scroll.opacity = 1
}

/* ---------- Ключевые кадры камеры и разборки ---------- */

// cam/look — камера и точка взгляда; fly — улёт стекла, стрелок, циферблата;
// bridge — подъём мостов и ротора, bop — их прозрачность; spread — разлёт колёс; drop — уход корпуса.
const KEYS = [
  { t: 0.0, cam: [0, 0, 7.4], look: [0, 0, 0], fly: 0, bridge: 0, bop: 1, spread: 0, drop: 0 },
  { t: 0.13, cam: [0.4, -2.7, 6.2], look: [0, 0, 0.2], fly: 0.3, bridge: 0, bop: 1, spread: 0, drop: 0 },
  { t: 0.27, cam: [1.7, -3.6, 4.9], look: [0, 0, 0.3], fly: 1, bridge: 0, bop: 1, spread: 0, drop: 0.35 },
  { t: 0.41, cam: [-1.3, -3.4, 4.4], look: [0, 0, 0.5], fly: 1, bridge: 1, bop: 0.3, spread: 0, drop: 0.7 },
  { t: 0.55, cam: [1.0, -2.0, 2.7], look: [0.3, 0.05, 0.3], fly: 1, bridge: 1, bop: 0.08, spread: 0, drop: 1 },
  { t: 0.69, cam: [-0.25, -1.95, 1.45], look: [0.02, -0.92, 0.3], fly: 1, bridge: 1, bop: 0.05, spread: 0, drop: 1 },
  { t: 0.83, cam: [1.25, -1.75, 1.2], look: [0.55, -1.05, 0.38], fly: 1, bridge: 1, bop: 0.05, spread: 0, drop: 1 },
  { t: 1.0, cam: [0.6, -6.6, 6.4], look: [0, 0, 1.3], fly: 1, bridge: 1, bop: 1, spread: 1, drop: 1 },
]

const smooth = (x) => x * x * (3 - 2 * x)

function sampleKeys(t) {
  let i = 0
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const u = smooth(THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1))
  const mix = (x, y) => x + (y - x) * u
  return {
    cam: a.cam.map((v, k) => mix(v, b.cam[k])),
    look: a.look.map((v, k) => mix(v, b.look[k])),
    fly: mix(a.fly, b.fly),
    bridge: mix(a.bridge, b.bridge),
    bop: mix(a.bop, b.bop),
    spread: mix(a.spread, b.spread),
    drop: mix(a.drop, b.drop),
  }
}

/* ---------- Текстуры на canvas ---------- */

let MAX_ANISO = 8

function canvasTexture(size, draw, { repeat = 1, mirror = false, srgb = true } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = MAX_ANISO
  if (repeat !== 1 || mirror) {
    tex.wrapS = tex.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
  }
  return tex
}

// Перляж — перекрывающиеся «жемчужные» круги на платине.
const perlageTexture = () =>
  canvasTexture(
    1024,
    (g, s) => {
      g.fillStyle = '#aeb3ba'
      g.fillRect(0, 0, s, s)
      const step = 64
      for (let y = -step; y < s + step; y += step * 0.72) {
        for (let x = -step; x < s + step; x += step * 0.72) {
          const gr = g.createRadialGradient(x - 10, y - 10, 2, x, y, step * 0.6)
          gr.addColorStop(0, 'rgba(255,255,255,0.6)')
          gr.addColorStop(0.55, 'rgba(165,170,178,0.2)')
          gr.addColorStop(1, 'rgba(80,86,94,0.4)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(x, y, step * 0.56, 0, TAU)
          g.fill()
          // Тонкие концентрические риски внутри каждого круга
          g.strokeStyle = 'rgba(255,255,255,0.08)'
          for (let r = 6; r < step * 0.55; r += 4) {
            g.beginPath()
            g.arc(x, y, r, 0, TAU)
            g.stroke()
          }
        }
      }
    },
    { repeat: 3 },
  )

// Женевские полосы на мостах.
const cotesTexture = () =>
  canvasTexture(
    512,
    (g, s) => {
      const bands = 4
      for (let i = 0; i < bands; i++) {
        const x0 = (i * s) / bands
        const gr = g.createLinearGradient(x0, 0, x0 + s / bands, 0)
        gr.addColorStop(0, '#959ba3')
        gr.addColorStop(0.42, '#f6f8fa')
        gr.addColorStop(0.55, '#e2e6ea')
        gr.addColorStop(1, '#a1a7af')
        g.fillStyle = gr
        g.fillRect(x0, 0, s / bands, s)
      }
      // Микрориски шлифовки
      for (let y = 0; y < s; y += 2) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
        g.fillRect(0, y, s, 1)
      }
    },
    { repeat: 2.5 },
  )

// Круговое шлифование (сатинирование «солей») для колёс — центр в uv(0,0), зеркальный повтор.
const soleilTexture = () =>
  canvasTexture(
    1024,
    (g, s) => {
      g.fillStyle = '#d8b25d'
      g.fillRect(0, 0, s, s)
      for (let r = 2; r < s * 1.45; r += 2) {
        g.strokeStyle = Math.random() > 0.5 ? 'rgba(255,240,200,0.22)' : 'rgba(110,80,20,0.18)'
        g.lineWidth = 1 + Math.random()
        g.beginPath()
        g.arc(0, 0, r, 0, Math.PI / 2)
        g.stroke()
      }
    },
    { repeat: 1 / 0.7, mirror: true },
  )

// Солнечные лучи — для барабана, храпового колеса, ротора.
const sunburstTexture = (base = '#c3c8cf') =>
  canvasTexture(1024, (g, s) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    g.translate(s / 2, s / 2)
    for (let i = 0; i < 720; i++) {
      g.rotate(TAU / 720)
      g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(60,66,74,0.22)'
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(s, 0)
      g.stroke()
    }
  })

// Зерно кожи для ремешка.
const leatherTexture = () =>
  canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = '#808080'
      g.fillRect(0, 0, s, s)
      for (let i = 0; i < 9000; i++) {
        const v = 100 + Math.random() * 80
        g.fillStyle = `rgb(${v},${v},${v})`
        g.beginPath()
        g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 0, TAU)
        g.fill()
      }
    },
    { repeat: 2, srgb: false },
  )

// Гравировка: золотой текст на прозрачном фоне.
function engravingTexture(lines, w = 1024, h = 256) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach(({ text, size, y, spacing = 0.2 }) => {
    g.font = `700 ${size}px Inter, system-ui, sans-serif`
    if ('letterSpacing' in g) g.letterSpacing = `${size * spacing}px`
    g.fillStyle = '#5a4210'
    g.fillText(text, w / 2 + 2, y * h + 2)
    g.fillStyle = '#e9c46a'
    g.fillText(text, w / 2, y * h)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = MAX_ANISO
  return tex
}

function drawDial(g, s, colors, day) {
  const c = s / 2
  g.clearRect(0, 0, s, s)
  // Основа
  const base = g.createRadialGradient(c, c * 0.75, s * 0.05, c, c, c)
  base.addColorStop(0, colors.dialLight)
  base.addColorStop(1, colors.dial)
  g.fillStyle = base
  g.beginPath()
  g.arc(c, c, c, 0, TAU)
  g.fill()

  // Гильоше «клу-де-Пари» в центре
  g.save()
  g.beginPath()
  g.arc(c, c, c * 0.8, 0, TAU)
  g.clip()
  const step = s / 90
  g.lineWidth = s / 900
  for (let d = -s; d < s * 2; d += step) {
    g.strokeStyle = 'rgba(255,255,255,0.07)'
    g.beginPath()
    g.moveTo(d, 0)
    g.lineTo(d + s, s)
    g.stroke()
    g.strokeStyle = 'rgba(0,0,0,0.12)'
    g.beginPath()
    g.moveTo(d + step / 2, 0)
    g.lineTo(d + step / 2 - s, s)
    g.stroke()
  }
  g.restore()

  // Кольцо с «санрэем» между гильоше и минутной дорожкой
  g.save()
  g.translate(c, c)
  for (let i = 0; i < 1440; i++) {
    g.rotate(TAU / 1440)
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
    g.beginPath()
    g.moveTo(c * 0.8, 0)
    g.lineTo(c, 0)
    g.stroke()
  }
  g.restore()
  g.strokeStyle = colors.ink
  g.globalAlpha = 0.35
  g.lineWidth = s / 700
  g.beginPath()
  g.arc(c, c, c * 0.8, 0, TAU)
  g.stroke()
  g.globalAlpha = 1

  // Минутная дорожка «железная дорога»
  g.lineCap = 'round'
  for (let i = 0; i < 300; i++) {
    const a = (i / 300) * TAU - Math.PI / 2
    const minute = i % 5 === 0
    const five = i % 25 === 0
    if (!minute) {
      g.strokeStyle = colors.ink
      g.globalAlpha = 0.35
      g.lineWidth = s / 1600
      const r1 = c * 0.925
      const r2 = c * 0.945
      g.beginPath()
      g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
      g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2)
      g.stroke()
      g.globalAlpha = 1
      continue
    }
    g.strokeStyle = colors.ink
    g.lineWidth = five ? s * 0.005 : s * 0.0022
    const r1 = c * (five ? 0.885 : 0.91)
    const r2 = c * 0.955
    g.beginPath()
    g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
    g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2)
    g.stroke()
  }
  g.lineWidth = s / 1400
  ;[0.92, 0.95].forEach((k) => {
    g.beginPath()
    g.arc(c, c, c * k, 0, TAU)
    g.stroke()
  })

  // Цифры минут снаружи
  g.fillStyle = colors.ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `600 ${s * 0.022}px Inter, system-ui, sans-serif`
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2
    const r = c * 0.985
    g.save()
    g.translate(c + Math.cos(a) * r * 0.985, c + Math.sin(a) * r * 0.985)
    g.rotate(a + Math.PI / 2)
    g.fillText(String(i * 5).padStart(2, '0'), 0, 0)
    g.restore()
  }

  // Окно даты на 3 часах
  const dw = s * 0.07
  const dh = s * 0.055
  const dx = c + c * 0.62 - dw / 2
  const dy = c - dh / 2
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fillRect(dx - s * 0.004, dy - s * 0.004, dw + s * 0.008, dh + s * 0.008)
  g.fillStyle = '#f7f5ef'
  g.fillRect(dx, dy, dw, dh)
  g.fillStyle = '#111'
  g.font = `700 ${s * 0.036}px Inter, system-ui, sans-serif`
  g.fillText(String(day), dx + dw / 2, dy + dh / 2 + s * 0.002)

  // Надписи
  g.fillStyle = colors.accent
  g.font = `800 ${s * 0.055}px Inter, system-ui, sans-serif`
  if ('letterSpacing' in g) g.letterSpacing = `${s * 0.012}px`
  g.fillText('PULSE', c, c * 0.6)
  if ('letterSpacing' in g) g.letterSpacing = `${s * 0.004}px`
  g.fillStyle = colors.ink
  g.font = `500 ${s * 0.02}px Inter, system-ui, sans-serif`
  g.fillText('AUTOMATIC', c, c * 0.68)
  g.font = `500 ${s * 0.018}px Inter, system-ui, sans-serif`
  g.fillText('25 JEWELS  ·  CHRONOMETER', c, c * 1.4)
  g.font = `500 ${s * 0.014}px Inter, system-ui, sans-serif`
  g.globalAlpha = 0.7
  g.fillText('HANDCRAFTED IN REACT', c, c * 1.86)
  g.globalAlpha = 1
  if ('letterSpacing' in g) g.letterSpacing = '0px'
}

/* ---------- Геометрия ---------- */

// Шестерня: зубья (обычные или «пилой»), окна между спицами и отверстие под ось.
function gearShape(teeth, rOut, { spokes = 5, saw = false, hole = 0.06, ring = 0 } = {}) {
  const root = rOut - Math.max(0.02, rOut * 0.07)
  const step = TAU / teeth
  const shape = new THREE.Shape()
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    const pts = saw
      ? [
          [root, a],
          [rOut, a + step * 0.62],
          [rOut - (rOut - root) * 0.15, a + step * 0.7],
          [root + (rOut - root) * 0.2, a + step * 0.76],
        ]
      : [
          [root, a],
          [root + (rOut - root) * 0.55, a + step * 0.12],
          [rOut, a + step * 0.24],
          [rOut, a + step * 0.44],
          [root + (rOut - root) * 0.55, a + step * 0.56],
          [root, a + step * 0.68],
        ]
    pts.forEach(([r, t], k) => {
      const x = Math.cos(t) * r
      const y = Math.sin(t) * r
      if (i === 0 && k === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
  }
  shape.closePath()
  if (ring) {
    const h = new THREE.Path()
    h.absarc(0, 0, ring, 0, TAU, true)
    shape.holes.push(h)
    return shape
  }
  if (spokes && rOut > 0.15) {
    const rim = root - rOut * 0.12
    const hub = rOut * 0.24
    const gap = 0.05 / rOut + 0.07
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * TAU + gap
      const a1 = ((i + 1) / spokes) * TAU - gap
      const w = new THREE.Path()
      w.moveTo(Math.cos(a0) * rim, Math.sin(a0) * rim)
      w.absarc(0, 0, rim, a0, a1, false)
      w.lineTo(Math.cos(a1 - gap * 0.4) * hub, Math.sin(a1 - gap * 0.4) * hub)
      w.absarc(0, 0, hub, a1 - gap * 0.4, a0 + gap * 0.4, true)
      w.closePath()
      shape.holes.push(w)
    }
  }
  if (hole) {
    const h = new THREE.Path()
    h.absarc(0, 0, hole, 0, TAU, true)
    shape.holes.push(h)
  }
  return shape
}

const extrude = (shape, depth, bevel = 0.006, curve = 48) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: curve,
  })

// Мост-капсула между двумя точками.
function capsuleShape([ax, ay], [bx, by], w) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const th = Math.atan2(ny, nx)
  const s = new THREE.Shape()
  s.moveTo(ax + nx * w, ay + ny * w)
  s.lineTo(bx + nx * w, by + ny * w)
  s.absarc(bx, by, w, th, th - Math.PI, true)
  s.lineTo(ax - nx * w, ay - ny * w)
  s.absarc(ax, ay, w, th - Math.PI, th - TAU, true)
  return s
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// Гранёная стрелка «дофин»: четыре грани с острым ребром посередине ловят свет.
function facetedHand(len, w, tail, h) {
  const T = [0, len, 0]
  const L = [-w, 0, 0]
  const R = [w, 0, 0]
  const B = [0, -tail, 0]
  const A = [0, 0, h]
  const tris = [L, A, T, A, R, T, B, A, L, B, R, A, L, T, R, L, R, B]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  return geo
}

class SpiralCurve extends THREE.Curve {
  constructor(turns, r0, r1) {
    super()
    this.turns = turns
    this.r0 = r0
    this.r1 = r1
  }
  getPoint(u, target = new THREE.Vector3()) {
    const a = u * this.turns * TAU
    const r = this.r0 + (this.r1 - this.r0) * u
    return target.set(Math.cos(a) * r, Math.sin(a) * r, 0)
  }
}

/* ---------- Раскладка механизма (координаты в плоскости XY) ---------- */

const P = {
  barrel: [-0.7, 0.35],
  center: [0, 0],
  third: [0.55, 0.5],
  fourth: [0.78, -0.25],
  escape: [-0.15, -0.85],
  fork: [0.18, -0.98],
  balance: [0.6, -1.05],
}

const BRIDGES = [
  { a: P.barrel, b: [-1.28, 1.02], w: 0.36 },
  { a: P.center, b: P.third, w: 0.14 },
  { a: P.third, b: P.fourth, w: 0.13 },
  { a: P.fourth, b: P.escape, w: 0.12 },
  { a: P.fork, b: [-0.5, -1.42], w: 0.09 },
  { a: P.balance, b: [1.38, -0.55], w: 0.16 },
]

const JEWELS = [P.center, P.third, P.fourth, P.escape, P.fork, P.balance]
const SCREWS = [[-1.28, 1.02], [1.38, -0.55], [-0.5, -1.42], [0.3, 0.25], [0.7, 0.15], [0.35, -0.55], [-1.05, 0.62]]

/* ---------- Материалы ---------- */

function useMaterials() {
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    MAX_ANISO = gl.capabilities.getMaxAnisotropy()
    const steel = new THREE.MeshStandardMaterial({ color: '#d3d8de', metalness: 1, roughness: 0.16 })
    const polished = new THREE.MeshStandardMaterial({ color: '#eef1f4', metalness: 1, roughness: 0.06 })
    const gold = new THREE.MeshStandardMaterial({ color: '#dfb75e', metalness: 1, roughness: 0.22 })
    const goldPolished = new THREE.MeshStandardMaterial({ color: '#f0cd7a', metalness: 1, roughness: 0.08 })
    const goldSoleil = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.3, map: soleilTexture() })
    const blued = new THREE.MeshPhysicalMaterial({ color: '#1f3bb3', metalness: 0.9, roughness: 0.18, clearcoat: 0.6 })
    const ruby = new THREE.MeshPhysicalMaterial({
      color: '#c0103f', roughness: 0.03, metalness: 0.1, clearcoat: 1, emissive: '#5a0018', emissiveIntensity: 0.6,
    })
    const plate = new THREE.MeshStandardMaterial({ color: '#c6cbd2', metalness: 0.85, roughness: 0.4, map: perlageTexture() })
    const bridge = new THREE.MeshStandardMaterial({ color: '#e6e9ed', metalness: 0.92, roughness: 0.28, map: cotesTexture() })
    const sunburst = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.22, map: sunburstTexture() })
    const rotorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.25, map: sunburstTexture('#d6b060') })
    const casePolished = new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.08 })
    const caseBrushed = new THREE.MeshStandardMaterial({ color: '#cfd4da', metalness: 1, roughness: 0.32 })
    const leatherBump = leatherTexture()
    const leather = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.75, metalness: 0, bumpMap: leatherBump, bumpScale: 1.2 })
    const stitch = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8 })
    // Стекло без transmission: иначе прозрачный циферблат за ним не виден.
    const crystal = new THREE.MeshPhysicalMaterial({
      color: '#eaf4ff', roughness: 0, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1,
      envMapIntensity: 2.5, depthWrite: false,
    })
    const dial = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.42, transparent: true })
    const appliedGold = goldPolished.clone()
    appliedGold.transparent = true
    const lume = new THREE.MeshStandardMaterial({ color: '#f2f6ee', emissive: '#7dffb8', emissiveIntensity: 0, roughness: 0.6, transparent: true })
    const handGold = goldPolished.clone()
    handGold.transparent = true
    handGold.flatShading = true
    handGold.side = THREE.DoubleSide
    const handSec = new THREE.MeshStandardMaterial({ color: '#ff3d71', metalness: 0.6, roughness: 0.3, transparent: true })
    const engraveBarrel = new THREE.MeshStandardMaterial({
      map: engravingTexture([{ text: 'CAL. P-25', size: 120, y: 0.42 }, { text: 'TWENTY-FIVE JEWELS', size: 54, y: 0.8 }]),
      transparent: true, metalness: 0.8, roughness: 0.3, depthWrite: false,
    })
    const engraveRotor = new THREE.MeshStandardMaterial({
      map: engravingTexture([{ text: 'PULSE', size: 150, y: 0.45, spacing: 0.35 }, { text: 'AUTOMATIC · REACT', size: 52, y: 0.82 }]),
      transparent: true, metalness: 0.8, roughness: 0.3, depthWrite: false,
    })
    const engraveReg = new THREE.MeshStandardMaterial({
      map: engravingTexture([{ text: '−      +', size: 170, y: 0.5, spacing: 0 }], 512, 256),
      transparent: true, metalness: 0.8, roughness: 0.3, depthWrite: false,
    })
    // Детали мостов и ротора — свои экземпляры, чтобы делать их полупрозрачными отдельно.
    const bridgeSet = {
      face: bridge,
      edge: polished.clone(),
      ruby: ruby.clone(),
      blued: blued.clone(),
      chaton: goldPolished.clone(),
      sun: sunburst.clone(),
      rotor: rotorMat,
      engraveBarrel,
      engraveRotor,
      engraveReg,
    }
    Object.values(bridgeSet).forEach((mt) => (mt.transparent = true))
    return {
      steel, polished, gold, goldPolished, goldSoleil, blued, ruby, plate, sunburst, casePolished, caseBrushed,
      leather, stitch, crystal, dial, appliedGold, lume, handGold, handSec, bridgeSet,
    }
  }, [gl])
}

function Environment({ mode }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    scene.environment = env
    gl.toneMappingExposure = 1.08
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentIntensity = mode === 'light' ? 1.15 : 0.9
  }, [mode, scene])
  return null
}

/* ---------- Детали ---------- */

function Gear({ pos, z, teeth, r, depth = 0.045, faceMat, edgeMat, opts, spin, pinion = true, gearRef, hub = true }) {
  const geo = useMemo(() => extrude(gearShape(teeth, r, opts), depth, 0.006, 64), [teeth, r, depth, opts])
  const pin = useMemo(() => extrude(gearShape(12, 0.075, { spokes: 0, hole: 0 }), 0.12, 0.004), [])
  const arbor = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.5, 24).rotateX(Math.PI / 2), [])
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(r * 0.2, r * 0.24, 0.03, 48).rotateX(Math.PI / 2), [r])
  const mats = useMemo(() => [faceMat, edgeMat], [faceMat, edgeMat])
  return (
    <group position={[pos[0], pos[1], z]} ref={gearRef} userData={{ spin }}>
      <mesh geometry={geo} material={mats} />
      {hub && <mesh geometry={hubGeo} material={edgeMat} position={[0, 0, depth + 0.02]} />}
      {pinion && <mesh geometry={pin} material={edgeMat} position={[0, 0, -0.06]} />}
      <mesh geometry={arbor} material={edgeMat} position={[0, 0, 0.05]} />
    </group>
  )
}

function Stitches({ geo, mat, segments }) {
  const ref = useRef()
  useEffect(() => {
    const m4 = new THREE.Matrix4()
    let i = 0
    segments.forEach(({ x0, x1, y, z }) => {
      for (let x = x0; x <= x1; x += 0.07) {
        m4.makeTranslation(y, x, z)
        ref.current.setMatrixAt(i++, m4)
      }
    })
    ref.current.count = i
    ref.current.instanceMatrix.needsUpdate = true
  }, [segments])
  return <instancedMesh ref={ref} args={[geo, mat, 200]} />
}

function Strap({ m, side }) {
  const g = useMemo(() => {
    const seg = extrude(roundedRect(1.12, 1.55, 0.12), 0.12, 0.035, 16)
    const end = extrude(roundedRect(1.02, 1.6, 0.4), 0.11, 0.03, 16)
    const stitch = new THREE.BoxGeometry(0.012, 0.04, 0.012)
    return { seg, end, stitch }
  }, [])
  const s = side
  const stitchRows = useMemo(
    () => [
      { x0: -0.7, x1: 0.7, y: -0.48, z: 0.16 },
      { x0: -0.7, x1: 0.7, y: 0.48, z: 0.16 },
    ],
    [],
  )
  return (
    <group position={[0, s * 2.85, -0.05]} rotation={[s * -0.18, 0, 0]}>
      <mesh geometry={g.seg} material={m.leather} position={[0, 0, -0.06]} />
      <Stitches geo={g.stitch} mat={m.stitch} segments={stitchRows} />
      <group position={[0, s * 1.55, -0.28]} rotation={[s * -0.35, 0, 0]}>
        <mesh geometry={g.end} material={m.leather} position={[0, 0, -0.05]} />
        <Stitches geo={g.stitch} mat={m.stitch} segments={stitchRows.map((r) => ({ ...r, y: r.y * 0.92 }))} />
      </group>
    </group>
  )
}

/* ---------- Модель ---------- */

function WatchModel({ mode }) {
  const m = useMaterials()
  const root = useRef()
  const parts = useRef({})
  const reg = (name) => (el) => {
    if (el) parts.current[name] = el
  }
  const cam = useThree((s) => s.camera)
  const state = useRef(sampleKeys(0))
  const look = useRef(new THREE.Vector3())
  const rimA = useRef()
  const rimB = useRef()
  const colorClock = useRef(0)
  const lastDialKey = useRef('')

  // Циферблат 2048×2048 на canvas, перерисовывается при смене палитры и даты.
  const dialCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 2048
    return c
  }, [])
  const dialTex = useMemo(() => {
    const t = new THREE.CanvasTexture(dialCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = MAX_ANISO
    return t
  }, [dialCanvas])
  useEffect(() => {
    m.dial.map = dialTex
    m.dial.needsUpdate = true
  }, [m, dialTex])

  // Тени: все детали отбрасывают и принимают, кроме стекла.
  useEffect(() => {
    root.current.traverse((o) => {
      if (o.isMesh && !o.userData.noShadow) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [])

  /* Геометрии */
  const g = useMemo(() => {
    const profile = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y))
    // Корпус: шлифованный борт и полированные фаски
    const caseSide = new THREE.LatheGeometry(
      profile([[1.76, -0.3], [1.97, -0.3], [2.05, -0.22], [2.08, -0.02], [2.07, 0.22], [2.02, 0.36], [1.76, 0.36]]).concat([new THREE.Vector2(1.76, -0.3)]),
      200,
    ).rotateX(Math.PI / 2)
    const bezelGeo = new THREE.LatheGeometry(
      profile([[1.78, 0.34], [2.02, 0.34], [2.0, 0.44], [1.94, 0.5], [1.86, 0.52], [1.81, 0.49], [1.78, 0.44]]).concat([new THREE.Vector2(1.78, 0.34)]),
      200,
    ).rotateX(Math.PI / 2)
    const lug = extrude(roundedRect(0.28, 0.62, 0.1), 0.26, 0.03, 12)
    const crownGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.22, 48, 1).rotateZ(Math.PI / 2)
    const crownCap = new THREE.CylinderGeometry(0.15, 0.18, 0.04, 48).rotateZ(Math.PI / 2)
    const knurl = new THREE.BoxGeometry(0.2, 0.018, 0.03)
    const stem = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24).rotateZ(Math.PI / 2)
    const back = new THREE.CylinderGeometry(1.8, 1.8, 0.06, 128).rotateX(Math.PI / 2)
    const plateGeo = new THREE.CylinderGeometry(1.74, 1.74, 0.12, 160).rotateX(Math.PI / 2)
    const plateEdge = new THREE.TorusGeometry(1.74, 0.02, 12, 200)
    const dialGeo = new THREE.CircleGeometry(1.7, 160)
    const rehaut = new THREE.CylinderGeometry(1.78, 1.7, 0.1, 160, 1, true).rotateX(Math.PI / 2)
    const thMax = Math.asin(1.84 / 5)
    const crystalGeo = new THREE.SphereGeometry(5, 128, 32, 0, TAU, 0, thMax)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 0.47 - 5 * Math.cos(thMax))
    const index = extrude(roundedRect(0.07, 0.25, 0.02), 0.03, 0.008, 8)
    const lumeGeo = new THREE.BoxGeometry(0.04, 0.12, 0.01)
    const hourHand = facetedHand(0.98, 0.075, 0.22, 0.03)
    const minHand = facetedHand(1.45, 0.058, 0.25, 0.026)
    const handLume = new THREE.BoxGeometry(0.022, 0.5, 0.004)
    const secHand = new THREE.BoxGeometry(0.016, 1.9, 0.01).translate(0, 0.6, 0)
    const secTail = new THREE.CircleGeometry(0.07, 48).translate(0, -0.25, 0.006)
    const cap = new THREE.CylinderGeometry(0.075, 0.085, 0.05, 48).rotateX(Math.PI / 2)
    const drum = new THREE.CylinderGeometry(0.56, 0.56, 0.16, 128).rotateX(Math.PI / 2)
    const drumCap = new THREE.CircleGeometry(0.55, 128)
    const jewelDome = new THREE.SphereGeometry(0.045, 32, 16, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45)
    const chaton = new THREE.TorusGeometry(0.065, 0.02, 16, 48)
    const screwHead = new THREE.CylinderGeometry(0.046, 0.058, 0.04, 40).rotateX(Math.PI / 2)
    const slot = new THREE.BoxGeometry(0.1, 0.014, 0.02)
    const balRing = new THREE.TorusGeometry(0.42, 0.032, 24, 160)
    const balSpoke = new THREE.BoxGeometry(0.84, 0.035, 0.03)
    const balScrew = new THREE.CylinderGeometry(0.016, 0.016, 0.06, 16).rotateZ(Math.PI / 2).translate(0.47, 0, 0)
    const balScrewHead = new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16).rotateZ(Math.PI / 2).translate(0.505, 0, 0)
    const roller = new THREE.CylinderGeometry(0.08, 0.08, 0.025, 48).rotateX(Math.PI / 2)
    const impulsePin = new THREE.BoxGeometry(0.02, 0.02, 0.04)
    const hairspring = new THREE.TubeGeometry(new SpiralCurve(13, 0.05, 0.3), 1400, 0.0042, 8, false)
    const stud = new THREE.CylinderGeometry(0.03, 0.03, 0.06, 20).rotateX(Math.PI / 2)
    const regArm = extrude(capsuleShape([0, 0], [0.55, 0], 0.025), 0.02, 0.004, 16)
    const fork = (() => {
      const s = new THREE.Shape()
      s.moveTo(-0.03, -0.02)
      s.lineTo(0.3, -0.022)
      s.lineTo(0.34, -0.05)
      s.lineTo(0.37, -0.05)
      s.lineTo(0.35, 0)
      s.lineTo(0.37, 0.05)
      s.lineTo(0.34, 0.05)
      s.lineTo(0.3, 0.022)
      s.lineTo(-0.03, 0.02)
      s.lineTo(-0.1, 0.16)
      s.lineTo(-0.14, 0.14)
      s.lineTo(-0.06, 0)
      s.lineTo(-0.14, -0.14)
      s.lineTo(-0.1, -0.16)
      s.closePath()
      return extrude(s, 0.025, 0.004)
    })()
    const palletStone = new THREE.BoxGeometry(0.05, 0.022, 0.03)
    const bridges = BRIDGES.map(({ a, b, w }) => extrude(capsuleShape(a, b, w), 0.06, 0.014, 48))
    const ratchet = extrude(gearShape(44, 0.4, { spokes: 0, saw: true, hole: 0.05 }), 0.04, 0.005, 48)
    const crownWheel = extrude(gearShape(30, 0.2, { spokes: 0, saw: true, hole: 0.03 }), 0.035, 0.004)
    const rotor = (() => {
      const s = new THREE.Shape()
      s.moveTo(0.18, 0)
      s.absarc(0, 0, 0.18, 0, Math.PI, false)
      s.lineTo(-1.62, 0)
      s.absarc(0, 0, 1.62, Math.PI, TAU, false)
      s.lineTo(0.18, 0)
      const w = new THREE.Path()
      w.moveTo(0.5, -0.12)
      w.absarc(0, 0, 0.5, -0.24, -Math.PI + 0.24, true)
      w.absarc(0, 0, 1.1, -Math.PI + 0.24, -0.24, false)
      w.closePath()
      s.holes.push(w)
      return extrude(s, 0.04, 0.01, 96)
    })()
    const rotorWeight = new THREE.TorusGeometry(1.52, 0.055, 16, 120, Math.PI).rotateZ(Math.PI)
    const plane = (w, h) => new THREE.PlaneGeometry(w, h)
    return {
      caseSide, bezelGeo, lug, crownGeo, crownCap, knurl, stem, back, plateGeo, plateEdge, dialGeo, rehaut,
      crystalGeo, index, lumeGeo, hourHand, minHand, handLume, secHand, secTail, cap, drum, drumCap, jewelDome,
      chaton, screwHead, slot, balRing, balSpoke, balScrew, balScrewHead, roller, impulsePin, hairspring, stud,
      regArm, fork, palletStone, bridges, ratchet, crownWheel, rotor, rotorWeight,
      engraveBarrelPlane: plane(0.62, 0.155),
      engraveRotorPlane: plane(1.0, 0.25),
      engraveRegPlane: plane(0.28, 0.14),
    }
  }, [])

  const gearOpts = useMemo(
    () => ({
      barrel: { spokes: 0, ring: 0.5 },
      train: { spokes: 5 },
      escape: { spokes: 4, saw: true },
    }),
    [],
  )

  const bridgeMats = useMemo(() => [m.bridgeSet.face, m.bridgeSet.edge], [m])
  const barrelBridgeAngle = Math.atan2(1.02 - P.barrel[1], -1.28 - P.barrel[0])
  const balCockAngle = Math.atan2(-0.55 - P.balance[1], 1.38 - P.balance[0])

  useFrame((st, dt) => {
    readScroll()
    const target = sampleKeys(scroll.t)
    const s = state.current
    const k = 1 - Math.exp(-dt * 4)
    for (const key of ['fly', 'bridge', 'bop', 'spread', 'drop']) s[key] += (target[key] - s[key]) * k
    for (let i = 0; i < 3; i++) {
      s.cam[i] += (target.cam[i] - s.cam[i]) * k
      s.look[i] += (target.look[i] - s.look[i]) * k
    }

    // Камера: на узких экранах отъезжаем дальше.
    const aspect = st.size.width / st.size.height
    const f = aspect < 1 ? 1 + (1 - aspect) * 1.3 : 1
    look.current.set(...s.look)
    cam.position.set(
      s.look[0] + (s.cam[0] - s.look[0]) * f,
      s.look[1] + (s.cam[1] - s.look[1]) * f,
      s.look[2] + (s.cam[2] - s.look[2]) * f,
    )
    cam.lookAt(look.current)

    // Лёгкий наклон за мышью (слабее при макросъёмке).
    const par = 1 - smooth(THREE.MathUtils.clamp(scroll.t / 0.5, 0, 1)) * 0.8
    root.current.rotation.x += (scroll.py * 0.25 * par - root.current.rotation.x) * k
    root.current.rotation.y += (scroll.px * 0.35 * par - root.current.rotation.y) * k

    const P_ = parts.current
    const time = st.clock.elapsedTime

    // Стрелки — реальное время, секундная «метёт» 8 шагами в секунду.
    const now = new Date()
    const sec = now.getSeconds() + Math.floor(now.getMilliseconds() / 125) / 8
    const min = now.getMinutes() + sec / 60
    const hr = (now.getHours() % 12) + min / 60
    if (P_.hour) P_.hour.rotation.z = -(hr / 12) * TAU
    if (P_.minute) P_.minute.rotation.z = -(min / 60) * TAU
    if (P_.second) P_.second.rotation.z = -(sec / 60) * TAU

    // Механизм
    const beats = time * 6
    const tick = Math.floor(beats)
    const frac = beats - tick
    const easeTick = tick + Math.min(1, frac * 5)
    for (const name of ['barrel', 'center', 'third', 'fourth']) {
      const el = P_[name]
      if (el) el.rotation.z = time * el.userData.spin
    }
    if (P_.escape) P_.escape.rotation.z = (-easeTick * TAU) / 15 / 2
    if (P_.fork) P_.fork.rotation.z = Math.tanh(Math.sin(beats * Math.PI) * 6) * 0.14
    const bal = Math.sin(time * TAU * 3) * 2.5
    if (P_.balanceWheel) P_.balanceWheel.rotation.z = bal
    if (P_.hairspring) {
      P_.hairspring.rotation.z = bal * 0.12
      const sc = 1 + Math.sin(time * TAU * 3) * 0.06
      P_.hairspring.scale.set(sc, sc, 1)
    }
    if (P_.ratchet) P_.ratchet.rotation.z = time * 0.03
    if (P_.rotor) P_.rotor.rotation.z = Math.sin(time * 0.35) * 1.2 + time * 0.08

    // Разборка
    const sp = s.spread
    const lift = s.bridge
    const setZ = (name, z0, dz) => P_[name] && (P_[name].position.z = z0 + dz)
    setZ('plate', 0, -sp * 0.2)
    setZ('barrel', 0.1, sp * 0.35)
    setZ('center', 0.2, sp * 0.6)
    setZ('third', 0.27, sp * 0.82)
    setZ('fourth', 0.21, sp * 0.72)
    setZ('escape', 0.26, sp * 0.95)
    setZ('fork', 0.3, sp * 1.1)
    setZ('balance', 0.32, sp * 1.35)
    setZ('bridges', 0, lift * 1.45 + sp * 0.5)
    setZ('screws', 0, lift * 1.85 + sp * 0.9)
    setZ('rotor', 0.5, lift * 1.6 + sp * 0.6)
    setZ('case', 0, -s.drop * 1.6)
    if (P_.crown) P_.crown.position.x = 2.2 + s.drop * 0.6
    setZ('dial', 0, s.fly * 2.8)
    setZ('hands', 0, s.fly * 3.6)
    setZ('crystal', 0, s.fly * 4.6)

    const fadeTop = 1 - THREE.MathUtils.clamp((s.fly - 0.35) / 0.6, 0, 1)
    m.dial.opacity = fadeTop
    m.appliedGold.opacity = fadeTop
    m.lume.opacity = fadeTop
    m.handGold.opacity = fadeTop
    m.handSec.opacity = fadeTop
    m.crystal.opacity = 0.14 * fadeTop
    if (P_.dial) P_.dial.visible = fadeTop > 0.01
    if (P_.hands) P_.hands.visible = fadeTop > 0.01
    if (P_.crystal) P_.crystal.visible = fadeTop > 0.01
    Object.values(m.bridgeSet).forEach((mat) => (mat.opacity = s.bop))
    // Ротор прячется сразу после циферблата, чтобы не загораживать мосты.
    const rotorFade = s.bop * (1 - THREE.MathUtils.clamp((s.fly - 0.6) / 0.3, 0, 1) * (1 - sp))
    m.bridgeSet.rotor.opacity = rotorFade
    m.bridgeSet.engraveRotor.opacity = rotorFade
    if (P_.rotor) P_.rotor.visible = rotorFade > 0.02
    if (P_.case) P_.case.visible = s.drop < 0.98

    // Цвета: подсветка и циферблат берут палитру текущей секции.
    if (colorClock.current++ % 20 === 0) {
      const css = getComputedStyle(document.documentElement)
      const a1 = css.getPropertyValue('--a1').trim()
      const a2 = css.getPropertyValue('--a2').trim()
      const a3 = css.getPropertyValue('--a3').trim()
      const bg2 = css.getPropertyValue('--bg-2').trim()
      const ink = css.getPropertyValue('--text').trim()
      if (a1 && rimA.current) rimA.current.color.set(a1)
      if (a2 && rimB.current) rimB.current.color.set(a2)
      if (a3) m.handSec.color.set(a3)
      m.lume.emissiveIntensity = mode === 'dark' ? 0.55 : 0
      const day = now.getDate()
      const key = [a2, bg2, ink, mode, day].join('|')
      if (key !== lastDialKey.current && bg2) {
        lastDialKey.current = key
        const dial = new THREE.Color(bg2)
        const dialLight = dial.clone().lerp(new THREE.Color(a1 || '#888'), 0.18)
        drawDial(
          dialCanvas.getContext('2d'),
          2048,
          {
            dial: `#${dial.getHexString()}`,
            dialLight: `#${dialLight.getHexString()}`,
            accent: a2 || '#7dd3fc',
            ink: ink || '#eee',
          },
          day,
        )
        dialTex.needsUpdate = true
      }
    }
  })

  return (
    <>
      <ambientLight intensity={mode === 'light' ? 0.45 : 0.22} />
      <directionalLight
        position={[2.5, 3.5, 7]}
        intensity={mode === 'light' ? 2.4 : 2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
        shadow-radius={4}
      />
      <pointLight ref={rimA} position={[-4, -2, 3]} intensity={18} distance={14} />
      <pointLight ref={rimB} position={[4, 3, 1.5]} intensity={14} distance={14} />

      <group ref={root}>
        {/* Корпус, ушки, ремешок, задняя крышка */}
        <group ref={reg('case')}>
          <mesh geometry={g.caseSide} material={m.caseBrushed} />
          <mesh geometry={g.bezelGeo} material={m.casePolished} />
          {[[-0.72, 1.98], [0.72, 1.98], [-0.72, -1.98], [0.72, -1.98]].map(([x, y]) => (
            <mesh key={`${x}${y}`} geometry={g.lug} material={m.casePolished} position={[x, y, -0.12]} rotation={[y > 0 ? -0.12 : 0.12, 0, 0]} />
          ))}
          <Strap m={m} side={1} />
          <Strap m={m} side={-1} />
          <mesh geometry={g.back} material={m.caseBrushed} position={[0, 0, -0.33]} />
        </group>
        <group ref={reg('crown')} position={[2.2, 0, 0.04]}>
          <mesh geometry={g.crownGeo} material={m.casePolished} />
          <mesh geometry={g.crownCap} material={m.casePolished} position={[0.12, 0, 0]} />
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * TAU
            return <mesh key={i} geometry={g.knurl} material={m.caseBrushed} position={[0, Math.cos(a) * 0.19, Math.sin(a) * 0.19]} rotation={[a, 0, 0]} />
          })}
          <mesh geometry={g.stem} material={m.steel} position={[-0.18, 0, 0]} />
        </group>

        {/* Платина с перляжем */}
        <group ref={reg('plate')}>
          <mesh geometry={g.plateGeo} material={m.plate} />
          <mesh geometry={g.plateEdge} material={m.polished} position={[0, 0, 0.06]} />
        </group>

        {/* Заводной барабан */}
        <group ref={reg('barrel')} position={[P.barrel[0], P.barrel[1], 0.1]} userData={{ spin: 0.02 }}>
          <mesh geometry={g.drum} material={m.goldSoleil} position={[0, 0, 0.02]} />
          <mesh geometry={g.drumCap} material={m.sunburst} position={[0, 0, 0.101]} />
          <Gear pos={[0, 0]} z={-0.06} teeth={96} r={0.62} depth={0.05} faceMat={m.goldSoleil} edgeMat={m.goldPolished} opts={gearOpts.barrel} pinion={false} hub={false} />
        </group>

        {/* Колёсная передача */}
        <Gear gearRef={reg('center')} pos={P.center} z={0.2} teeth={64} r={0.5} faceMat={m.goldSoleil} edgeMat={m.goldPolished} opts={gearOpts.train} spin={-0.05} />
        <Gear gearRef={reg('third')} pos={P.third} z={0.27} teeth={48} r={0.36} faceMat={m.goldSoleil} edgeMat={m.goldPolished} opts={gearOpts.train} spin={0.18} />
        <Gear gearRef={reg('fourth')} pos={P.fourth} z={0.21} teeth={40} r={0.32} faceMat={m.goldSoleil} edgeMat={m.goldPolished} opts={gearOpts.train} spin={-0.6} />
        <Gear gearRef={reg('escape')} pos={P.escape} z={0.26} teeth={15} r={0.22} faceMat={m.steel} edgeMat={m.polished} opts={gearOpts.escape} />

        {/* Анкерная вилка с палетами */}
        <group ref={reg('fork')} position={[P.fork[0], P.fork[1], 0.3]}>
          <group rotation={[0, 0, Math.atan2(P.balance[1] - P.fork[1], P.balance[0] - P.fork[0])]}>
            <mesh geometry={g.fork} material={m.polished} />
            <mesh geometry={g.palletStone} material={m.ruby} position={[-0.13, 0.15, 0.02]} rotation={[0, 0, 0.5]} />
            <mesh geometry={g.palletStone} material={m.ruby} position={[-0.13, -0.15, 0.02]} rotation={[0, 0, -0.5]} />
          </group>
          <mesh geometry={g.jewelDome} material={m.ruby} position={[0, 0, 0.03]} />
        </group>

        {/* Баланс и волосковая спираль */}
        <group ref={reg('balance')} position={[P.balance[0], P.balance[1], 0.32]}>
          <group ref={reg('balanceWheel')}>
            <mesh geometry={g.balRing} material={m.goldPolished} />
            <mesh geometry={g.balSpoke} material={m.gold} />
            <mesh geometry={g.balSpoke} material={m.gold} rotation={[0, 0, Math.PI / 3]} />
            <mesh geometry={g.balSpoke} material={m.gold} rotation={[0, 0, -Math.PI / 3]} />
            {Array.from({ length: 12 }, (_, i) => (
              <group key={i} rotation={[0, 0, (i / 12) * TAU]}>
                <mesh geometry={g.balScrew} material={m.goldPolished} />
                <mesh geometry={g.balScrewHead} material={m.goldPolished} />
              </group>
            ))}
            <mesh geometry={g.roller} material={m.polished} position={[0, 0, -0.03]} />
            <mesh geometry={g.impulsePin} material={m.ruby} position={[0, -0.06, -0.05]} />
          </group>
          <mesh ref={reg('hairspring')} geometry={g.hairspring} material={m.blued} position={[0, 0, 0.05]} />
        </group>

        {/* Мосты: женевские полосы на гранях, полированные фаски по краю */}
        <group ref={reg('bridges')}>
          {g.bridges.map((geo, i) => (
            <mesh key={i} geometry={geo} material={bridgeMats} position={[0, 0, 0.38]} />
          ))}
          <mesh
            geometry={g.engraveBarrelPlane}
            material={m.bridgeSet.engraveBarrel}
            position={[(P.barrel[0] - 1.28) / 2 - 0.02, (P.barrel[1] + 1.02) / 2 + 0.02, 0.456]}
            rotation={[0, 0, barrelBridgeAngle - Math.PI / 2]}
            userData={{ noShadow: true }}
          />
          {JEWELS.map(([x, y], i) => (
            <group key={i} position={[x, y, 0.46]}>
              <mesh geometry={g.chaton} material={m.bridgeSet.chaton} />
              <mesh geometry={g.jewelDome} material={m.bridgeSet.ruby} />
            </group>
          ))}
          <group ref={reg('ratchet')} position={[P.barrel[0], P.barrel[1], 0.46]}>
            <mesh geometry={g.ratchet} material={m.bridgeSet.sun} />
          </group>
          <mesh geometry={g.crownWheel} material={m.bridgeSet.sun} position={[-0.05, 0.95, 0.46]} />
          {/* Регулятор хода (градусник) на мосту баланса */}
          <group position={[P.balance[0], P.balance[1], 0.47]} rotation={[0, 0, balCockAngle + 0.35]}>
            <mesh geometry={g.regArm} material={m.bridgeSet.edge} />
          </group>
          <mesh
            geometry={g.engraveRegPlane}
            material={m.bridgeSet.engraveReg}
            position={[P.balance[0] + Math.cos(balCockAngle) * 0.42, P.balance[1] + Math.sin(balCockAngle) * 0.42, 0.457]}
            rotation={[0, 0, balCockAngle - Math.PI / 2]}
            userData={{ noShadow: true }}
          />
          <mesh geometry={g.stud} material={m.bridgeSet.edge} position={[P.balance[0] + 0.22, P.balance[1] + 0.12, 0.47]} />
        </group>

        {/* Синёные винты — при разборке «выкручиваются» выше мостов */}
        <group ref={reg('screws')}>
          {SCREWS.concat([P.barrel]).map(([x, y], i) => (
            <group key={i} position={[x, y, 0.47]}>
              <mesh geometry={g.screwHead} material={m.bridgeSet.blued} />
              <mesh geometry={g.slot} material={m.bridgeSet.edge} position={[0, 0, 0.018]} rotation={[0, 0, i]} />
            </group>
          ))}
        </group>

        {/* Ротор автоподзавода с гравировкой */}
        <group ref={reg('rotor')} position={[0, 0, 0.5]}>
          <mesh geometry={g.rotor} material={m.bridgeSet.rotor} />
          <mesh geometry={g.rotorWeight} material={m.bridgeSet.chaton} position={[0, 0, 0.02]} />
          <mesh geometry={g.engraveRotorPlane} material={m.bridgeSet.engraveRotor} position={[0, -1.26, 0.062]} userData={{ noShadow: true }} />
          <mesh geometry={g.screwHead} material={m.bridgeSet.blued} position={[0, 0, 0.06]} />
        </group>

        {/* Циферблат: накладные индексы с люминофором */}
        <group ref={reg('dial')}>
          <mesh geometry={g.dialGeo} material={m.dial} position={[0, 0, 0.6]} />
          <mesh geometry={g.rehaut} material={m.appliedGold} position={[0, 0, 0.6]} />
          {Array.from({ length: 12 }, (_, i) => {
            if (i === 3) return null // окно даты
            const a = (i / 12) * TAU
            const r = 1.3
            const pair = i === 0 ? [-0.055, 0.055] : [0]
            return (
              <group key={i} position={[Math.sin(a) * r, Math.cos(a) * r, 0.605]} rotation={[0, 0, -a]}>
                {pair.map((dx) => (
                  <group key={dx} position={[dx, 0, 0]}>
                    <mesh geometry={g.index} material={m.appliedGold} />
                    <mesh geometry={g.lumeGeo} material={m.lume} position={[0, 0.02, 0.047]} />
                  </group>
                ))}
              </group>
            )
          })}
        </group>

        {/* Гранёные стрелки */}
        <group ref={reg('hands')}>
          <group ref={reg('hour')} position={[0, 0, 0.66]}>
            <mesh geometry={g.hourHand} material={m.handGold} />
            <mesh geometry={g.handLume} material={m.lume} position={[0, 0.5, 0.018]} scale={[1, 0.8, 1]} />
          </group>
          <group ref={reg('minute')} position={[0, 0, 0.7]}>
            <mesh geometry={g.minHand} material={m.handGold} />
            <mesh geometry={g.handLume} material={m.lume} position={[0, 0.78, 0.014]} scale={[0.8, 1.2, 1]} />
          </group>
          <group ref={reg('second')} position={[0, 0, 0.74]}>
            <mesh geometry={g.secHand} material={m.handSec} />
            <mesh geometry={g.secTail} material={m.handSec} />
          </group>
          <mesh geometry={g.cap} material={m.handGold} position={[0, 0, 0.76]} />
        </group>

        {/* Купольное сапфировое стекло */}
        <group ref={reg('crystal')}>
          <mesh geometry={g.crystalGeo} material={m.crystal} userData={{ noShadow: true }} />
        </group>
      </group>
    </>
  )
}

export default function Watch3D({ mode }) {
  const stage = useRef()

  useEffect(() => {
    const onScroll = () => {
      readScroll()
      if (stage.current) stage.current.style.opacity = scroll.opacity
    }
    const onMove = (e) => {
      scroll.px = e.clientX / window.innerWidth - 0.5
      scroll.py = e.clientY / window.innerHeight - 0.5
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div className="watch3d" ref={stage} aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 35, position: [0, 0, 7.4], near: 0.05, far: 60 }}
      >
        <Environment mode={mode} />
        <WatchModel mode={mode} />
      </Canvas>
    </div>
  )
}
