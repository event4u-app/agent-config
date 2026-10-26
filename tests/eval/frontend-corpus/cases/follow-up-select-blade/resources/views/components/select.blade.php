@props(['options' => []])

<select {{ $attributes->merge(['class' => 'h-9 rounded-md border border-gray-300 px-3 text-sm [appearance:base-select] focus:outline-none focus:ring-2 focus:ring-indigo-500']) }}>
    @foreach ($options as $value => $label)
        <option value="{{ $value }}">{{ $label }}</option>
    @endforeach
</select>
