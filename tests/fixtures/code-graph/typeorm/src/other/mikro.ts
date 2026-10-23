import { Entity, ManyToOne } from '@mikro-orm/core';

import { User } from '../entities/user';

@Entity()
export class Invoice {
    @ManyToOne(() => User)
    customer!: User;
}
