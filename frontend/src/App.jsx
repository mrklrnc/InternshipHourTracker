import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5045/api'

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('internship_user')
    return saved ? JSON.parse(saved) : null
  })
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [targetHours, setTargetHours] = useState(400)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [summary, setSummary] = useState(null)
  const [logs, setLogs] = useState([])
  const [manualTimeIn, setManualTimeIn] = useState('')
  const [manualTimeOut, setManualTimeOut] = useState('')
  const [deductLunch, setDeductLunch] = useState(true)
  const [liveDeductLunch, setLiveDeductLunch] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchDashboard(user.id)
    }
  }, [user])

  // Auto-check "Deduct 1-hour lunch" when manual entry spans >= 5 hours
  useEffect(() => {
    if (manualTimeIn && manualTimeOut) {
      const hours = (new Date(manualTimeOut) - new Date(manualTimeIn)) / (1000 * 60 * 60)
      setDeductLunch(hours >= 5)
    }
  }, [manualTimeIn, manualTimeOut])

  async function fetchDashboard(userId) {
    try {
      const [sumRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/timelogs/user/${userId}/summary`),
        fetch(`${API_BASE}/timelogs/user/${userId}`)
      ])
      if (sumRes.ok) setSummary(await sumRes.json())
      if (logsRes.ok) setLogs(await logsRes.json())
    } catch {
      setError('Could not connect to backend API. Make sure your C# API is running on http://localhost:5045.')
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register'
      const body = authMode === 'login'
        ? { username, password }
        : { username, password, targetHours: Number(targetHours) || 400 }

      const res = await fetch(`${API_BASE}/users/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Authentication failed')
      } else {
        localStorage.setItem('internship_user', JSON.stringify(data))
        setUser(data)
      }
    } catch {
      setError('Cannot reach backend at ' + API_BASE)
    } finally {
      setLoading(false)
    }
  }

  async function handleTimeIn(sessionLabel) {
    if (!user) return
    setError('')
    try {
      const res = await fetch(
        `${API_BASE}/timelogs/time-in/${user.id}?sessionType=${encodeURIComponent(sessionLabel)}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Action failed')
      } else {
        await fetchDashboard(user.id)
      }
    } catch {
      setError('Failed to reach backend API.')
    }
  }

  async function handleTimeOut(reasonLabel, shouldDeductLunch = false) {
    if (!user) return
    setError('')
    try {
      const res = await fetch(
        `${API_BASE}/timelogs/time-out/${user.id}?deductLunch=${shouldDeductLunch}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Action failed')
      } else {
        setLiveDeductLunch(false)
        await fetchDashboard(user.id)
      }
    } catch {
      setError('Failed to reach backend API.')
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualTimeIn || !manualTimeOut) return
    setError('')
    try {
      const res = await fetch(`${API_BASE}/timelogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          timeIn: new Date(manualTimeIn).toISOString(),
          timeOut: new Date(manualTimeOut).toISOString(),
          deductLunchBreak: deductLunch,
          sessionType: deductLunch ? 'Full Day (-1h Lunch)' : 'Manual Session',
          hoursLogged: 0
        })
      })
      if (res.ok) {
        setManualTimeIn('')
        setManualTimeOut('')
        await fetchDashboard(user.id)
      }
    } catch {
      setError('Failed to save manual entry.')
    }
  }

  async function handleDeleteLog(id) {
    await fetch(`${API_BASE}/timelogs/${id}`, { method: 'DELETE' })
    await fetchDashboard(user.id)
  }

  function handleLogout() {
    localStorage.removeItem('internship_user')
    setUser(null)
    setSummary(null)
    setLogs([])
  }

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="card auth-card">
          <h1>Internship Hours Tracker</h1>
          <p className="subtitle">Track your 400-hour requirement seamlessly</p>

          <div className="tabs">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => { setAuthMode('login'); setError('') }}
            >
              Login
            </button>
            <button
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => { setAuthMode('register'); setError('') }}
            >
              Register
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleAuth}>
            <label>Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
            />

            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
            />

            {authMode === 'register' && (
              <>
                <label>Target Internship Hours</label>
                <input
                  type="number"
                  value={targetHours}
                  onChange={e => setTargetHours(e.target.value)}
                />
              </>
            )}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const pct = summary?.progressPercentage ?? 0
  const isClockedIn = summary?.isCurrentlyClockedIn
  const remainingHrs = summary?.remainingHours ?? user.targetHours
  const remainingDays = summary?.remainingDays ?? Math.round((remainingHrs / 8) * 10) / 10
  const completedDays = summary?.completedDays ?? Math.round(((summary?.totalHoursLogged ?? 0) / 8) * 10) / 10

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>Internship Hours Tracker</h1>
          <span className="user-badge">Logged in as <strong>{user.username}</strong></span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid">
        <div className="card progress-card">
          <h2>Overall Progress</h2>
          <div className="stats-row">
            <div className="stat">
              <span className="stat-value">{summary?.totalHoursLogged ?? 0}h</span>
              <span className="stat-label">Completed ({completedDays}d)</span>
            </div>
            <div className="stat">
              <span className="stat-value">{remainingHrs}h</span>
              <span className="stat-label">Remaining</span>
            </div>
            <div className="stat">
              <span className="stat-value highlight-days">{remainingDays}d</span>
              <span className="stat-label">Days Left (8h/day)</span>
            </div>
            <div className="stat">
              <span className="stat-value">{summary?.targetHours ?? user.targetHours}h</span>
              <span className="stat-label">Goal ({Math.round((summary?.targetHours ?? user.targetHours) / 8)}d)</span>
            </div>
          </div>

          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="progress-caption">{pct}% of your internship requirement completed</p>
        </div>

        <div className="card clock-card">
          <h2>Live Time Clock</h2>
          <p className="status-text">
            Status:{' '}
            <span className={isClockedIn ? 'badge-active' : 'badge-idle'}>
              {isClockedIn
                ? `Clocked In (${summary?.activeTimeLog?.sessionType || 'Active'})`
                : 'Clocked Out (Off Duty / On Lunch)'}
            </span>
          </p>
          {summary?.activeTimeLog && (
            <p className="active-since">
              Started at: {new Date(summary.activeTimeLog.timeIn).toLocaleString()}
            </p>
          )}

          {!isClockedIn ? (
            <div className="button-group">
              <button
                onClick={() => handleTimeIn('Morning (AM)')}
                className="clock-btn timein"
              >
                Morning Time In
              </button>
              <button
                onClick={() => handleTimeIn('Afternoon (PM)')}
                className="clock-btn afternoon-in"
              >
                Back from Lunch (PM Time In)
              </button>
            </div>
          ) : (
            <div className="button-group">
              <button
                onClick={() => handleTimeOut('Lunch Out', false)}
                className="clock-btn lunch-out"
              >
                Time Out for Lunch (1 hr unpaid)
              </button>
              <button
                onClick={() => handleTimeOut('End of Day', liveDeductLunch)}
                className="clock-btn timeout"
              >
                End of Day Time Out
              </button>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={liveDeductLunch}
                  onChange={e => setLiveDeductLunch(e.target.checked)}
                />
                <span>Forgot to clock out at lunch? Deduct 1h now</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="card manual-card">
        <h3>Add Past Session Manually</h3>
        <form className="manual-form" onSubmit={handleManualSubmit}>
          <div>
            <label>Time In</label>
            <input
              type="datetime-local"
              required
              value={manualTimeIn}
              onChange={e => setManualTimeIn(e.target.value)}
            />
          </div>
          <div>
            <label>Time Out</label>
            <input
              type="datetime-local"
              required
              value={manualTimeOut}
              onChange={e => setManualTimeOut(e.target.value)}
            />
          </div>
          <button type="submit" className="primary-btn">Add Log</button>
        </form>
        <label className="checkbox-row" style={{ marginTop: '0.85rem' }}>
          <input
            type="checkbox"
            checked={deductLunch}
            onChange={e => setDeductLunch(e.target.checked)}
          />
          <span>Deduct 1-hour unpaid lunch break from this session</span>
        </label>
      </div>

      <div className="card table-card">
        <h3>Time Log History ({logs.length} sessions)</h3>
        {logs.length === 0 ? (
          <p className="empty-state">No time logs recorded yet. Click "Morning Time In" or add a session above!</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Hours Logged</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.timeIn).toLocaleDateString()}</td>
                    <td>
                      <span className="session-pill">
                        {log.sessionType || (log.deductLunchBreak ? 'Full Day (-1h Lunch)' : 'Session')}
                      </span>
                    </td>
                    <td>{new Date(log.timeIn).toLocaleTimeString()}</td>
                    <td>{log.timeOut ? new Date(log.timeOut).toLocaleTimeString() : <em>In progress...</em>}</td>
                    <td>
                      <strong>{log.hoursLogged} hrs</strong>
                      {log.deductLunchBreak && <span className="lunch-note"> (-1h lunch)</span>}
                    </td>
                    <td>
                      <button className="delete-btn" onClick={() => handleDeleteLog(log.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
