import { Input } from '@/components/ui/input';

export function OrderFilters() {
    return (
        <div className="flex items-end gap-3">
            <label className="grid gap-1.5 text-sm">
                Customer
                <Input name="customer" placeholder="Search customers" />
            </label>
            <label className="grid gap-1.5 text-sm">
                Order number
                <Input name="order" placeholder="e.g. 10423" />
            </label>
        </div>
    );
}
