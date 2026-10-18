# 5. List reusable patterns

Categorize what already exists. Empty arrays are valid, never omit the keys.

```
state.ui_audit.patterns = {
  forms: [<component path:str>, ...],     // any component with <form>, useForm, <flux:input>, <Input> + <Button type=submit>
  tables: [...],                          // <table>, <flux:table>, DataTable, headless table primitives
  modals: [...],                          // <flux:modal>, <Dialog>, AlertDialog, Sheet
  empty_states: [...],                    // components matching grep "no results"|"empty"|"keine"|"nothing yet"
  navigation: [...],                      // sidebar, breadcrumb, tabs
  data_display: [...]                     // cards, lists, stat tiles
}
```
