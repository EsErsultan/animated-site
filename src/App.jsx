import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  motion,
  AnimatePresence,
  animate,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import Watch from './Watch.jsx'
import './App.css'

/* ---------- Данные ---------- */

const YEAR = new Date().getFullYear()

// Каждая секция — своя палитра. При прокрутке цвета плавно перетекают.
const SECTIONS = [
  {
    id: 'top', label: 'Главная',
    dark: { '--bg': '#07070d', '--bg-2': '#10101c', '--a1': '#7c5cff', '--a2': '#00d4ff', '--a3': '#ff4fd8' },
    light: { '--bg': '#f6f4ff', '--bg-2': '#ffffff', '--a1': '#6d4aff', '--a2': '#0891b2', '--a3': '#db2777' },
  },
  {
    id: 's0', label: 'Возможности',
    dark: { '--bg': '#03110c', '--bg-2': '#082019', '--a1': '#10b981', '--a2': '#a3e635', '--a3': '#06b6d4' },
    light: { '--bg': '#ecfbf4', '--bg-2': '#ffffff', '--a1': '#059669', '--a2': '#4d7c0f', '--a3': '#0891b2' },
  },
  {
    id: 's1', label: 'Цифры',
    dark: { '--bg': '#140904', '--bg-2': '#22120a', '--a1': '#ff7a18', '--a2': '#ffd166', '--a3': '#ff3d71' },
    light: { '--bg': '#fff4ea', '--bg-2': '#ffffff', '--a1': '#ea580c', '--a2': '#b45309', '--a3': '#e11d48' },
  },
  {
    id: 'parallax', label: 'Параллакс',
    dark: { '--bg': '#040a1a', '--bg-2': '#0a1530', '--a1': '#3b82f6', '--a2': '#22d3ee', '--a3': '#818cf8' },
    light: { '--bg': '#edf3ff', '--bg-2': '#ffffff', '--a1': '#2563eb', '--a2': '#0e7490', '--a3': '#6366f1' },
  },
  {
    id: 's2', label: 'Стек',
    dark: { '--bg': '#14040c', '--bg-2': '#240a18', '--a1': '#ff4f8b', '--a2': '#ffb3c7', '--a3': '#c026d3' },
    light: { '--bg': '#fff0f5', '--bg-2': '#ffffff', '--a1': '#e11d74', '--a2': '#be185d', '--a3': '#a21caf' },
  },
  {
    id: 's3', label: 'Вопросы',
    dark: { '--bg': '#0f0c03', '--bg-2': '#1d1808', '--a1': '#f59e0b', '--a2': '#2dd4bf', '--a3': '#fb7185' },
    light: { '--bg': '#fffaea', '--bg-2': '#ffffff', '--a1': '#d97706', '--a2': '#0f766e', '--a3': '#e11d48' },
  },
  {
    id: 'cta', label: 'Частицы',
    dark: { '--bg': '#0a0614', '--bg-2': '#160e28', '--a1': '#8b5cf6', '--a2': '#22d3ee', '--a3': '#f472b6' },
    light: { '--bg': '#f4f1ff', '--bg-2': '#ffffff', '--a1': '#7c3aed', '--a2': '#0891b2', '--a3': '#db2777' },
  },
]

const WORDS = ['движение', 'эмоции', 'скорость', 'магию']

const FEATURES = [
  { icon: '⚡', title: 'Мгновенно', text: 'Vite собирает проект за доли секунды, а React обновляет только то, что изменилось.' },
  { icon: '🌀', title: 'Плавно', text: 'Пружинная физика framer-motion делает каждое движение естественным.' },
  { icon: '🎯', title: 'Точно', text: 'Анимации запускаются ровно тогда, когда блок появляется на экране.' },
  { icon: '🧲', title: 'Отзывчиво', text: 'Кнопки притягиваются к курсору, карточки наклоняются за мышью.' },
  { icon: '🎨', title: 'Ярко', text: 'У каждой секции своя палитра, цвета меняются прямо во время прокрутки.' },
  { icon: '♿', title: 'Бережно', text: 'Если в системе выключена анимация, сайт это уважает.' },
]

