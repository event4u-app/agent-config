import * as React from "react";

export function Card(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-ui="Card">{props.children}</div>;
}
