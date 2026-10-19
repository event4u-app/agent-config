<template>
  <CartDrawer :open="true"><OrderSummaryCard total="42.00" /></CartDrawer>
</template>

<script setup>
import CartDrawer from "./components/CartDrawer.vue";
import OrderSummaryCard from "./components/OrderSummaryCard.vue";
</script>
