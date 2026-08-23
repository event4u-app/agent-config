<template>
  <form class="space-y-4" @submit.prevent="submit">
    <label class="block text-sm font-medium" for="email">Email</label>
    <input id="email" v-model="email" type="email" class="w-full rounded border px-3 py-2" />
    <button type="submit" class="rounded bg-slate-900 px-4 py-2 text-white">Invite</button>
  </form>
</template>
