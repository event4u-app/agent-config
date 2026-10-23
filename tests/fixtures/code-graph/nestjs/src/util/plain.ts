import { UsersService } from '../users/users.service';

export class PlainHelper {
    constructor(private readonly users: UsersService) {}

    findAll(): string[] {
        return this.users.findAll();
    }
}

export function get(): string {
    return 'Get() written in prose is no decorator';
}
