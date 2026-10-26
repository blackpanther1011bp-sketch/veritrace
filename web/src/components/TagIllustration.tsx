/** Illustration affichée avant l'ouverture de la caméra. */
export function TagIllustration() {
  return (
    <svg width="200" height="278" viewBox="0 0 230 320" role="img" aria-label="Étiquette de vêtement avec son code-barres">
      <line x1="115" y1="0" x2="115" y2="42" stroke="#6E7F74" strokeWidth="2" />
      <path d="M40 62 L95 30 H135 L190 62 V296 a10 10 0 0 1 -10 10 H50 a10 10 0 0 1 -10 -10 Z" fill="#EDEAE2" />
      <circle cx="115" cy="48" r="7" fill="#1A2A21" />
      <rect x="70" y="92" width="90" height="12" rx="6" fill="#C9CFC6" />
      <rect x="82" y="118" width="66" height="9" rx="4.5" fill="#DAD9CF" />
      <rect x="88" y="136" width="54" height="9" rx="4.5" fill="#DAD9CF" />
      <g fill="#0F1A14">
        {[62, 66, 69, 74, 77, 81, 84, 90, 93, 97, 100, 105, 109, 112, 116, 119, 124, 127, 131, 137, 140, 144, 147, 152, 155, 159, 162, 167].map((x, i) => (
          <rect key={x} x={x} y="200" width={[2, 1, 3, 1, 2, 1, 4][i % 7]} height="60" />
        ))}
      </g>
      <path d="M50 208 V188 H70" stroke="#3DDC97" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M160 188 H180 V208" stroke="#3DDC97" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M180 260 V280 H160" stroke="#3DDC97" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M70 280 H50 V260" stroke="#3DDC97" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
