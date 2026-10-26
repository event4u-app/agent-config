/**
 * Which Terraform resource types are connections rather than things.
 *
 * Data, not code: a type listed here becomes an edge between the resources
 * its `from` and `to` arguments reference (an `aws_security_group_rule` is the
 * line between two security groups, not a box of its own). A type not listed,
 * or one whose two ends cannot both be resolved, stays a node — the generic
 * fallback every provider gets.
 *
 * Adding a provider is one entry here. Argument names are the provider's own.
 */

export interface EdgeType {
    /** arguments that name the source end, tried in order */
    from: string[];
    /** arguments that name the target end, tried in order */
    to: string[];
}

export const TERRAFORM_EDGE_TYPES: Readonly<Record<string, Readonly<Record<string, EdgeType>>>> = {
    aws: {
        aws_security_group_rule: { from: ['source_security_group_id'], to: ['security_group_id'] },
        aws_vpc_security_group_ingress_rule: { from: ['referenced_security_group_id'], to: ['security_group_id'] },
        aws_vpc_security_group_egress_rule: { from: ['security_group_id'], to: ['referenced_security_group_id'] },
        aws_iam_role_policy_attachment: { from: ['policy_arn'], to: ['role'] },
        aws_iam_user_policy_attachment: { from: ['policy_arn'], to: ['user'] },
        aws_iam_group_policy_attachment: { from: ['policy_arn'], to: ['group'] },
        aws_route_table_association: { from: ['route_table_id'], to: ['subnet_id', 'gateway_id'] },
        aws_lb_target_group_attachment: { from: ['target_group_arn'], to: ['target_id'] },
        aws_lambda_permission: { from: ['source_arn'], to: ['function_name'] },
        aws_volume_attachment: { from: ['volume_id'], to: ['instance_id'] },
    },
    google: {
        google_project_iam_member: { from: ['member'], to: ['project'] },
        google_compute_network_peering: { from: ['network'], to: ['peer_network'] },
    },
    azurerm: {
        azurerm_network_interface_security_group_association: { from: ['network_security_group_id'], to: ['network_interface_id'] },
        azurerm_subnet_network_security_group_association: { from: ['network_security_group_id'], to: ['subnet_id'] },
        azurerm_role_assignment: { from: ['principal_id'], to: ['scope'] },
    },
};

/** The provider a resource type belongs to: its prefix up to the first underscore. */
export function providerOf(type: string): string {
    return type.split('_')[0] ?? type;
}

export function edgeTypeOf(type: string): EdgeType | null {
    return TERRAFORM_EDGE_TYPES[providerOf(type)]?.[type] ?? null;
}
