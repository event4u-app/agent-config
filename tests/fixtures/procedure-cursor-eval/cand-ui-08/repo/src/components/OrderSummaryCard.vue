<template>
  <section class="order-summary">
    <h2>Order summary</h2>
    <p>{{ total }}</p>
  </section>
</template>

<script setup>
defineProps({ total: String });
</script>
