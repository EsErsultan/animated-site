/* eslint-disable react/immutability -- объекты three.js по задумке меняются в useFrame */
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
  Процедурная 3D-модель механических часов на three.js.
  Циферблат смотрит на +Z. Прокрутка секции #watch управляет «режиссурой»:
  стекло, стрелки и циферблат улетают, мосты поднимаются, камера подлетает
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

// cam/look — положение камеры и точка взгляда; fly — улёт стекла, стрелок и циферблата;
// bridge — подъём мостов, bop — их прозрачность; spread — разлёт колёс; drop — уход корпуса вниз.
const KEYS = [
  { t: 0.0, cam: [0, 0, 7.4], look: [0, 0, 0], fly: 0, bridge: 0, bop: 1, spread: 0, drop: 0 },
  { t: 0.13, cam: [0.4, -2.7, 6.2], look: [0, 0, 0.2], fly: 0.3, bridge: 0, bop: 1, spread: 0, drop: 0 },
  { t: 0.27, cam: [1.7, -3.6, 4.9], look: [0, 0, 0.3], fly: 1, bridge: 0, bop: 1, spread: 0, drop: 0.35 },
  { t: 0.41, cam: [-1.3, -3.4, 4.4], look: [0, 0, 0.5], fly: 1, bridge: 1, bop: 0.3, spread: 0, drop: 0.7 },
  { t: 0.55, cam: [1.0, -2.0, 2.7], look: [0.3, 0.05, 0.3], fly: 1, bridge: 1, bop: 0.08, spread: 0, drop: 1 },
  { t: 0.69, cam: [-0.25, -1.95, 1.45], look: [0.02, -0.92, 0.3], fly: 1, bridge: 1, bop: 0.05, spread: 0, drop: 1 },
  { t: 0.83, cam: [1.25, -1.75, 1.2], look: [0.55, -1.05, 0.38], fly: 1, bridge: 1, bop: 0.05, spread: 0, drop: 1 },
  { t: 1.0, cam: [0.6, -6.4, 6.0], look: [0, 0, 1.1], fly: 1, bridge: 1, bop: 1, spread: 1, drop: 1 },
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

function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (repeat !== 1) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
  }
  return tex
}

// Перляж — перекрывающиеся «жемчужные» круги на платине.
const perlageTexture = () =>
  canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = '#aeb3ba'
      g.fillRect(0, 0, s, s)
      const step = 40
      for (let y = -step; y < s + step; y += step * 0.75) {
        for (let x = -step; x < s + step; x += step * 0.75) {
          const gr = g.createRadialGradient(x - 6, y - 6, 2, x, y, step * 0.6)
          gr.addColorStop(0, 'rgba(255,255,255,0.55)')
          gr.addColorStop(0.6, 'rgba(160,166,174,0.25)')
          gr.addColorStop(1, 'rgba(90,96,104,0.35)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(x, y, step * 0.55, 0, TAU)
          g.fill()
        }
      }
    },
    3,
  )

// Женевские полосы на мостах.
const cotesTexture = () =>
  canvasTexture(
    256,
    (g, s) => {
      const bands = 4
      for (let i = 0; i < bands; i++) {
        const x0 = (i * s) / bands
        const gr = g.createLinearGradient(x0, 0, x0 + s / bands, 0)
        gr.addColorStop(0, '#9da3ab')
        gr.addColorStop(0.45, '#f4f6f8')
        gr.addColorStop(1, '#a7adb5')
        g.fillStyle = gr
        g.fillRect(x0, 0, s / bands, s)
      }
    },
    2.5,
  )

// Солнечные лучи — для барабана и храпового колеса.
const sunburstTexture = () =>
  canvasTexture(512, (g, s) => {
    g.fillStyle = '#c3c8cf'
    g.fillRect(0, 0, s, s)
    g.translate(s / 2, s / 2)
    for (let i = 0; i < 360; i++) {
      g.rotate(TAU / 360)
      g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(70,76,84,0.25)'
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(s, 0)
      g.stroke()
    }
  })

