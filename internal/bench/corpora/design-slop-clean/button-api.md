<!-- clean: component reference with props, states, and the cases where the component is the wrong choice -->
# Button

A single action trigger. Renders a `<button>` unless `href` is set, in which
case it renders an `<a>` with button styling.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `primary` \| `quiet` \| `danger` | `quiet` | One `primary` button per view section. |
| `size` | `sm` \| `md` | `md` | `sm` is 28px tall and only for table row actions. |
| `href` | `string` | none | Setting this renders an anchor. `type` is then ignored. |
| `type` | `button` \| `submit` | `button` | Always set `submit` explicitly inside a form. |
| `loading` | `boolean` | `false` | Disables the button and swaps the label for a spinner. |
| `iconStart` | `ReactNode` | none | Must be 16px and decorative. Give the button a text label as well. |

## States

Focus is drawn with `:focus-visible` and a 2px outline offset by 1px, never by
removing the outline and tinting the background. Hover changes background only.
Disabled buttons keep 4.5:1 label contrast so the label stays readable.

## Usage

```jsx
<Button variant="primary" type="submit">
  Save changes
</Button>

<Button variant="danger" onClick={confirmDelete}>
  Delete project
</Button>
```

## When not to use this

- Navigation between pages. Use a plain link. A link that looks like a button is
  still a link and must keep middle click and open in new tab working.
- A binary setting. Use a checkbox or a switch so the current value is visible
  without reading the label as a verb.
- More than two actions in a row. Move the rest into a menu.

## Label text

Write the outcome, not the mechanism. "Save changes" over "Submit". "Delete
project" over "Confirm". A label that only says "OK" forces the user to re-read
the dialog to find out what OK does.
