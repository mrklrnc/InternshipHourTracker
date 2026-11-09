import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5045/api'

function getEstimatedCompletionShort(remainingDays) {
  const daysToAdd = Math.ceil(remainingDays || 0)
  if (daysToAdd <= 0) return 'Done!'
  const date = new Date()
  let added = 0
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) {
      added++
    }
  }
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const yr = String(date.getFullYear()).slice(-2)
  return `${month} '${yr}`
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('internship_user')
    return saved ? JSON.parse(saved) : null
  })

  // Active Navigation Tab: 'dashboard' | 'profile' | 'settings'
  const [activeNav, setActiveNav] = useState('dashboard')

  // Auth State: 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password'
  const [authMode, setAuthMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [targetHours, setTargetHours] = useState(400)
  const [regWorkStart, setRegWorkStart] = useState('08:00')
  const [regWorkEnd, setRegWorkEnd] = useState('17:00')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Dashboard & Logs State
  const [summary, setSummary] = useState(null)
  const [logs, setLogs] = useState([])
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const LOGS_PER_PAGE = 10

  // Session Type Selector: 'full' | 'half-am' | 'half-pm'
  const [sessionMode, setSessionMode] = useState('full')

  const [showManualForm, setShowManualForm] = useState(false)
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualStartTime, setManualStartTime] = useState('08:00')
  const [manualEndTime, setManualEndTime] = useState('17:00')
  const [manualSessionMode, setManualSessionMode] = useState('full')
  const [deductLunch, setDeductLunch] = useState(true)
  const [liveDeductLunch, setLiveDeductLunch] = useState(false)

  // Edit Log State
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogDate, setEditLogDate] = useState('')
  const [editLogStartTime, setEditLogStartTime] = useState('')
  const [editLogEndTime, setEditLogEndTime] = useState('')
  const [editLogDeductLunch, setEditLogDeductLunch] = useState(false)
  const [editLogSessionType, setEditLogSessionType] = useState('')

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTargetHours, setEditTargetHours] = useState(400)
  const [editWorkStart, setEditWorkStart] = useState('08:00')
  const [editWorkEnd, setEditWorkEnd] = useState('17:00')

  // Settings State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('internship_dark_mode')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('internship_dark_mode', JSON.stringify(darkMode))
    document.body.classList.toggle('light-theme', !darkMode)
  }, [darkMode])

  useEffect(() => {
    if (user?.id) {
      fetchDashboard(user.id)
      setEditFullName(user.fullName || user.username || '')
      setEditEmail(user.email || `${user.username.toLowerCase().replace(/\s+/g, '')}@university.edu`)
      setEditTargetHours(user.targetHours || 400)
      setEditWorkStart(user.workStartTime || '08:00')
      setEditWorkEnd(user.workEndTime || '17:00')
      setManualStartTime(user.workStartTime || '08:00')
      setManualEndTime(user.workEndTime || '17:00')
    }
  }, [user])

  useEffect(() => {
    const startDefault = user?.workStartTime || '08:00'
    const endDefault = user?.workEndTime || '17:00'
    if (manualSessionMode === 'full') {
      setDeductLunch(true)
      setManualStartTime(startDefault)
      setManualEndTime(endDefault)
    } else if (manualSessionMode === 'half-am') {
      setDeductLunch(false)
      setManualStartTime(startDefault)
      setManualEndTime('12:00')
    } else if (manualSessionMode === 'half-pm') {
      setDeductLunch(false)
      setManualStartTime('13:00')
      setManualEndTime(endDefault)
    }
  }, [manualSessionMode, user?.workStartTime, user?.workEndTime])

  function getAuthHeaders(extra = {}) {
    return user?.token
      ? { ...extra, Authorization: `Bearer ${user.token}` }
      : extra
  }

  async function fetchDashboard(userId) {
    try {
      const headers = getAuthHeaders()
      const [sumRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/timelogs/user/${userId}/summary`, { headers }),
        fetch(`${API_BASE}/timelogs/user/${userId}`, { headers })
      ])
      if (sumRes.ok) setSummary(await sumRes.json())
      if (logsRes.ok) {
        const fetchedLogs = await logsRes.json()
        setLogs(fetchedLogs)
      }
    } catch {
      setError('Could not connect to backend API. Make sure your C# API is running.')
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (authMode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match. Please check your confirm password.')
      return
    }

    setLoading(true)
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register'
      const body = authMode === 'login'
        ? { username, password }
        : {
            username,
            fullName: fullName.trim() || username,
            email,
            password,
            targetHours: Number(targetHours) || 400,
            workStartTime: regWorkStart || '08:00',
            workEndTime: regWorkEnd || '17:00'
          }

      const res = await fetch(`${API_BASE}/users/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.requiresVerification) {
          setEmail(data.email || username)
          setAuthMode('verify-email')
          setError(data.message || 'Please verify your email first.')
        } else {
          setError(data.message || 'Authentication failed')
        }
      } else if (data.requiresVerification) {
        setEmail(data.email || email)
        setOtpCode('')
        setAuthMode('verify-email')
        setSuccessMsg(data.message || `Verification code sent to ${data.email || email}`)
      } else {
        const enrichedUser = {
          ...data,
          email: data.email || email || `${data.username.toLowerCase()}@university.edu`,
          fullName: data.fullName || fullName.trim() || data.username
        }
        setLoading(false)
        setIsSuccess(true)
        setTimeout(() => {
          localStorage.setItem('internship_user', JSON.stringify(enrichedUser))
          setUser(enrichedUser)
          setIsSuccess(false)
          setActiveNav('dashboard')
        }, 800)
        return
      }
    } catch {
      setError('Cannot reach backend at ' + API_BASE)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyEmail(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/users/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || username, code: otpCode })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Invalid verification code.')
      } else {
        setLoading(false)
        setIsSuccess(true)
        setTimeout(() => {
          localStorage.setItem('internship_user', JSON.stringify(data))
          setUser(data)
          setIsSuccess(false)
          setActiveNav('dashboard')
        }, 800)
        return
      }
    } catch {
      setError('Failed to verify code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/users/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || username })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Could not resend verification email.')
      } else {
        setSuccessMsg(data.message || 'A new verification code has been sent!')
      }
    } catch {
      setError('Failed to reach backend API.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPasswordRequest(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email || username })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Could not send reset code.')
      } else {
        setEmail(data.email || email)
        setOtpCode('')
        setAuthMode('reset-password')
        setSuccessMsg(data.message || 'Reset code sent to your email!')
      }
    } catch {
      setError('Failed to reach backend API.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    if (resetNewPassword !== resetConfirmPassword) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: email || username,
          code: otpCode,
          newPassword: resetNewPassword
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to reset password.')
      } else {
        setAuthMode('login')
        setPassword('')
        setOtpCode('')
        setSuccessMsg(data.message || 'Password reset! You can now sign in.')
      }
    } catch {
      setError('Failed to reach backend API.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    const updated = {
      ...user,
      fullName: editFullName,
      email: editEmail,
      targetHours: Number(editTargetHours) || 400,
      workStartTime: editWorkStart || '08:00',
      workEndTime: editWorkEnd || '17:00'
    }
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      if (res.ok) {
        localStorage.setItem('internship_user', JSON.stringify(updated))
        setUser(updated)
        setIsEditingProfile(false)
        setSuccessMsg('Profile updated successfully!')
        await fetchDashboard(user.id)
      }
    } catch {
      // Save locally even if backend model hasn't redeployed yet
      localStorage.setItem('internship_user', JSON.stringify(updated))
      setUser(updated)
      setIsEditingProfile(false)
      setSuccessMsg('Profile saved!')
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!currentPassword || !newPassword) {
      setError('Please fill in both your current and new password.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and Confirm new password do not match.')
      return
    }
    if (user.password && currentPassword !== user.password) {
      setError('Current password is incorrect.')
      return
    }

    try {
      const updatedUser = { ...user, password: newPassword }
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      })
      if (res.ok) {
        localStorage.setItem('internship_user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setSuccessMsg('Password updated successfully!')
      } else {
        setError('Could not update password.')
      }
    } catch {
      setError('Failed to reach backend API.')
    }
  }

  async function handleTimeIn(sessionLabel) {
    if (!user) return
    setError('')
    try {
      const res = await fetch(
        `${API_BASE}/timelogs/time-in/${user.id}?sessionType=${encodeURIComponent(sessionLabel)}`,
        { method: 'POST', headers: getAuthHeaders() }
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

  async function handleTimeOut(shouldDeductLunch = false) {
    if (!user) return
    setError('')
    const tzOffset = new Date().getTimezoneOffset()
    try {
      const res = await fetch(
        `${API_BASE}/timelogs/time-out/${user.id}?deductLunch=${shouldDeductLunch}&tzOffsetMinutes=${tzOffset}`,
        { method: 'POST', headers: getAuthHeaders() }
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
    if (!manualDate || !manualStartTime || !manualEndTime) return
    setError('')
    const labelMap = {
      'full': 'Full Day (-1h Lunch)',
      'half-am': 'Half Day (AM - No Lunch)',
      'half-pm': 'Half Day (PM - No Lunch)'
    }
    const timeInIso = new Date(`${manualDate}T${manualStartTime}`).toISOString()
    const timeOutIso = new Date(`${manualDate}T${manualEndTime}`).toISOString()
    const tzOffset = new Date().getTimezoneOffset()

    try {
      const res = await fetch(`${API_BASE}/timelogs?tzOffsetMinutes=${tzOffset}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: user.id,
          timeIn: timeInIso,
          timeOut: timeOutIso,
          deductLunchBreak: deductLunch,
          sessionType: labelMap[manualSessionMode] || 'Session',
          hoursLogged: 0
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowManualForm(false)
        await fetchDashboard(user.id)
      } else {
        setError(data.message || 'Invalid session timestamps.')
      }
    } catch {
      setError('Failed to save manual entry.')
    }
  }

  async function handleDeleteLog(id) {
    await fetch(`${API_BASE}/timelogs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    await fetchDashboard(user.id)
  }

  function startEditLog(log) {
    const inDate = new Date(log.timeIn)
    const pad = n => String(n).padStart(2, '0')
    const localDateStr = `${inDate.getFullYear()}-${pad(inDate.getMonth() + 1)}-${pad(inDate.getDate())}`
    const localStartStr = `${pad(inDate.getHours())}:${pad(inDate.getMinutes())}`

    let localEndStr = user.workEndTime || '17:00'
    if (log.timeOut) {
      const outDate = new Date(log.timeOut)
      localEndStr = `${pad(outDate.getHours())}:${pad(outDate.getMinutes())}`
    }

    setEditingLogId(log.id)
    setEditLogDate(localDateStr)
    setEditLogStartTime(localStartStr)
    setEditLogEndTime(localEndStr)
    setEditLogDeductLunch(Boolean(log.deductLunchBreak))
    setEditLogSessionType(log.sessionType || (log.deductLunchBreak ? 'Full Day (-1h Lunch)' : 'Half Day (AM - No Lunch)'))
  }

  async function handleUpdateLogSubmit(e, log) {
    e.preventDefault()
    setError('')
    const timeInIso = new Date(`${editLogDate}T${editLogStartTime}`).toISOString()
    const timeOutIso = new Date(`${editLogDate}T${editLogEndTime}`).toISOString()
    const tzOffset = new Date().getTimezoneOffset()

    try {
      const res = await fetch(`${API_BASE}/timelogs/${log.id}?tzOffsetMinutes=${tzOffset}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: log.id,
          userId: user.id,
          timeIn: timeInIso,
          timeOut: timeOutIso,
          deductLunchBreak: editLogDeductLunch,
          sessionType: editLogSessionType,
          hoursLogged: log.hoursLogged
        })
      })
      if (res.ok) {
        setEditingLogId(null)
        await fetchDashboard(user.id)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Failed to update time log.')
      }
    } catch {
      setError('Failed to reach backend API.')
    }
  }

  function handleExportPDF() {
    const totalHrs = summary?.totalHoursLogged ?? 0
    const goalHrs = summary?.targetHours ?? user.targetHours ?? 400
    const remainingHrs = summary?.remainingHours ?? Math.max(0, goalHrs - totalHrs)
    const completedDays = summary?.completedDays ?? Math.round((totalHrs / 8) * 10) / 10
    const remainingDays = summary?.remainingDays ?? Math.round((remainingHrs / 8) * 10) / 10

    const sortedLogs = [...logs].sort((a, b) => new Date(a.timeIn) - new Date(b.timeIn))

    const rowsHtml = sortedLogs.map((log, index) => {
      const dateStr = formatDateShort(log.timeIn)
      const timeInStr = new Date(log.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const timeOutStr = log.timeOut
        ? new Date(log.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'In Progress'
      const sessionStr = log.sessionType || (log.deductLunchBreak ? 'Full Day (-1h Lunch)' : 'Half Day (No Lunch)')
      const lunchStr = log.deductLunchBreak ? '1.0 hr deducted' : 'None'
      const hrs = Number(log.hoursLogged || 0).toFixed(2)

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${dateStr}</td>
          <td>${sessionStr}</td>
          <td>${timeInStr}</td>
          <td>${timeOutStr}</td>
          <td>${lunchStr}</td>
          <td style="font-weight:700; text-align:right;">${hrs} hrs</td>
        </tr>
      `
    }).join('')

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Please allow pop-ups in your browser to export the PDF report.')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Internship Time Log Report - ${user.fullName || user.username}</title>
        <style>
          * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; }
          body { padding: 36px 44px; margin: 0; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0 0 6px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 2px 0; font-size: 13px; color: #475569; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 26px; }
          .summary-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #f8fafc; }
          .summary-box .val { font-size: 20px; font-weight: 700; color: #1d4ed8; }
          .summary-box .lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 36px; font-size: 13px; }
          th { background: #1e293b !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: left; padding: 10px 12px; font-weight: 600; }
          td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .total-row td { background: #eff6ff !important; font-weight: 700; border-top: 2px solid #1e293b; font-size: 14px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 56px; page-break-inside: avoid; }
          .sig-line { border-top: 1px solid #334155; padding-top: 8px; text-align: center; font-size: 13px; color: #334155; }
          @media print {
            body { padding: 15px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>INTERNSHIP DAILY TIME RECORD (DTR) REPORT</h1>
            <p><strong>Intern Name:</strong> ${user.fullName || user.username}</p>
            <p><strong>Email:</strong> ${user.email || `${user.username.toLowerCase()}@university.edu`}</p>
            <p><strong>Required Hours:</strong> ${goalHrs} Hours (${Math.round(goalHrs / 8)} Days @ 8h/day)</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p><strong>Total Sessions:</strong> ${logs.length}</p>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <div class="val">${totalHrs} hrs</div>
            <div class="lbl">Completed (${completedDays} days)</div>
          </div>
          <div class="summary-box">
            <div class="val">${remainingHrs} hrs</div>
            <div class="lbl">Remaining</div>
          </div>
          <div class="summary-box">
            <div class="val">${remainingDays} days</div>
            <div class="lbl">Days Left (8h/day)</div>
          </div>
          <div class="summary-box">
            <div class="val">${goalHrs} hrs</div>
            <div class="lbl">Target Requirement</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Session Type</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Lunch Break</th>
              <th style="text-align:right;">Hours Logged</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">No sessions recorded yet.</td></tr>'}
            <tr class="total-row">
              <td colspan="6" style="text-align:right;">TOTAL RENDERED INTERNSHIP HOURS:</td>
              <td style="text-align:right;">${Number(totalHrs).toFixed(2)} hrs</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">
            <strong>${user.fullName || user.username}</strong><br/>
            Intern Signature Over Printed Name
          </div>
          <div class="sig-line">
            <strong>Supervisor / Coordinator</strong><br/>
            Authorized Signature & Date
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  function handleLogout() {
    localStorage.removeItem('internship_user')
    setUser(null)
    setSummary(null)
    setLogs([])
  }

  // ==========================================
  // 1. SIGN IN / REGISTER VIEW
  // ==========================================
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className={`auth-card-transition ${isSuccess ? 'exit-success' : ''}`}>
          <div className="card auth-card">
          <h1>Internship Hours Tracker</h1>
          <p className="subtitle">Track your 400-hour requirement seamlessly</p>

          {(authMode === 'login' || authMode === 'register') && (
            <div className="tabs">
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg('') }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5" />
                  <path d="m21 2-9.6 9.6" />
                  <path d="m15.5 7.5 3 3L22 7l-3-3" />
                </svg>
                <span>Login</span>
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg('') }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
                <span>Register</span>
              </button>
            </div>
          )}

          {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
          {successMsg && <div className="success-banner" style={{ marginBottom: '1rem' }}>{successMsg}</div>}

          {/* EMAIL VERIFICATION SCREEN */}
          {authMode === 'verify-email' && (
            <form onSubmit={handleVerifyEmail}>
              <p className="subtitle" style={{ marginBottom: '0.75rem' }}>
                Enter the 6-digit verification code sent to <strong>{email || username}</strong>.
                <br />
                <span style={{ fontSize: '0.82rem', color: '#fbbf24' }}>
                  Tip: Don't see it in your inbox? Please check your <strong>Spam</strong> or <strong>Promotions</strong> folder.
                </span>
              </p>
              <label>6-Digit Verification Code</label>
              <div className="input-with-icon">
                <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="e.g. 482910"
                  style={{ letterSpacing: '4px', fontWeight: 700 }}
                />
              </div>

              <button
                type="submit"
                className={`signin-btn ${loading ? 'btn-loading' : ''} ${isSuccess ? 'btn-success' : ''}`}
                disabled={loading || isSuccess}
              >
                {loading && (
                  <>
                    <svg className="spin-loader" width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                )}
                {!loading && isSuccess && (
                  <>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Success!</span>
                  </>
                )}
                {!loading && !isSuccess && <span>Verify Email & Sign In</span>}
              </button>

              <div className="forgot-link-wrap" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button type="button" className="forgot-link" onClick={handleResendVerification} disabled={loading}>
                  Resend Code
                </button>
                <button type="button" className="forgot-link" onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg('') }}>
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD REQUEST SCREEN */}
          {authMode === 'forgot-password' && (
            <form onSubmit={handleForgotPasswordRequest}>
              <p className="subtitle" style={{ marginBottom: '0.75rem' }}>
                Enter your registered email address or username and we will send you a 6-digit password reset code.
              </p>
              <label>Email Address or Username</label>
              <div className="input-with-icon">
                <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                />
              </div>

              <button type="submit" className="signin-btn" disabled={loading}>
                <span>{loading ? 'Sending Code...' : 'Send Reset Code'}</span>
              </button>

              <div className="forgot-link-wrap">
                <button type="button" className="forgot-link" onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg('') }}>
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD WITH 6-DIGIT CODE SCREEN */}
          {authMode === 'reset-password' && (
            <form onSubmit={handleResetPasswordSubmit}>
              <p className="subtitle" style={{ marginBottom: '0.75rem' }}>
                Enter the 6-digit code sent to <strong>{email}</strong> and choose a new password.
                <br />
                <span style={{ fontSize: '0.82rem', color: '#fbbf24' }}>
                  Tip: Don't see it in your inbox? Please check your <strong>Spam</strong> or <strong>Promotions</strong> folder.
                </span>
              </p>
              <label>6-Digit Reset Code</label>
              <div className="input-with-icon">
                <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  style={{ letterSpacing: '4px', fontWeight: 700 }}
                />
              </div>

              <label>New Password</label>
              <div className="input-with-icon">
                <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>

              <label>Confirm New Password</label>
              <div className="input-with-icon">
                <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type="password"
                  required
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <button type="submit" className="signin-btn" disabled={loading}>
                <span>{loading ? 'Resetting...' : 'Reset Password'}</span>
              </button>

              <div className="forgot-link-wrap">
                <button type="button" className="forgot-link" onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg('') }}>
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {(authMode === 'login' || authMode === 'register') && (
            <form onSubmit={handleAuth}>
            {authMode === 'register' && (
              <>
                <label>Full Name</label>
                <div className="input-with-icon">
                  <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>
              </>
            )}

            <label>Username</label>
            <div className="input-with-icon">
              <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            {authMode === 'register' && (
              <>
                <label>Email Address</label>
                <div className="input-with-icon">
                  <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                  />
                </div>
              </>
            )}

            <label>Password</label>
            <div className="input-with-icon">
              <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                )}
              </button>
            </div>

            {authMode === 'register' && (
              <>
                <label>Confirm Password</label>
                <div className="input-with-icon">
                  <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    className="eye-toggle"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    )}
                  </button>
                </div>

                <label>Target Internship Hours</label>
                <div className="input-with-icon">
                  <svg className="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <input
                    type="number"
                    value={targetHours}
                    onChange={e => setTargetHours(e.target.value)}
                  />
                </div>

                <div className="manual-form" style={{ marginTop: '0.4rem' }}>
                  <div>
                    <label>Company Start Time</label>
                    <input
                      type="time"
                      required
                      value={regWorkStart}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                      onChange={e => setRegWorkStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Company End Time</label>
                    <input
                      type="time"
                      required
                      value={regWorkEnd}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                      onChange={e => setRegWorkEnd(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`signin-btn ${loading ? 'btn-loading' : ''} ${isSuccess ? 'btn-success' : ''}`}
              disabled={loading || isSuccess}
            >
              {loading && (
                <>
                  <svg className="spin-loader" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              )}
              {!loading && isSuccess && (
                <>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Success!</span>
                </>
              )}
              {!loading && !isSuccess && (
                <>
                  <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" x2="3" y1="12" y2="12" />
                  </svg>
                </>
              )}
            </button>

            {authMode === 'login' && (
              <div className="forgot-link-wrap">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => { setAuthMode('forgot-password'); setError(''); setSuccessMsg('') }}
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </form>
          )}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // 2. AUTHENTICATED SHELL + TOP NAVBAR
  // ==========================================
  const totalHrs = summary?.totalHoursLogged ?? 0
  const goalHrs = summary?.targetHours ?? user.targetHours ?? 400
  const remainingHrs = summary?.remainingHours ?? Math.max(0, goalHrs - totalHrs)
  const pct = summary?.progressPercentage ?? Math.min(100, Math.round((totalHrs / goalHrs) * 100))
  const completedDays = summary?.completedDays ?? Math.round((totalHrs / 8) * 10) / 10
  const remainingDays = summary?.remainingDays ?? Math.round((remainingHrs / 8) * 10) / 10
  const isClockedIn = summary?.isCurrentlyClockedIn
  const estShort = getEstimatedCompletionShort(remainingDays)

  const radius = 58
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, Math.max(4, pct)) / 100) * circumference

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * LOGS_PER_PAGE
  const visibleLogs = logs.slice(startIndex, startIndex + LOGS_PER_PAGE)

  const displayFullName = user.fullName || user.username
  const displayHandle = `@${(user.username || 'intern').toLowerCase().replace(/\s+/g, '')}`
  const displayEmail = user.email || `${(user.username || 'intern').toLowerCase().replace(/\s+/g, '')}@university.edu`

  return (
    <div className={darkMode ? 'app-shell' : 'app-shell light-mode'}>
      {/* TOP NAVIGATION BAR */}
      <nav className="top-navbar">
        <div className="navbar-inner">
          <div className="navbar-brand" onClick={() => { setActiveNav('dashboard'); setError(''); setSuccessMsg('') }}>
            <div className="brand-logo-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="brand-title">Internship Hours Tracker</span>
          </div>

          <div className="navbar-links">
            <button
              type="button"
              className={`nav-tab-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveNav('dashboard'); setError(''); setSuccessMsg('') }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeNav === 'profile' ? 'active' : ''}`}
              onClick={() => { setActiveNav('profile'); setError(''); setSuccessMsg('') }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeNav === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveNav('settings'); setError(''); setSuccessMsg('') }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT CONTAINER */}
      <div className="web-dashboard">
        {error && <div className="error-banner">{error}</div>}
        {successMsg && <div className="success-banner">{successMsg}</div>}

        {/* ==========================================
            TAB 1: DASHBOARD VIEW
            ========================================== */}
        {activeNav === 'dashboard' && (
          <>
            <header className="card topbar-card">
              <div>
                <h1>Internship Hours Tracker</h1>
                <span className="user-badge">Logged in as <strong>{displayFullName}</strong></span>
              </div>
              <button className="signout-outline-btn" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </header>

            <section className="card progress-section-card">
              <h2>Overall Progress</h2>

              <div className="progress-web-layout">
                <div className="donut-wrap">
                  <svg className="donut-svg" width="144" height="144" viewBox="0 0 144 144">
                    <circle
                      className="donut-track"
                      cx="72"
                      cy="72"
                      r={radius}
                      fill="transparent"
                      strokeWidth="14"
                    />
                    <circle
                      className="donut-progress"
                      cx="72"
                      cy="72"
                      r={radius}
                      fill="transparent"
                      stroke="#3b82f6"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 72 72)"
                    />
                  </svg>
                  <div className="donut-center">
                    <span className="donut-pct-green">{pct}%</span>
                    <span className="donut-hours-main">
                      <strong>{totalHrs}h</strong> / {goalHrs}h
                    </span>
                  </div>
                </div>

                <div className="stat-boxes-grid">
                  <div className="stat-dark-box">
                    <div className="stat-box-val green-text">
                      {totalHrs}h
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                    </div>
                    <div className="stat-box-lbl">Completed ({completedDays}d)</div>
                  </div>

                  <div className="stat-dark-box">
                    <div className="stat-box-val blue-text">{remainingHrs}h</div>
                    <div className="stat-box-lbl">Remaining ({remainingDays}d)</div>
                  </div>

                  <div className="stat-dark-box">
                    <div className="stat-box-val white-text">{remainingDays}d</div>
                    <div className="stat-box-lbl">Days Left (8h/day)</div>
                  </div>

                  <div className="stat-dark-box">
                    <div className="stat-box-val white-text">{estShort}</div>
                    <div className="stat-box-lbl">Est. Completion</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="card clock-section-card">
              <div className="clock-card-header">
                <h2>Live Time Clock</h2>
                <div className={isClockedIn ? 'status-pill-emerald' : 'status-pill-outline'}>
                  <span className={isClockedIn ? 'dot dot-green-pulse' : 'dot dot-slate'} />
                  <span>
                    {isClockedIn
                      ? `Clocked In (${summary?.activeTimeLog?.sessionType || 'Active'})`
                      : 'Clocked Out (Off Duty)'}
                  </span>
                </div>
              </div>

              {summary?.activeTimeLog && (
                <p className="active-since">
                  Session started at {new Date(summary.activeTimeLog.timeIn).toLocaleTimeString()}{' '}
                  <span className="official-hours-muted">
                    • Official Company Hours: {user.workStartTime || '08:00'} – {user.workEndTime || '17:00'}
                  </span>
                </p>
              )}

              <div className="session-type-label">
                SESSION TYPE{' '}
                <span className="shift-policy-inline">
                  • Official Shift: {user.workStartTime || '08:00'} to {user.workEndTime || '17:00'} (early clock-in counts from {user.workStartTime || '08:00'})
                </span>
              </div>
              <div className="session-selector-grid">
                <button
                  type="button"
                  className={`session-option-card ${sessionMode === 'full' ? 'selected' : ''}`}
                  onClick={() => setSessionMode('full')}
                >
                  <span className={`radio-circle ${sessionMode === 'full' ? 'checked' : ''}`}>
                    {sessionMode === 'full' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="session-option-title">Full Day</span>
                  <span className="session-option-sub">AM + PM (-1h Lunch)</span>
                </button>

                <button
                  type="button"
                  className={`session-option-card ${sessionMode === 'half-am' ? 'selected' : ''}`}
                  onClick={() => setSessionMode('half-am')}
                >
                  <span className={`radio-circle ${sessionMode === 'half-am' ? 'checked' : ''}`}>
                    {sessionMode === 'half-am' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="session-option-title">Half Day (AM)</span>
                  <span className="session-option-sub">Morning Only (No Lunch)</span>
                </button>

                <button
                  type="button"
                  className={`session-option-card ${sessionMode === 'half-pm' ? 'selected' : ''}`}
                  onClick={() => setSessionMode('half-pm')}
                >
                  <span className={`radio-circle ${sessionMode === 'half-pm' ? 'checked' : ''}`}>
                    {sessionMode === 'half-pm' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="session-option-title">Half Day (PM)</span>
                  <span className="session-option-sub">Afternoon Only (No Lunch)</span>
                </button>
              </div>

              {!isClockedIn ? (
                <div className="wide-action-stack">
                  {(sessionMode === 'full' || sessionMode === 'half-am') && (
                    <button
                      type="button"
                      onClick={() =>
                        handleTimeIn(
                          sessionMode === 'half-am'
                            ? 'Half Day (AM - No Lunch)'
                            : 'Morning (AM)'
                        )
                      }
                      className="wide-btn sapphire-primary-btn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>
                        {sessionMode === 'half-am' ? 'Morning Time In (Half Day AM)' : 'Morning Time In'}
                      </span>
                    </button>
                  )}

                  {(sessionMode === 'full' || sessionMode === 'half-pm') && (
                    <button
                      type="button"
                      onClick={() =>
                        handleTimeIn(
                          sessionMode === 'half-pm'
                            ? 'Half Day (PM - No Lunch)'
                            : 'Afternoon (PM)'
                        )
                      }
                      className={sessionMode === 'half-pm' ? 'wide-btn sapphire-primary-btn' : 'wide-btn slate-ghost-btn'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>
                        {sessionMode === 'half-pm' ? 'Afternoon Time In (Half Day PM)' : 'Back from Lunch (PM)'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="wide-action-stack">
                  {sessionMode === 'full' && (
                    <button
                      type="button"
                      onClick={() => handleTimeOut(false)}
                      className="wide-btn slate-ghost-btn"
                    >
                      {/* Coffee Cup Icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                        <line x1="6" x2="6" y1="2" y2="4" />
                        <line x1="10" x2="10" y1="2" y2="4" />
                        <line x1="14" x2="14" y1="2" y2="4" />
                      </svg>
                      <span>Time Out for Lunch (1 hr unpaid)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTimeOut(liveDeductLunch)}
                    className="wide-btn sapphire-primary-btn"
                  >
                    {/* Clock-Out / Exit Icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    <span>End of Shift Time Out</span>
                  </button>
                  <label className="checkbox-row" style={{ marginTop: '0.4rem' }}>
                    <input
                      type="checkbox"
                      checked={liveDeductLunch}
                      onChange={e => setLiveDeductLunch(e.target.checked)}
                    />
                    <span>Deduct 1-hour unpaid lunch break from this shift</span>
                  </label>
                </div>
              )}

              <div className="manual-toggle-row">
                <button
                  type="button"
                  className="manual-link-btn"
                  onClick={() => setShowManualForm(v => !v)}
                >
                  {showManualForm ? '− Hide Manual Entry' : '+ Add Past Session Manually'}
                </button>
              </div>

              {showManualForm && (
                <div className="manual-drawer">
                  <div className="session-type-label" style={{ marginBottom: '0.5rem' }}>Manual Session Type</div>
                  <div className="session-selector-grid" style={{ marginBottom: '0.85rem' }}>
                    <button
                      type="button"
                      className={`session-option-card compact ${manualSessionMode === 'full' ? 'selected' : ''}`}
                      onClick={() => setManualSessionMode('full')}
                    >
                      <span className="session-option-title">Full Day (-1h Lunch)</span>
                    </button>
                    <button
                      type="button"
                      className={`session-option-card compact ${manualSessionMode === 'half-am' ? 'selected' : ''}`}
                      onClick={() => setManualSessionMode('half-am')}
                    >
                      <span className="session-option-title">Half Day (AM)</span>
                    </button>
                    <button
                      type="button"
                      className={`session-option-card compact ${manualSessionMode === 'half-pm' ? 'selected' : ''}`}
                      onClick={() => setManualSessionMode('half-pm')}
                    >
                      <span className="session-option-title">Half Day (PM)</span>
                    </button>
                  </div>

                  <form className="manual-form three-col-picker" onSubmit={handleManualSubmit}>
                    <div>
                      <label>Session Date</label>
                      <input
                        type="date"
                        required
                        value={manualDate}
                        onClick={e => e.target.showPicker && e.target.showPicker()}
                        onChange={e => setManualDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Time In</label>
                      <input
                        type="time"
                        required
                        value={manualStartTime}
                        onClick={e => e.target.showPicker && e.target.showPicker()}
                        onChange={e => setManualStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Time Out</label>
                      <input
                        type="time"
                        required
                        value={manualEndTime}
                        onClick={e => e.target.showPicker && e.target.showPicker()}
                        onChange={e => setManualEndTime(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="wide-btn blue-wide-btn" style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
                      Save Manual Log
                    </button>
                  </form>
                </div>
              )}
            </section>

            <section className="card history-section-card">
              <div className="history-card-header">
                <div className="history-title-group">
                  <h2>Time Log History</h2>
                  <span className="sessions-count-pill">{logs.length} sessions</span>
                </div>

                <div className="history-actions-group">
                  <button
                    type="button"
                    className="export-pdf-btn"
                    onClick={handleExportPDF}
                    title="Export official DTR PDF Report"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                    <span>Export PDF Report</span>
                  </button>
                </div>
              </div>

              {logs.length === 0 ? (
                <p className="empty-state">No time logs recorded yet. Start a session above!</p>
              ) : (
                <>
                  <div className="history-rows-list">
                    {visibleLogs.map(log => {
                      const isOpen = expandedLogId === log.id
                      const isFullDay = log.deductLunchBreak || (log.sessionType && log.sessionType.toLowerCase().includes('full'))
                      const hoursFormatted = Number(log.hoursLogged || 0).toFixed(1)
                      const pillLabel = log.sessionType || (log.deductLunchBreak ? 'Full Day (-1h Lunch)' : 'Half Day (No Lunch)')

                      return (
                        <div
                          key={log.id}
                          className={`history-row-card ${isOpen ? 'expanded' : ''}`}
                        >
                          <button
                            type="button"
                            className="history-row-summary"
                            onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                          >
                            <div className="history-row-left">
                              <span className="history-date">{formatDateShort(log.timeIn)}</span>
                              <span className={isFullDay ? 'pill-outline-blue' : 'pill-outline-green'}>
                                {pillLabel}
                              </span>
                            </div>

                            <div className="history-row-right">
                              <span className="history-hrs">
                                <strong>{hoursFormatted}</strong> hrs
                              </span>
                              <span className={`circle-chevron ${isOpen ? 'rotated' : ''}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </span>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="history-row-details">
                              {editingLogId === log.id ? (
                                <form className="edit-log-inline-form" onSubmit={e => handleUpdateLogSubmit(e, log)}>
                                  <div className="manual-form three-col-picker">
                                    <div>
                                      <label>Date</label>
                                      <input
                                        type="date"
                                        required
                                        value={editLogDate}
                                        onClick={e => e.target.showPicker && e.target.showPicker()}
                                        onChange={e => setEditLogDate(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label>Time In</label>
                                      <input
                                        type="time"
                                        required
                                        value={editLogStartTime}
                                        onClick={e => e.target.showPicker && e.target.showPicker()}
                                        onChange={e => setEditLogStartTime(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label>Time Out</label>
                                      <input
                                        type="time"
                                        required
                                        value={editLogEndTime}
                                        onClick={e => e.target.showPicker && e.target.showPicker()}
                                        onChange={e => setEditLogEndTime(e.target.value)}
                                      />
                                    </div>
                                  </div>

                                  <div className="edit-log-options-row">
                                    <select
                                      className="session-select-input"
                                      value={editLogSessionType}
                                      onChange={e => {
                                        const val = e.target.value
                                        setEditLogSessionType(val)
                                        setEditLogDeductLunch(val.includes('Full Day'))
                                      }}
                                    >
                                      <option value="Full Day (-1h Lunch)">Full Day (-1h Lunch)</option>
                                      <option value="Half Day (AM - No Lunch)">Half Day (AM - No Lunch)</option>
                                      <option value="Half Day (PM - No Lunch)">Half Day (PM - No Lunch)</option>
                                      <option value="Morning (AM)">Morning (AM)</option>
                                      <option value="Afternoon (PM)">Afternoon (PM)</option>
                                    </select>

                                    <label className="checkbox-row">
                                      <input
                                        type="checkbox"
                                        checked={editLogDeductLunch}
                                        onChange={e => setEditLogDeductLunch(e.target.checked)}
                                      />
                                      <span>Deduct 1h unpaid lunch</span>
                                    </label>
                                  </div>

                                  <div className="log-action-buttons-right">
                                    <button
                                      type="button"
                                      className="cancel-inline-btn"
                                      onClick={() => setEditingLogId(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button type="submit" className="save-inline-btn">
                                      Save Changes
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className="detail-grid">
                                  <div>
                                    <span className="detail-lbl">Time In:</span>{' '}
                                    <strong>{new Date(log.timeIn).toLocaleTimeString()}</strong>
                                  </div>
                                  <div>
                                    <span className="detail-lbl">Time Out:</span>{' '}
                                    <strong>{log.timeOut ? new Date(log.timeOut).toLocaleTimeString() : 'In progress...'}</strong>
                                  </div>
                                  <div>
                                    <span className="detail-lbl">Lunch Break:</span>{' '}
                                    <span>{log.deductLunchBreak ? 'Auto-deducted 1h unpaid lunch' : 'No lunch deduction (Half Day)'}</span>
                                  </div>
                                  <div className="log-action-buttons-right">
                                    <button
                                      type="button"
                                      className="edit-inline-btn"
                                      onClick={() => startEditLog(log)}
                                    >
                                      Edit Log
                                    </button>
                                    <button
                                      type="button"
                                      className="delete-inline-btn"
                                      onClick={() => handleDeleteLog(log.id)}
                                    >
                                      Delete Log
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* PAGINATION CONTROLS (10 PER PAGE) */}
                  {totalPages > 1 && (
                    <div className="pagination-bar">
                      <span className="pagination-info">
                        Showing {startIndex + 1}–{Math.min(startIndex + LOGS_PER_PAGE, logs.length)} of {logs.length} sessions
                      </span>
                      <div className="pagination-buttons">
                        <button
                          type="button"
                          className="page-btn"
                          disabled={safePage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                          ‹ Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            type="button"
                            className={`page-btn ${safePage === pageNum ? 'active' : ''}`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="page-btn"
                          disabled={safePage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* ==========================================
            TAB 2: PROFILE VIEW
            ========================================== */}
        {activeNav === 'profile' && (
          <div className="subpage-container">
            <h1 className="subpage-title">My Profile</h1>

            <div className="card profile-hero-card">
              <div className="profile-hero-left">
                <div className="avatar-circle">
                  <span role="img" aria-label="Developer Avatar" className="avatar-emoji">👨‍💻</span>
                </div>
                <div className="profile-identity">
                  <h2>{displayFullName}</h2>
                  <span className="username-pill">{displayHandle}</span>
                  <div className="profile-email-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <span>{displayEmail}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="edit-profile-btn"
                onClick={() => setIsEditingProfile(v => !v)}
              >
                {isEditingProfile ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {isEditingProfile && (
              <form className="card edit-profile-card" onSubmit={handleSaveProfile}>
                <h3>Edit Profile Details</h3>
                <div className="manual-form" style={{ marginTop: '0.75rem' }}>
                  <div>
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={e => setEditFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Target Internship Hours Requirement</label>
                    <input
                      type="number"
                      required
                      value={editTargetHours}
                      onChange={e => setEditTargetHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Company Start Time (Hours count from)</label>
                    <input
                      type="time"
                      required
                      value={editWorkStart}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                      onChange={e => setEditWorkStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Company End Time</label>
                    <input
                      type="time"
                      required
                      value={editWorkEnd}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                      onChange={e => setEditWorkEnd(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="edit-profile-btn" style={{ marginTop: '1rem' }}>
                  Save Changes
                </button>
              </form>
            )}

            <div className="profile-info-grid">
              <div className="card profile-stat-card">
                <div className="profile-stat-icon green-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div className="profile-stat-label">TARGET REQUIREMENT</div>
                  <div className="profile-stat-value">{goalHrs} Hours</div>
                </div>
              </div>

              <div className="card profile-stat-card">
                <div className="profile-stat-icon blue-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
                <div>
                  <div className="profile-stat-label">COMPANY WORKING HOURS</div>
                  <div className="profile-stat-value">{user.workStartTime || '08:00'} – {user.workEndTime || '17:00'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: SETTINGS VIEW
            ========================================== */}
        {activeNav === 'settings' && (
          <div className="subpage-container">
            <h1 className="subpage-title" style={{ marginBottom: '0.25rem' }}>Settings</h1>
            <p className="subpage-subtitle">Manage your account security and preferences.</p>

            {/* CHANGE PASSWORD PANEL */}
            <div className="card settings-panel">
              <div className="settings-panel-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>CHANGE PASSWORD</span>
              </div>

              <form className="settings-panel-body" onSubmit={handleChangePassword}>
                <div>
                  <label style={{ marginTop: 0 }}>Current Password</label>
                  <input
                    type="password"
                    className="settings-input"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="settings-two-col">
                  <div>
                    <label>New Password</label>
                    <input
                      type="password"
                      className="settings-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      className="settings-input"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button type="submit" className="update-password-btn">
                  Update Password
                </button>
              </form>
            </div>

            {/* SYSTEM PREFERENCES PANEL */}
            <div className="card settings-panel">
              <div className="settings-panel-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>SYSTEM PREFERENCES</span>
              </div>

              <div className="settings-pref-list">
                <div className="settings-pref-row">
                  <div>
                    <div className="pref-title">Dark Mode</div>
                    <div className="pref-desc">Use the dark theme across the application</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkMode}
                    className={`ios-switch ${darkMode ? 'on' : ''}`}
                    onClick={() => setDarkMode(v => !v)}
                  >
                    <span className="ios-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-logout-divider">
              <button type="button" className="danger-logout-btn" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                <span>Log Out of Account</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
