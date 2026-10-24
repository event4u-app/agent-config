export async function GET(): Promise<Response> {
    return new Response('[]');
}

export const POST = async (): Promise<Response> => new Response(null, { status: 201 });

function helper(): string {
    return 'GET';
}

export function format(): string {
    return helper();
}
