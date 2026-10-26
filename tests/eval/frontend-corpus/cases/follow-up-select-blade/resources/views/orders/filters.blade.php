<div class="flex items-end gap-3">
    <label class="grid gap-1.5 text-sm">
        {{ __('orders.filters.customer') }}
        <x-input name="customer" :placeholder="__('orders.filters.customer_placeholder')" />
    </label>
    <label class="grid gap-1.5 text-sm">
        {{ __('orders.filters.number') }}
        <x-input name="order" />
    </label>
</div>