const STATS = [
  { value: 60, suffix: ' fps', label: 'плавность анимаций' },
  { value: 7, suffix: '', label: 'цветовых палитр' },
  { value: 100, suffix: '%', label: 'на React' },
  { value: 0, suffix: ' мс', label: 'ожидания' },
]

const TABS = [
  { id: 'react', label: 'React', text: 'Компоненты и хуки: каждый эффект — отдельный переиспользуемый блок.', code: 'const [open, setOpen] = useState(false)' },
  { id: 'motion', label: 'Motion', text: 'framer-motion отвечает за пружины, появление при скролле и общие layout-переходы.', code: '<motion.div whileInView={{ opacity: 1 }} />' },
  { id: 'css', label: 'CSS', text: 'Keyframes для градиентов и блобов, @property — для плавной смены цветов секций.', code: '@property --a1 { syntax: "<color>"; inherits: true }' },
  { id: 'canvas', label: 'Canvas', text: 'Частицы рисуются на canvas, разбегаются от курсора и берут цвет текущей секции.', code: 'ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)' },
]

const FAQ = [
  { q: 'Это настоящий сайт?', a: 'Это тестовый сайт: витрина анимаций на React, HTML, CSS и JavaScript.' },
  { q: 'Почему меняются цвета?', a: 'У каждой секции своя палитра. Когда секция доходит до середины экрана, весь сайт плавно перекрашивается.' },
  { q: 'Можно ли выключить анимации?', a: 'Да. Если в настройках системы включено «Уменьшить движение», CSS-анимации отключаются.' },
  { q: 'Где лежит код?', a: 'В репозитории на GitHub, вместе с инструкцией по запуску.' },
]

/* ---------- Анимации появления при скролле ---------- */

const EASE = [0.22, 1, 0.36, 1]
const VIEWPORT = { once: false, amount: 0.25 }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }

// Карточки влетают с разных сторон: левая колонка слева, правая справа, средняя снизу.
const cardIn = {
  hidden: (i) => ({
    opacity: 0,
    x: i % 3 === 0 ? -120 : i % 3 === 2 ? 120 : 0,
    y: i % 3 === 1 ? 120 : 40,
    rotate: i % 3 === 0 ? -8 : i % 3 === 2 ? 8 : 0,
    scale: 0.85,
  }),
  show: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, transition: { type: 'spring', stiffness: 90, damping: 16 } },
}

const zoomIn = {
  hidden: { opacity: 0, scale: 0.4, rotate: -12 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } },
}

const sideIn = {
  hidden: (i) => ({ opacity: 0, x: i % 2 ? 140 : -140, skewX: i % 2 ? -10 : 10 }),
  show: { opacity: 1, x: 0, skewX: 0, transition: { duration: 0.8, ease: EASE } },
}

const flipIn = {
  hidden: { opacity: 0, rotateX: -70, y: 50, transformPerspective: 900 },
  show: { opacity: 1, rotateX: 0, y: 0, transformPerspective: 900, transition: { duration: 0.9, ease: EASE } },
}

function Section({ id, className = '', children }) {
  return (
    <motion.section
      id={id}
      data-theme={id}
      className={`section ${className}`}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </motion.section>
  )
}

function Heading({ kicker, children }) {
  return (
    <div className="heading">
      <motion.span
        className="kicker"
        variants={{
          hidden: { opacity: 0, letterSpacing: '0.6em' },
          show: { opacity: 1, letterSpacing: '0.18em', transition: { duration: 0.8, ease: EASE } },
        }}
      >
        {kicker}
      </motion.span>
      <motion.h2
        variants={{
          hidden: { clipPath: 'inset(0 0 100% 0)', y: 40 },
          show: { clipPath: 'inset(0 0 0% 0)', y: 0, transition: { duration: 0.9, ease: EASE } },
        }}
      >
        {children}
      </motion.h2>
      <motion.span
        className="heading-line"
        variants={{
          hidden: { scaleX: 0 },
          show: { scaleX: 1, transition: { duration: 0.8, delay: 0.3, ease: EASE } },
        }}
      />
    </div>
  )
}

