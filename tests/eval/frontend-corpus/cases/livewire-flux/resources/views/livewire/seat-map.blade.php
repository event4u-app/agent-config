<div class="grid grid-cols-8 gap-1" wire:poll.5s>
    @foreach ($seats as $seat)
        <button class="aspect-square rounded border text-xs" @disabled($seat->taken)>{{ $seat->label }}</button>
    @endforeach
</div>
