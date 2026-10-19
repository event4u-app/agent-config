<template>
  <form class="shipping-form" @submit.prevent="$emit('save')">
    <label for="street">Street</label>
    <input id="street" v-model="street" />
  </form>
</template>

<script setup>
import { ref } from "vue";
const street = ref("");
</script>
