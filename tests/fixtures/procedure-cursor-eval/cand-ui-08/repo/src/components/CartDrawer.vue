<template>
  <aside class="cart-drawer" v-if="open">
    <slot />
  </aside>
</template>

<script setup>
defineProps({ open: Boolean });
</script>
