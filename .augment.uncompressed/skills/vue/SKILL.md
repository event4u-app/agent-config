---
name: vue
description: "Use when writing Vue.js components — Composition API, TypeScript, reactive state, and clean component architecture."
---

# vue

## When to use

Use this skill when:
- Creating or editing Vue.js components (`.vue` files)
- Building reactive frontends with Vue
- Working with Vue Router, Pinia/Vuex, or composables
- Integrating Vue with Laravel (Inertia.js or standalone SPA)

## Before writing code

1. **Detect Vue version** — check `package.json` for `vue` version.
   - Vue 3: Composition API, `<script setup>`, TypeScript.
   - Vue 2: Options API (or Composition API via plugin).
2. **Detect build tool** — Vite (`vite.config.ts`), Webpack (`webpack.mix.js`), or other.
3. **Check existing components** — match the style (Options vs Composition API, TS vs JS).
4. **Check state management** — Pinia (`stores/`), Vuex (`store/`), or composables.
5. **Read project docs** — check `./agents/` and `package.json` scripts.

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

## Core rules

### Composition API (Vue 3)
- Prefer `<script setup>` syntax — it's shorter and more type-safe.
- Use `ref()` for primitive values, `reactive()` for objects.
- Use `computed()` for derived state.
- Extract reusable logic into composables (`use{Feature}.ts`).

### TypeScript
- Use TypeScript when the project uses it (check for `.ts` / `lang="ts"`).
- Type props with `defineProps<Props>()`.
- Type emits with `defineEmits<{...}>()`.
- Define interfaces for complex data structures.

### State management
- **Pinia** (Vue 3): Define stores in `stores/` with `defineStore()`.
- **Vuex** (Vue 2/3): Follow existing module structure.
- **Composables**: For shared logic that doesn't need global state.
- Keep component-local state local — don't put everything in the store.

### Component architecture
- **Props down, events up** — parent passes data via props, child emits events.
- Keep components focused — one responsibility per component.
- Extract repeated UI patterns into reusable components.
- Use slots for flexible content injection.

### API calls
- Use a centralized API layer (check for `api/`, `services/`, or `composables/`).
- Handle loading and error states in the component.
- Use `async/await` over raw Promises.

## Template conventions

- Use `v-if` / `v-else` for conditional rendering.
- Use `v-for` with `:key` — always provide a unique key.
- Use `@click` shorthand over `v-on:click`.
- Use `:prop` shorthand over `v-bind:prop`.
- Keep templates readable — extract complex logic into computed properties or methods.

## Styling

- Match the project's CSS approach (Tailwind, SCSS, scoped CSS, CSS modules).
- Use `<style scoped>` when the project uses it.
- Do not introduce a new styling approach.

## Pinia store patterns

```ts
// stores/useUserStore.ts
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  async function login(credentials: LoginCredentials) {
    user.value = await api.login(credentials)
  }

  function logout() {
    user.value = null
  }

  return { user, isAuthenticated, login, logout }
})
```

- Use **Setup Stores** (function syntax) over Option Stores for better TypeScript support.
- Keep stores focused — one domain per store.
- Use `storeToRefs()` when destructuring reactive state from stores.

## Composables

Extract reusable logic into composables (`composables/use{Feature}.ts`):

```ts
// composables/usePagination.ts
export function usePagination(fetchFn: (page: number) => Promise<PaginatedResponse>) {
  const currentPage = ref(1)
  const data = ref([])
  const isLoading = ref(false)

  async function goToPage(page: number) {
    isLoading.value = true
    const response = await fetchFn(page)
    data.value = response.data
    currentPage.value = page
    isLoading.value = false
  }

  return { currentPage, data, isLoading, goToPage }
}
```

## What NOT to do

- Do not use Options API in a Vue 3 project that uses Composition API.
- Do not mutate props directly — emit events instead.
- Do not put business logic in templates — use computed/methods.
- Do not skip TypeScript types when the project uses TS.
- Do not create global state for component-local concerns.
- Do not mix styling approaches within the same project.
- Do not use `reactive()` for primitives — use `ref()`.
- Do not forget `.value` when accessing refs in `<script>` (not needed in `<template>`).

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
