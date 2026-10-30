import type { ReactNode } from "react";
import { cx } from "./utils";

export type ContainerProps = { className?: string; children: ReactNode };

/** Shared section container: max 1240 px, 20 px (mobile) / 40 px inner margin. */
export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cx("mx-auto w-full max-w-[1240px] px-5 sm:px-10", className)}>
      {children}
    </div>
  );
}
