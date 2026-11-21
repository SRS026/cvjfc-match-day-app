import type { ComponentChildren } from 'preact';

const LOGO = './logo.png';

export function Logo({ onClick }: { onClick?: () => void }) {
  const img = <img class="logo" src={LOGO} alt="Cheddar club mascot" />;
  if (!onClick) return img;
  return (
    <button class="btn" style={{ display: 'flex', flexShrink: 0 }} onClick={onClick} aria-label="Back to Match Day App home">
      {img}
    </button>
  );
}

export function Header(props: { title: string; onLogo?: () => void; children?: ComponentChildren; size?: number }) {
  return (
    <div class="header">
      <Logo onClick={props.onLogo} />
      <div class="title" style={props.size ? { fontSize: props.size + 'px' } : undefined}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}
