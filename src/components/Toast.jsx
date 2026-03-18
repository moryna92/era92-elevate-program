export default function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', top: 70, left: '50%',
      transform: `translateX(-50%) translateY(${message ? 0 : -20}px)`,
      background: 'var(--sage)', color: '#fff',
      padding: '10px 22px', borderRadius: 4,
      fontFamily: 'DM Mono,monospace', fontSize: 11, letterSpacing: 1,
      zIndex: 500, opacity: message ? 1 : 0,
      transition: 'all .3s', whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
}
