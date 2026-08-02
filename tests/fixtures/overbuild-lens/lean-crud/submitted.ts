import { invoices } from './db';
import type { Request, Response } from './http';

export async function getInvoice(req: Request, res: Response): Promise<void> {
    const invoice = await invoices.findForTenant(req.params.id, req.auth.tenantId);
    if (!invoice) {
        res.status(404).json({ error: 'not found' });
        return;
    }
    res.json(invoice);
}
