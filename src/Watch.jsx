import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import './Watch.css'

/*
  Механические часы на фоне. Каждый слой — отдельный SVG в 3D-пространстве.
  При прокрутке часы наклоняются, слои расходятся по оси Z (разборка),
  а циферблат, стрелки и стекло улетают вверх и открывают механизм.
*/

const C = 200 // центр viewBox 400×400

/* ---------- Геометрия ---------- */

function circlePath(cx, cy, r) {
  return `M${cx + r} ${cy}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`
}

// Шестерня с зубьями и окнами-спицами (fill-rule: evenodd вырезает окна).
function gearPath(teeth, rOut, windows = 5) {
  const rIn = rOut - Math.max(3, rOut * 0.09)
  const step = (Math.PI * 2) / teeth
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    const pts = [
      [rIn, a],
      [rOut, a + step * 0.22],
      [rOut, a + step * 0.5],
      [rIn, a + step * 0.72],
    ]
    for (const [r, t] of pts) {
      d += `${d ? 'L' : 'M'}${(Math.cos(t) * r).toFixed(2)} ${(Math.sin(t) * r).toFixed(2)}`
    }
  }
  d += 'Z'
  if (windows && rOut > 20) {
    const wr = rOut * 0.22
    const wd = rOut * 0.52
    for (let i = 0; i < windows; i++) {
      const a = (i / windows) * Math.PI * 2
      d += circlePath(Math.cos(a) * wd, Math.sin(a) * wd, wr)
    }
  }
  d += circlePath(0, 0, Math.max(2.5, rOut * 0.08))
  return d
}

function spiralPath(turns, r0, r1) {
  let d = ''
  const n = turns * 48
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns * Math.PI * 2
    const r = r0 + ((r1 - r0) * i) / n
    d += `${i ? 'L' : 'M'}${(Math.cos(t) * r).toFixed(2)} ${(Math.sin(t) * r).toFixed(2)}`
  }
  return d
}

const GEARS = [
  { id: 'barrel', x: 135, y: 255, teeth: 64, r: 72, cls: 'gold', dur: 240, dir: 1 },
  { id: 'center', x: 200, y: 200, teeth: 50, r: 52, cls: 'gold', dur: 120, dir: -1 },
  { id: 'third', x: 268, y: 150, teeth: 36, r: 38, cls: 'steel', dur: 40, dir: 1 },
  { id: 'fourth', x: 290, y: 245, teeth: 30, r: 32, cls: 'gold', dur: 15, dir: -1 },
  { id: 'escape', x: 238, y: 305, teeth: 15, r: 24, cls: 'steel', dur: 3, dir: 1, steps: 15 },
]

const BRIDGES = [
  [135, 255, 200, 200],
  [268, 150, 290, 245],
  [238, 305, 290, 245],
  [120, 130, 62, 205],
]

const JEWELS = [
  [135, 255], [200, 200], [268, 150], [290, 245], [238, 305], [120, 130],
]

const SCREWS = [
  [62, 205], [330, 300], [95, 95], [310, 95], [170, 335],
]

/* ---------- Слои ---------- */

function Plate() {
  return (
    <svg viewBox="0 0 400 400">
      <defs>
        <pattern id="perlage" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="10" className="perlage" />
          <circle cx="11" cy="11" r="5" className="perlage" />
        </pattern>
      </defs>
      <circle cx={C} cy={C} r="178" className="plate" />
      <circle cx={C} cy={C} r="178" fill="url(#perlage)" />
      {SCREWS.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" className="screw" />
          <line x1={x - 4} y1={y - 1} x2={x + 4} y2={y + 1} className="screw-slot" />
        </g>
      ))}
    </svg>
  )
}

