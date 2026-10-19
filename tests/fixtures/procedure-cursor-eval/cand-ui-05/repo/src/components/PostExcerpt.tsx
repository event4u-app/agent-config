import * as React from "react";

export function PostExcerpt(props: React.PropsWithChildren<{ className?: string }>) {
  return <section className={props.className}>{props.children}</section>;
}