/* ---------- Цвет секций ---------- */

function useSectionTheme(mode) {
  const [active, setActive] = useState(SECTIONS[0].id)

  useEffect(() => {
    const els = document.querySelectorAll('[data-theme]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.dataset.theme)
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Layout-эффект: цвета меняются в том же кадре, что и тема (важно для анимации переключения).
  useLayoutEffect(() => {
    const vars = SECTIONS.find((s) => s.id === active)[mode]
    const root = document.documentElement
    root.dataset.mode = mode
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  }, [active, mode])

  return active
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ---------- Эффекты ---------- */

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 25 })
  return <motion.div className="progress" style={{ scaleX }} />
}

function CursorGlow() {
  const x = useMotionValue(-500)
  const y = useMotionValue(-500)
  const sx = useSpring(x, { stiffness: 150, damping: 20 })
  const sy = useSpring(y, { stiffness: 150, damping: 20 })
  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [x, y])
  return <motion.div className="cursor-glow" style={{ x: sx, y: sy }} />
}

function Magnetic({ children, className = '', to }) {
  const ref = useRef(null)
  const x = useSpring(0, { stiffness: 200, damping: 12 })
  const y = useSpring(0, { stiffness: 200, damping: 12 })
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.35)
    y.set((e.clientY - r.top - r.height / 2) * 0.35)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }
  return (
    <motion.a
      ref={ref}
      href={`#${to}`}
      className={`btn ${className}`}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={(e) => {
        e.preventDefault()
        scrollToId(to)
      }}
      whileTap={{ scale: 0.92 }}
    >
      {children}
    </motion.a>
  )
}

function TiltCard({ icon, title, text, index }) {
  const rx = useSpring(0, { stiffness: 180, damping: 15 })
  const ry = useSpring(0, { stiffness: 180, damping: 15 })
  const [glow, setGlow] = useState({ x: 50, y: 50 })
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry.set((px - 0.5) * 20)
    rx.set((0.5 - py) * 20)
    setGlow({ x: px * 100, y: py * 100 })
  }
  const reset = () => {
    rx.set(0)
    ry.set(0)
  }
  return (
    <motion.article
      className="card"
      custom={index}
      variants={cardIn}
      style={{ rotateX: rx, rotateY: ry, '--gx': `${glow.x}%`, '--gy': `${glow.y}%` }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileHover={{ scale: 1.03 }}
    >
      <motion.span
        className="card-icon"
        whileHover={{ rotate: [0, -15, 15, -10, 0], scale: 1.2 }}
        transition={{ duration: 0.6 }}
      >
        {icon}
      </motion.span>
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.article>
  )
}

function Counter({ value, suffix }) {
  const ref = useRef(null)
  const inView = useInView(ref, { amount: 0.6 })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate: (v) => setN(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, value])
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  )
}