function Gears() {
  return (
    <svg viewBox="0 0 400 400">
      {GEARS.map((g) => (
        <g key={g.id} transform={`translate(${g.x} ${g.y})`}>
          <path
            d={gearPath(g.teeth, g.r, g.id === 'escape' ? 0 : 5)}
            className={`gear gear--${g.cls}`}
            fillRule="evenodd"
            style={{
              animationDuration: `${g.dur}s`,
              animationDirection: g.dir > 0 ? 'normal' : 'reverse',
              animationTimingFunction: g.steps ? `steps(${g.steps})` : 'linear',
            }}
          />
          <path d={gearPath(10, 10, 0)} className="gear gear--steel pinion" fillRule="evenodd" />
        </g>
      ))}
    </svg>
  )
}

function Balance() {
  return (
    <svg viewBox="0 0 400 400">
      <g transform="translate(120 130)">
        <g className="balance">
          <circle r="42" className="balance-ring" />
          <circle r="34" className="balance-ring balance-ring--inner" />
          {[0, 60, 120].map((a) => (
            <line
              key={a}
              x1={Math.cos((a * Math.PI) / 180) * -34}
              y1={Math.sin((a * Math.PI) / 180) * -34}
              x2={Math.cos((a * Math.PI) / 180) * 34}
              y2={Math.sin((a * Math.PI) / 180) * 34}
              className="balance-spoke"
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <circle key={i} cx={Math.cos(a) * 42} cy={Math.sin(a) * 42} r="3" className="balance-screw" />
          })}
        </g>
        <path d={spiralPath(7, 4, 26)} className="hairspring" />
      </g>
    </svg>
  )
}

function Bridges() {
  return (
    <svg viewBox="0 0 400 400">
      {BRIDGES.map(([x1, y1, x2, y2], i) => (
        <g key={i}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} className="bridge-edge" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} className="bridge" />
        </g>
      ))}
      {JEWELS.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7" className="jewel-setting" />
          <circle cx={x} cy={y} r="4.5" className="jewel" />
          <circle cx={x - 1.5} cy={y - 1.5} r="1.4" className="jewel-shine" />
        </g>
      ))}
    </svg>
  )
}

function Case() {
  return (
    <svg viewBox="0 0 400 400">
      <rect x="378" y="186" width="18" height="28" rx="4" className="crown" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={381 + i * 2.6} y1="188" x2={381 + i * 2.6} y2="212" className="crown-grip" />
      ))}
      <circle cx={C} cy={C} r="186" className="case-ring" />
      <circle cx={C} cy={C} r="178" className="case-inner" />
    </svg>
  )
}

function Dial() {
  return (
    <svg viewBox="0 0 400 400">
      <circle cx={C} cy={C} r="172" className="dial" />
      <circle cx={C} cy={C} r="150" className="dial-track" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2
        const major = i % 5 === 0
        const r1 = major ? 140 : 152
        return (
          <line
            key={i}
            x1={C + Math.cos(a) * r1}
            y1={C + Math.sin(a) * r1}
            x2={C + Math.cos(a) * 162}
            y2={C + Math.sin(a) * 162}
            className={major ? 'dial-index' : 'dial-tick'}
          />
        )
      })}
      {[
        ['12', C, 112],
        ['3', 294, C + 8],
        ['6', C, 302],
        ['9', 106, C + 8],
      ].map(([t, x, y]) => (
        <text key={t} x={x} y={y} className="dial-num" textAnchor="middle">
          {t}
        </text>
      ))}
      <text x={C} y="150" className="dial-brand" textAnchor="middle">
        PULSE
      </text>
      <text x={C} y="262" className="dial-sub" textAnchor="middle">
        AUTOMATIC · 25 JEWELS
      </text>
    </svg>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let t
    const tick = () => {
      setNow(new Date())
      t = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    t = setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => clearTimeout(t)
  }, [])
  return now
}

// Стрелка: прозрачный круг на весь циферблат делает центр вращения = центр часов.
function Hand({ deg, children, spring }) {
  return (
    <motion.g animate={{ rotate: deg }} transition={spring} initial={false}>
      <circle cx={C} cy={C} r="200" fill="transparent" />
      {children}
    </motion.g>
  )
}

