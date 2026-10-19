import * as React from "react";

export function SearchField(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-tier="molecules">{props.children}</div>;
}
