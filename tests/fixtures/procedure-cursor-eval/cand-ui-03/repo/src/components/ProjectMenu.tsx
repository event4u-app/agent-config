import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function ProjectMenu({ onArchive }: { onArchive: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="project-menu__trigger">Actions</DropdownMenu.Trigger>
      <DropdownMenu.Content className="project-menu__content">
        <DropdownMenu.Item onSelect={onArchive}>Archive project</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