function Hands() {
  const now = useClock()
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const tick = { type: 'spring', stiffness: 420, damping: 14 }
  const smooth = { duration: 0.6, ease: 'easeOut' }
  return (
    <svg viewBox="0 0 400 400">
      <Hand deg={secs / 120} spring={smooth}>
        <path d={`M${C - 6} ${C + 18} L${C} ${C - 95} L${C + 6} ${C + 18} Z`} className="hand" />
      </Hand>
      <Hand deg={secs * 0.1} spring={smooth}>
        <path d={`M${C - 4.5} ${C + 22} L${C} ${C - 140} L${C + 4.5} ${C + 22} Z`} className="hand" />
      </Hand>
      <Hand deg={secs * 6} spring={tick}>
        <line x1={C} y1={C + 34} x2={C} y2={C - 156} className="hand-sec" />
        <circle cx={C} cy={C + 26} r="5" className="hand-sec-dot" />
      </Hand>
      <circle cx={C} cy={C} r="7" className="hand-cap" />
      <circle cx={C} cy={C} r="2.5" className="hand-pin" />
    </svg>
  )
}

function Crystal() {
  return (
    <svg viewBox="0 0 400 400">
      <circle cx={C} cy={C} r="176" className="crystal" />
      <path d="M70 150 A140 140 0 0 1 250 62 A160 160 0 0 0 90 190 Z" className="crystal-shine" />
    </svg>
  )
}

/* ---------- Сцена ---------- */

const LAYERS = [
  { key: 'plate', z: -3, El: Plate },
  { key: 'gears', z: -2, El: Gears },
  { key: 'balance', z: -1.4, El: Balance },
  { key: 'bridges', z: -0.6, El: Bridges },
  { key: 'case', z: 0, El: Case },
  { key: 'dial', z: 1.2, El: Dial, fly: 260 },
  { key: 'hands', z: 2, El: Hands, fly: 340 },
  { key: 'crystal', z: 3, El: Crystal, fly: 480 },
]

const SPREAD = 70

function Layer({ z, fly, explode, flyAway, El }) {
  const tz = useTransform([explode, flyAway], ([e, f]) => z * e * SPREAD + (fly ? f * fly : 0))
  const opacity = useTransform(flyAway, (f) => (fly ? 1 - f * 0.92 : 1))
  return (
    <motion.div className="watch-layer" style={{ z: tz, opacity }}>
      <El />
    </motion.div>
  )
}

export default function Watch() {
  const { scrollYProgress } = useScroll()
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 22 })

  const rotateX = useTransform(p, [0, 0.3], [0, 58])
  const rotateZ = useTransform(p, [0, 0.3, 1], [0, -25, -45])
  const scale = useTransform(p, [0, 0.3, 1], [1, 0.88, 0.95])
  const explode = useTransform(p, [0.08, 0.5], [0, 1])
  const flyAway = useTransform(p, [0.45, 0.8], [0, 1])
  const captionOpacity = useTransform(p, [0.6, 0.8], [0, 1])
  // На первом экране часы приглушены, чтобы не мешать тексту; при разборке становятся ярче.
  const stageOpacity = useTransform(p, [0, 0.15], [0.3, 0.6])

  return (
    <motion.div className="watch-stage" aria-hidden="true" style={{ opacity: stageOpacity }}>
      <motion.div className="watch" style={{ rotateX, rotateZ, scale }}>
        {LAYERS.map(({ key, ...rest }) => (
          <Layer key={key} {...rest} explode={explode} flyAway={flyAway} />
        ))}
      </motion.div>
      <motion.p className="watch-caption" style={{ opacity: captionOpacity }}>
        Внутри: заводной барабан · колёсная передача · баланс со спиралью · спуск
      </motion.p>
    </motion.div>
  )
}
