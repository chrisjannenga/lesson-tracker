import { useEffect, useRef, useState } from 'react'
import './App.css'

// ---- Edit these two lines any time the month or dates change ----
const START_DATE = new Date(2026, 8, 24) // Sept 24, 2026
const END_DATE = new Date(2026, 8, 30) // Sept 30, 2026
// -------------------------------------------------------------------

const DAY_MS = 86400000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfDay(d) {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function dateKey(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

function allDates() {
  const out = []
  let cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    out.push(new Date(cur))
    cur = new Date(cur.getTime() + DAY_MS)
  }
  return out
}

function daysLeftFrom(today) {
  const t = startOfDay(today)
  const e = startOfDay(END_DATE)
  if (t > e) return 0
  return Math.floor((e - t) / DAY_MS) + 1
}

function loadState(key, defaults) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

function saveState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // storage unavailable - fail quietly, the app still works for the session
  }
}

function sumLog(log) {
  return Object.values(log).reduce((a, b) => a + (b || 0), 0)
}

function useSubjectState(id, defaultRemaining, today) {
  const storeKey = `ixlTracker_${id}_v1`
  const initial = loadState(storeKey, {
    remaining: defaultRemaining,
    log: {},
    dailyGoal: null,
    lastSyncedLogTotal: 0,
  })

  // First-ever load: seed a goal from today's real days-left.
  if (initial.dailyGoal === null || initial.dailyGoal === undefined) {
    const dLeft = daysLeftFrom(today)
    initial.dailyGoal = dLeft > 0 ? Math.ceil(initial.remaining / dLeft) : 0
    initial.lastSyncedLogTotal = sumLog(initial.log)
  }

  const [remaining, setRemainingRaw] = useState(initial.remaining)
  const [log, setLog] = useState(initial.log)
  const [dailyGoal, setDailyGoal] = useState(initial.dailyGoal)
  const [lastSyncedLogTotal, setLastSyncedLogTotal] = useState(initial.lastSyncedLogTotal)

  useEffect(() => {
    saveState(storeKey, { remaining, log, dailyGoal, lastSyncedLogTotal })
  }, [remaining, log, dailyGoal, lastSyncedLogTotal, storeKey])

  // A manual retype of "remaining" is a fresh resync from the real IXL
  // count: recompute the goal immediately and don't let log history
  // double-count against this fresh number later.
  function setRemaining(value) {
    const v = Math.max(0, value || 0)
    const dLeft = daysLeftFrom(today)
    setRemainingRaw(v)
    setDailyGoal(dLeft > 0 ? Math.ceil(v / dLeft) : 0)
    setLastSyncedLogTotal(sumLog(log))
  }

  function setCount(key, value) {
    const v = Math.max(0, value || 0)
    setLog((prev) => {
      const next = { ...prev }
      if (v === 0) delete next[key]
      else next[key] = v
      return next
    })
  }

  function resetLog() {
    setLog({})
    setLastSyncedLogTotal(0)
  }

  function recount() {
    const loggedTotal = sumLog(log)
    const increment = loggedTotal - lastSyncedLogTotal
    const newRemaining = Math.max(0, remaining - increment)
    const dLeft = daysLeftFrom(today)
    setRemainingRaw(newRemaining)
    setDailyGoal(dLeft > 0 ? Math.ceil(newRemaining / dLeft) : 0)
    setLastSyncedLogTotal(loggedTotal)
  }

  return { remaining, setRemaining, log, setCount, resetLog, dailyGoal, recount }
}

