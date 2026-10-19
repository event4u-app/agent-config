import * as React from "react";

export function PageHeader(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-ui="PageHeader">{props.children}</div>;
}
