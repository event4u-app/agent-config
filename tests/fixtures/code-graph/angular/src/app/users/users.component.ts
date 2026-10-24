import { Component, inject } from '@angular/core';

import { Logger } from './logger.service';
import { UsersService } from './users.service';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
})
export class UsersComponent {
    private readonly logger = inject(Logger);

    constructor(private readonly users: UsersService) {}

    load(): string[] {
        this.logger.log();
        return this.users.all();
    }
}
