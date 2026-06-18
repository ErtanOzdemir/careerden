import { useEffect, useState } from "react";

export default function CompanyLogo(props: { company: string; logo?: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [props.logo]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-outline-variant bg-surface-container text-primary ${props.className ?? ""}`}
    >
      {props.logo && !hasError ? (
        <img
          alt={`${props.company} logo`}
          className="h-full w-full object-contain bg-white"
          onError={() => setHasError(true)}
          src={props.logo}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold">
          {props.company.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