function SplitTitle({ text }) {
  return (
    <span className="split" aria-label={text}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={{ opacity: 0, y: 80, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.3 + i * 0.04, type: 'spring', stiffness: 200, damping: 15 }}
          whileHover={{ y: -12, transition: { duration: 0.2 } }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  )
}

function RotatingWord() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="rotator">
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[i]}
          className="gradient-text"
          initial={{ y: '100%', opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {WORDS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function Particles() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const rootStyle = getComputedStyle(document.documentElement)
    const mouse = { x: -9999, y: -9999 }
    let w, h, raf
    let frame = 0
    let dot = '#22d3ee'
    let line = '#8b5cf6'
    let pts = []
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = canvas.offsetWidth
      h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(90, Math.floor((w * h) / 9000))
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
      }))
    }
    const tick = () => {
      // Цвета берутся из текущей палитры секции.
      if (frame++ % 15 === 0) {
        dot = rootStyle.getPropertyValue('--a2').trim() || dot
        line = rootStyle.getPropertyValue('--a1').trim() || line
      }
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = dot
      for (const p of pts) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < 120 && d > 0) {
          p.vx += (dx / d) * 0.4
          p.vy += (dy / d) * 0.4
        }
        p.vx *= 0.98
        p.vy *= 0.98
        p.x += p.vx + (Math.random() - 0.5) * 0.1
        p.y += p.vy + (Math.random() - 0.5) * 0.1
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        p.x = Math.max(0, Math.min(w, p.x))
        p.y = Math.max(0, Math.min(h, p.y))
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = line
      ctx.lineWidth = 0.6
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]
          const b = pts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 110) {
            ctx.globalAlpha = 1 - d / 110
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    resize()
    tick()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return <canvas ref={ref} className="particles" />
}

/* ---------- Навигация: бургер и меню ---------- */

function Burger({ open, onClick }) {
  const line = { type: 'spring', stiffness: 300, damping: 22 }
  return (
    <button
      className={`burger ${open ? 'burger--open' : ''}`}
      onClick={onClick}
      aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open}
      aria-controls="site-menu"
    >
      <motion.span animate={open ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }} transition={line} />
      <motion.span animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.2 }} />
      <motion.span animate={open ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }} transition={line} />
    </button>
  )
}

const menuList = {
  closed: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
  open: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } },
}

const menuItem = {
  closed: { opacity: 0, y: 50, filter: 'blur(8px)' },
  open: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE } },
}

function Menu({ active, onNavigate }) {
  return (
    <motion.div
      id="site-menu"
      className="menu"
      initial={{ clipPath: 'circle(0% at 96% 4%)' }}
      animate={{ clipPath: 'circle(150% at 96% 4%)', transition: { duration: 0.8, ease: EASE } }}
      exit={{ clipPath: 'circle(0% at 96% 4%)', transition: { duration: 0.6, ease: EASE, delay: 0.15 } }}
    >
      <div className="menu-glow" />
      <motion.ul className="menu-list" variants={menuList} initial="closed" animate="open" exit="closed">
        {SECTIONS.map((s, i) => (
          <motion.li key={s.id} variants={menuItem}>
            <a
              href={`#${s.id}`}
              className={`menu-link ${active === s.id ? 'menu-link--active' : ''}`}
              style={{ '--c1': s.dark['--a1'], '--c2': s.dark['--a2'] }}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(s.id)
              }}
            >
              <span className="menu-num">0{i + 1}</span>
              <span className="menu-text">{s.label}</span>
              <span className="menu-swatch" />
            </a>
          </motion.li>
        ))}
      </motion.ul>
      <motion.p
        className="menu-foot"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.7 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      >
        Pulse · тестовый сайт на React
      </motion.p>
    </motion.div>
  )
}

/* ---------- Светлая и тёмная тема ---------- */

