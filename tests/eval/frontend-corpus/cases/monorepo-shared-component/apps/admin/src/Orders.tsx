import { DataTable } from "@acme/ui";
export const Orders = ({ rows }) => <DataTable rows={rows} columns={[{ key: "id", label: "ID" }]} />;
