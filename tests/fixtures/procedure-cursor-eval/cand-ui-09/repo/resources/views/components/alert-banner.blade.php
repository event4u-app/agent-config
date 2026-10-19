@props(['type' => 'info'])
<div {{ $attributes->merge(['class' => 'alert-banner alert-banner--'.$type]) }} role="alert">
    {{ $slot }}
</div>
