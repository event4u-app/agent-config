<x-layouts.app>
    <x-alert-banner type="warning">Two invoices are overdue.</x-alert-banner>
    <table>
        @foreach ($invoices as $invoice)
            <x-invoice-row :invoice="$invoice" />
        @endforeach
    </table>
</x-layouts.app>
