// S0.5 fixture — LOOKALIKE: sendMail inside a bullmq Worker processor — worker context, must NOT fire.
import { Worker } from 'bullmq';
import { transporter } from '../mailer';

export const mailWorker = new Worker('mail', async (job) => {
    await transporter.sendMail({ to: job.data.email, subject: 'Welcome', text: 'Hi' });
});
