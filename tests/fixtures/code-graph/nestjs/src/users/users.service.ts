import { Injectable } from '@nestjs/common';

import { AuditLog } from './audit.log';

@Injectable()
export class UsersService {
    constructor(private readonly audit: AuditLog) {}

    findAll(): string[] {
        return [];
    }
}
