import { useState } from 'react'
import { useStore } from '../store'
import { ROLE_LABEL } from '../lib/workflow'
import { IconAlert, IconUser } from '../icons'

/**
 * Sign-in for the prototype.
 *
 * These are demo credentials held in the client bundle — there is no real
 * authentication here, and there cannot be without a backend. The point is to
 * simulate the office's actual roles so people can see what each one can and
 * cannot do. Real deployment replaces this with Supabase Auth (whitepaper §14.1).
 */
export function Login() {
  const { db, signIn } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showAccounts, setShowAccounts] = useState(true)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn(username, password)) {
      setError('That username and password do not match an account.')
      return
    }
    setError('')
  }

  function use(u: { username: string; password: string }) {
    setUsername(u.username)
    setPassword(u.password)
    setError('')
  }

  const byRole = ['encoder', 'liaison', 'pa', 'viewer'] as const

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <div className="mark">SB</div>
          <div>
            <b>SUBAYBAY</b>
            <span>Office of the Provincial Agriculturist · Aurora</span>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          Use your office account. What you can do depends on your role.
        </p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">Username</label>
            <input
              id="u" className="input" autoFocus autoComplete="username"
              value={username} onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="e.g. loraine"
            />
          </div>
          <div className="field">
            <label htmlFor="p">Password</label>
            <input
              id="p" className="input" type="password" autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
            />
          </div>

          {error && (
            <div className="note note-crit" style={{ marginBottom: 14 }}>
              <IconAlert size={15} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
            Sign in
          </button>
        </form>

        <div className="login-demo">
          <button className="login-toggle" onClick={() => setShowAccounts((v) => !v)}>
            {showAccounts ? 'Hide' : 'Show'} demo accounts
          </button>

          {showAccounts && (
            <>
              <p className="sub" style={{ margin: '10px 0 12px' }}>
                Prototype only — these credentials sit in the page itself and secure nothing.
                Pick an account to see the office from that person's side.
              </p>

              {byRole.map((r) => {
                const people = db.users.filter((u) => u.roles[0] === r)
                if (people.length === 0) return null
                return (
                  <div key={r} className="login-group">
                    <h4>{ROLE_LABEL[r]}</h4>
                    {people.map((u) => (
                      <button key={u.id} className="login-acct" onClick={() => use(u)}>
                        <span className="av"><IconUser size={13} /></span>
                        <span className="who">
                          <b>{u.name}</b>
                          <span>{u.position}</span>
                        </span>
                        <span className="cred mono">
                          {u.username}
                          <span>{u.password}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
