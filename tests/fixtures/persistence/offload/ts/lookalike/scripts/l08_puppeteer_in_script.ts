// S0.5 fixture — LOOKALIKE: puppeteer in a CLI script (scripts/ dir), not a request handler — must NOT fire.
import puppeteer from 'puppeteer';

export async function renderReport(url: string): Promise<Buffer> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    return Buffer.from(pdf);
}