function SubjectPanel({ id, name, caption, defaultRemaining, today, dLeft, onRemainingChange, onGoalChange }) {
  const { remaining, setRemaining, log, setCount, resetLog, dailyGoal, recount } = useSubjectState(
    id,
    defaultRemaining,
    today
  )
  const [confirmingKey, setConfirmingKey] = useState(null)
  const confirmTimeout = useRef(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    onRemainingChange(id, remaining)
    onGoalChange(id, dailyGoal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, dailyGoal])

  useEffect(() => {
    return () => {
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current)
    }
  }, [])

  const target = dailyGoal || 0
  const startingTotal = Math.max(remaining, defaultRemaining)
  const pct =
    startingTotal > 0 ? Math.max(0, Math.min(100, 100 - (remaining / startingTotal) * 100)) : 100

  function handleRecount() {
    recount()
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  function armConfirm(key) {
    setConfirmingKey(key)
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current)
    confirmTimeout.current = setTimeout(() => setConfirmingKey(null), 2500)
  }

  function handleMinusClick(key) {
    const current = log[key] || 0
    if (current <= 0) return
    if (confirmingKey === key) {
      setCount(key, current - 1)
      setConfirmingKey(null)
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current)
    } else {
      armConfirm(key)
    }
  }

  function handlePlusClick(key) {
    setCount(key, (log[key] || 0) + 1)
    if (confirmingKey === key) setConfirmingKey(null)
  }

  return (
    <section className="panel" data-subject={id}>
      <div className="panel-header">
        <div>
          <p className="subject-name">{name}</p>
          <p className="subject-caption">{caption}</p>
        </div>
        <button
          type="button"
          className={'recount-btn' + (flash ? ' flash' : '')}
          onClick={handleRecount}
          title="Recalculate today's and future days' goal from the current total and what's been logged"
        >
          Recount
        </button>
      </div>

      <div className="stat-row">
        <div className="stat big">
          <span className="remaining-edit">
            <input
              type="number"
              min="0"
              value={remaining}
              onChange={(e) => setRemaining(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </span>
          <span className="lbl">lessons remaining</span>
        </div>
        <div className="stat">
          <span className="num">{dLeft}</span>
          <span className="lbl">days left</span>
        </div>
        <div className="stat">
          <span className="num">{remaining === 0 ? 'done' : dLeft === 0 ? '—' : target}</span>
          <span className="lbl">per day to finish</span>
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>

      <p className="log-title">
        <span>Daily log</span>
        <button className="reset-link" onClick={resetLog}>
          reset log
        </button>
      </p>
      <p className="tap-hint">Tap + each time she finishes a lesson. Tap − twice to remove one.</p>

      <table className="log">
        <tbody>
          {allDates().map((d) => {
            const key = dateKey(d)
            const isToday = key === dateKey(today)
            const isPast = startOfDay(d) < today
            const val = log[key]
            const isConfirming = confirmingKey === key

            let statusText = ''
            let statusClass = 'day-status'
            if (val === undefined) {
              statusText = isPast ? 'no entry' : isToday ? `goal ${target}` : ''
            } else if (target > 0 && val >= target) {
              statusText = 'goal met'
              statusClass += ' met'
            } else {
              statusText = `goal ${target}`
            }

            return (
              <tr key={key} className={isToday ? 'is-today' : ''}>
                <td className="day-label">
                  <span className="dow">{DOW[d.getDay()]}</span>
                  {d.getDate()}
                </td>
                <td className="day-input">
                  <div className="stepper">
                    <button
                      type="button"
                      className={'step-btn minus' + (isConfirming ? ' confirming' : '')}
                      aria-label={`Remove one lesson from ${key}`}
                      onClick={() => handleMinusClick(key)}
                    >
                      {isConfirming ? 'sure?' : '\u2212'}
                    </button>
                    <span className="count-display">{val || 0}</span>
                    <button
                      type="button"
                      className={isToday ? 'step-btn plus today' : 'step-btn plus'}
                      aria-label={`Add one lesson to ${key}`}
                      onClick={() => handlePlusClick(key)}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className={statusClass}>{statusText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="panel-footer">
        {remaining === 0 ? (
          <>
            <strong>All lessons done.</strong> Nice work.
          </>
        ) : dLeft === 0 ? (
          <>
            The month is over with <strong>{remaining}</strong> lessons still remaining.
          </>
        ) : (
          <>
            <strong>{remaining}</strong> lessons ÷ <strong>{dLeft}</strong> days left ={' '}
            <strong>{target}/day</strong> to finish by {END_DATE.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
          </>
        )}
      </div>
    </section>
  )
}

export default function App() {
  const today = startOfDay(new Date())
  const dLeft = daysLeftFrom(today)
  const [remainings, setRemainings] = useState({ math: 69, la: 58 })
  const [goals, setGoals] = useState({ math: 0, la: 0 })

  function handleRemainingChange(id, val) {
    setRemainings((prev) => ({ ...prev, [id]: val }))
  }

  function handleGoalChange(id, val) {
    setGoals((prev) => ({ ...prev, [id]: val }))
  }

  const total = remainings.math + remainings.la
  const combinedTarget = goals.math + goals.la

  return (
    <div className="wrap">
      <header className="page">
        <p className="eyebrow">
          {START_DATE.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &ndash;{' '}
          {END_DATE.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <h1>Lesson tracker</h1>
        <p className="sub">
          Unique lessons remaining in each skill plan, and how many need to happen each day to
          finish by the end of the month.
        </p>
      </header>

      <div className="grid">
        <SubjectPanel
          id="math"
          name="Math"
          caption="Arizona Grade 3 · IXL skill plan"
          defaultRemaining={69}
          today={today}
          dLeft={dLeft}
          onRemainingChange={handleRemainingChange}
          onGoalChange={handleGoalChange}
        />
        <SubjectPanel
          id="la"
          name="Language Arts"
          caption="Arizona Grade 3 · IXL skill plan"
          defaultRemaining={58}
          today={today}
          dLeft={dLeft}
          onRemainingChange={handleRemainingChange}
          onGoalChange={handleGoalChange}
        />
      </div>

      <p className="combined">
        {total === 0 ? (
          <>
            Both subjects are <strong>fully caught up</strong>.
          </>
        ) : dLeft === 0 ? (
          <>
            <strong>{total}</strong> lessons remained when the month ended.
          </>
        ) : (
          <>
            Combined: <strong>{total}</strong> lessons left · <strong>{dLeft}</strong> days left ·{' '}
            <strong>{combinedTarget}/day</strong> across both subjects.
          </>
        )}
      </p>

      <p className="footer-note">
        &ldquo;Lessons remaining&rdquo; is the number to update whenever you re-check the actual
        IXL skill plan. The per-day goal is frozen once set &mdash; it only changes when you edit
        &ldquo;lessons remaining&rdquo; directly, or tap <strong>Recount</strong>, which pulls in
        everything logged since the last recount, subtracts it from the total, and splits
        whatever&rsquo;s left evenly across today and the days still remaining. So if a day or two
        falls short of goal, recounting raises the pace for what&rsquo;s left instead of leaving
        today&rsquo;s goal too low to actually finish on time.
      </p>
    </div>
  )
}
