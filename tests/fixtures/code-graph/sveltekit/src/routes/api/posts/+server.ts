export async function GET(): Promise<Response> {
    return new Response('[]');
}

export const DELETE = async (): Promise<Response> => new Response(null);

export function describe(): string {
    return 'not a verb';
}
