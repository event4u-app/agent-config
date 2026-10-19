import * as React from "react";

export function ProductGrid(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-tier="organisms">{props.children}</div>;
}
