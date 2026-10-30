// Careerden Unplugged's wordmark, matching the desktop app: the edition name on a yellow block
// beside Careerden.
export function UnpluggedWordmark({ size = "default" }: { size?: "default" | "large" }) {
  return (
    <span className={"unplugged-wordmark" + (size === "large" ? " large" : "")}>
      Careerden
      <span className="unplugged-badge">Unplugged</span>
    </span>
  );
}
