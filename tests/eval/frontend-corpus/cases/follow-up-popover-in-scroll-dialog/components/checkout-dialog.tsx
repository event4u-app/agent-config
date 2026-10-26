export function CheckoutDialog() {
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="fixed inset-0 grid place-items-center bg-black/40">
            <div className="flex max-h-[80vh] w-[28rem] flex-col rounded-lg bg-background shadow-lg">
                <h2 id="checkout-title" className="border-b px-6 py-4 text-base font-semibold">
                    Shipping address
                </h2>
                <div className="grid gap-4 overflow-y-auto px-6 py-4">
                    <label className="grid gap-1.5 text-sm">
                        Street
                        <input name="street" className="h-9 rounded-md border px-3 text-sm" />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        City
                        <input name="city" className="h-9 rounded-md border px-3 text-sm" />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                        Postal code
                        <input name="postal" className="h-9 rounded-md border px-3 text-sm" />
                    </label>
                </div>
            </div>
        </div>
    );
}
