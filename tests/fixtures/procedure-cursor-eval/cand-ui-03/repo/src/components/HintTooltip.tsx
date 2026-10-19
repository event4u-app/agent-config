import * as Tooltip from "@radix-ui/react-tooltip";

export function HintTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Content className="hint-tooltip">{text}</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
