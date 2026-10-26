import * as SelectPrimitive from '@radix-ui/react-select';
import * as React from 'react';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ children }: { children: React.ReactNode }) {
    return (
        <SelectPrimitive.Trigger className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
            {children}
        </SelectPrimitive.Trigger>
    );
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="z-50 rounded-md border bg-popover p-1 text-sm shadow-md">
                <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <SelectPrimitive.Item value={value} className="rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-accent">
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}
