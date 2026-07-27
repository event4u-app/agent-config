// S0.5 fixture — TRUE F9: puppeteer PDF generation inside a Next.js route handler.
import puppeteer from 'puppeteer';

export async function POST(request: Request) {
    const { url } = await request.json();
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
}
