import * as React from "react";

export function PriceTag(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-tier="atoms">{props.children}</div>;
}