function getInitialMode() {
  const saved = localStorage.getItem('mode')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function useMode() {
  const [mode, setMode] = useState(getInitialMode)
  useEffect(() => localStorage.setItem('mode', mode), [mode])

  // Новая тема раскрывается кругом из точки клика (View Transitions API).
  const toggle = (e) => {
    const next = mode === 'dark' ? 'light' : 'dark'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) {
      setMode(next)
      return
    }
    const x = e.clientX
    const y = e.clientY
    const root = document.documentElement
    root.classList.add('theme-switching')
    const t = document.startViewTransition(() => flushSync(() => setMode(next)))
    t.ready.then(() => {
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    t.finished.finally(() => root.classList.remove('theme-switching'))
  }

  return [mode, toggle]
}

function ThemeToggle({ mode, onToggle }) {
  const dark = mode === 'dark'
  const spring = { type: 'spring', stiffness: 260, damping: 18 }
  return (
    <motion.button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
      whileTap={{ scale: 0.85 }}
    >
      <motion.svg viewBox="0 0 24 24" width="22" height="22" animate={{ rotate: dark ? 40 : 90 }} transition={spring}>
        <mask id="moon-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <motion.circle r="9" fill="black" animate={{ cx: dark ? 17 : 32, cy: dark ? 6 : -6 }} transition={spring} />
        </mask>
        <motion.circle cx="12" cy="12" fill="currentColor" mask="url(#moon-mask)" animate={{ r: dark ? 9 : 5 }} transition={spring} />
        <motion.g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{ opacity: dark ? 0 : 1, scale: dark ? 0.4 : 1 }}
          style={{ originX: '12px', originY: '12px' }}
          transition={spring}
        >
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <line
                key={i}
                x1={12 + Math.cos(a) * 8}
                y1={12 + Math.sin(a) * 8}
                x2={12 + Math.cos(a) * 10.5}
                y2={12 + Math.sin(a) * 10.5}
              />
            )
          })}
        </motion.g>
      </motion.svg>
    </motion.button>
  )
}

