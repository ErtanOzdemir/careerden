import logoUrl from "../public/handshake-logo.svg";
import whiteLogoUrl from "../public/handshake-logo-white.svg";

export function BrandLogo({
  className,
  variant = "theme",
}: {
  className?: string;
  variant?: "theme" | "light" | "inverse";
}) {
  if (variant === "light") {
    return <img src={logoUrl} alt="Careerden" className={className} />;
  }

  if (variant === "inverse") {
    return (
      <>
        <img src={whiteLogoUrl} alt="Careerden" className={`dark:hidden ${className ?? ""}`} />
        <img src={logoUrl} alt="Careerden" className={`hidden dark:block ${className ?? ""}`} />
      </>
    );
  }

  return (
    <>
      <img src={logoUrl} alt="Careerden" className={`brand-logo-theme-light ${className ?? ""}`} />
      <img
        src={whiteLogoUrl}
        alt="Careerden"
        className={`brand-logo-theme-dark ${className ?? ""}`}
      />
    </>
  );
}
