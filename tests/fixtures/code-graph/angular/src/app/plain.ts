import { UsersService } from './users/users.service';

export class Report {
    constructor(private readonly users: UsersService) {}
}
