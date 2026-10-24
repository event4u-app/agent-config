import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Post } from './post';

@Entity('app_users')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @OneToMany(() => Post, (post) => post.author)
    posts!: Post[];
}
