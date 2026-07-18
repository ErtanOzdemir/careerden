export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-mark${inverse ? " brand-mark-inverse" : ""}`} aria-hidden="true">
      <img alt="" src={inverse ? "/handshake-logo-white.svg" : "/handshake-logo.svg"} />
    </span>
  );
}
