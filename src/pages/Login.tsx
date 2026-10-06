import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity, BellRing, BrainCircuit, CircleCheck, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import heroUrl from '../assets/login-hero.jpg';
import { DEMO_CREDENTIALS, useApp } from '../store/AppStore';
import { Button, Field, Input, Logo, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import { cn } from '../utils/cn';

export default function Login() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  if (state.authenticated) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = 'Please enter your username';
    if (!password) errs.password = 'Please enter your password';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    window.setTimeout(() => {
      if (username.trim().toLowerCase() === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
        dispatch({ type: 'LOGIN' });
        toast({ kind: 'success', title: `Welcome back, ${state.profile.displayName}`, description: 'Patient risk predictions are up to date.' });
        navigate('/', { replace: true });
      } else {
        setLoading(false);
        setErrors({ form: 'Invalid username or password. Use the demo account shown below.' });
      }
    }, 700);
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setTimeout(() => {
      setResetSent(false);
      setResetEmail('');
      setResetError('');
    }, 200);
  };

  const sendReset = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Enter a valid hospital email address');
      return;
    }
    setResetError('');
    setResetSent(true);
  };

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/90 via-blue-900/75 to-blue-700/40" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-lg">
              <Logo className="h-7 w-7" />
            </span>
            <span className="text-lg font-semibold">Clinical Risk Prediction System</span>
          </div>
          <div className="max-w-lg">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI-assisted early warning
            </p>
            <h2 className="text-4xl font-bold leading-[1.1] xl:text-5xl">
              Early Insight.
              <br />
              Safer Care.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-blue-50/90">
              Continuously analyses vital signs, laboratory results and patient history to flag clinical deterioration and ICU readmission
              risk — so your team can act before it happens.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                { icon: Activity, text: 'Real-time deterioration risk from bedside observations' },
                { icon: BrainCircuit, text: 'Explainable predictions with contributing factors' },
                { icon: BellRing, text: 'Automatic alerts when risk thresholds are crossed' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-blue-100/70">City General Hospital · Clinical Decision Support</p>
        </div>
      </aside>

      <main className="relative flex min-h-dvh items-center justify-center bg-gradient-to-b from-blue-50/80 via-white to-white px-5 py-10 sm:px-8 lg:bg-none">
        <div className="w-full max-w-[400px]">
          <div className="sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-8 sm:shadow-xl sm:shadow-slate-200/70 lg:border-0 lg:p-0 lg:shadow-none">
            <div className="flex flex-col items-center text-center">
              <Logo className="h-16 w-16" />
              <h1 className="mt-4 text-[22px] font-bold leading-tight text-navy-900">Clinical Risk Prediction System</h1>
              <p className="mt-1.5 text-sm text-slate-500">Early Insight. Safer Care.</p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              {errors.form && (
                <div role="alert" className="animate-pop-in rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errors.form}
                </div>
              )}
              <div>
                <label htmlFor="username" className="sr-only">
                  Username
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrors((x) => ({ ...x, username: undefined, form: undefined }));
                  }}
                  leftIcon={<User className="h-4 w-4" />}
                  invalid={!!errors.username}
                  className="h-11"
                />
                {errors.username && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.username}</p>}
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((x) => ({ ...x, password: undefined, form: undefined }));
                  }}
                  leftIcon={<Lock className="h-4 w-4" />}
                  invalid={!!errors.password}
                  className="h-11"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                {errors.password && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full bg-blue-700 hover:bg-blue-800" loading={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                  Forgot password?
                </button>
              </div>
            </form>

            <div className="mt-7 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Demo account</p>
                  <p className="mt-0.5">
                    <span className="font-mono font-semibold text-blue-700">{DEMO_CREDENTIALS.username}</span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="font-mono font-semibold text-blue-700">{DEMO_CREDENTIALS.password}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => {
                    setUsername(DEMO_CREDENTIALS.username);
                    setPassword(DEMO_CREDENTIALS.password);
                    setErrors({});
                  }}
                >
                  Autofill
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
            Demonstration system with simulated patient data.
            <br className="sm:hidden" /> Not intended for clinical use.
          </p>
        </div>
      </main>

      <Modal
        open={forgotOpen}
        onClose={closeForgot}
        size="sm"
        title="Reset your password"
        description={resetSent ? undefined : 'We will email you a secure link to reset your password.'}
        footer={
          resetSent ? (
            <Button onClick={closeForgot}>Back to login</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeForgot}>
                Cancel
              </Button>
              <Button onClick={sendReset} icon={<Mail className="h-4 w-4" />}>
                Send reset link
              </Button>
            </>
          )
        }
      >
        {resetSent ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CircleCheck className="h-6 w-6" />
            </span>
            <p className="mt-3 font-semibold text-slate-900">Check your inbox</p>
            <p className="mt-1 text-sm text-slate-500">
              If an account exists for <span className="font-medium text-slate-700">{resetEmail}</span>, a reset link is on its way. For urgent
              access contact the IT service desk (ext. 4357).
            </p>
          </div>
        ) : (
          <Field label="Hospital email" htmlFor="reset-email" error={resetError}>
            <Input
              id="reset-email"
              type="email"
              placeholder="name@hospital.org"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              invalid={!!resetError}
              className={cn(resetError && 'animate-pop-in')}
              onKeyDown={(e) => e.key === 'Enter' && sendReset()}
            />
          </Field>
        )}
      </Modal>
    </div>
  );
}
