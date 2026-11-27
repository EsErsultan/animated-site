import { useEffect, useRef, useState } from 'react'
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
import './App.css'

/* ---------- Данные ---------- */

const YEAR = new Date().getFullYear()

const WORDS =['движение', 'эмоции', 'скорость', 'магию']

const FEATURES = [
  { icon: '⚡', title: 'Мгновенно', text: 'Vite собирает проект за доли секунды, а React обновляет только то, что изменилось.' },
  { icon: '🌀', title: 'Плавно', text: 'Пружинная физика framer-motion делает каждое движение естественным.' },
  { icon: '🎯', title: 'Точно', text: 'Анимации запускаются ровно тогда, когда блок появляется на экране.' },
  { icon: '🧲', title: 'Отзывчиво', text: 'Кнопки притягиваются к курсору, карточки наклоняются за мышью.' },
  { icon: '🎨', title: 'Ярко', text: 'Живые градиенты, светящиеся блобы и частицы на canvas.' },
  { icon: '♿', title: 'Бережно', text: 'Если в системе выключена анимация, сайт это уважает.' },
]

const STATS = [
  { value: 60, suffix: ' fps', label: 'плавность анимаций' },
  { value: 12, suffix: '+', label: 'видов эффектов' },
  { value: 100, suffix: '%', label: 'на React' },
  { value: 0, suffix: ' мс', label: 'ожидания' },
]

const TABS = [
  { id: 'react', label: 'React', text: 'Компоненты и хуки: каждый эффект — отдельный переиспользуемый блок.', code: 'const [open, setOpen] = useState(false)' },
  { id: 'motion', label: 'Motion', text: 'framer-motion отвечает за пружины, появление при скролле и общие layout-переходы.', code: '<motion.div whileInView={{ opacity: 1 }} />' },
  { id: 'css', label: 'CSS', text: 'Keyframes для градиентов, блобов и бегущей строки — без единой строчки JS.', code: '@keyframes float { 50% { transform: translateY(-20px) } }' },
  { id: 'canvas', label: 'Canvas', text: 'Частицы рисуются на canvas и разбегаются от курсора.', code: 'ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)' },
]

const FAQ = [
  { q: 'Это настоящий сайт?', a: 'Это тестовый сайт: витрина анимаций на React, HTML, CSS и JavaScript.' },
  { q: 'Какие библиотеки используются?', a: 'React, Vite и framer-motion. Частицы, блобы и бегущая строка написаны вручную.' },
  { q: 'Можно ли выключить анимации?', a: 'Да. Если в настройках системы включено «Уменьшить движение», CSS-анимации отключаются.' },
  { q: 'Где лежит код?', a: 'В репозитории на GitHub, вместе с инструкцией по запуску.' },
]

/* ---------- Общие анимации ---------- */

const reveal = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }

function Section({ id, className = '', children }) {
  return (
    <motion.section
      id={id}
      className={`section ${className}`}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.section>
  )
}

function Heading({ kicker, children }) {
  return (
    <motion.div className="heading" variants={reveal}>
      <span className="kicker">{kicker}</span>
      <h2>{children}</h2>
    </motion.div>
  )
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

function Magnetic({ children, className = '', href }) {
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
      href={href}
      className={`btn ${className}`}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileTap={{ scale: 0.92 }}
    >
      {children}
    </motion.a>
  )
}

function TiltCard({ icon, title, text }) {
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
      variants={reveal}
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
  const inView = useInView(ref, { once: true })
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
          whileHover={{ y: -12, color: '#00d4ff', transition: { duration: 0.2 } }}
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
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
    const mouse = { x: -9999, y: -9999 }
    let w, h, raf
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
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < 120) {
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
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(160, 200, 255, 0.85)'
        ctx.fill()
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]
          const b = pts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 110) {
            ctx.strokeStyle = `rgba(124, 92, 255, ${1 - d / 110})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
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

/* ---------- Секции ---------- */

function Nav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 40)), [scrollY])
  return (
    <motion.header
      className={`nav ${scrolled ? 'nav--scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <a href="#top" className="logo">
        <motion.span
          className="logo-dot"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        Pulse
      </a>
      <nav>
        {['Возможности', 'Цифры', 'Стек', 'Вопросы'].map((t, i) => (
          <motion.a
            key={t}
            href={`#s${i}`}
            className="nav-link"
            whileHover={{ y: -2 }}
          >
            {t}
          </motion.a>
        ))}
      </nav>
    </motion.header>
  )
}

function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 200])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  return (
    <section className="hero" id="top" ref={ref}>
      <div className="blob blob--1" />
      <div className="blob blob--2" />
      <div className="blob blob--3" />
      <div className="grid-bg" />
      <motion.div className="hero-inner" style={{ y, opacity }}>
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
          Двигайте мышью, листайте вниз, наводите на карточки. Здесь анимировано почти всё.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
        >
          <Magnetic href="#s0" className="btn--primary">Смотреть эффекты</Magnetic>
          <Magnetic href="#s2" className="btn--ghost">Что под капотом</Magnetic>
        </motion.div>
      </motion.div>
      <motion.a
        href="#s0"
        className="scroll-hint"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        aria-label="Листать вниз"
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
        {FEATURES.map((f) => (
          <TiltCard key={f.title} {...f} />
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
          <motion.div key={s.label} className="stat" variants={reveal} whileHover={{ y: -6 }}>
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
  return (
    <section className="parallax" ref={ref}>
      <motion.div className="shape shape--ring" style={{ y: y1, rotate }} />
      <motion.div className="shape shape--square" style={{ y: y2, rotate: rotateBack }} />
      <motion.div className="shape shape--pill" style={{ y: y1 }} />
      <motion.h2 style={{ scale }}>
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
      <motion.div className="tabs" variants={reveal}>
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
          <motion.div key={item.q} className={`faq-item ${open === i ? 'faq-item--open' : ''}`} variants={reveal}>
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
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
    <section className="cta">
      <Particles />
      <motion.div
        className="cta-inner"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2>
          Поводите мышью <span className="gradient-text">над частицами</span>
        </h2>
        <p>Они разбегаются от курсора и соединяются линиями.</p>
        <Magnetic href="#top" className="btn--primary">Наверх ↑</Magnetic>
      </motion.div>
    </section>
  )
}

export default function App() {
  return (
    <>
      <ScrollProgress />
      <CursorGlow />
      <Nav />
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
