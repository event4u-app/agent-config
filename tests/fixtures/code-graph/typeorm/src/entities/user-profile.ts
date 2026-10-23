import { Column, Entity, OneToOne } from 'typeorm';

import { User } from './user';

@Entity()
export class UserProfile {
    @Column()
    bio!: string;

    @OneToOne(() => User)
    user!: User;
}

@Entity()
export class HTTPLog {
    @Column()
    line!: string;
}
