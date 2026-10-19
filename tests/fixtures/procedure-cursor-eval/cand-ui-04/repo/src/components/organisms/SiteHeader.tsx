import * as React from "react";

export function SiteHeader(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-tier="organisms">{props.children}</div>;
}
