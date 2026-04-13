---
name: vue
description: "Use when writing Vue.js components — Composition API, TypeScript, reactive state, and clean component architecture."
---

# vue

## When to use

Vue.js components, reactive frontends, Vue Router, Pinia/Vuex, composables, Laravel integration.

## Before: detect Vue version (3: Composition+script setup, 2: Options), build tool (Vite/Webpack), existing components, state management, project docs.

## Component structure (Vue 3 + Composition API)

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { User } from '@/types'

interface Props {
  userId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  updated: [user: User]
}>()

const user = ref<User | null>(null)
const isLoading = ref(false)

const fullName = computed(() =>
  user.value ? `${user.value.firstName} ${user.value.lastName}` : ''
)

onMounted(async () => {
  isLoading.value = true
  user.value = await fetchUser(props.userId)
  isLoading.value = false
})
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="user">
    <h1>{{ fullName }}</h1>
  </div>
</template>
```

## Rules

**Composition API:** `<script setup>`, `ref()` (primitives), `reactive()` (objects), `computed()`, composables (`use{Feature}.ts`). **TS:** `defineProps<Props>()`, `defineEmits<{...}>()`. **State:** Pinia (Setup Stores, `storeToRefs()`), Vuex (existing modules), composables (no global needed). **Components:** props down + events up, focused, reusable, slots. **API:** centralized layer, loading/error states.

## Templates: `v-if`/`v-for` with `:key`, shorthand `@click`/`:prop`. Styling: match project (scoped CSS/Tailwind/SCSS).

## Pinia: Setup Stores (function syntax), one domain per store, `storeToRefs()` for destructuring.

## Composables: `composables/use{Feature}.ts` for reusable stateful logic.

## Gotcha

- Don't use Options API in new code — Composition API is the standard for Vue 3.
- The model tends to mutate props directly — always emit events to the parent for state changes.
- `ref()` for primitives, `reactive()` for objects — don't wrap objects in `ref()` unnecessarily.

## Do NOT

- Do NOT use reactive() for primitives — use ref().

## Auto-trigger keywords

- Vue.js
- Composition API
- Pinia
- Vue component
- reactive state
