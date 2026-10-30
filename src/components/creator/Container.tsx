import type { ReactNode } from "react";
import { cx } from "./utils";

export type ContainerProps = { className?: string; children: ReactNode };

/** Közös szekció-konténer: max 1240 px, 20 px (mobil) / 40 px belső margó. */
export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cx("mx-auto w-full max-w-[1240px] px-5 sm:px-10", className)}>
      {children}
    </div>
  );
}