function Nav({ active, mode, onToggleMode }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 40)), [scrollY])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const navigate = (id) => {
    setOpen(false)
    // Ждём, пока снимется блокировка прокрутки, затем едем к секции.
    setTimeout(() => scrollToId(id), 350)
  }

  return (
    <>
      <motion.header
        className={`nav ${scrolled && !open ? 'nav--scrolled' : ''}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <a
          href="#top"
          className="logo"
          onClick={(e) => {
            e.preventDefault()
            navigate('top')
          }}
        >
          <motion.span
            className="logo-dot"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          Pulse
        </a>
        <div className="nav-actions">
          <ThemeToggle mode={mode} onToggle={onToggleMode} />
          <Burger open={open} onClick={() => setOpen((v) => !v)} />
        </div>
      </motion.header>
      <AnimatePresence>{open && <Menu active={active} onNavigate={navigate} />}</AnimatePresence>
    </>
  )
}

function SectionDots({ active }) {
  return (
    <nav className="dots" aria-label="Секции">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          className={`dot ${active === s.id ? 'dot--active' : ''}`}
          onClick={() => scrollToId(s.id)}
          aria-label={s.label}
          aria-current={active === s.id}
        >
          <span className="dot-label">{s.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ---------- Секции ---------- */

function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 200])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85])
  return (
    <section className="hero" id="top" data-theme="top" ref={ref}>
      <div className="blob blob--1" />
      <div className="blob blob--2" />
      <div className="blob blob--3" />
      <div className="grid-bg" />
      <motion.div className="hero-inner" style={{ y, opacity, scale }}>
        <motion.span
          className="badge"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
        >
          <span className="badge-dot" /> Тестовый сайт · React + framer-motion
        </motion.span>
        <h1>
          <SplitTitle text="Сайт, в котором" />
          <br />
          всё —&nbsp;<RotatingWord />
        </h1>
        <motion.p
          className="lead"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          Листайте вниз: у каждой секции свои цвета, а блоки появляются по-разному. Меню — справа вверху.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
        >
          <Magnetic to="s0" className="btn--primary">Смотреть эффекты</Magnetic>
          <Magnetic to="s2" className="btn--ghost">Что под капотом</Magnetic>
        </motion.div>
      </motion.div>
      <motion.a
        href="#s0"
        className="scroll-hint"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        aria-label="Листать вниз"
        onClick={(e) => {
          e.preventDefault()
          scrollToId('s0')
        }}
      >
        <span />
      </motion.a>
    </section>
  )
}

function Marquee() {
  const items = ['React', 'Vite', 'framer-motion', 'CSS keyframes', 'Canvas', 'Spring physics', 'Scroll reveal', 'Parallax']
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...items, ...items].map((t, i) => (
          <span key={i}>
            {t} <i>✦</i>
          </span>
        ))}
      </div>
    </div>
  )
}

function Features() {
  return (
    <Section id="s0">
      <Heading kicker="Возможности">Каждый блок живёт своей жизнью</Heading>
      <div className="cards">
        {FEATURES.map((f, i) => (
          <TiltCard key={f.title} index={i} {...f} />
        ))}
      </div>
    </Section>
  )
}

function Stats() {
  return (
    <Section id="s1" className="stats-section">
      <Heading kicker="Цифры">Числа считают сами</Heading>
      <div className="stats">
        {STATS.map((s) => (
          <motion.div key={s.label} className="stat" variants={zoomIn} whileHover={{ y: -6 }}>
            <strong className="gradient-text">
              <Counter value={s.value} suffix={s.suffix} />
            </strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

function Parallax() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y1 = useTransform(scrollYProgress, [0, 1], [150, -150])
  const y2 = useTransform(scrollYProgress, [0, 1], [-100, 100])
  const rotate = useTransform(scrollYProgress, [0, 1], [-30, 30])
  const rotateBack = useTransform(rotate, (r) => -r * 2)
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.7, 1.1, 0.7])
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])
  return (
    <section className="parallax" id="parallax" data-theme="parallax" ref={ref}>
      <motion.div className="shape shape--ring" style={{ y: y1, rotate }} />
      <motion.div className="shape shape--square" style={{ y: y2, rotate: rotateBack }} />
      <motion.div className="shape shape--pill" style={{ y: y1 }} />
      <motion.h2 style={{ scale, opacity }}>
        Листайте — <span className="gradient-text">фигуры двигаются</span> с разной скоростью
      </motion.h2>
    </section>
  )
}

function Tabs() {
  const [active, setActive] = useState(TABS[0].id)
  const tab = TABS.find((t) => t.id === active)
  return (
    <Section id="s2">
      <Heading kicker="Стек">Что под капотом</Heading>
      <motion.div className="tabs" variants={flipIn}>
        <div className="tab-list" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              className={`tab ${active === t.id ? 'tab--active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {active === t.id && (
                <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            className="tab-panel"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <p>{tab.text}</p>
            <pre>
              <code>{tab.code}</code>
            </pre>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Section>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <Section id="s3">
      <Heading kicker="Вопросы">Коротко о главном</Heading>
      <div className="faq">
        {FAQ.map((item, i) => (
          <motion.div
            key={item.q}
            custom={i}
            variants={sideIn}
            className={`faq-item ${open === i ? 'faq-item--open' : ''}`}
          >
            <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              {item.q}
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="faq-icon">
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="faq-a"
                >
                  <p>{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

function Cta() {
  return (
    <section className="cta" id="cta" data-theme="cta">
      <Particles />
      <motion.div
        className="cta-inner"
        initial={{ opacity: 0, scale: 0.8, y: 60 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <h2>
          Поводите мышью <span className="gradient-text">над частицами</span>
        </h2>
        <p>Они разбегаются от курсора и берут цвета этой секции.</p>
        <Magnetic to="top" className="btn--primary">Наверх ↑</Magnetic>
      </motion.div>
    </section>
  )
}

export default function App() {
  const [mode, toggleMode] = useMode()
  const active = useSectionTheme(mode)
  return (
    <>
      <Watch />
      <ScrollProgress />
      <CursorGlow />
      <Nav active={active} mode={mode} onToggleMode={toggleMode} />
      <SectionDots active={active} />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Stats />
        <Parallax />
        <Tabs />
        <Faq />
        <Cta />
      </main>
      <footer className="footer">
        <span>© {YEAR} Pulse · тестовый сайт</span>
        <span>React · Vite · framer-motion</span>
      </footer>
    </>
  )
}
