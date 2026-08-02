export interface NotificationChannel {
    send(to: string, subject: string, body: string): Promise<void>;
}

export interface WelcomeOptions {
    channel?: 'email' | 'sms' | 'push' | 'webhook';
    retries?: number;
    backoffMs?: number;
    templateOverride?: string;
    locale?: string;
    dryRun?: boolean;
}

export class WelcomeNotifier {
    constructor(private readonly channels: Map<string, NotificationChannel>) {}

    async send(to: string, opts: WelcomeOptions = {}): Promise<void> {
        const channel = this.channels.get(opts.channel ?? 'email');
        if (!channel) throw new Error(`no channel: ${opts.channel}`);
        if (opts.dryRun) return;
        await channel.send(to, 'Welcome', opts.templateOverride ?? 'Welcome aboard.');
    }
}
