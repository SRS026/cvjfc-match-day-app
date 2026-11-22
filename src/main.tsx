import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles.css';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { actions, resumedGame, useAppState } from './store';
import { Home } from './screens/Home';
import { Live } from './screens/Live';
import { Summary } from './screens/Summary';
import { keepAwake } from './wakelock';

registerSW({ immediate: true });

function App() {
  const state = useAppState();
  const [now, setNow] = useState(Date.now());
  const [askResume, setAskResume] = useState(resumedGame);

  // One ticker for the whole app: redraws the clock and auto-stops at each
  // 10-minute mark, even while the coach is on the home screen.
  useEffect(() => {
    const t = setInterval(() => {
      actions.tick();
      setNow(Date.now());
    }, 250);
    const wake = () => {
      actions.tick();
      setNow(Date.now());
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  const live = state.live;
  const onLive = state.screen === 'live' && !!live;
  useEffect(() => keepAwake(!!live), [!!live]);

  // Match the page behind the app to the current screen (iOS overscroll / notch).
  const bg = onLive && live!.view === 'pitch' && !live!.ending ? '#0F4D2B' : '#FFC629';
  useEffect(() => {
    document.body.style.background = bg;
    document.documentElement.style.background = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [bg]);

  return (
    <>
      {onLive ? <Live live={live!} now={now} hideTimes={!!state.hideTimes} /> : <Home state={state} />}
      {onLive && live!.ending && <Summary live={live!} now={now} />}
      {askResume && live && (
        <div class="overlay" role="dialog" aria-modal="true">
          <div class="dialog">
            <h2>Resume Game {askResume}?</h2>
            <div class="grid2">
              <button class="btn dbtn outline" onClick={() => { setAskResume(null); actions.goHome(); }}>
                Home
              </button>
              <button
                class="btn dbtn"
                style={{ background: 'var(--green)', color: '#fff' }}
                onClick={() => { setAskResume(null); actions.kickOff(askResume); }}
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

render(<App />, document.getElementById('app')!);