function drawDial(g, s, colors) {
  const c = s / 2
  g.clearRect(0, 0, s, s)
  // Основа с «санрэем»
  const base = g.createRadialGradient(c, c * 0.8, s * 0.05, c, c, c)
  base.addColorStop(0, colors.dialLight)
  base.addColorStop(1, colors.dial)
  g.fillStyle = base
  g.beginPath()
  g.arc(c, c, c, 0, TAU)
  g.fill()
  g.save()
  g.translate(c, c)
  for (let i = 0; i < 720; i++) {
    g.rotate(TAU / 720)
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(c, 0)
    g.stroke()
  }
  g.restore()
  // Минутная дорожка
  g.strokeStyle = colors.ink
  g.lineCap = 'round'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2
    const major = i % 5 === 0
    const r1 = c * (major ? 0.87 : 0.9)
    const r2 = c * 0.95
    g.lineWidth = major ? s * 0.006 : s * 0.0025
    g.beginPath()
    g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
    g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2)
    g.stroke()
  }
  g.lineWidth = s * 0.002
  g.beginPath()
  g.arc(c, c, c * 0.955, 0, TAU)
  g.stroke()
  // Надписи
  g.textAlign = 'center'
  g.fillStyle = colors.accent
  g.font = `800 ${s * 0.055}px Inter, system-ui, sans-serif`
  g.fillText('PULSE', c, c * 0.62)
  g.fillStyle = colors.ink
  g.font = `500 ${s * 0.022}px Inter, system-ui, sans-serif`
  g.fillText('AUTOMATIC  ·  25 JEWELS', c, c * 1.42)
  g.font = `500 ${s * 0.018}px Inter, system-ui, sans-serif`
  g.fillText('HANDCRAFTED IN REACT', c, c * 1.5)
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
          [rOut, a + step * 0.65],
          [root + (rOut - root) * 0.25, a + step * 0.72],
        ]
      : [
          [root, a],
          [rOut, a + step * 0.2],
          [rOut, a + step * 0.48],
          [root, a + step * 0.7],
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
    const gap = 0.06 / rOut + 0.08
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

const extrude = (shape, depth, bevel = 0.006) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 32,
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

/* ---------- Сцена ---------- */

function useMaterials() {
  return useMemo(() => {
    const steel = new THREE.MeshStandardMaterial({ color: '#cfd4db', metalness: 1, roughness: 0.2 })
    const gold = new THREE.MeshStandardMaterial({ color: '#dcb45c', metalness: 1, roughness: 0.26 })
    const blued = new THREE.MeshStandardMaterial({ color: '#2340b8', metalness: 0.9, roughness: 0.25 })
    const ruby = new THREE.MeshPhysicalMaterial({
      color: '#c0103f', roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: '#5a0018', emissiveIntensity: 0.6,
    })
    const plate = new THREE.MeshStandardMaterial({ color: '#c3c8cf', metalness: 0.85, roughness: 0.42, map: perlageTexture() })
    const bridge = new THREE.MeshStandardMaterial({ color: '#e1e5ea', metalness: 0.9, roughness: 0.3, map: cotesTexture() })
    const sunburst = new THREE.MeshStandardMaterial({ color: '#d4d8de', metalness: 1, roughness: 0.25, map: sunburstTexture() })
    const caseMat = new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 1, roughness: 0.14 })
    // Стекло без transmission: иначе прозрачный циферблат за ним не виден.
    const crystal = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1,
      envMapIntensity: 2.5, depthWrite: false,
    })
    const dial = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.45, transparent: true })
    const appliedGold = gold.clone()
    appliedGold.transparent = true
    const handGold = gold.clone()
    handGold.transparent = true
    const handSec = new THREE.MeshStandardMaterial({ color: '#ff3d71', metalness: 0.6, roughness: 0.3, transparent: true })
    // У мостов свои экземпляры материалов, чтобы делать их полупрозрачными отдельно от остального.
    const bridgeSet = [bridge, ruby.clone(), blued.clone(), gold.clone(), sunburst.clone()]
    bridgeSet.forEach((m) => (m.transparent = true))
    return { steel, gold, blued, ruby, plate, sunburst, caseMat, crystal, dial, appliedGold, handGold, handSec, bridgeSet }
  }, [])
}

