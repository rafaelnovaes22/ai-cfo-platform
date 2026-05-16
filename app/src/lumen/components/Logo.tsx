import logoUrl from "@/assets/logo.svg";
import logoDarkUrl from "@/assets/logo-dark.svg";

type Props = { className?: string; size?: number; iconOnly?: boolean };

export function LumenLogo({
  className = "",
  size = 28,
  iconOnly = false,
}: Props) {
  if (iconOnly) {
    // Crop the SVG to roughly the "D" mark area using CSS background trick
    return (
      <div
        className={className}
        aria-label="Logo"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${logoUrl})`,
          backgroundSize: "auto 130%",
          backgroundPosition: "0% 50%",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }
  return (
    <>
      <img
        src={logoDarkUrl}
        alt="Logo"
        className={`${className} flex dark:hidden`}
        style={{ height: size, width: "auto" }}
      />
      <img
        src={logoUrl}
        alt="Logo"
        className={`${className} hidden dark:flex`}
        style={{ height: size, width: "auto" }}
      />
    </>
  );
}
