import * as React from "react";

export function StatTile(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={props.className} data-ui="StatTile">{props.children}</div>;
}
