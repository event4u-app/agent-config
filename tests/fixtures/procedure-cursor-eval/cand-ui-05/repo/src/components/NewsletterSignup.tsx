import * as React from "react";

export function NewsletterSignup(props: React.PropsWithChildren<{ className?: string }>) {
  return <section className={props.className}>{props.children}</section>;
}
