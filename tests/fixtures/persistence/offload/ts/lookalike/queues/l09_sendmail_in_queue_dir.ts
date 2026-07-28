// S0.5 fixture — LOOKALIKE: sendMail in a queue-processor directory — worker context, must NOT fire.
import { transporter } from '../../mailer';

export async function handleWelcomeMail(data: { email: string }): Promise<void> {
    await transporter.sendMail({ to: data.email, subject: 'Welcome', text: 'Hi' });
}
