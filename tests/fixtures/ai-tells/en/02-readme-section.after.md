## What this library does

This is a state container with two ideas behind it. First, every state change goes through one dispatch function, so you can log or replay anything that happened. Second, subscriptions are granular: a component that reads one field only re-renders when that field changes.

The API surface is four functions. Most projects only need two of them.

It fits best in apps where many distant components share state. For a form or a single page, plain component state is less code and easier to debug.