function Environment({ mode }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentIntensity = mode === 'light' ? 1.1 : 0.85
  }, [mode, scene])
  return null
}

function Gear({ pos, z, teeth, r, depth = 0.04, mat, opts, spin, pinion = true, gearRef }) {
  const geo = useMemo(() => extrude(gearShape(teeth, r, opts), depth), [teeth, r, depth, opts])
  const pin = useMemo(() => extrude(gearShape(10, 0.075, { spokes: 0, hole: 0 }), 0.12, 0.004), [])
  const arbor = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, 0.5, 16).rotateX(Math.PI / 2), [])
  return (
    <group position={[pos[0], pos[1], z]} ref={gearRef} userData={{ spin }}>
      <mesh geometry={geo} material={mat} />
      {pinion && <mesh geometry={pin} material={mat} position={[0, 0, -0.06]} />}
      <mesh geometry={arbor} material={mat} position={[0, 0, 0.05]} />
    </group>
  )
}

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

  // Циферблат рисуется на canvas и перерисовывается при смене палитры.
  const dialCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    return c
  }, [])
  const dialTex = useMemo(() => {
    const t = new THREE.CanvasTexture(dialCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [dialCanvas])
  useEffect(() => {
    m.dial.map = dialTex
    m.dial.needsUpdate = true
  }, [m, dialTex])

  /* Геометрии */
  const g = useMemo(() => {
    const lathe = new THREE.LatheGeometry(
      [
        [1.76, -0.32], [1.95, -0.32], [2.03, -0.26], [2.07, -0.05], [2.06, 0.25], [2.0, 0.44],
        [1.93, 0.5], [1.84, 0.5], [1.8, 0.44], [1.76, 0.4],
      ].map(([x, y]) => new THREE.Vector2(x, y)).concat([new THREE.Vector2(1.76, -0.32)]),
      160,
    ).rotateX(Math.PI / 2)
    const bezel = new THREE.TorusGeometry(1.88, 0.075, 24, 160).translate(0, 0, 0.49)
    const lug = new THREE.BoxGeometry(0.3, 0.55, 0.26)
    const crownGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.26, 28, 1).rotateZ(Math.PI / 2)
    const stem = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16).rotateZ(Math.PI / 2)
    const back = new THREE.CylinderGeometry(1.8, 1.8, 0.06, 96).rotateX(Math.PI / 2)
    const plateGeo = new THREE.CylinderGeometry(1.74, 1.74, 0.12, 128).rotateX(Math.PI / 2)
    const dialGeo = new THREE.CircleGeometry(1.7, 128)
    const rehaut = new THREE.CylinderGeometry(1.78, 1.7, 0.1, 128, 1, true).rotateX(Math.PI / 2)
    const thMax = Math.asin(1.84 / 5)
    const crystalGeo = new THREE.SphereGeometry(5, 96, 24, 0, TAU, 0, thMax)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 0.47 - 5 * Math.cos(thMax))
    const index = new THREE.BoxGeometry(0.06, 0.24, 0.035)
    const hourHand = extrude(
      new THREE.Shape([new THREE.Vector2(-0.075, -0.14), new THREE.Vector2(0, 0.98), new THREE.Vector2(0.075, -0.14), new THREE.Vector2(0, -0.24)]),
      0.012,
      0.008,
    )
    const minHand = extrude(
      new THREE.Shape([new THREE.Vector2(-0.055, -0.16), new THREE.Vector2(0, 1.45), new THREE.Vector2(0.055, -0.16), new THREE.Vector2(0, -0.26)]),
      0.012,
      0.008,
    )
    const secHand = new THREE.BoxGeometry(0.018, 1.9, 0.01).translate(0, 0.6, 0)
    const secTail = new THREE.CircleGeometry(0.07, 32).translate(0, -0.25, 0.006)
    const cap = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 32).rotateX(Math.PI / 2)
    const drum = new THREE.CylinderGeometry(0.56, 0.56, 0.16, 96).rotateX(Math.PI / 2)
    const drumCap = new THREE.CircleGeometry(0.55, 96)
    const jewel = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24).rotateX(Math.PI / 2)
    const chaton = new THREE.TorusGeometry(0.065, 0.02, 12, 32)
    const screwHead = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 24).rotateX(Math.PI / 2)
    const slot = new THREE.BoxGeometry(0.1, 0.014, 0.02)
    const balRing = new THREE.TorusGeometry(0.42, 0.032, 16, 96)
    const balSpoke = new THREE.BoxGeometry(0.84, 0.035, 0.03)
    const balScrew = new THREE.CylinderGeometry(0.016, 0.016, 0.06, 12).rotateZ(Math.PI / 2).translate(0.47, 0, 0)
    const roller = new THREE.CylinderGeometry(0.08, 0.08, 0.025, 32).rotateX(Math.PI / 2)
    const hairspring = new THREE.TubeGeometry(new SpiralCurve(13, 0.05, 0.3), 900, 0.0045, 6, false)
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
    const bridges = BRIDGES.map(({ a, b, w }) => extrude(capsuleShape(a, b, w), 0.06, 0.012))
    const ratchet = extrude(gearShape(44, 0.4, { spokes: 0, saw: true, hole: 0.05 }), 0.04, 0.004)
    const crownWheel = extrude(gearShape(30, 0.2, { spokes: 0, saw: true, hole: 0.03 }), 0.035, 0.004)
    return {
      lathe, bezel, lug, crownGeo, stem, back, plateGeo, dialGeo, rehaut, crystalGeo, index, hourHand, minHand,
      secHand, secTail, cap, drum, drumCap, jewel, chaton, screwHead, slot, balRing, balSpoke, balScrew, roller,
      hairspring, fork, palletStone, bridges, ratchet, crownWheel,
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

    // Стрелки — реальное время, секундная «метёт» 8 шагами в секунду, как у автоподзавода.
    const now = new Date()
    const sec = now.getSeconds() + Math.floor(now.getMilliseconds() / 125) / 8
    const min = now.getMinutes() + sec / 60
    const hr = (now.getHours() % 12) + min / 60
    if (P_.hour) P_.hour.rotation.z = -(hr / 12) * TAU
    if (P_.minute) P_.minute.rotation.z = -(min / 60) * TAU
    if (P_.second) P_.second.rotation.z = -(sec / 60) * TAU

    // Колёсная передача
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
    setZ('case', 0, -s.drop * 1.6)
    if (P_.crown) P_.crown.position.x = 2.18 + s.drop * 0.6
    setZ('dial', 0, s.fly * 2.8)
    setZ('hands', 0, s.fly * 3.6)
    setZ('crystal', 0, s.fly * 4.6)

    const fadeTop = 1 - THREE.MathUtils.clamp((s.fly - 0.35) / 0.6, 0, 1)
    m.dial.opacity = fadeTop
    m.appliedGold.opacity = fadeTop
    m.handGold.opacity = fadeTop
    m.handSec.opacity = fadeTop
    m.crystal.opacity = 0.14 * fadeTop
    if (P_.dial) P_.dial.visible = fadeTop > 0.01
    if (P_.hands) P_.hands.visible = fadeTop > 0.01
    if (P_.crystal) P_.crystal.visible = fadeTop > 0.01
    m.bridgeSet.forEach((mat) => (mat.opacity = s.bop))
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
      const key = [a2, bg2, ink, mode].join('|')
      if (key !== lastDialKey.current && bg2) {
        lastDialKey.current = key
        const dial = new THREE.Color(bg2)
        const dialLight = dial.clone().lerp(new THREE.Color(a1 || '#888'), 0.18)
        drawDial(dialCanvas.getContext('2d'), 1024, {
          dial: `#${dial.getHexString()}`,
          dialLight: `#${dialLight.getHexString()}`,
          accent: a2 || '#7dd3fc',
          ink: ink || '#eee',
        })
        dialTex.needsUpdate = true
      }
    }
  })

  return (
    <>
      <ambientLight intensity={mode === 'light' ? 0.5 : 0.25} />
      <directionalLight position={[3, 4, 6]} intensity={mode === 'light' ? 2.2 : 1.8} />
      <pointLight ref={rimA} position={[-4, -2, 3]} intensity={18} distance={14} />
      <pointLight ref={rimB} position={[4, 3, 1.5]} intensity={14} distance={14} />

      <group ref={root}>
        {/* Корпус, ушки, заводная головка, задняя крышка */}
        <group ref={reg('case')}>
          <mesh geometry={g.lathe} material={m.caseMat} />
          <mesh geometry={g.bezel} material={m.caseMat} />
          {[[-0.72, 2.0], [0.72, 2.0], [-0.72, -2.0], [0.72, -2.0]].map(([x, y]) => (
            <mesh key={`${x}${y}`} geometry={g.lug} material={m.caseMat} position={[x, y, 0.02]} rotation={[y > 0 ? -0.15 : 0.15, 0, 0]} />
          ))}
          <mesh geometry={g.back} material={m.caseMat} position={[0, 0, -0.34]} />
        </group>
        <group ref={reg('crown')} position={[2.18, 0, 0.06]}>
          <mesh geometry={g.crownGeo} material={m.caseMat} />
          <mesh geometry={g.stem} material={m.steel} position={[-0.18, 0, 0]} />
        </group>

        {/* Платина с перляжем */}
        <group ref={reg('plate')}>
          <mesh geometry={g.plateGeo} material={m.plate} />
        </group>

        {/* Заводной барабан */}
        <group ref={reg('barrel')} position={[P.barrel[0], P.barrel[1], 0.1]} userData={{ spin: 0.02 }}>
          <mesh geometry={g.drum} material={m.gold} position={[0, 0, 0.02]} />
          <mesh geometry={g.drumCap} material={m.sunburst} position={[0, 0, 0.101]} />
          <Gear pos={[0, 0]} z={-0.06} teeth={96} r={0.62} depth={0.05} mat={m.gold} opts={gearOpts.barrel} pinion={false} />
        </group>

        {/* Колёсная передача */}
        <Gear gearRef={reg('center')} pos={P.center} z={0.2} teeth={64} r={0.5} mat={m.gold} opts={gearOpts.train} spin={-0.05} />
        <Gear gearRef={reg('third')} pos={P.third} z={0.27} teeth={48} r={0.36} mat={m.gold} opts={gearOpts.train} spin={0.18} />
        <Gear gearRef={reg('fourth')} pos={P.fourth} z={0.21} teeth={40} r={0.32} mat={m.gold} opts={gearOpts.train} spin={-0.6} />
        <Gear gearRef={reg('escape')} pos={P.escape} z={0.26} teeth={15} r={0.22} mat={m.steel} opts={gearOpts.escape} />

        {/* Анкерная вилка с палетами */}
        <group ref={reg('fork')} position={[P.fork[0], P.fork[1], 0.3]}>
          <group rotation={[0, 0, Math.atan2(P.balance[1] - P.fork[1], P.balance[0] - P.fork[0])]}>
            <mesh geometry={g.fork} material={m.steel} />
            <mesh geometry={g.palletStone} material={m.ruby} position={[-0.13, 0.15, 0.02]} rotation={[0, 0, 0.5]} />
            <mesh geometry={g.palletStone} material={m.ruby} position={[-0.13, -0.15, 0.02]} rotation={[0, 0, -0.5]} />
          </group>
          <mesh geometry={g.jewel} material={m.ruby} position={[0, 0, 0.03]} />
        </group>

        {/* Баланс и волосковая спираль */}
        <group ref={reg('balance')} position={[P.balance[0], P.balance[1], 0.32]}>
          <group ref={reg('balanceWheel')}>
            <mesh geometry={g.balRing} material={m.gold} />
            <mesh geometry={g.balSpoke} material={m.gold} />
            <mesh geometry={g.balSpoke} material={m.gold} rotation={[0, 0, Math.PI / 3]} />
            <mesh geometry={g.balSpoke} material={m.gold} rotation={[0, 0, -Math.PI / 3]} />
            {Array.from({ length: 12 }, (_, i) => (
              <mesh key={i} geometry={g.balScrew} material={m.gold} rotation={[0, 0, (i / 12) * TAU]} />
            ))}
            <mesh geometry={g.roller} material={m.steel} position={[0, 0, -0.03]} />
          </group>
          <mesh ref={reg('hairspring')} geometry={g.hairspring} material={m.blued} position={[0, 0, 0.05]} />
        </group>

        {/* Мосты с женевскими полосами, камни, храповое колесо */}
        <group ref={reg('bridges')}>
          {g.bridges.map((geo, i) => (
            <mesh key={i} geometry={geo} material={m.bridgeSet[0]} position={[0, 0, 0.38]} />
          ))}
          {JEWELS.map(([x, y], i) => (
            <group key={i} position={[x, y, 0.46]}>
              <mesh geometry={g.chaton} material={m.bridgeSet[3]} />
              <mesh geometry={g.jewel} material={m.bridgeSet[1]} />
            </group>
          ))}
          <group ref={reg('ratchet')} position={[P.barrel[0], P.barrel[1], 0.46]}>
            <mesh geometry={g.ratchet} material={m.bridgeSet[4]} />
          </group>
          <mesh geometry={g.crownWheel} material={m.bridgeSet[4]} position={[-0.05, 0.95, 0.46]} />
        </group>

        {/* Синёные винты — при разборке «выкручиваются» выше мостов */}
        <group ref={reg('screws')}>
          {SCREWS.concat([P.barrel]).map(([x, y], i) => (
            <group key={i} position={[x, y, 0.47]}>
              <mesh geometry={g.screwHead} material={m.bridgeSet[2]} />
              <mesh geometry={g.slot} material={m.bridgeSet[0]} position={[0, 0, 0.018]} rotation={[0, 0, i]} />
            </group>
          ))}
        </group>

        {/* Циферблат с накладными индексами */}
        <group ref={reg('dial')}>
          <mesh geometry={g.dialGeo} material={m.dial} position={[0, 0, 0.6]} />
          <mesh geometry={g.rehaut} material={m.appliedGold} position={[0, 0, 0.6]} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * TAU
            const r = 1.32
            return (
              <group key={i} position={[Math.sin(a) * r, Math.cos(a) * r, 0.62]} rotation={[0, 0, -a]}>
                <mesh geometry={g.index} material={m.appliedGold} position={i === 0 ? [-0.05, 0, 0] : [0, 0, 0]} />
                {i === 0 && <mesh geometry={g.index} material={m.appliedGold} position={[0.05, 0, 0]} />}
              </group>
            )
          })}
        </group>

        {/* Стрелки */}
        <group ref={reg('hands')}>
          <group ref={reg('hour')} position={[0, 0, 0.66]}>
            <mesh geometry={g.hourHand} material={m.handGold} />
          </group>
          <group ref={reg('minute')} position={[0, 0, 0.69]}>
            <mesh geometry={g.minHand} material={m.handGold} />
          </group>
          <group ref={reg('second')} position={[0, 0, 0.72]}>
            <mesh geometry={g.secHand} material={m.handSec} />
            <mesh geometry={g.secTail} material={m.handSec} />
          </group>
          <mesh geometry={g.cap} material={m.handGold} position={[0, 0, 0.74]} />
        </group>

        {/* Купольное сапфировое стекло */}
        <group ref={reg('crystal')}>
          <mesh geometry={g.crystalGeo} material={m.crystal} />
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
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 35, position: [0, 0, 7.4], near: 0.05, far: 60 }}
      >
        <Environment mode={mode} />
        <WatchModel mode={mode} />
      </Canvas>
    </div>
  )
}

