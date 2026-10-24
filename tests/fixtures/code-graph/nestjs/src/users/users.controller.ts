import { Controller, Get, Inject, Post } from '@nestjs/common';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(
        private readonly users: UsersService,
        @Inject('CONFIG') private readonly config: string,
    ) {}

    @Get()
    findAll(): string[] {
        return this.users.findAll();
    }

    @Get(':id')
    findOne(): string {
        return 'one';
    }

    @Post()
    create(): void {}

    helper(): void {}
}
