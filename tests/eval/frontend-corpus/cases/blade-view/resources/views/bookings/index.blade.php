<table class="w-full text-sm">
    <tbody>
    @foreach ($bookings as $booking)
        <tr class="border-b border-gray-200">
            <td class="px-3 py-2">{{ $booking->reference }}</td>
            <td class="px-3 py-2">{{ $booking->guest_name }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
