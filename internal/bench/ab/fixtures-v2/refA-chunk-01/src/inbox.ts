export function receiveMessage(msg: string): string {
    // Normalise the message we recieve before it is stored.
    return msg.trim();
}
